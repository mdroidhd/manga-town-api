## Purpose

Permitir que los clientes descubran las fuentes disponibles en producción y consulten su manifiesto por ID.

## ADDED Requirements

### Requirement: Fuentes del registro de producción

La configuración de producción SHALL registrar `olympus` y `apollcomics`. El registro MUST excluir providers de ejemplo, incluido `demo`. El descubrimiento y el catálogo SHALL devolver HTTP 404 con `PROVIDER_NOT_FOUND` cuando se les solicite un ID que no esté registrado.

#### Scenario: Listar las fuentes disponibles

- **WHEN** un cliente consulta `GET /v1/providers`
- **THEN** la API responde HTTP 200 con los manifiestos de Olympus y Apoll Comics como únicas fuentes registradas

#### Scenario: Consultar un provider desconocido

- **WHEN** un cliente solicita el manifiesto o el catálogo de un ID ausente del registro
- **THEN** la API responde HTTP 404 con `PROVIDER_NOT_FOUND`
