import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import * as sdk from 'chameleon-ultra.js'
import WebbleAdapter from 'chameleon-ultra.js/plugin/WebbleAdapter'

const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8')
let numero = 0
function pendiente() {
  let resolver
  const promesa = new Promise(resolve => { resolver = resolve })
  return { promesa, resolver }
}

async function pantalla(t, opciones = {}) {
  const campos = new Map()
  for (const etiqueta of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const contenido = html.slice(etiqueta.index + etiqueta[0].length).split('<')[0]
    campos.set(etiqueta[1], { value: etiqueta[0].match(/ value="([^"]+)"/)?.[1] ?? '', textContent: contenido })
  }
  const el = id => campos.get(id)
  const timers = new Map()
  let reloj = 1000
  let idTimer = 0
  let ultra
  const llamadas = []
  const device = Object.assign(new EventTarget(), { name: 'ChameleonUltra-PRIVADO',
    id: 'ID-PRIVADO', gatt: { connected: false, disconnect() { this.connected = false } } })
  let solicitudes = 0
  let copiado
  class Ultra {
    emitter = new EventEmitter()
    constructor() { ultra = this }
    async use(a) { this.a = a }
    addHook(nombre, fn) { if (nombre === 'disconnect') this.antesDeCerrar = fn }
    async connect() {
      this.a.device = await this.a.bluetooth.requestDevice({})
      device.gatt.connected = true
    }
    isConnected() { return device.gatt.connected }
    async disconnect() { await this.antesDeCerrar({}, async () => {
      device.gatt.disconnect()
      this.emitter.emit('disconnected')
    }) }
    isDfu() { return false }
    async cmdGetAppVersion() { return '2.1' }
    async cmdGetDeviceModel() { return sdk.DeviceModel.ULTRA }
    async cmdGetGitVersion() { return 'sintético' }
    async cmdGetSupportedCmds() { return new Set([1002, 2000, 2008, 1039, ...(opciones.bateria ? [1025] : [])]) }
    async cmdGetSleepTimeout() { return 8 }
    async cmdGetDeviceMode() { return sdk.DeviceMode.READER }
    async cmdHf14aScan() {
      llamadas.push('scan')
      return opciones.scan ? opciones.scan() : [{ sak: [8] }]
    }
    async cmdMf1ReadBlock({ key }) {
      assert.equal(key.toString('hex'), 'ffffffffffff')
      llamadas.push('bloque')
      const carta = opciones.bloque ? await opciones.bloque() : '06NR'
      return sdk.Buffer.from(carta.padEnd(16, '\0'))
    }
    async cmdGetBatteryInfo() { llamadas.push('batería'); return opciones.bateria() }
  }
  // En el ensayo de integración sólo se simulan la radio y los comandos de preparación.
  class UltraConTransporteReal extends sdk.ChameleonUltra {
    constructor() {
      super()
      ultra = this
      for (const nombre of Object.getOwnPropertyNames(Ultra.prototype).filter(n => n.startsWith('cmd'))) {
        this[nombre] = Ultra.prototype[nombre]
      }
    }
  }
  if (opciones.sdkReal) {
    device.gatt.connected = true
    const uuid = n => '6e40000' + n + '-b5a3-f393-e0a9-e50e24dcca9e'
    const tx = Object.assign(new EventTarget(), { uuid: uuid(3), async startNotifications() {} })
    device.gatt.getPrimaryServices = async () => [
      { uuid: uuid(1), getCharacteristics: async () => [tx, { uuid: uuid(2) }] }
    ]
  }
  const bluetooth = { getAvailability: async () => true,
    requestDevice: async () => { solicitudes++; return device }, getDevices: async () => [device] }
  for (const [nombre, value] of Object.entries({
    isSecureContext: true, navigator: { bluetooth, clipboard: { writeText: async v => { copiado = v } } },
    document: { getElementById: el },
    ChameleonUltraJS: { ...sdk, ChameleonUltra: opciones.sdkReal ? UltraConTransporteReal : Ultra,
      WebbleAdapter: opciones.sdkReal ? WebbleAdapter : class {} },
    setTimeout: (fn, ms) => { timers.set(++idTimer, { fn, ms }); return idTimer },
    clearTimeout: id => timers.delete(id)
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, nombre)
    Object.defineProperty(globalThis, nombre, { configurable: true, value })
    t.after(() => original ? Object.defineProperty(globalThis, nombre, original) : Reflect.deleteProperty(globalThis, nombre))
  }
  t.mock.method(Date, 'now', () => reloj)
  await import('../web/app.js?ensayo=' + ++numero)
  assert.equal(el('leer').disabled, true)
  const click = id => el(id).onclick()
  if (opciones.periodica === false) el('periodica').value = 'no'
  await click('conectar')
  if (!opciones.falloInicial) assert.equal(el('estado').textContent, 'Conectado')
  assert.match(el('info').textContent, /8 s/)
  return { el, click, llamadas, timers, device, get solicitudes() { return solicitudes },
    async informe() { await click('copiar'); return copiado }, get ultra() { return ultra },
    avanzar: ms => { reloj += ms },
    async siguiente() {
      assert.equal(timers.size, 1)
      const [id, { fn, ms }] = timers.entries().next().value
      timers.delete(id)
      reloj += ms
      await fn()
    } }
}

test('ausencias repetidas por estado RF y lista vacía, seguidas de tres cartas', async t => {
  const cartas = ['06NR', '08NR', '14RR']
  let scans = 0
  const p = await pantalla(t, { scan() {
    if (++scans === 1) throw Object.assign(new Error(), { status: 1 })
    return scans <= 3 ? [] : [{ sak: [8] }]
  }, bloque: () => cartas.shift() })
  await p.click('leer')
  for (let i = 0; i < 2; i++) await p.siguiente()
  assert.equal(p.el('estado').textContent, 'Conectado')
  for (const carta of ['06NR', '08NR', '14RR']) {
    await p.siguiente()
    assert.equal(p.el('resultado').textContent, carta)
  }
  assert.equal(p.el('contador').textContent, '3')
})

test('tarjeta sostenida, ausencia aislada y retirada confirmada', async t => {
  const presencia = [1, 1, 0, 1, 0, 0, 1]
  const p = await pantalla(t, { scan: () => presencia.shift() ? [{ sak: [8] }] : [] })
  await p.click('leer')
  while (presencia.length) await p.siguiente()
  assert.equal(p.el('contador').textContent, '2')
})

test('detener durante escaneo descarta el resultado y permite reiniciar', async t => {
  const espera = pendiente()
  const p = await pantalla(t, { scan: () => espera.promesa })
  const primera = p.click('leer')
  await p.click('leer')
  espera.resolver([{ sak: [8] }])
  await primera
  assert.deepEqual(p.llamadas, ['scan'])
  assert.equal(p.timers.size, 0)
  await p.click('leer')
  assert.equal(p.el('contador').textContent, '1')
})

test('desconexión en vuelo, reconexión y respuesta de la sesión anterior', async t => {
  const espera = pendiente()
  const p = await pantalla(t, { scan: () => espera.promesa })
  const primera = p.click('leer')
  await p.ultra.disconnect()
  assert.equal(p.el('estado').textContent, 'Desconectado')
  await p.click('conectar')
  espera.resolver([{ sak: [8] }])
  await primera
  assert.equal(p.el('estado').textContent, 'Conectado')
  assert.deepEqual(p.llamadas, ['scan'])
})

test('fallo de autenticación recuperable y mensaje sin trama', async t => {
  let fallo = true
  const p = await pantalla(t, { bloque() {
    if (fallo) throw Object.assign(new Error('trama privada'), { status: 6 })
    return '08NR'
  } })
  await p.click('leer')
  assert.match(p.el('error').textContent, /2008.*0x06/)
  assert.doesNotMatch(p.el('error').textContent, /privada/)
  fallo = false
  await p.siguiente()
  assert.equal(p.el('resultado').textContent, '08NR')
})

test('timeout del SDK exige nueva sesión y aísla la respuesta tardía', async t => {
  const p = await pantalla(t, { scan() { throw new Error('read resp timeout (5000ms)') } })
  const anterior = p.ultra
  await p.click('leer')
  assert.match(p.el('error').textContent, /tiempo de espera/)
  assert.match(p.el('registro').textContent, /timeout.*GATT conectado[\s\S]*Cierre iniciado por la aplicación/)
  assert.equal(p.timers.size, 0)
  await p.click('conectar')
  anterior.emitter.emit('resp', { cmd: 2000 })
  assert.notEqual(p.ultra, anterior)
  assert.equal(p.el('resultado').textContent, '—')
})

test('batería inicial y periódica espera el fin de la operación RFID', async t => {
  const espera = pendiente()
  const p = await pantalla(t, { bateria: () => ({ level: 76, voltage: 3970 }), scan: () => espera.promesa })
  assert.equal(p.el('bateria').textContent, '76 % estimado · 3970 mV')
  const primera = p.click('leer')
  p.avanzar(46000)
  assert.equal(p.timers.size, 0)
  espera.resolver([{ sak: [8] }])
  await primera
  await p.siguiente()
  assert.deepEqual(p.llamadas, ['batería', 'scan', 'bloque', 'batería', 'scan', 'bloque'])
})

for (const [nombre, status] of [['sin capacidad', null], ['comando rechazado', 0x67], ['error recuperable', 2]]) {
  test('batería no disponible · ' + nombre, async t => {
    const p = await pantalla(t, status ? { bateria() { throw Object.assign(new Error(), { status }) } } : {})
    assert.equal(p.el('bateria').textContent, 'Batería no disponible')
    await p.click('leer')
    assert.equal(p.el('contador').textContent, '1')
    p.avanzar(46000)
    await p.siguiente()
    assert.equal(p.llamadas.filter(v => v === 'batería').length, status === 2 ? 2 : status ? 1 : 0)
  })
}

test('timeout de batería inicial inhibe todos los comandos de la sesión', async t => {
  const p = await pantalla(t, { falloInicial: true, bateria() { throw new Error('read resp timeout (5000ms)') } })
  assert.equal(p.el('leer').disabled, true)
  assert.equal(p.timers.size, 0)
  assert.deepEqual(p.llamadas, ['batería'])
  assert.match(await p.informe(), /1025\) · timeout · GATT conectado/)
})

test('GATT espontáneo precede a SDK y conserva el primer indicio', async t => {
  const p = await pantalla(t)
  p.device.gatt.disconnect()
  p.device.dispatchEvent(new Event('gattserverdisconnected'))
  p.ultra.emitter.emit('disconnected')
  const informe = await p.informe()
  assert.match(informe, /Primer indicio observable · [^\n]*gattserverdisconnected/)
  assert.match(p.el('registro').textContent, /gattserverdisconnected[\s\S]*SDK disconnected/)
  assert.doesNotMatch(informe, /Cierre iniciado por la aplicación/)
})

test('WebbleAdapter 0.4.13 propaga un corte GATT al lector real del SDK', async t => {
  const p = await pantalla(t, { sdkReal: true })
  const aviso = new Promise(resolve => p.ultra.emitter.once('disconnected', resolve))
  p.device.gatt.disconnect()
  p.device.dispatchEvent(new Event('gattserverdisconnected'))
  await aviso
  await p.informe()
  assert.match(p.el('registro').textContent, /gattserverdisconnected[\s\S]*SDK comienza disconnect[\s\S]*SDK disconnected/)
  assert.equal(p.el('conectar').disabled, false)
})

test('timeout cuando GATT ya está caído conserva esa muestra', async t => {
  const p = await pantalla(t, { scan() {
    p.device.gatt.disconnect()
    throw new Error('read resp timeout')
  } })
  await p.click('leer')
  assert.match(await p.informe(), /timeout · GATT desconectado/)
  assert.equal(p.timers.size, 0)
})

test('usuario, aviso SDK y reconexión explícita al equipo autorizado', async t => {
  const p = await pantalla(t)
  await p.click('desconectar')
  assert.match(p.el('registro').textContent, /Cierre solicitado por el usuario[\s\S]*SDK disconnected/)
  p.el('reutilizar').checked = true
  await p.click('conectar')
  assert.equal(p.solicitudes, 1)
  assert.match(await p.informe(), /Primer indicio observable · ninguno/)
  assert.match(p.el('registro').textContent, /Solicitud de dispositivo autorizado/)
  p.ultra.emitter.emit('disconnected')
  assert.match(await p.informe(), /Primer indicio observable · [^\n]*SDK disconnected · GATT conectado/)
})

test('batería desactivada conserva la consulta inicial y el sondeo RFID', async t => {
  const p = await pantalla(t, { periodica: false, bateria: () => ({ level: 97, voltage: 4100 }) })
  assert.equal(p.timers.size, 0)
  await p.click('leer')
  p.avanzar(90000)
  await p.siguiente()
  assert.deepEqual(p.llamadas, ['batería', 'scan', 'bloque', 'scan', 'bloque'])
  p.el('periodica').value = 'si'
  p.el('periodica').onchange()
  p.avanzar(45000)
  await p.siguiente()
  assert.equal(p.llamadas.filter(v => v === 'batería').length, 2)
})

test('registro acotado y copia sin datos privados durante errores recuperables', async t => {
  const p = await pantalla(t, { bloque() { throw Object.assign(new Error('trama PRIVADA'), { status: 6 }) } })
  await p.click('leer')
  for (let i = 0; i < 90; i++) await p.siguiente()
  const informe = await p.informe()
  assert.equal(p.el('registro').textContent.split('\n').length, 256)
  assert.equal(p.el('estado').textContent, 'Conectado')
  assert.match(informe, /Fin MF1_READ_ONE_BLOCK \(2008\) · respuesta con estado 6/)
  assert.doesNotMatch(informe, /privad|ffffffffffff|06NR/i)
})
