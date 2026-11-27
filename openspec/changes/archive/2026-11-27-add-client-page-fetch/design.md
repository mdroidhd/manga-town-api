## Context

La IP del servidor recibe contenido incorrecto del lector Olympus.

## Goals / Non-Goals

Solicitar el HTML al cliente y validar los paneles en el servidor, sin persistirlo ni implementar continuaciones.

## Decisions

El provider construye la acción con la URL autorizada y proporciona parsePages; el controlador selecciona según capabilities y valida el body. Apoll conserva getPages.

## Risks / Trade-offs

El HTML del cliente no es confiable: se restringe el tamaño y los enlaces de imágenes a su CDN.
