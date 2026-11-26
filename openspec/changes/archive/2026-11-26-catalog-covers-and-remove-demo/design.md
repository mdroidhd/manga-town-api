## Context

Olympus comparte el mapeo de `cover` entre búsqueda y novedades. Su endpoint `/api/new-chapters` devuelve portadas en el CDN `media.imagesolymp.xyz`. La búsqueda de Olympus también admite portadas del origen canónico. Apoll Comics devuelve las portadas de novedades en los elementos `img` de cada `.page-item-detail`. La búsqueda usa los resultados de Madara, que agrupan la miniatura y el título por serie.

## Goals / Non-Goals

- Incluir portadas válidas en los resúmenes a partir de la respuesta que el provider ya obtuvo.
- Mantener la selección de resultados, la deduplicación y la paginación actuales.
- Exponer Olympus y Apoll Comics en el registro de producción.

## Decisions

- **Olympus.** Conservar `seriesSummary` y `safeUrl` como ruta común. Validar las portadas absolutas y relativas con los mismos orígenes de búsqueda y descartar valores vacíos, ausentes o inválidos. Usar `cover` como URL única.
- **Apoll Comics.** Tomar la imagen del contenedor de la serie del enlace. Usar `.page-item-detail` en novedades y el contenedor del resultado de Madara en búsqueda. Preferir `data-src` y usar `src` si falta. Reutilizar `imageUrl` y el descarte de `dflazy.jpg`. Las portadas de los listados deben pertenecer a `https://apollcomics.es`.
- **Registro y pruebas.** Eliminar la implementación de ejemplo y registrar Olympus y Apoll Comics. Los e2e comprobarán el registro real y simularán las respuestas HTTP de los providers con la inyección de `fetch`.

## Risks / Trade-offs

- Cambios en el HTML de Madara pueden dejar un resultado sin portada. El campo opcional permite devolver la serie y las pruebas verifican que cada miniatura se asocia a su serie.
- Un cliente que solicite `demo` recibirá `PROVIDER_NOT_FOUND`.
