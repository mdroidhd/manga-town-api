## Context

El catálogo usa `page = 1` cuando el cliente omite el parámetro. El origen de Apoll Comics responde HTTP 301 para `/manga/page/1/?m_orderby=latest` y sirve la primera página en `/manga/?m_orderby=latest`.

## Decisions

- `ApollComicsProvider.listLatest` elige `/manga/` cuando `page` es 1 y `/manga/page/N/` para páginas posteriores. Ambas rutas usan `m_orderby=latest`.
- El cliente HTTP conserva `redirect: 'manual'` y su mapeo de respuestas 3xx a `UPSTREAM_INVALID_RESPONSE`.
- La prueba de extremo a extremo simula el HTTP 301 de `/page/1/` y comprueba que una petición explícita de la página 1 devuelve HTTP 200 con una única llamada a la URL canónica. Las pruebas existentes cubren la página predeterminada y la paginación posterior.
