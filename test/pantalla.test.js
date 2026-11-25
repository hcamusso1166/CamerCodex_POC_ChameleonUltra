import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import * as sdk from 'chameleon-ultra.js'

test('pantalla con SDK simulado: conexión, lectura, rechazo y limpieza de la sesión', async t => {
  const campos = new Map()
  const getElementById = id => {
    if (!campos.has(id)) campos.set(id, { value: '', textContent: '' })
    return campos.get(id)
  }
  let rechazar = false
  class Ultra {
    emitter = new EventEmitter()
    async use() {}
    async connect() { this.activo = true }
    isConnected() { return this.activo }
    async disconnect() { this.activo = false; this.emitter.emit('disconnected') }
    isDfu() { return false }
    async cmdGetAppVersion() { return '2.1' }
    async cmdGetDeviceModel() { return sdk.DeviceModel.ULTRA }
    async cmdGetGitVersion() { return 'sintético' }
    async cmdGetSupportedCmds() { return new Set([1002, 2000, 2008]) }
    async cmdGetDeviceMode() { return sdk.DeviceMode.READER }
    async cmdHf14aScan() { return [{ sak: [8] }] }
    async cmdMf1ReadBlock() {
      if (rechazar) throw Object.assign(new Error('trama privada'), { status: 6 })
      return sdk.Buffer.from('06NR'.padEnd(16, '\0'))
    }
  }
  class Adaptador {
    device = { name: 'Unidad sintética', gatt: { connected: true, disconnect() { this.connected = false } } }
  }
  for (const [nombre, value] of Object.entries({
    isSecureContext: true, navigator: { bluetooth: {} }, document: { getElementById },
    ChameleonUltraJS: { ...sdk, ChameleonUltra: Ultra, WebbleAdapter: Adaptador }
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, nombre)
    Object.defineProperty(globalThis, nombre, { configurable: true, value })
    t.after(() => original ? Object.defineProperty(globalThis, nombre, original) : Reflect.deleteProperty(globalThis, nombre))
  }
  await import('../web/app.js')
  assert.equal(getElementById('leer').disabled, true)
  await getElementById('conectar').onclick()
  assert.equal(getElementById('leer').disabled, false)
  getElementById('clave').value = '0'.repeat(12)
  await getElementById('leer').onclick()
  assert.equal(getElementById('resultado').textContent, '06NR')
  rechazar = true
  await getElementById('leer').onclick()
  assert.equal(getElementById('resultado').textContent, '—')
  assert.equal(getElementById('clave').value, '')
  assert.match(getElementById('error').textContent, /2008.*0x06/)
  assert.doesNotMatch(getElementById('error').textContent, /trama privada/)
  assert.equal(getElementById('estado').textContent, 'Desconectado')
  assert.equal(getElementById('leer').disabled, true)
})
