## Why

El lector necesita la portada de cada serie en novedades y en los demás listados que ya la reciben del origen. El registro de producción debe exponer las fuentes disponibles para lectura. El provider `demo` ya no cumple ese propósito.

## What Changes

- Normalizar las portadas de novedades y búsqueda de Olympus y Apoll Comics como `coverUrl` cuando exista una URL permitida.
- Omitir el campo si la imagen falta o su URL es inválida y conservar la serie en la respuesta.
- **BREAKING** Retirar `demo` del registro de producción y ejecutar las pruebas contra fuentes con respuestas simuladas o con dobles confinados a las pruebas.

## Capabilities

### New Capabilities

- `provider-registry` — Fuentes expuestas por el registro de producción y tratamiento de IDs no registrados.

### Modified Capabilities

- `provider-catalog` — Portadas opcionales de los resúmenes y escenarios de paginación con una fuente registrada.

## Impact

El cambio afecta a los mapeos de series, la composición de `ProvidersModule`, las pruebas de catálogo y registro y la documentación de las fuentes registradas. El campo `coverUrl` ya forma parte del contrato de resúmenes.
