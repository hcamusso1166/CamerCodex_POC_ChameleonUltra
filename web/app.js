import { comando, leer, preparar } from './lector.js'

const el = id => document.getElementById(id)
const sdk = globalThis.ChameleonUltraJS
const bluetooth = navigator.bluetooth
const disponible = Boolean(globalThis.isSecureContext && bluetooth && sdk?.WebbleAdapter)
const intervaloBateria = 45000
let sesion = null
let aceptadas = 0

function controles() {
  el('conectar').disabled = !disponible || Boolean(sesion)
  el('desconectar').disabled = !sesion?.lista
  el('leer').disabled = !sesion?.lista
  el('leer').textContent = sesion?.lectura ? 'Detener lectura' : 'Iniciar lectura continua'
  el('clave').disabled = el('pausa').disabled = Boolean(sesion?.lectura)
}

function vigente(s) {
  if (sesion !== s || s.cerrando || !s.ultra.isConnected() || !s.adaptador.device?.gatt?.connected) {
    throw Object.assign(new Error('Desconexión BLE.'), { transporte: true })
  }
}

async function cerrar(s, mensaje = '', fallo = false) {
  if (!s || sesion !== s || s.cerrando) return
  s.cerrando = true
  s.lista = false
  s.lectura = null
  clearTimeout(s.timer)
  controles()
  el('clave').value = 'FFFFFFFFFFFF'
  el('lector').textContent = 'Detenido'
  el('bateria').textContent = 'Batería no disponible'
  el('error').textContent = mensaje
  try {
    if (s.ultra.isConnected()) await s.ultra.disconnect()
  } catch {
    // El enlace puede haberse perdido antes de completar el cierre del SDK.
  } finally {
    s.adaptador.device?.gatt?.disconnect()
    sesion = null
    el('estado').textContent = fallo ? 'Error · desconectado' : 'Desconectado'
    controles()
  }
}

async function bateria(s) {
  try {
    const { level, voltage } = await comando('GET_BATTERY_INFO (1025)', () => s.ultra.cmdGetBatteryInfo())
    vigente(s)
    if (!Number.isInteger(level) || level < 0 || level > 100 || !Number.isInteger(voltage) || voltage <= 0) {
      throw new Error('Medición inválida')
    }
    el('bateria').textContent = level + ' % estimado · ' + voltage + ' mV'
  } catch (error) {
    vigente(s)
    // El SDK correlaciona por comando. Tras timeout no se repite 1025 en esta sesión.
    if (error.timeout || [0x67, 0x69].includes(error.status)) s.proximaBateria = Infinity
    else if (error.transporte) throw error
    el('bateria').textContent = 'Batería no disponible'
  }
}

function programar(s, demora) {
  clearTimeout(s.timer)
  if (s.lista && Number.isFinite(demora)) s.timer = setTimeout(() => ciclo(s), Math.max(0, demora))
}

async function ciclo(s) {
  if (!s.lista || s.ocupado) return
  s.ocupado = true
  clearTimeout(s.timer)
  try {
    vigente(s)
    if (Date.now() >= s.proximaBateria) {
      s.proximaBateria = Date.now() + intervaloBateria
      await bateria(s)
    }
    vigente(s)
    const lectura = s.lectura
    if (!lectura) return
    const comprobar = () => {
      vigente(s)
      if (s.lectura !== lectura) throw new Error('Lectura detenida')
    }
    const clave = sdk.Buffer.from(el('clave').value, 'hex')
    try {
      const carta = await leer(s.ultra, sdk, clave, comprobar)
      comprobar()
      el('error').textContent = ''
      el('lector').textContent = carta ? 'Leyendo · tarjeta presente' : 'Leyendo · esperando tarjeta'
      if (!carta) {
        if (++lectura.ausencias >= 2) lectura.anterior = null
      } else {
        lectura.ausencias = 0
        if (lectura.anterior !== carta) {
          lectura.anterior = carta
          el('resultado').textContent = carta
          el('contador').textContent = String(++aceptadas)
        }
      }
    } catch (error) {
      if (error.transporte) throw error
      comprobar()
      lectura.ausencias = 0
      el('lector').textContent = 'Recuperando · se reintentará la lectura'
      el('error').textContent = error.message
    } finally {
      clave.fill(0)
    }
  } catch (error) {
    if (error.transporte) await cerrar(s, error.message + ' Volvé a conectar.', true)
  } finally {
    s.ocupado = false
    programar(s, s.lectura?.pausa ?? (s.proximaBateria - Date.now()))
  }
}

el('conectar').onclick = async () => {
  if (sesion) return
  const ultra = new sdk.ChameleonUltra()
  const adaptador = new sdk.WebbleAdapter()
  const s = sesion = { ultra, adaptador, proximaBateria: Infinity }
  controles()
  el('info').textContent = el('error').textContent = ''
  el('estado').textContent = 'Buscando dispositivo'
  // Delegar el selector al navegador con los filtros y servicios del SDK.
  adaptador.bluetooth = {
    getAvailability: () => bluetooth.getAvailability(),
    requestDevice: async opciones => {
      const device = await bluetooth.requestDevice(opciones)
      el('estado').textContent = 'Conectando'
      return device
    }
  }
  ultra.emitter.on('disconnected', () => {
    if (s.lista) void cerrar(s, 'Desconexión BLE. Volvé a conectar.')
  })
  try {
    await comando('Adaptador BLE', () => ultra.use(adaptador))
    await comando('Conexión GATT', () => ultra.connect())
    const capacidades = await preparar(ultra, sdk, () => vigente(s), datos => {
      el('info').textContent = (adaptador.device.name ?? 'Chameleon') + '\n' + datos
    })
    let suspension = 'no disponible'
    if (capacidades.has(1039)) {
      try {
        suspension = await comando('GET_SLEEP_TIMEOUT (1039)', () => ultra.cmdGetSleepTimeout()) + ' s'
      } catch (error) {
        vigente(s)
        if (error.transporte && !error.timeout) throw error
      }
    }
    vigente(s)
    el('info').textContent += '\nSuspensión configurada: ' + suspension
    s.proximaBateria = capacidades.has(1025) ? 0 : Infinity
    s.lista = true
    el('estado').textContent = 'Conectado'
    el('lector').textContent = 'Listo'
    controles()
    await ciclo(s)
  } catch (error) {
    await cerrar(s, error.message, true)
  }
}

el('leer').onclick = () => {
  const s = sesion
  if (!s?.lista) return
  if (s.lectura) {
    s.lectura = null
    el('lector').textContent = 'Detenido'
    el('error').textContent = ''
    programar(s, s.proximaBateria - Date.now())
  } else {
    if (!/^[0-9a-fA-F]{12}$/.test(el('clave').value)) {
      el('error').textContent = 'Ingresá los 12 dígitos hexadecimales de la clave A.'
      return
    }
    const pausa = Number(el('pausa').value)
    if (!Number.isInteger(pausa) || pausa < 250 || pausa > 400) {
      el('error').textContent = 'Elegí una pausa entre 250 y 400 ms.'
      return
    }
    s.lectura = { pausa, anterior: null, ausencias: 0 }
    el('lector').textContent = 'Leyendo'
    el('error').textContent = ''
  }
  controles()
  if (s.lectura) return ciclo(s)
}
el('desconectar').onclick = () => cerrar(sesion)
controles()
if (!disponible) el('error').textContent = 'Se requiere Chrome con Web Bluetooth, contexto seguro y SDK local cargado.'
if (disponible && bluetooth.getDevices) {
  bluetooth.getDevices().then(devices => {
    const nombres = devices.map(d => d.name).filter(n => /chameleon|^C[UL]-/i.test(n ?? ''))
    el('permisos').textContent = nombres.length ? 'Autorizados por nombre: ' + nombres.join(', ') : 'Sin Chameleon identificable por nombre.'
  }).catch(() => {})
}
