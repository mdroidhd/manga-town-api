## MODIFIED Requirements

### Requirement: Búsqueda de series

El provider SHALL consultar `/?s=<q>&post_type=wp-manga` con la consulta codificada. SHALL extraer el título y el ID de los enlaces con `href` que estén dentro de contenedores `.h4` o `.post-title` de resultados de Madara. Solo SHALL aceptar enlaces del origen de Apoll Comics que apunten a una ruta de serie `/manga/<slug>/` y SHALL devolver un resumen por slug, en orden de aparición.

#### Scenario: Extraer títulos de los contenedores de Madara

- **GIVEN** una respuesta con un enlace de serie dentro de `h3.h4` y otro enlace de serie dentro de `.post-title`
- **WHEN** se realiza la búsqueda
- **THEN** el catálogo devuelve los slugs y los títulos de ambas series en orden de aparición

#### Scenario: Normalizar los resultados de WordPress

- **GIVEN** una respuesta con enlaces de series válidos dentro de contenedores de resultado, un duplicado, un enlace de capítulo y un enlace a otro origen
- **WHEN** se busca una consulta que contiene espacios y caracteres reservados
- **THEN** la petición codifica la consulta y el catálogo devuelve los slugs y títulos válidos una vez en orden de aparición

#### Scenario: Buscar sin coincidencias

- **WHEN** WordPress responde correctamente sin enlaces de resultados válidos
- **THEN** la búsqueda devuelve una lista vacía
