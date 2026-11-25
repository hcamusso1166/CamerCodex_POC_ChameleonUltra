import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer, DeviceMode, Mf1KeyType, DeviceModel } from 'chameleon-ultra.js'
import { interpretar, leer, preparar } from '../web/lector.js'

const sdk = { DeviceMode, Mf1KeyType, DeviceModel }
const vigente = () => {}
// Muestras sintéticas, con relleno intercalado para probar la extracción histórica.
function sintetico(texto) {
  const bloque = Buffer.alloc(16)
  Array.from(texto, (c, i) => { bloque[2 * i + 1] = c.charCodeAt(0) })
  return bloque
}

for (const carta of ['06NR', '08NR', '14RR']) {
  test('lectura sintética de ' + carta, async () => {
    const clave = Buffer.alloc(6)
    const pasos = []
    const ultra = {
      cmdHf14aScan: async () => { pasos.push('scan'); return [{ sak: [8], uid: [0, 1, 2, 3] }] },
      cmdMf1ReadBlock: async args => {
        pasos.push('read')
        assert.deepEqual(args, { block: 1, keyType: 0x60, key: clave })
        return sintetico(carta)
      }
    }
    assert.equal(await leer(ultra, sdk, clave, vigente), carta)
    assert.deepEqual(pasos, ['scan', 'read'])
  })
}
for (const n of [0, 15, 17]) test('longitud inválida ' + n, () =>
  assert.throws(() => interpretar(Buffer.alloc(n)), /16 bytes/))
for (const valor of ['06N', '06nr', 'XX06NR', '00XX']) test('identificador inválido ' + valor, () =>
  assert.throws(() => interpretar(sintetico(valor)), /Identificador/))

for (const [nombre, fallo, patron] of [
  ['autenticación', { status: 6 }, /2008.*0x06.*autenticación/],
  ['timeout', Error('read resp timeout (5000ms)'), /2008.*tiempo/],
  ['desconexión', Error('device disconnected'), /2008.*desconexión/],
  ['error de comando', { status: 0x67 }, /2008.*0x67/]
]) test(nombre, async () => {
  const ultra = { cmdHf14aScan: async () => [{ sak: [8] }], cmdMf1ReadBlock: async () => { throw fallo } }
  await assert.rejects(leer(ultra, sdk, Buffer.alloc(6), vigente), patron)
})
test('una respuesta tardía se descarta tras la desconexión', async () => {
  let conectado = true
  const ultra = { cmdHf14aScan: async () => [{ sak: [8] }], cmdMf1ReadBlock: async () => {
    conectado = false
    return sintetico('06NR')
  } }
  await assert.rejects(leer(ultra, sdk, Buffer.alloc(6), () => {
    if (!conectado) throw new Error('Desconectado')
  }), /Desconectado/)
})
for (const tarjetas of [[], [{ sak: [0] }], [{ sak: [8] }, { sak: [8] }]]) {
  test('selección rechazada ' + JSON.stringify(tarjetas), async () => {
    await assert.rejects(leer({ cmdHf14aScan: async () => tarjetas }, sdk, null, vigente), /tarjeta|SAK/)
  })
}
function equipo() {
  let modo = DeviceMode.TAG
  return { isDfu: () => false, cmdGetAppVersion: async () => '2.1', cmdGetGitVersion: async () => 'sintético',
    cmdGetDeviceModel: async () => DeviceModel.ULTRA, cmdGetSupportedCmds: async () => new Set([1001, 1002, 2000, 2008]),
    cmdGetDeviceMode: async () => modo, cmdChangeDeviceMode: async valor => { modo = valor } }
}
test('verifica modo tras cambiarlo', async () => {
  const ultra = equipo()
  await preparar(ultra, sdk, vigente, () => {})
  assert.equal(await ultra.cmdGetDeviceMode(), DeviceMode.READER)
})
test('detiene una sesión sin capacidad de lectura', async () => {
  const ultra = equipo()
  ultra.cmdGetSupportedCmds = async () => new Set([1002, 2000])
  await assert.rejects(preparar(ultra, sdk, vigente, () => {}), /ausente: 2008/)
})
test('detiene la sesión si el firmware no confirma el modo', async () => {
  const ultra = equipo()
  ultra.cmdChangeDeviceMode = async () => {}
  await assert.rejects(preparar(ultra, sdk, vigente, () => {}), /confirmó/)
})
