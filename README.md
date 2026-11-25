# Camer Codex® — POC Chameleon Ultra

El laboratorio estudia si el Chameleon Ultra Compact puede aportar lecturas de cartas a una aplicación POC aislada mediante CamerPacket v1 y BLE. La Entrega C0 constituye el laboratorio documentalmente y queda pendiente de revisión de Coperfil y aprobación del responsable del proyecto.

## Hardware y evidencia experimental

El responsable del proyecto confirmó que el Chameleon Ultra Compact está operativo con el firmware `v2.0.0-244-ZhaiRen-FixSlotBUG+RST+DFU+POLL400ms`. Mediante Chameleon Ultra GUI leyó el sector 0, bloque 1 de tres tarjetas MIFARE Classic 1K.

| Lectura | Carta | Color | Dorso |
| --- | --- | --- | --- |
| `06NR` | 6 de tréboles | Negro | Rojo |
| `08NR` | 8 de tréboles | Negro | Rojo |
| `14RR` | As de corazones | Rojo | Rojo |

La evidencia cubre la lectura manual de esas tarjetas. La adquisición automática, la construcción del paquete, el transporte BLE automático y la integración con la PWA siguen sin validación.

## Arquitectura preliminar — no aprobada

La hipótesis es obtener la lectura del dispositivo con su firmware actual, interpretarla conforme al contrato de cartas, construir un CamerPacket v1 y entregarlo por BLE a una aplicación POC aislada. La auditoría debe determinar dónde podrían ejecutarse la adaptación y la construcción del paquete, qué roles BLE admite el equipo y si el recorrido es factible. El lugar de ejecución y el transporte siguen abiertos.

## Alcance y próximas entregas

C0 comprende únicamente este documento, las instrucciones del laboratorio, el inventario de contratos y el plan. Quedan excluidos la programación, las instalaciones, las pruebas físicas, los cambios de firmware, las modificaciones a MrCamerDev 1.0 o a las aplicaciones Camer Codex, la creación de repositorios o ADR y los despliegues.

Después de C0 se propone auditar la factibilidad (Entrega 0), adaptar la lectura (1), construir el paquete (2), comunicarlo a la aplicación POC aislada (3) y validar el recorrido en hardware (4). Cada etapa requiere autorización propia. [Plan y criterios de aceptación](docs/PLAN_POC.md) · [Contratos y dependencias](docs/CONTRATOS_Y_DEPENDENCIAS.md)

La Bitácora Maestra es la referencia superior. Las reglas de trabajo locales identifican las decisiones aplicables y su estado. [Bitácora Maestra](https://github.com/hcamusso1166/CamerCodex_Bitacora_Maestra/blob/main/BITACORA_MAESTRA.md) · [Instrucciones del laboratorio](AGENTS.md)
