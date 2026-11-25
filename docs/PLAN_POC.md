# Plan de la POC Chameleon Ultra Compact

C0 constituyó el laboratorio. El responsable aprobó el cierre técnico de la Entrega 0 con observaciones. La Entrega 1 queda pendiente de autorización separada.

| Entrega | Trabajo propuesto | Criterio de aceptación | Riesgo que debe resolverse |
| --- | --- | --- | --- |
| 0 · Auditoría técnica de factibilidad · cierre técnico aprobado con observaciones | Auditoría documental de líneas base, contratos, roles BLE y opciones de ejecución. | [Informe y dictamen](auditorias/ENTREGA_0_FACTIBILIDAD.md), con referencias versionadas, matriz de impacto, regresión prevista y vía de recuperación. | Quedan abiertas la compatibilidad física del firmware instalado, la obtención de muestras completas de los bloques y la discrepancia de orden de bytes de `seq`. |
| 1 · Adaptación mínima de lectura · pendiente de autorización | En el laboratorio aislado, adaptar la salida documentada de lectura a la representación de carta verificada. Usar muestras de referencia trazables. | Pruebas reproducibles reconocen las tres cartas según el README y tratan una entrada inválida según el contrato verificado. Registrar el origen de las muestras. | Interpretar los códigos visibles como si fueran el contenido binario completo del bloque. |
| 2 · Construcción de CamerPacket v1 | Construir el paquete a partir de la lectura adaptada y compararlo con ejemplos de referencia verificados. | Para cada caso, la salida coincide con la especificación versionada y el consumidor de referencia puede interpretarla en una prueba aislada. | Generar un paquete plausible pero incompatible con el consumidor. |
| 3 · Comunicación BLE con aplicación POC aislada | Verificar en pruebas de integración aisladas el intercambio previsto y la reacción de la aplicación ante desconexión. Registrar qué extremos se simularon. | Evidencia del envío, recepción e interpretación de los casos y del estado de conexión observado. Distinguir resultados simulados de resultados sobre radio física. | Validar solo el emisor, confundir permiso con conexión activa o depender de una PWA protegida. |
| 4 · Validación física | Con autorización específica, el responsable verifica el recorrido desde cada tarjeta hasta la aplicación POC aislada. | Acta con unidad, firmware, versiones, commit, procedimiento, resultado esperado y observado por carta, incidencias y decisión del responsable. Toda función BLE que se declare validada requiere ensayo físico específico. | Atribuir a la POC resultados de la GUI, de otra unidad o de otra versión. |

## Aprobaciones y cierre de etapa

Coperfil revisa los resultados frente a los criterios de la etapa. El responsable decide si acepta la evidencia y si autoriza la entrega siguiente, con su rama y alcance. Una dependencia sin resolver se registra con su impacto y se somete a decisión antes de continuar. La autorización de una etapa de desarrollo no habilita pruebas sobre hardware.

Si se propone vinculación persistente, aplicar primero los prerrequisitos y escenarios del ADR-BLE-001, incluidos permisos revocados, varias unidades, reinicios y pérdida de cobertura. La aprobación de la POC no promueve cambios a producción. [Gobernanza y decisiones aplicables](../AGENTS.md) · [Contratos por verificar](CONTRATOS_Y_DEPENDENCIAS.md)
