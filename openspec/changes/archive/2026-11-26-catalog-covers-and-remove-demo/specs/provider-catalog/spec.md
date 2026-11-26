## ADDED Requirements

### Requirement: Paginación del listado de series recientes

Cada provider SHALL implementar `listLatest(page, ctx)` con resultado `OperationResult<Paginated<SeriesSummary>>`. La API SHALL exponer `GET /v1/catalog/:provider/latest` y devolver `{ data, page, hasNextPage }` en caso de éxito. `page` SHALL aceptar un único entero decimal seguro mayor o igual a 1 y tomar el valor 1 cuando se omite.

#### Scenario: Solicitar la página predeterminada

- **WHEN** un cliente consulta las novedades de una fuente registrada sin parámetro `page`
- **THEN** recibe HTTP 200 con los resúmenes de la primera página, `page: 1` y la señal de página siguiente

#### Scenario: Solicitar una página vacía

- **WHEN** una fuente registrada devuelve una página válida sin series y sin página siguiente
- **THEN** la API responde HTTP 200 con `data: []`, el número solicitado y `hasNextPage: false`

#### Scenario: Rechazar una página inválida

- **WHEN** la página es vacía, menor que 1, fraccionaria, no decimal, repetida o superior al mayor entero seguro
- **THEN** la API responde HTTP 400 con `INVALID_QUERY` sin ejecutar la operación del provider

### Requirement: Portadas de los resúmenes de Olympus

Olympus SHALL normalizar el campo `cover` de búsqueda y novedades con la misma validación. SHALL devolver `coverUrl` solo para URLs HTTPS sin credenciales del origen canónico de la operación o de `https://media.imagesolymp.xyz`. Si la portada falta o es inválida, el resumen SHALL conservarse y omitir el campo.

#### Scenario: Obtener las portadas de Olympus

- **GIVEN** el listado contiene cómics cuyos campos `cover` apuntan al CDN de Olympus o al origen canónico
- **WHEN** se consultan las novedades o la búsqueda
- **THEN** cada resumen incluye su propia portada como URL absoluta

#### Scenario: Omitir una portada de Olympus no utilizable

- **GIVEN** el JSON incluye un cómic cuya portada es nula, vacía, malformada, con credenciales o de otro origen
- **WHEN** se solicita el listado
- **THEN** la operación devuelve el resumen del cómic y omite `coverUrl`

### Requirement: Portadas de los resúmenes de Apoll Comics

Apoll Comics SHALL extraer la imagen del mismo resultado que el enlace de la serie y, en novedades, del mismo contenedor `.page-item-detail`. SHALL preferir `data-src` y usar `src` si está ausente o vacío. SHALL devolver `coverUrl` solo para URLs HTTPS sin credenciales de `https://apollcomics.es` y excluir `dflazy.jpg`. Si la portada falta o es inválida, el resumen SHALL conservarse y omitir el campo.

#### Scenario: Asociar las portadas de Apoll Comics

- **GIVEN** el HTML contiene varias series con portadas distintas en sus respectivos contenedores y una imagen diferida cuyo `src` es un placeholder
- **WHEN** se consultan las novedades o la búsqueda
- **THEN** cada resumen incluye la portada válida de esa serie y la imagen diferida se obtiene de `data-src`

#### Scenario: Omitir una portada de Apoll Comics no utilizable

- **GIVEN** el origen incluye una serie con una portada ausente, vacía, malformada, con credenciales, de otro origen o con un placeholder
- **WHEN** se solicita el listado
- **THEN** la operación devuelve el resumen de la serie y omite `coverUrl`

## REMOVED Requirements

### Requirement: Listado paginado de series recientes

**Reason**: Los escenarios usaban una fuente de ejemplo que se retira de producción.

**Migration**: El requisito Paginación del listado de series recientes cubre el mismo endpoint con fuentes registradas y conserva su contrato HTTP.
