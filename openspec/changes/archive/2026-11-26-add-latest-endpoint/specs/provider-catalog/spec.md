## ADDED Requirements

### Requirement: Listado paginado de series recientes

Cada provider SHALL implementar `listLatest(page, ctx)` con resultado `OperationResult<Paginated<SeriesSummary>>`. La API SHALL exponer `GET /v1/catalog/:provider/latest` y devolver `{ data, page, hasNextPage }` en caso de éxito. `page` SHALL aceptar un único entero decimal seguro mayor o igual a 1 y tomar el valor 1 cuando se omite.

#### Scenario: Solicitar la página predeterminada

- **WHEN** un cliente consulta las novedades de Demo sin parámetro `page`
- **THEN** recibe HTTP 200 con los resúmenes fijos de Demo, `page: 1` y `hasNextPage: false`

#### Scenario: Solicitar una página vacía de Demo

- **WHEN** un cliente consulta una página de Demo posterior a la primera
- **THEN** recibe HTTP 200 con `data: []`, el número solicitado y `hasNextPage: false`

#### Scenario: Rechazar una página inválida

- **WHEN** la página es vacía, menor que 1, fraccionaria, no decimal, repetida o superior al mayor entero seguro
- **THEN** la API responde HTTP 400 con `INVALID_QUERY` sin ejecutar la operación del provider

### Requirement: Novedades de Olympus

Olympus SHALL consultar `https://olympusxyz.com/api/new-chapters?page=N` y validar el JSON. SHALL incluir solo entradas con `type === 'comic'` y usar el slug como ID. SHALL conservar la primera aparición de cada slug y el orden del origen. `hasNextPage` SHALL ser el resultado de comparar `current_page < last_page`.

#### Scenario: Normalizar una página con series repetidas

- **GIVEN** una página que contiene cómics, un slug repetido y entradas de otro tipo
- **WHEN** se consulta esa página de novedades
- **THEN** la respuesta contiene una entrada por slug de cómic en el orden de la primera aparición
- **AND** la paginación refleja `current_page` y `last_page`

#### Scenario: Consultar la última página

- **WHEN** Olympus devuelve `current_page` igual a `last_page`
- **THEN** `hasNextPage` es falso

### Requirement: Novedades de Apoll Comics

Apoll Comics SHALL consultar `https://apollcomics.es/manga/page/N/?m_orderby=latest`. SHALL extraer el slug y el título de enlaces de serie en `.page-item-detail .post-title a`, conservando una entrada por slug en el orden de la primera aparición. `hasNextPage` SHALL indicar si existe un enlace de paginación del sitio a `/manga/page/<N+1>`.

#### Scenario: Avanzar por el catálogo ordenado por fecha

- **GIVEN** páginas de resultados distintos, con un slug repetido en la primera
- **WHEN** se consulta cada número de página
- **THEN** cada respuesta contiene los resúmenes correspondientes en el orden de aparición y sin slugs repetidos
- **AND** cada página devuelve `hasNextPage: true` si contiene un enlace a su siguiente página

### Requirement: Errores del listado reciente

El catálogo SHALL aplicar el mismo mapeo a HTTP que en sus otras operaciones. SHALL devolver `PROVIDER_NOT_FOUND` con HTTP 404 para un provider desconocido y conservar los códigos de error devueltos por el provider.

#### Scenario: Solicitar novedades de un provider desconocido

- **WHEN** el ID indicado no está registrado
- **THEN** la API responde HTTP 404 con `PROVIDER_NOT_FOUND`

#### Scenario: Recibir fallos del origen

- **WHEN** la página remota responde 404 o devuelve un JSON inválido de Olympus
- **THEN** el catálogo responde respectivamente con HTTP 404 y `NOT_FOUND`, o HTTP 502 y `UPSTREAM_INVALID_RESPONSE`
