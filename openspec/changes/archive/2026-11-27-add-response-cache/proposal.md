## Why
Reducir peticiones repetidas a fuentes y evitar saturarlas.

## What Changes
- Caché pública de respuestas correctas en memoria y Redis opcional, con TTL por operación y deduplicación concurrente.
- Invalidación interna autenticada y cabecera de diagnóstico.

## Capabilities
### New Capabilities
- `caching`: caché de respuestas del catálogo e invalidación segura.

### Modified Capabilities

## Impact
Catálogo, configuración, despliegue y pruebas; Redis es opcional.
