// Sólo recibe nombres de etapas y resultados controlados por la POC.
// Nunca recibe el contenido de una respuesta, un dispositivo ni un error del SDK.
export class Diagnostico {
  inicio = performance.now()
  #lineas = []
  #siguiente = 0
  conexion = null
  fin = null
  respuesta = null
  horaRespuesta = ''
  operacion = 'Ninguna'
  primerIndicio = ''
  suspension = 'no disponible'
  bateria = 'Batería no disponible'

  get eventos() {
    return this.#lineas.slice(this.#siguiente).concat(this.#lineas.slice(0, this.#siguiente))
  }

  confirmarRespuesta() {
    this.respuesta = performance.now()
    this.horaRespuesta = new Date().toISOString()
  }

  anotar(texto, gatt, indicio = false) {
    const ms = Math.round(performance.now() - this.inicio)
    const linea = new Date().toISOString() + ' +' + ms + ' ms · ' + texto + ' · GATT ' + gatt
    if (indicio && !this.primerIndicio) this.primerIndicio = linea
    this.#lineas[this.#siguiente] = linea
    this.#siguiente = (this.#siguiente + 1) % 256
  }

  resumen(estado, gatt, periodica, ultimoCierre) {
    const ahora = this.fin ?? performance.now()
    const intervalo = desde => desde === null ? 'sin dato' : Math.round(ahora - desde) + ' ms'
    return [
      'Estado · ' + estado + ' · GATT ' + gatt,
      'Duración de conexión · ' + intervalo(this.conexion),
      'Última respuesta válida · ' + (this.horaRespuesta || 'sin dato'),
      'Desde la última respuesta válida · ' + intervalo(this.respuesta),
      'Última operación · ' + this.operacion,
      this.bateria + ' · periódica ' + (periodica ? 'activada' : 'desactivada'),
      'Suspensión configurada · ' + this.suspension,
      'Primer indicio observable · ' + (this.primerIndicio || 'ninguno'),
      'Último cierre · ' + (ultimoCierre || 'ninguno')
    ].join('\n')
  }
}
