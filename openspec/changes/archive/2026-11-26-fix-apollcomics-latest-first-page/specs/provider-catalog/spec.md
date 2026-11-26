## MODIFIED Requirements

### Requirement: Novedades de Apoll Comics

Apoll Comics SHALL consultar `https://apollcomics.es/manga/?m_orderby=latest` para la página 1 y `https://apollcomics.es/manga/page/N/?m_orderby=latest` para las páginas posteriores. SHALL extraer el slug y el título de enlaces de serie en `.page-item-detail .post-title a`, conservando una entrada por slug en el orden de la primera aparición. `hasNextPage` SHALL indicar si existe un enlace de paginación del sitio a `/manga/page/<N+1>`.

#### Scenario: Consultar la primera página de novedades

- **GIVEN** el origen responde HTTP 301 en `/manga/page/1/?m_orderby=latest` y devuelve el catálogo en `/manga/?m_orderby=latest`
- **WHEN** se consultan las novedades de Apoll Comics con `page=1` o sin parámetro `page`
- **THEN** el provider hace una única petición a `https://apollcomics.es/manga/?m_orderby=latest`
- **AND** el catálogo responde HTTP 200 con los resúmenes, `page: 1` y la señal de página siguiente

#### Scenario: Avanzar por el catálogo ordenado por fecha

- **GIVEN** páginas de resultados distintos, con un slug repetido en la primera
- **WHEN** se consulta cada número de página
- **THEN** cada respuesta contiene los resúmenes correspondientes en el orden de aparición y sin slugs repetidos
- **AND** cada página devuelve `hasNextPage: true` si contiene un enlace a su siguiente página
