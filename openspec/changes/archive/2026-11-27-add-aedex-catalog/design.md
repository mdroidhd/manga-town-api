## Context

La API de Aedex requiere tres cabeceras y usa slugs para la ficha.

## Goals / Non-Goals

Implementar el catálogo y sus capítulos; excluir lector y login.

## Decisions

Un cliente de origen fijo consulta JSON con límite de tiempo. El provider normaliza respuestas y cachea páginas públicas por parámetros. Las páginas devuelven READER_NOT_AVAILABLE con HTTP 501.

## Risks / Trade-offs

Una caché local de duración limitada puede retrasar actualizaciones; no guarda sesiones ni credenciales.
