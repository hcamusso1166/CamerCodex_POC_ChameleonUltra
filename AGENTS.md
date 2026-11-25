# Instrucciones para agentes del laboratorio

## Autoridad y decisiones aplicables

Consultar la [Bitácora Maestra](https://github.com/hcamusso1166/CamerCodex_Bitacora_Maestra/blob/main/BITACORA_MAESTRA.md) y releer los ADR aplicables al iniciar cada entrega. Rigen las decisiones aprobadas del ecosistema, seguidas del alcance expresamente autorizado por el responsable y de estas instrucciones locales. Documentar gobernanza, instrucciones y arquitectura en castellano. Ante una contradicción, detener el trabajo y solicitar decisión. Una excepción a una regla global exige justificación documentada y aprobación explícita.

| Decisión | Estado formal | Aplicación en el laboratorio |
| --- | --- | --- |
| [ADR-GLOBAL-001](https://github.com/hcamusso1166/CamerCodex_Bitacora_Maestra/blob/main/docs/adr/ADR-GLOBAL-001-integridad-ecosistema.md) | Aprobado. Adopción documental inicial, cumplimiento por repositorio pendiente de verificar. | Preservar compatibilidad, versionar contratos, identificar impacto, regresión, recuperación y trazabilidad. |
| [ADR-BLE-001](https://github.com/hcamusso1166/CamerCodex_Bitacora_Maestra/blob/main/docs/adr/ADR-BLE-001-vinculacion-persistente.md) | Aprobado. Implementación diferida y sin validación derivada del ADR. | Revisar su aplicabilidad antes de diseñar la conexión. Mantener diferida la vinculación persistente hasta cumplir sus prerrequisitos. |
| [ADR-APP-001](https://github.com/hcamusso1166/CamerCodex_Bitacora_Maestra/blob/main/docs/adr/ADR-APP-001-separacion-lineas-aplicacion.md) | Propuesta documentada, pendiente de revisión y aprobación final mediante PR. | Usar su inventario como referencia declarada. El aislamiento de la POC es una restricción expresa de esta entrega. |

## Flujo obligatorio

1. Verificar producto, ruta, raíz Git, remoto, rama, HEAD y estado del árbol. Identificar el destino previsto. C0 corresponde a `hcamusso1166/CamerCodex_POC_ChameleonUltra`, rama `docs/constitucion-poc`, con destino documental local. Si hay cambios inesperados, informar y detenerse antes de escribir.
2. Confirmar la entrega autorizada. Para investigación, registrar fuentes, revisiones y cuestiones abiertas. Antes de programar, verificar los [contratos y dependencias](docs/CONTRATOS_Y_DEPENDENCIAS.md), la matriz de impacto sobre dispositivos, aplicaciones y rutinas, las pruebas de regresión y el procedimiento de recuperación. Detenerse si falta evidencia para decidir.
3. Trabajar únicamente en la rama y los archivos autorizados. En C0 solo se permiten `README.md`, `AGENTS.md`, `docs/CONTRATOS_Y_DEPENDENCIAS.md` y `docs/PLAN_POC.md`. Está prohibido cambiar elementos fuera del alcance, crear código, instalar dependencias, crear repositorios o ADR, flashear, probar hardware o desplegar.
4. Preservar por separado el firmware físico del Chameleon, las fuentes SHOW y experimentos E1 REQA/WUPA de MrCamerDev 1.0, la PWA comercial, la aplicación experimental y el prototipo histórico. Consultar referencias externas solo en lectura. Una rama o un archivo fuente no acreditan qué binario está flasheado. La Bitácora Maestra solo se consulta.
5. Documentar resultados y límites de cada etapa según el [plan](docs/PLAN_POC.md). Separar las conclusiones de investigación, las pruebas de implementación y la evidencia física confirmada por el responsable. Vincular decisión, contrato, pruebas, repositorio, rama, commit, artefacto y destino cuando existan.
6. Revisar el diff, los archivos nuevos, los enlaces y el estado final. Presentar los cambios a Coperfil para revisión y al responsable para aprobación. En C0, detenerse allí. Commit, push y apertura de PR requieren autorización posterior explícita. Cuando se autorice un PR, documentar alcance, impacto, verificaciones y pendientes. El merge requiere revisión y aprobación expresa. Un merge documental tampoco autoriza despliegue ni la entrega siguiente.
