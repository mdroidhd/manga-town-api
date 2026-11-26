## Context

El reconocimiento local documenta las rutas y los selectores de Madara. La ficha y el listado de capítulos comparten la ruta de serie. El parámetro `style=list` pide la lista completa. El lector publica imágenes con carga diferida en el HTML.

## Goals / Non-Goals

Resolver las cuatro operaciones del contrato desde las rutas públicas del catálogo. La búsqueda devuelve los resultados de la primera página de WordPress, dado que el contrato actual expone una única consulta sin parámetros de paginación.

## Decisions

- Usar un cliente con `fetch` inyectable para las peticiones GET a `https://apollcomics.es`. Aplicar un plazo de cinco segundos por petición, incluida la lectura del cuerpo. Propagar la cancelación y desactivar las redirecciones automáticas.
- Analizar HTML con Cheerio. Extraer los slugs de enlaces del sitio y usar los slugs para reconstruir las rutas. Conservar el orden de aparición y deduplicar los resultados y capítulos por slug. Extraer el número visible del capítulo a partir del texto cuando tenga un prefijo de capítulo y un número. Conservar el texto visible para otras etiquetas.
- Usar `data-src` con espacios recortados y recurrir a `src` cuando el primero esté vacío. En la ficha, omitir el placeholder `dflazy.jpg`. Resolver las URLs relativas y limitar las imágenes de salida a los dos orígenes del manifiesto. Numerar las páginas desde cero en orden del documento.
- Usar los códigos y mensajes públicos de Olympus para las clases de error del cliente. Registrar `ApollComicsProvider` en el módulo existente y sustituir su `fetch` en las pruebas.

## Risks / Trade-offs

La extracción depende de los selectores de Madara. El lector y la ficha devuelven un error estable si falta contenido obligatorio. Una búsqueda sin enlaces válidos devuelve una lista vacía. Los fixtures mantienen explícita la estructura de la que depende el provider.
