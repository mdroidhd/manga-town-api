## ADDED Requirements

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

