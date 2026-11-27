## Why

Una caída de Redis convierte la purga autenticada en un error 500 pese a que L1 ya se ha limpiado. El cliente necesita distinguir este fallo parcial y los logs no deben repetir el mismo aviso.

## What Changes

- Purgar siempre L1 y responder 503 con `CACHE_UNAVAILABLE` si la purga compartida falla.
- Mantener respuesta 200 cuando Redis no está configurado.
- Registrar las transiciones de disponibilidad de Redis sin repetir avisos por operación.

## Capabilities

### Modified Capabilities
- `caching`: comportamiento de purga parcial y avisos de disponibilidad.

## Impact

Servicio y adaptador de caché, controlador, pruebas y contrato HTTP de purga.
