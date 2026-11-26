## Why

La primera página de novedades de Apoll Comics devuelve HTTP 502 con `UPSTREAM_INVALID_RESPONSE`. El origen responde HTTP 301 a `/manga/page/1/?m_orderby=latest` y el cliente HTTP de Apoll Comics rechaza las redirecciones.

## What Changes

- Consultar la primera página de novedades en la URL canónica `/manga/?m_orderby=latest`.
- Usar `/manga/page/N/?m_orderby=latest` para las páginas posteriores.
- Cubrir la primera página con una prueba que simule el HTTP 301 de la ruta paginada.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `provider-catalog` — URL de la primera página de novedades de Apoll Comics.

## Impact

El cambio afecta a la URL que construye `ApollComicsProvider.listLatest` y a las pruebas del listado de novedades de Apoll Comics.
