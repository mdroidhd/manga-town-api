## Why

Olympus devuelve contenido falso a la IP del servidor; la app debe descargar el lector desde su propia conexión.

## What Changes

- Solicitar descarga HTML al cliente para providers con pages app y aceptar el HTML para parsearlo.
- Mantener la resolución de páginas en servidor para Apoll.

## Capabilities

### New Capabilities

### Modified Capabilities

- `provider-catalog`: resolución de páginas desde HTML obtenido por la app.

## Impact

Contrato de providers, endpoints de catálogo, Olympus y pruebas.
