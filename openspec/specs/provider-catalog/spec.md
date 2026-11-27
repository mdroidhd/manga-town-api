# provider-catalog Specification

## Purpose

Mostrar las series actualizadas recientemente en la fuente elegida y permitir que el lector avance por páginas.

## Requirements

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

### Requirement: Errores del listado reciente

El catálogo SHALL aplicar el mismo mapeo a HTTP que en sus otras operaciones. SHALL devolver `PROVIDER_NOT_FOUND` con HTTP 404 para un provider desconocido y conservar los códigos de error devueltos por el provider.

#### Scenario: Solicitar novedades de un provider desconocido

- **WHEN** el ID indicado no está registrado
- **THEN** la API responde HTTP 404 con `PROVIDER_NOT_FOUND`

#### Scenario: Recibir fallos del origen

- **WHEN** la página remota responde 404 o devuelve un JSON inválido de Olympus
- **THEN** el catálogo responde respectivamente con HTTP 404 y `NOT_FOUND`, o HTTP 502 y `UPSTREAM_INVALID_RESPONSE`

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

Apoll Comics SHALL extraer la imagen del mismo resultado que el enlace de la serie y, en novedades, del mismo contenedor `.page-item-detail`. SHALL preferir `data-src` y usar `src` si está ausente o vacío. SHALL devolver `coverUrl` solo para URLs HTTPS sin credenciales de `https://apollcomics.es`, `https://cdn1.apollcomics.es` o `https://cdn1.apollcomics.com`, y excluir `dflazy.jpg`. Si la portada falta o no cumple estas condiciones, el resumen SHALL conservarse y omitir el campo.

#### Scenario: Asociar las portadas de Apoll Comics

- **GIVEN** el HTML contiene varias series con portadas distintas en sus respectivos contenedores y una imagen diferida cuyo `src` es un placeholder
- **WHEN** se consultan las novedades o la búsqueda
- **THEN** cada resumen incluye la portada válida de esa serie y la imagen diferida se obtiene de `data-src`

#### Scenario: Conservar compatibilidad con el CDN anterior

- **GIVEN** el HTML del lector o una portada contiene imágenes HTTPS de `cdn1.apollcomics.com`
- **WHEN** se solicitan las páginas o un resumen de serie
- **THEN** la API acepta únicamente esas imágenes del origen conocido

#### Scenario: Omitir una portada de Apoll Comics no utilizable

- **GIVEN** el origen incluye una serie con una portada ausente, vacía, malformada, con credenciales, de otro origen o con un placeholder
- **WHEN** se solicita el listado
- **THEN** la operación devuelve el resumen de la serie y omite `coverUrl`

### Requirement: Recuperación del lector Olympus

Olympus SHALL enviar cabeceras de navegador y preparar una sesión canónica reutilizable de hasta cinco minutos antes del lector. SHALL reintentar una vez tras renovar la sesión ante redirects externos o placeholders, sin seguir el mirror. SHALL devolver `UPSTREAM_INVALID_RESPONSE` si persiste y conservar la validación de índices y CDN de los paneles.

#### Scenario: Redirección externa transitoria

- **GIVEN** el lector redirige a un host externo
- **WHEN** el reintento de la URL original devuelve un capítulo válido
- **THEN** se devuelven sus paneles sin consultar el host externo

#### Scenario: Placeholder transitorio

- **GIVEN** el lector devuelve imágenes `/cp/cp-*.jpg` o el marcador del mirror
- **WHEN** el reintento devuelve un capítulo válido
- **THEN** se devuelven sus paneles válidos

#### Scenario: Redirecciones externas persistentes

- **WHEN** ambos intentos redirigen fuera del origen canónico
- **THEN** se devuelve `UPSTREAM_INVALID_RESPONSE` sin consultar el mirror

### Requirement: Páginas obtenidas por la app

El catálogo SHALL responder HTTP 202 con `client_action_required` y una acción `fetch_html` con URL, provider, seriesId y chapterId para los providers con `pages: app`. Olympus SHALL usar `https://olympusxyz.com/capitulo/<chapterId>/comic-<slug>`.

#### Scenario: Solicitar páginas en cliente

- **WHEN** el provider declara pages app
- **THEN** devuelve la acción para descargar el lector

### Requirement: Parseo de páginas

El POST a la misma ruta SHALL aceptar `{html: string}` de hasta 5 MB y devolver `{data: PageRef[]}` mediante `parsePages`. SHALL devolver 400 `PARSE_NOT_SUPPORTED` si no existe parser y 422 `INVALID_HTML` si no hay paneles válidos.

#### Scenario: Validar paneles

- **WHEN** Olympus recibe HTML
- **THEN** SHALL ordenar paneles por `data-i` y admitir únicamente imágenes válidas de su CDN. Apoll SHALL seguir usando GET de servidor.

#### Scenario: Solicitar el lector de Olympus

- **WHEN** se solicitan las páginas de Olympus
- **THEN** responde HTTP 202 con la acción `fetch_html` y la URL del lector

#### Scenario: Parsear el lector

- **WHEN** se envía HTML válido de Olympus
- **THEN** responde HTTP 200 con páginas ordenadas del CDN

#### Scenario: HTML inválido o parser inexistente

- **WHEN** se envía HTML sin paneles válidos o a un provider sin parser
- **THEN** responde respectivamente HTTP 422 `INVALID_HTML` o HTTP 400 `PARSE_NOT_SUPPORTED`

#### Scenario: Resolver páginas en servidor

- **WHEN** se solicitan páginas de Apoll
- **THEN** responde HTTP 200 con las páginas del servidor

### Requirement: Páginas del lector de Apoll Comics

Apoll Comics SHALL aceptar páginas HTTPS sin credenciales alojadas en `https://apollcomics.es`, `https://cdn1.apollcomics.es` o `https://cdn1.apollcomics.com`. SHALL rechazar cualquier otro origen, URLs con credenciales, URLs HTTP y URLs malformadas. SHALL declarar los tres orígenes permitidos en su manifest.

#### Scenario: Resolver el CDN actual

- **GIVEN** el HTML del lector contiene imágenes HTTPS de `cdn1.apollcomics.es`
- **WHEN** se solicitan las páginas del capítulo
- **THEN** la API devuelve las URLs de esas imágenes en el orden original

#### Scenario: Rechazar una página no autorizada

- **GIVEN** una página usa una URL externa, HTTP, con credenciales o malformada
- **WHEN** se solicitan las páginas del capítulo
- **THEN** la operación devuelve `UPSTREAM_INVALID_RESPONSE` sin aceptar esa imagen
