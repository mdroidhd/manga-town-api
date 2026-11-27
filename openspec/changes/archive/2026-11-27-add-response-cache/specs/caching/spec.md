## ADDED Requirements

### Requirement: Caché de catálogo
El sistema SHALL cachear únicamente resultados públicos exitosos de búsqueda, novedades, ficha y capítulos mediante L1 y Redis opcional, con TTL configurable por operación y claves que incluyan proveedor, versión, operación y parámetros normalizados.

#### Scenario: Resultado reutilizado
- **WHEN** se repite una petición idéntica exitosa dentro de su TTL
- **THEN** se devuelve el resultado almacenado con X-Cache HIT-L1 o HIT-L2

#### Scenario: Resultado no cacheable
- **WHEN** el proveedor devuelve error o client_action_required
- **THEN** el resultado no se almacena

#### Scenario: Peticiones simultáneas
- **WHEN** llegan peticiones idénticas concurrentes
- **THEN** comparten una única llamada al proveedor

#### Scenario: Redis no disponible
- **WHEN** Redis no está configurado o falla
- **THEN** el catálogo sigue funcionando con L1 y la salud permanece disponible

### Requirement: Purga autenticada
El sistema SHALL ofrecer purga interna por proveedor o global protegida con token, y deshabilitarla si no existe token configurado.

#### Scenario: Token ausente en configuración
- **WHEN** CACHE_PURGE_TOKEN no está definido
- **THEN** POST /v1/cache/purge responde 404

#### Scenario: Token válido
- **WHEN** se solicita purga con token válido
- **THEN** se invalidan las entradas correspondientes en ambos niveles
