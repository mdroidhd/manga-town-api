## Why

El catálogo admite fuentes registradas en el servidor. Apoll Comics publica su catálogo, sus capítulos y su lector en HTML de Madara, accesible sin cuenta ni captcha. Integrarlo añade una segunda fuente real de cómics en español.

## What Changes

- Registrar el manifiesto de `apollcomics` y exponer la fuente a través de las rutas actuales de providers y catálogo.
- Extraer resultados de búsqueda, fichas, capítulos y URLs de lectura de HTML de Apoll Comics. Usar los slugs de serie y capítulo como identificadores.
- Cubrir el contrato, la selección de orígenes y los errores con fixtures HTML y un `fetch` inyectado.

## Capabilities

### New Capabilities

- `provider-apollcomics` — Búsqueda, fichas, capítulos y páginas de Apoll Comics resueltos en el servidor.

### Modified Capabilities

Ninguna.

## Impact

Se añaden un cliente y un provider bajo `src/modules/providers/apollcomics/` y se amplía el registro en `ProvidersModule`. Las respuestas usan el contrato de catálogo existente. Las pruebas unitarias y e2e simulan el sitio mediante el token de inyección del cliente.
