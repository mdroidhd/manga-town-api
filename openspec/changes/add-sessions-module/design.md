## Context

`ProviderContext` admite datos opcionales de sesión. Las rutas de catálogo actuales usan una identidad anónima y los providers registrados operan sin sesión de fuente. El módulo se probará a través de su servicio interno.

## Goals / Non-Goals

Entregar el ciclo de vida del cookie jar en el servidor. La autenticación de la API, las rutas HTTP y los flujos de login quedan para cambios posteriores.

## Decisions

- Identificar la sesión por `(userId, providerId)` usando una identidad verificada por el servidor. Cada alta obtiene una referencia interna nueva que permite rechazar actualizaciones de una sesión cerrada o sustituida.
- Cifrar el jar serializado con cifrado autenticado antes de entregarlo al adaptador. Mantener la clave en la configuración de secretos del servidor y asociar el contenido cifrado a su identidad de sesión.
- Fijar `expiresAt` al crear la sesión. El almacenamiento debe aplicar la expiración y el servicio debe rechazar lecturas vencidas. Las actualizaciones parciales conservan la fecha original.
- Coordinar cierre, actualización y sustitución de forma atómica para que una escritura en curso no restaure una sesión revocada. La prueba de concurrencia verificará este caso.

## Risks / Trade-offs

Un fallo de descifrado deja la sesión inutilizable. El llamador recibe un fallo sin datos de cookies y puede iniciar una sesión nueva.
