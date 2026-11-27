## MODIFIED Requirements

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

## ADDED Requirements

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
