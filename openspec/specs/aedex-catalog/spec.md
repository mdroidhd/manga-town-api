# aedex-catalog Specification

## Purpose

Proveer el catálogo público y los capítulos de Aedex.

## Requirements

### Requirement: Catálogo Aedex

El sistema SHALL registrar Aedex como fuente de cómics en español y consultar su API con las cabeceras obligatorias.

#### Scenario: Buscar y listar novedades
- **WHEN** el usuario busca o solicita una página de novedades
- **THEN** la API devuelve series normalizadas con slugs y portadas y usa la paginación real para novedades

#### Scenario: Consultar ficha y capítulos
- **WHEN** el usuario solicita una serie por slug
- **THEN** la API devuelve su ficha y capítulos normalizados en el orden de la fuente

### Requirement: Lector aplazado

El sistema SHALL rechazar la resolución de páginas de Aedex hasta implementar el lector.

#### Scenario: Solicitar páginas
- **WHEN** se solicitan páginas de un capítulo de Aedex
- **THEN** se devuelve READER_NOT_AVAILABLE con HTTP 501
