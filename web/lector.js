const cartasA1 = new Set(['06NR', '08NR', '14RR'])

export function interpretar(bloque) {
  if (!(bloque instanceof Uint8Array) || bloque.length !== 16) {
    throw new Error('Bloque inválido. Se esperaban exactamente 16 bytes.')
  }
  const caracteres = String.fromCharCode(...bloque).match(/[0-9A-Z]/g) ?? []
  const carta = caracteres.slice(0, 4).join('')
  if (!cartasA1.has(carta)) throw new Error('Identificador ajeno a las tres muestras de A1.')
  return carta
}

// Sólo se exponen etapa y estado. Los errores del SDK pueden contener tramas.
export async function comando(etapa, operacion) {
  try {
    return await operacion()
  } catch (error) {
    const estado = error?.status
    const detalle = new Map([[1, 'tarjeta ausente'], [2, 'error de comunicación'],
      [3, 'CRC inválido'], [4, 'colisión'], [6, 'autenticación rechazada'],
      [0x66, 'modo incorrecto'], [0x67, 'comando no admitido']])
    let motivo = 'fallo de transporte o respuesta incompatible'
    if (Number.isInteger(estado)) {
      motivo = 'estado 0x' + estado.toString(16).padStart(2, '0') + ' · ' + (detalle.get(estado) ?? 'error del dispositivo')
    } else if (/timeout/i.test(error?.message)) {
      motivo = 'tiempo de espera agotado'
    } else if (/disconnect/i.test(error?.message)) {
      motivo = 'desconexión BLE'
    } else if ([error?.cause?.name, error?.cause?.cause?.name].includes('NotFoundError')) {
      motivo = 'selección cancelada o dispositivo ausente'
    }
    throw Object.assign(new Error(etapa + ' · ' + motivo), {
      status: estado, timeout: !Number.isInteger(estado) && /timeout/i.test(error?.message),
      transporte: !Number.isInteger(estado) && !/^buf must be a Buffer with length of /.test(error?.message)
    })
  }
}

export async function preparar(ultra, sdk, vigente, informar, ejecutar = comando) {
  const consultar = (nombre, funcion) => {
    vigente()
    return ejecutar(nombre, funcion)
  }
  if (ultra.isDfu()) throw new Error('Equipo en modo DFU. Se requiere el modo de aplicación.')
  const version = await consultar('GET_APP_VERSION (1000)', () => ultra.cmdGetAppVersion())
  informar('Firmware ' + version)
  if (!/^2\.\d+$/.test(version)) throw new Error('Firmware fuera del rango 2.x del SDK: ' + version)
  const revision = await consultar('GET_GIT_VERSION (1017)', () => ultra.cmdGetGitVersion())
  const modelo = await consultar('GET_DEVICE_MODEL (1033)', () => ultra.cmdGetDeviceModel())
  if (modelo !== sdk.DeviceModel.ULTRA) throw new Error('GET_DEVICE_MODEL (1033) · modelo inesperado: ' + modelo)
  const capacidades = await consultar('GET_DEVICE_CAPABILITIES (1035)', () => ultra.cmdGetSupportedCmds())
  vigente()
  informar('Modelo ' + (sdk.DeviceModel[modelo] ?? modelo) + ' · firmware ' + version + ' · ' + revision +
    '\nComandos declarados: ' + [...capacidades].sort((a, b) => a - b).join(', '))
  const requerir = id => {
    if (!capacidades.has(id)) throw new Error('Capacidad requerida ausente: ' + id)
  }
  for (const id of [1002, 2000, 2008]) requerir(id)
  const modo = () => consultar('GET_DEVICE_MODE (1002)', () => ultra.cmdGetDeviceMode())
  const inicial = await modo()
  if (![sdk.DeviceMode.TAG, sdk.DeviceMode.READER].includes(inicial)) throw new Error('GET_DEVICE_MODE (1002) · modo inesperado: ' + inicial)
  if (inicial === sdk.DeviceMode.TAG) {
    requerir(1001)
    await consultar('CHANGE_DEVICE_MODE (1001)', () => ultra.cmdChangeDeviceMode(sdk.DeviceMode.READER))
    if (await modo() !== sdk.DeviceMode.READER) throw new Error('El dispositivo no confirmó el modo lector.')
  }
  vigente()
  return capacidades
}

export async function leer(ultra, sdk, clave, vigente, ejecutar = comando) {
  vigente()
  let tarjetas
  try {
    tarjetas = await ejecutar('HF14A_SCAN (2000)', () => ultra.cmdHf14aScan())
  } catch (error) {
    if (error.status !== 1) throw error
    tarjetas = []
  }
  vigente()
  if (tarjetas.length === 0) return null
  if (tarjetas.length !== 1) throw new Error('Presentá una sola tarjeta Camer Deck.')
  if (tarjetas[0].sak?.length !== 1 || tarjetas[0].sak[0] !== 0x08) {
    throw new Error('La selección no corresponde a MIFARE Classic 1K (SAK 08).')
  }
  const bloque = await ejecutar('MF1_READ_ONE_BLOCK (2008)', () =>
    ultra.cmdMf1ReadBlock({ block: 1, keyType: sdk.Mf1KeyType.KEY_A, key: clave }))
  vigente()
  return interpretar(bloque)
}
