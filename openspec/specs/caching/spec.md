# caching Specification

## Purpose

Reducir las consultas repetidas a los proveedores mediante una caché de respuestas del catálogo, disponible también sin Redis.

## Requirements

### Requirement: Caché de catálogo
El sistema SHALL cachear únicamente resultados públicos exitosos de búsqueda, novedades, ficha y capítulos mediante L1 y Redis opcional, con TTL configurable por operación y claves que incluyan proveedor, versión, operación y parámetros normalizados. SHALL registrar el aviso de indisponibilidad de Redis solo al cambiar a ese estado.

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

#### Scenario: Avisos de Redis
- **WHEN** Redis deja de estar disponible, sigue fallando y posteriormente se recupera y vuelve a fallar
- **THEN** se registra un aviso para cada transición a indisponible, no por cada operación fallida

### Requirement: Purga autenticada
El sistema SHALL ofrecer purga interna por proveedor o global protegida con token, y deshabilitarla si no existe token configurado. SHALL purgar L1 siempre y distinguir una purga compartida fallida de una configuración sin Redis.

#### Scenario: Token ausente en configuración
- **WHEN** CACHE_PURGE_TOKEN no está definido
- **THEN** POST /v1/cache/purge responde 404

#### Scenario: Token válido
- **WHEN** se solicita purga con token válido y Redis está disponible
- **THEN** se invalidan las entradas correspondientes en ambos niveles y responde 200

#### Scenario: Redis configurado no disponible
- **WHEN** se solicita purga con token válido y falla la purga de Redis configurado
- **THEN** se invalida L1 y responde 503 con código `CACHE_UNAVAILABLE` indicando que la purga compartida no se completó

#### Scenario: Redis no configurado
- **WHEN** se solicita purga con token válido y Redis no está configurado
- **THEN** se invalida L1 y responde 200
