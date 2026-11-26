## Why

La pantalla de inicio del lector necesita mostrar las series actualizadas recientemente en la fuente elegida y cargar más resultados cuando el usuario avance.

## What Changes

- Añadir la operación paginada `listLatest` al contrato de providers e implementarla en Demo, Olympus y Apoll Comics.
- Exponer `GET /v1/catalog/:provider/latest` con una página opcional y un indicador de página siguiente.
- Verificar el contrato HTTP y la normalización de las fuentes con fixtures y peticiones simuladas.

## Capabilities

### New Capabilities

- `provider-catalog` — Listado paginado de series recientes por provider.

### Modified Capabilities

Ninguna.

## Impact

El cambio añade una ruta de catálogo y un resultado de dominio que todos los providers registrados implementan. Olympus usa su API de novedades y Apoll Comics el listado de Madara ordenado por últimas actualizaciones.
