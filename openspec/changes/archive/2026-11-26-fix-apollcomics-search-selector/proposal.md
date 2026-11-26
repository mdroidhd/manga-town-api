## Why

La búsqueda de Apoll Comics devuelve una lista vacía en producción. Madara coloca el enlace de la serie dentro de un encabezado como `h3.h4`. El selector actual busca la clase `h4` en el propio enlace y omite esos resultados.

## What Changes

- Extraer los enlaces de serie dentro de los contenedores `.h4` y `.post-title` de los resultados de Madara.
- Conservar el filtro por origen y ruta de serie, la deduplicación por slug y el orden de aparición.
- Reproducir el HTML de búsqueda en un fixture y cubrirlo con una prueba de regresión.

## Capabilities

### Modified Capabilities

- `provider-apollcomics` — Selección de enlaces en la búsqueda de series.

## Impact

El cambio afecta al selector de búsqueda de Apoll Comics, su fixture y las pruebas de búsqueda. La ruta HTTP y el formato de respuesta del catálogo se conservan.
