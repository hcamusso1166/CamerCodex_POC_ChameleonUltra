import { comando, leer, preparar } from './lector.js'
import { Diagnostico } from './diagnostico.js'

const el = id => document.getElementById(id)
const sdk = globalThis.ChameleonUltraJS
const bluetooth = navigator.bluetooth
const disponible = Boolean(globalThis.isSecureContext && bluetooth && sdk?.WebbleAdapter)
const intervaloBateria = 45000
const intervaloSupervision = 10000
const consultaSupervision = 'Supervisión GET_APP_VERSION (1000)'
let sesion = null
let aceptadas = 0
let ultimaSesion
let ultimoCierre = ''
let equipoAnterior
let relojPanel

const periodica = () => el('periodica').value !== 'no'
const gatt = s => s?.device ? (s.device.gatt?.connected ? 'conectado' : 'desconectado') : 'sin comprobar'
function mostrar() {
  const s = ultimaSesion
  if (!s) return
  el('resumen').textContent = s.diag.resumen(el('estado').textContent, gatt(s), periodica(), ultimoCierre)
  el('registro').textContent = s.diag.eventos.join('\n')
}
el('diagnostico').ontoggle = () => {
  clearInterval(relojPanel)
  if (el('diagnostico').open) {
    mostrar()
    relojPanel = setInterval(mostrar, 1000)
  }
}
el('copiar').onclick = async () => {
  mostrar()
  try {
    await navigator.clipboard.writeText(el('resumen').textContent + '\n\n' + el('registro').textContent)
    el('copia').textContent = 'Diagnóstico copiado.'
  } catch {
    el('copia').textContent = 'Seleccioná el resumen y los eventos para copiarlos manualmente.'
  }
}

function evento(s, texto, indicio = false) {
  s.diag.anotar(texto, gatt(s), indicio)
}
async function consultar(s, nombre, operacion) {
  const inicio = performance.now()
  const latencia = () => nombre === consultaSupervision ? ' · latencia ' + Math.round(performance.now() - inicio) + ' ms' : ''
  s.diag.operacion = nombre
  evento(s, 'Inicio ' + nombre)
  try {
    const valor = await comando(nombre, operacion)
    if (!s.cerrando) s.diag.confirmarRespuesta()
    const version = nombre === consultaSupervision && /^\d{1,3}\.\d{1,3}$/.test(valor) ? ' ' + valor : ''
    evento(s, 'Fin ' + nombre + (s.cerrando ? ' · respuesta descartada' : ' · respuesta válida' + version) + latencia())
    return valor
  } catch (error) {
    const respondio = Number.isInteger(error.status)
    if (respondio && !s.cerrando) s.diag.confirmarRespuesta()
    const resultado = respondio ? 'respuesta con estado ' + error.status : error.timeout ? 'timeout' : 'fallo'
    evento(s, 'Fin ' + nombre + ' · ' + resultado + latencia(), error.transporte)
    throw error
  }
}

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

async function cerrar(s, mensaje = '', origen = 'usuario') {
  if (!s || sesion !== s || s.cerrando) return
  s.cerrando = true
  if (origen === 'usuario') evento(s, 'Cierre solicitado por el usuario', true)
  if (origen === 'aplicación') evento(s, 'Cierre iniciado por la aplicación', true)
  s.lista = false
  el('supervision').value = 'no'
  s.lectura = null
  clearTimeout(s.timer)
  controles()
  el('clave').value = 'FFFFFFFFFFFF'
  el('lector').textContent = 'Detenido'
  el('bateria').textContent = 'Batería no disponible'
  el('error').textContent = mensaje
  try {
    if (!['SDK', 'GATT'].includes(origen) && s.ultra.isConnected()) await s.ultra.disconnect()
  } catch {
    // El enlace puede haberse perdido antes de completar el cierre del SDK.
  } finally {
    if (s.device?.gatt?.connected) s.device.gatt.disconnect()
    s.diag.fin ??= performance.now()
    ultimoCierre = origen + ' · ' + (s.diag.primerIndicio || 'sin indicio previo')
    const duracion = s.diag.conexion === null ? 'sin conexión confirmada' :
      Math.round(s.diag.fin - s.diag.conexion) + ' ms desde conexión'
    evento(s, 'Sesión cerrada · ' + origen + ' · ' + duracion)
    sesion = null
    el('estado').textContent = origen === 'aplicación' ? 'Error · desconectado' : 'Desconectado'
    mostrar()
    controles()
  }
}

async function bateria(s) {
  try {
    const { level, voltage } = await consultar(s, 'GET_BATTERY_INFO (1025)', () => s.ultra.cmdGetBatteryInfo())
    vigente(s)
    if (!Number.isInteger(level) || level < 0 || level > 100 || !Number.isInteger(voltage) || voltage <= 0) {
      throw new Error('Medición inválida')
    }
    el('bateria').textContent = s.diag.bateria = level + ' % estimado · ' + voltage + ' mV'
  } catch (error) {
    if (error.transporte) throw error
    vigente(s)
    if ([0x67, 0x69].includes(error.status)) {
      s.admiteBateria = false
      s.proximaBateria = Infinity
    }
    el('bateria').textContent = s.diag.bateria = 'Batería no disponible'
  }
}

function programar(s) {
  clearTimeout(s.timer)
  if (!s.lista || s.ocupado) return
  const demora = s.lectura?.pausa ?? (Math.min(s.proximaBateria, s.proximaSupervision) - Date.now())
  if (Number.isFinite(demora)) s.timer = setTimeout(() => ciclo(s), Math.max(0, demora))
}

async function ciclo(s) {
  if (!s.lista || s.ocupado) return
  s.ocupado = true
  clearTimeout(s.timer)
  try {
    vigente(s)
    if (Date.now() >= s.proximaBateria) {
      s.proximaBateria = periodica() ? Date.now() + intervaloBateria : Infinity
      await bateria(s)
    }
    vigente(s)
    if (Date.now() >= s.proximaSupervision) {
      try {
        await s.consultar(consultaSupervision, () => s.ultra.cmdGetAppVersion())
      } catch (error) {
        if (error.transporte) throw error
        vigente(s)
        el('supervision').value = 'no'
        evento(s, 'Supervisión desactivada por error de comando')
        s.diag.supervision = 'desactivada por error de comando'
      }
      vigente(s)
      s.proximaSupervision = el('supervision').value === 'si' ? Date.now() + intervaloSupervision : Infinity
    }
    const lectura = s.lectura
    if (!lectura) return
    const comprobar = () => {
      vigente(s)
      if (s.lectura !== lectura) throw new Error('Lectura detenida')
    }
    const clave = sdk.Buffer.from(el('clave').value, 'hex')
    try {
      const carta = await leer(s.ultra, sdk, clave, comprobar, s.consultar)
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
    if (error.transporte) await cerrar(s, error.message + ' Volvé a conectar.', 'aplicación')
  } finally {
    s.ocupado = false
    programar(s)
  }
}

el('periodica').onchange = () => {
  const s = sesion
  if (!s) return
  evento(s, 'Batería periódica ' + (periodica() ? 'activada' : 'desactivada'))
  if (!s.lista || !s.admiteBateria) return
  s.proximaBateria = periodica() ? Date.now() + intervaloBateria : Infinity
  if (!s.lectura) programar(s)
}

function configurarSupervision(s) {
  const activa = el('supervision').value === 'si'
  s.diag.supervision = activa ? 'activada · 10 s' : 'desactivada'
  s.proximaSupervision = activa ? Date.now() + intervaloSupervision : Infinity
  evento(s, 'Supervisión BLE experimental ' + s.diag.supervision)
}
el('supervision').onchange = () => {
  if (!sesion?.lista) return
  configurarSupervision(sesion)
  if (!sesion.lectura) programar(sesion)
}

el('conectar').onclick = async () => {
  if (sesion) return
  const ultra = new sdk.ChameleonUltra()
  const adaptador = new sdk.WebbleAdapter()
  ultimaSesion?.device?.removeEventListener('gattserverdisconnected', ultimaSesion.alPerderGatt)
  const s = sesion = ultimaSesion = { ultra, adaptador, diag: new Diagnostico(), proximaBateria: Infinity }
  s.consultar = (nombre, fn) => consultar(s, nombre, fn)
  evento(s, 'Inicio de sesión · batería periódica ' + (periodica() ? 'activada' : 'desactivada'))
  el('copia').textContent = ''
  controles()
  el('info').textContent = el('error').textContent = ''
  el('estado').textContent = 'Buscando dispositivo'
  // Delegar el selector al navegador con los filtros y servicios del SDK.
  adaptador.bluetooth = {
    getAvailability: () => bluetooth.getAvailability(),
    requestDevice: async opciones => {
      const reutilizar = el('reutilizar').checked && equipoAnterior
      evento(s, reutilizar ? 'Solicitud de dispositivo autorizado' : 'Solicitud de dispositivo al navegador')
      const device = reutilizar ? equipoAnterior : await bluetooth.requestDevice(opciones)
      s.device = device
      s.alPerderGatt = () => {
        evento(s, 'gattserverdisconnected', true)
        s.diag.fin ??= performance.now()
        if (s.lista && !s.cerrando) void cerrar(s, 'Desconexión GATT. Volvé a conectar.', 'GATT')
        mostrar()
      }
      device.addEventListener('gattserverdisconnected', s.alPerderGatt, { once: true })
      el('estado').textContent = 'Conectando'
      return device
    }
  }
  ultra.emitter.on('disconnected', () => {
    evento(s, 'SDK disconnected', true)
    if (s.lista && !s.cerrando) void cerrar(s, 'Desconexión notificada por el SDK. Volvé a conectar.', 'SDK')
    mostrar()
  })
  try {
    ultra.addHook('disconnect', async (_contexto, siguiente) => {
      evento(s, 'SDK comienza disconnect', true)
      return siguiente()
    })
    await comando('Adaptador BLE', () => ultra.use(adaptador))
    await comando('Conexión GATT', () => ultra.connect())
    if (s.diag.primerIndicio) throw new Error('Conexión interrumpida durante el inicio.')
    vigente(s)
    s.diag.conexion = performance.now()
    evento(s, 'Conexión GATT establecida y verificada')
    const capacidades = await preparar(ultra, sdk, () => vigente(s), datos => {
      if (sesion === s) el('info').textContent = datos
    }, s.consultar)
    evento(s, 'Modo lector confirmado')
    equipoAnterior = s.device
    let suspension = 'no disponible'
    if (capacidades.has(1039)) {
      try {
        suspension = await s.consultar('GET_SLEEP_TIMEOUT (1039)', () => ultra.cmdGetSleepTimeout()) + ' s'
      } catch (error) {
        vigente(s)
        if (error.transporte) throw error
      }
    }
    vigente(s)
    el('info').textContent += '\nSuspensión configurada: ' + suspension
    s.diag.suspension = suspension
    evento(s, 'Suspensión configurada · ' + suspension)
    s.admiteBateria = capacidades.has(1025)
    s.proximaBateria = s.admiteBateria ? 0 : Infinity
    configurarSupervision(s)
    s.lista = true
    el('estado').textContent = 'Conectado'
    el('lector').textContent = 'Listo'
    controles()
    await ciclo(s)
  } catch (error) {
    await cerrar(s, error.message, 'aplicación')
  }
}

el('leer').onclick = () => {
  const s = sesion
  if (!s?.lista) return
  if (s.lectura) {
    s.lectura = null
    el('lector').textContent = 'Detenido'
    el('error').textContent = ''
    programar(s)
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
    const compatibles = devices.filter(d => /^ChameleonUltra$/i.test(d.name ?? ''))
    if (compatibles.length === 1) equipoAnterior ??= compatibles[0]
    el('permisos').textContent = 'Equipos autorizados con nombre ChameleonUltra · ' + compatibles.length
  }).catch(() => {})
}
