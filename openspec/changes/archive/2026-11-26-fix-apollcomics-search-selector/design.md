## Context

Madara devuelve resultados con la estructura `<h3 class="h4"><a href="…">Título</a></h3>`. El parser ya normaliza el texto, valida el origen y extrae el slug de las rutas de serie.

## Goals / Non-Goals

Adaptar la extracción de títulos de búsqueda a los contenedores de resultados de Madara y conservar las reglas actuales de normalización.

## Decisions

- Seleccionar enlaces descendientes con `href` mediante `.h4 a[href], .post-title a[href]` y reutilizar la validación de URLs y el mapa de resultados por slug.
- Modelar un `h3.h4` con enlace directo y un contenedor `.post-title` en el fixture compartido para verificar ambas estructuras junto con el orden, los duplicados y los enlaces descartados.

## Risks / Trade-offs

Un contenedor puede incluir enlaces de capítulo o de otros sitios. El filtro de origen y ruta descarta esos enlaces antes de añadir un resultado.
