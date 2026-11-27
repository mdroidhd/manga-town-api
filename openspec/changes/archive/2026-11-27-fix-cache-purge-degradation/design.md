## Context

L1 es local y Redis es opcional. La invalidación compartida puede fallar después de limpiar L1.

## Goals / Non-Goals

- Comunicar el fallo parcial con 503 y código estable, preservando la purga local.
- Evitar avisos duplicados durante una misma caída y volver a avisar tras recuperación y nueva caída.
- No cambiar la política de disponibilidad del catálogo ni el mecanismo de invalidación distribuida.

## Decisions

La capa de servicio traduce el fallo de purga compartida a una excepción HTTP 503 estructurada después de purgar L1. Sin Redis no se invoca el adaptador. El adaptador registra cambios de estado, no cada operación fallida.

## Risks / Trade-offs

Una respuesta 503 indica éxito local pero no garantiza invalidación de otras instancias; el cliente puede reintentar.
