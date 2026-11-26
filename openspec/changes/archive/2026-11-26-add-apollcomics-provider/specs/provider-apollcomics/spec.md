# Delta de Apoll Comics

## Purpose

Consultar el catálogo y resolver la lectura de Apoll Comics desde el servidor mediante el contrato de providers.

## ADDED Requirements

### Requirement: Registro y manifiesto de Apoll Comics

La API SHALL registrar `apollcomics` con el nombre `Apoll Comics`, versión de contrato `1`, tipo `comic`, idioma `es` y orígenes `https://apollcomics.es` y `https://cdn1.apollcomics.com`. El manifiesto SHALL declarar `login: none`, `captcha: none`, `pages: server` y `deviceEgress: false`.

#### Scenario: Descubrir la fuente

- **WHEN** un cliente lista los providers y consulta el manifiesto de `apollcomics`
- **THEN** la lista incluye `apollcomics` y su manifiesto declara los orígenes y las capacidades indicadas

### Requirement: Búsqueda de series

El provider SHALL consultar `/?s=<q>&post_type=wp-manga` con la consulta codificada. SHALL devolver un resumen por slug, en orden de aparición, con el título y el ID extraídos de cada enlace `a.h4[href]` válido del sitio que apunte a `/manga/<slug>/`.

#### Scenario: Normalizar los resultados de WordPress

- **GIVEN** una respuesta con enlaces de series válidos, un duplicado y enlaces ajenos al catálogo
- **WHEN** se busca una consulta que contiene espacios y caracteres reservados
- **THEN** la petición codifica la consulta y el catálogo devuelve los slugs y títulos válidos una vez en orden de aparición

#### Scenario: Buscar sin coincidencias

- **WHEN** WordPress responde correctamente sin enlaces de resultados válidos
- **THEN** la búsqueda devuelve una lista vacía

### Requirement: Ficha de serie por slug

El provider SHALL consultar `/manga/<slug>/` y devolver el slug, el ID del provider y el título de `h1`. SHALL incluir cuando estén disponibles la portada de `.summary_image img`, la descripción de `.description-summary` y el estado de `.post-content_item`. SHALL preferir `data-src` de la portada y omitir el placeholder `dflazy.jpg`.

#### Scenario: Normalizar una ficha con portada diferida

- **GIVEN** una ficha con título, descripción, estado y una imagen con `data-src` real y `src` de placeholder
- **WHEN** se consulta por slug
- **THEN** la ficha incluye esos datos y la URL absoluta de la portada real

#### Scenario: Recibir una ficha sin título

- **WHEN** la ficha responde correctamente pero no contiene un `h1` con texto
- **THEN** la operación devuelve `UPSTREAM_INVALID_RESPONSE`

### Requirement: Listado de capítulos por slug

El provider SHALL consultar `/manga/<slug>/?style=list` y extraer capítulos de `li.wp-manga-chapter > a`. SHALL conservar una entrada por slug de capítulo en orden de aparición y aceptar enlaces de capítulo de la serie solicitada y del origen del sitio. SHALL devolver el número visible a partir del texto del enlace, conservando el texto cuando sea una etiqueta sin número de capítulo.

#### Scenario: Obtener los capítulos de una serie

- **GIVEN** una lista con capítulos válidos, un título de especial, un duplicado y un enlace de otra serie
- **WHEN** se solicita el listado por slug
- **THEN** la única petición incluye `style=list` y la respuesta contiene los slugs de la serie en el orden del HTML con su número o etiqueta

### Requirement: Resolución ordenada de páginas

El provider SHALL consultar `/manga/<slug>/<chapter-slug>/` y devolver las imágenes de `div.reading-content .page-break img` con índices consecutivos desde cero y en orden del documento. SHALL recortar espacios de las fuentes y usar `src` cuando `data-src` esté ausente o vacío. Las URLs de imágenes devueltas, incluidas las portadas, MUST pertenecer a un origen del manifiesto y carecer de credenciales.

#### Scenario: Leer imágenes con carga diferida

- **GIVEN** un lector con imágenes JPG y PNG que usan `data-src` con espacios o `src`
- **WHEN** se consultan sus páginas por los slugs de serie y capítulo
- **THEN** se devuelven las URLs absolutas con los índices en orden de aparición

#### Scenario: Rechazar un lector inválido

- **WHEN** el lector carece de imágenes seleccionables o contiene una imagen sin una URL permitida
- **THEN** la operación devuelve `UPSTREAM_INVALID_RESPONSE`

### Requirement: Errores de contenido y del sitio

El provider SHALL devolver `NOT_FOUND` para slugs inválidos o para un HTTP 404 de ficha, capítulos o lector, `UPSTREAM_RATE_LIMIT` para HTTP 429 y `UPSTREAM_UNAVAILABLE` para fallos de transporte u otros estados de error. Los mensajes públicos MUST omitir el cuerpo y los detalles internos del fallo.

#### Scenario: Solicitar contenido inexistente o un slug inválido

- **WHEN** se consulta contenido que responde 404 o se proporciona un slug que no es un segmento válido
- **THEN** se devuelve `NOT_FOUND` y un slug inválido se rechaza antes de llamar a `fetch`

#### Scenario: Recibir un error del sitio

- **WHEN** el sitio responde 429 o 503, o falla el transporte
- **THEN** la operación devuelve `UPSTREAM_RATE_LIMIT` para 429 y `UPSTREAM_UNAVAILABLE` para los otros fallos

### Requirement: Peticiones acotadas al sitio

El cliente MUST limitar las peticiones al origen del sitio y evitar el seguimiento automático de redirecciones. El provider SHALL devolver `UPSTREAM_INVALID_RESPONSE` ante una redirección inesperada, `UPSTREAM_TIMEOUT` al vencer el plazo y `REQUEST_ABORTED` al cancelar la operación.

#### Scenario: Recibir una redirección inesperada

- **WHEN** el sitio redirige a otro origen
- **THEN** la operación devuelve `UPSTREAM_INVALID_RESPONSE`
- **AND** el cliente no solicita el destino de la redirección

#### Scenario: Interrumpir una petición pendiente

- **WHEN** vence el plazo o el contexto cancela la operación durante la petición
- **THEN** se devuelve respectivamente `UPSTREAM_TIMEOUT` o `REQUEST_ABORTED`
