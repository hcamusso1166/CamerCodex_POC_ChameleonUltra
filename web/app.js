import { comando, leer, preparar } from './lector.js'

const el = id => document.getElementById(id)
const sdk = globalThis.ChameleonUltraJS
let sesion = null
let fase = 'Desconectado'
const disponible = Boolean(isSecureContext && navigator.bluetooth && sdk?.WebbleAdapter)
function estado(valor) {
  fase = valor
  el('estado').textContent = valor
  el('conectar').disabled = !disponible || valor !== 'Desconectado'
  el('leer').disabled = valor !== 'Conectado · modo lector'
  el('desconectar').disabled = !['Conectado · modo lector', 'Leyendo tarjeta…'].includes(valor)
}
function vigente(actual) {
  if (sesion !== actual || !actual.ultra.isConnected() || !actual.adaptador.device?.gatt?.connected) {
    throw new Error('Desconexión BLE durante la operación.')
  }
}
async function cerrar(actual, mensaje) {
  if (sesion !== actual) return
  sesion = null
  estado('Desconectando…')
  el('clave').value = ''
  el('resultado').textContent = '—'
  el('error').textContent = mensaje
  try {
    if (actual.ultra.isConnected()) await actual.ultra.disconnect()
  } finally {
    actual.adaptador.device?.gatt?.disconnect()
    estado('Desconectado')
  }
}
el('conectar').onclick = async () => {
  el('error').textContent = ''
  el('info').textContent = ''
  const ultra = new sdk.ChameleonUltra()
  const adaptador = new sdk.WebbleAdapter()
  const actual = sesion = { ultra, adaptador }
  estado('Conectando…')
  // Durante el diagnóstico inicial el comando pendiente conserva su error de etapa.
  ultra.emitter.on('disconnected', () => {
    if (sesion === actual && fase !== 'Conectando…') void cerrar(actual, 'Desconexión BLE.')
  })
  try {
    await comando('Adaptador BLE', () => ultra.use(adaptador))
    await comando('Conexión GATT', () => ultra.connect())
    await preparar(ultra, sdk, () => vigente(actual), datos => {
      el('info').textContent = (adaptador.device.name ?? 'Chameleon') + '\n' + datos
    })
    vigente(actual)
    estado('Conectado · modo lector')
  } catch (error) {
    await cerrar(actual, error.message)
  }
}
el('leer').onclick = async () => {
  const actual = sesion
  el('resultado').textContent = '—'
  el('error').textContent = ''
  if (!/^[0-9a-fA-F]{12}$/.test(el('clave').value)) {
    el('error').textContent = 'Ingresá los 12 dígitos hexadecimales de la clave A.'
    return
  }
  const clave = sdk.Buffer.from(el('clave').value, 'hex')
  estado('Leyendo tarjeta…')
  try {
    const carta = await leer(actual.ultra, sdk, clave, () => vigente(actual))
    vigente(actual)
    el('resultado').textContent = carta
    estado('Conectado · modo lector')
  } catch (error) {
    await cerrar(actual, error.message)
  } finally {
    clave.fill(0)
  }
}
el('desconectar').onclick = () => cerrar(sesion, '')
estado(fase)
if (!disponible) el('error').textContent = 'Se requiere Chrome con Web Bluetooth, contexto seguro y SDK local cargado.'
