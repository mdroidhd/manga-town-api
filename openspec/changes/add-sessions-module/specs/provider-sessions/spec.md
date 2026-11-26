# Delta de sesiones de fuente

## Purpose

Conservar las cookies de sesión que un provider puede usar en el servidor, con aislamiento por usuario y un ciclo de vida limitado.

## ADDED Requirements

### Requirement: Cookie jar cifrado y aislado

El módulo SHALL guardar un cookie jar cifrado en reposo por cada par `(userId, providerId)` y permitir su lectura únicamente a un consumidor interno que actúe para ese mismo par con una identidad de usuario verificada. La clave de cifrado SHALL mantenerse fuera del almacén de sesiones. El módulo MUST NOT exponer cookies en logs, errores ni respuestas públicas.

#### Scenario: Recuperar un jar vigente

- **GIVEN** una sesión de fuente vigente con un cookie jar guardado
- **WHEN** el consumidor interno lo solicita para el mismo usuario y provider
- **THEN** recupera el jar y el almacén contiene el contenido cifrado

#### Scenario: Aislar usuarios y providers

- **GIVEN** un jar guardado para el usuario A y el provider X
- **WHEN** se consulta para el usuario B y el provider X, o para el usuario A y el provider Y
- **THEN** la consulta no devuelve cookies del par original

### Requirement: Vencimiento de la sesión

El módulo SHALL fijar una fecha de expiración con un TTL positivo configurable al crear la sesión. Las lecturas y las actualizaciones del jar SHALL conservar esa fecha. A partir de `expiresAt`, el módulo MUST tratar la sesión como ausente.

#### Scenario: Alcanzar el límite del TTL

- **GIVEN** una sesión vigente cuyo jar se consulta o actualiza antes del vencimiento
- **WHEN** el reloj alcanza `expiresAt` y un consumidor solicita de nuevo la sesión
- **THEN** el módulo informa que no hay una sesión utilizable

### Requirement: Invalidación al cerrar la sesión de fuente

El módulo SHALL invalidar el jar del par `(userId, providerId)` al cerrar su sesión de fuente. Repetir el cierre SHALL dejar el mismo estado. Las actualizaciones iniciadas con una referencia anterior al cierre MUST NOT reactivar esa sesión ni modificar una sesión nueva.

#### Scenario: Cerrar una sesión de fuente

- **GIVEN** un usuario con sesiones vigentes en dos providers
- **WHEN** el usuario cierra la sesión de uno de ellos, incluso si repite la operación
- **THEN** el jar de ese provider deja de estar disponible y el del otro sigue accesible

#### Scenario: Recibir una actualización tardía después del cierre

- **GIVEN** una actualización pendiente del jar de una sesión cerrada
- **WHEN** la actualización intenta persistirse
- **THEN** el módulo la rechaza y cualquier sesión nueva del mismo par conserva su propio jar
