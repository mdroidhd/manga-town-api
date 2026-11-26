## Why

Los providers que requieren login necesitan reutilizar sus cookies entre operaciones. El contexto actual admite una sesión opcional. Hace falta un módulo que conserve las cookies que el servidor puede usar, limite su vigencia y permita revocarlas al cerrar la sesión de la fuente.

## What Changes

- Añadir un módulo interno `sessions` que guarde y recupere un cookie jar por `userId` y `providerId`, cifrado en reposo.
- Aplicar un TTL configurable a cada sesión e invalidarla al cerrar sesión en esa fuente.
- Limitar esta primera entrega al servicio interno. La autenticación de la API, los endpoints y flujos de login, las sesiones ligadas al dispositivo y la integración con continuations o caché privada se tratarán en sus respectivos cambios.

## Capabilities

### New Capabilities

- `provider-sessions` — Almacenamiento cifrado, expiración e invalidación de sesiones de fuente en el servidor.

### Modified Capabilities

Ninguna.

## Impact

La implementación añadirá `src/modules/sessions/`, un adaptador de almacenamiento y configuración para el TTL y la clave de cifrado. Los consumidores internos usarán la identidad de usuario verificada por el servidor. Las pruebas usarán cookies sintéticas y un reloj controlado.
