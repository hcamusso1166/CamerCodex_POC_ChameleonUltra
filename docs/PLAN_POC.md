# Plan de la POC Chameleon Ultra Compact

C0 constituye el laboratorio y termina con la revisión documental de Coperfil y la decisión del responsable. La Entrega 0 comienza después, con autorización separada. Las entregas siguientes son propuestas pendientes. El resultado de la auditoría puede ser que la POC sea inviable con el firmware disponible.

| Entrega | Trabajo propuesto | Criterio de aceptación | Riesgo que debe resolverse |
| --- | --- | --- | --- |
| 0 · Auditoría técnica de factibilidad | Inspeccionar fuentes en lectura, identificar líneas base, contratos, roles BLE y opciones de ejecución. | Dictamen de factibilidad, inviabilidad o evidencia insuficiente, con referencias versionadas, matriz de impacto, regresión prevista y vía de recuperación. Para avanzar deben estar resueltas las dependencias de la adaptación. | Confundir una lectura por GUI con una interfaz automatizable o atribuir al equipo un rol BLE sin evidencia. |
| 1 · Adaptación mínima de lectura | En el laboratorio aislado, adaptar la salida documentada de lectura a la representación de carta verificada. Usar muestras de referencia trazables. | Pruebas reproducibles reconocen las tres cartas según el README y tratan una entrada inválida según el contrato verificado. Registrar el origen de las muestras. | Interpretar los códigos visibles como si fueran el contenido binario completo del bloque. |
| 2 · Construcción de CamerPacket v1 | Construir el paquete a partir de la lectura adaptada y compararlo con ejemplos de referencia verificados. | Para cada caso, la salida coincide con la especificación versionada y el consumidor de referencia puede interpretarla en una prueba aislada. | Generar un paquete plausible pero incompatible con el consumidor. |
| 3 · Comunicación BLE con aplicación POC aislada | Verificar en pruebas de integración aisladas el intercambio previsto y la reacción de la aplicación ante desconexión. Registrar qué extremos se simularon. | Evidencia del envío, recepción e interpretación de los casos y del estado de conexión observado. Distinguir resultados simulados de resultados sobre radio física. | Validar solo el emisor, confundir permiso con conexión activa o depender de una PWA protegida. |
| 4 · Validación física | Con autorización específica, el responsable verifica el recorrido desde cada tarjeta hasta la aplicación POC aislada. | Acta con unidad, firmware, versiones, commit, procedimiento, resultado esperado y observado por carta, incidencias y decisión del responsable. Toda función BLE que se declare validada requiere ensayo físico específico. | Atribuir a la POC resultados de la GUI, de otra unidad o de otra versión. |

## Aprobaciones y cierre de etapa

Coperfil revisa los resultados frente a los criterios de la etapa. El responsable decide si acepta la evidencia y si autoriza la entrega siguiente, con su rama y alcance. Una dependencia sin resolver se registra con su impacto y se somete a decisión antes de continuar. La autorización de una etapa de desarrollo no habilita pruebas sobre hardware.

Si se propone vinculación persistente, aplicar primero los prerrequisitos y escenarios del ADR-BLE-001, incluidos permisos revocados, varias unidades, reinicios y pérdida de cobertura. La aprobación de la POC no promueve cambios a producción. [Gobernanza y decisiones aplicables](../AGENTS.md) · [Contratos por verificar](CONTRATOS_Y_DEPENDENCIAS.md)
