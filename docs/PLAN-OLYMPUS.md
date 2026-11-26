# Plan de implementación: Olympus

Base: [recon del 26-11-2026](RECON-OLYMPUS.md) y [arquitectura](ARQUITECTURA.md). Registrar `olympus` (Olympus Scanlation, versión `0.1.0`, contrato `1`, `kinds: ['comic']`, `languages: ['es']`) junto a `demo`. Todo se ejecuta en el servidor: `login: none`, `captcha: none`, `pages: server`, `deviceEgress: false`; no se usan cookies ni sesiones.

## Contrato y endpoints

| Operación | Petición a Olympus | Mapeo al contrato |
| --- | --- | --- |
| `search(query)` | `GET /api/series/list` → `data[]`: `id`, `name`, `slug`, `cover`, `type`. | Filtrar `type === 'comic'` y buscar por subcadena de `name` (sin distinguir mayúsculas ni tildes). Devolver `id: slug`, `providerId: 'olympus'`, `title: name`, `coverUrl: cover` si es una URL admitida. Sin coincidencias: `ok([])`. |
| `getSeries(id)` | `GET /api/series/{slug}?type=comic` → `data`: `id`, `name`, `summary`. | Usar el `slug` solicitado como `id`, `providerId: 'olympus'`, `name` → `title` y `summary` → `description` si es texto. No rellenar `status`, `coverUrl` ni `year` con campos no verificados en el detalle. |
| `listChapters(id)` | `GET /api/series/{slug}/chapters?page=N&direction=desc&type=comic` → `data[]`: `id`, `name`, `published_at`, `team`, `read_by_auth`; `meta.total`. | `id` numérico → cadena decimal, `name` → `number` (conservar texto, por ejemplo `190` o `10.5`), `published_at` → `publishedAt` si está presente. Omitir `title`, `team` y `read_by_auth`: `name` no es un título y los otros dos campos no tienen equivalente. |
| `getPages(id, chapter)` | `GET /capitulo/{chapterId}/comic-{slug}` → `301` a `/series/comic-{slug}/capitulo/{numero}` → HTML. | Cada `img[src]` en `main.strip div.panel > img` aporta `url`; el `data-i` del panel da el `index` (base 0). Devolver solo `{ index, url }`, en orden ascendente. |

- El ID público de serie es **el slug exacto del upstream**, en el ámbito de `providerId`; no generar slugs ni mantener un mapa desde el `id` numérico. Detalle y capítulos funcionan sin búsqueda previa.
- `chapter` es **`ChapterSummary.id`**, no `number`. Validar que sea un entero decimal positivo; rechazar slugs vacíos, `.`/`..` o con barras y codificar el slug como segmento de ruta.
- Capítulos: empezar en `page=1` y conservar el orden `desc`; deduplicar por `id` y parar al alcanzar `meta.total`. Página vacía o sin IDs nuevos antes de tiempo: error, nunca resultados parciales. `total: 0` con lista vacía es válido.

## Descubrimiento y caché

- En el primer uso de Olympus (sin bloquear el arranque de Nest), hacer `GET https://olympus.pages.dev/` y extraer `content` de `meta[property="og:url"]` con Cheerio. Validar HTTPS sin credenciales y guardar solo el `origin`, hoy `https://olympusxyz.com`.
- Declarar en `manifest.origins` la entrada `https://olympus.pages.dev`, el canónico aprobado `https://olympusxyz.com` y el CDN `https://media.imagesolymp.xyz`. El `og:url` solo puede elegir un origen canónico ya aprobado, no añadir uno nuevo; el CDN se usa para validar URLs de salida, no para descargar imágenes.
- Caché de origen en memoria por instancia de Nest: 1 h de TTL y un solo refresco en vuelo. Si la consulta falla por red, timeout, `429` o `5xx`, reutilizar el último origen válido hasta 24 h desde su validación y esperar 30 s antes de otro intento. No usar la copia si se anuncia un origen no permitido.
- Caché de `/api/series/list`: clave `(providerId, versión, origen, series/list)` y snapshot con solo los cómics y sus títulos normalizados. TTL de 15 min; entre 15 y 60 min desde la última carga correcta, servir el snapshot y refrescarlo en segundo plano en la primera búsqueda que lo necesite.
- Compartir una sola descarga por origen entre búsquedas simultáneas. En frío o pasados 60 min, esperar una carga válida. Reemplazar el snapshot solo tras validar la respuesta; ante fallo conservar la copia hasta su límite, con 30 s de espera antes de otro refresco en segundo plano. Un cambio de origen no reutiliza la lista anterior.

## Lector HTTP y errores

- Usar `fetch` de Node con redirección manual. En `getPages`, seguir un solo `301`: resolver `Location` contra la URL inicial, exigir HTTPS sin credenciales, el mismo origen canónico y la ruta esperada de esa serie antes de solicitar el HTML. Rechazar saltos extra; un `200` directo solo vale si contiene un lector válido.
- Con **Cheerio**, seleccionar `main.strip div.panel > img`, leer `src` y ordenar numéricamente por el `data-i` del padre. Resolver URLs relativas contra la URL final y exigir que sean HTTPS del CDN declarado. Cero páginas, panel sin imagen válida o índices ausentes, duplicados o discontinuos son errores, no una lista vacía. No descargar ni proxificar los archivos.
- Validar el JSON con Zod; si `cover` es texto, resolverlo contra el origen canónico y aceptar solo una URL HTTPS sin credenciales del canónico o del CDN. Si no cumple, omitir `coverUrl`.
- Límites iniciales: 5 s por petición incluido el cuerpo, 15 s por operación y 30 s para paginar capítulos; respetar `ctx.signal`. Si un consumidor cancela o agota su plazo, deja de esperar los refrescos compartidos sin cancelarlos para los demás; cada refresco mantiene su propio timeout. Sin reintentos HTTP en línea.
- Devolver `status: 'error'` con código estable: `NOT_FOUND` para ID inválido o `404` de la ficha, primera página de capítulos o lector; `UPSTREAM_TIMEOUT` para plazos agotados; `REQUEST_ABORTED` si cancela el llamador; `UPSTREAM_RATE_LIMIT` para `429`; `UPSTREAM_UNAVAILABLE` para red y demás fallos HTTP de Olympus; `UPSTREAM_INVALID_RESPONSE` para JSON/HTML/`Location` inválido, origen rechazado o paginación incoherente.
- Mantener `CatalogController` y `AllExceptionsFilter`: `NOT_FOUND` → HTTP 404; demás errores del provider → 502 con el código estable. No incluir cuerpos remotos, cookies ni trazas en la respuesta pública.

## Pruebas (sin peticiones reales a Olympus)

- **Unitarias (Jest):** fixtures JSON con `comic` y otro tipo, título con tildes, `id` distinto de `slug`, ficha con `summary` y dos páginas con `meta.total`, `published_at` y número decimal. Probar búsqueda/mapeo, detalle en frío, orden y deduplicación de capítulos, y error ante paginación truncada o JSON inválido.
- **Caché y fallos (Jest, reloj simulado):** comprobar carga única concurrente, TTL y copia anterior al fallar el refresco, separación por origen, expiración dura y cancelación de un consumidor sin cancelar al otro. Simular `404`, `429`, `5xx`, timeout, `og:url` no autorizado y HTML sin páginas.
- **E2E (Nest + Supertest):** levantar `AppModule`, verificar `GET /v1/providers/olympus` y llamar a las cuatro rutas de `/v1/catalog/olympus`. Con `undici.MockAgent` como dispatcher de `fetch` y `disableNetConnect()`, simular descubrimiento, JSON y `/capitulo/135953/comic-20-225-2sabueso13424` → `301` → `/series/comic-20-225-2sabueso13424/capitulo/190`. El fixture HTML tiene paneles desordenados e imágenes ajenas al selector; comprobar `index`/URL, `404 NOT_FOUND` y `502 UPSTREAM_INVALID_RESPONSE` sin contactar al host de un `Location` externo.
- Comprobar que se consumen los interceptores pactados, restaurar el dispatcher y cerrar el mock y la app; Supertest usa solo loopback. El CI actual ya ejecuta `npm test` y `npm run test:e2e`.

## Ficheros, en orden de implementación

1. `package.json` — Añadir Cheerio en runtime y Undici para pruebas, con versiones compatibles con Node 20+.
2. `package-lock.json` — Reflejar las dependencias elegidas para que `npm ci` sea reproducible.
3. `src/modules/providers/olympus/olympus.client.ts` — Implementar HTTP, política de orígenes, redirección manual y caché del canónico.
4. `src/modules/providers/olympus/olympus.provider.ts` — Declarar el manifest e implementar los cuatro mapeos, la caché de búsqueda y la extracción de páginas.
5. `src/modules/providers/providers.module.ts` — Registrar una única instancia de Olympus junto a Demo sin red durante el arranque.
6. `test/fixtures/olympus/series-list.json` — Cubrir búsqueda, filtros de tipo e identidad por slug.
7. `test/fixtures/olympus/series-detail.json` — Representar la ficha con los campos confirmados.
8. `test/fixtures/olympus/chapters.json` — Guardar dos respuestas paginadas con números de capítulo en texto.
9. `test/fixtures/olympus/landing.html` — Representar la página de descubrimiento y su `og:url`.
10. `test/fixtures/olympus/chapter.html` — Representar el lector final con `data-i` fuera de orden y elementos ajenos.
11. `src/modules/providers/olympus/olympus.provider.spec.ts` — Cubrir mapeos, cachés y fallos con fixtures y reloj controlado.
12. `test/olympus.e2e-spec.ts` — Probar registro y rutas HTTP reales de Nest contra un upstream simulado.

## Riesgos y fuera de alcance

- Si se muda a un host nuevo, verificarlo y añadirlo al manifest antes de usarlo; una mudanza no cambia los IDs mientras se mantengan los slugs. Renombrar un slug sí rompe referencias y no se crearán alias en esta versión.
- Cambios en JSON, selector o CDN pueden romper mapeos; las pruebas de fixtures detectan regresiones internas, no cambios en producción. La lista ocupa RAM por réplica; paginar series largas o modificadas durante la consulta puede terminar en error.
- Fuera: rankings, novedades, catálogo paginado, géneros/estados, login/captcha/continuations, descarga de imágenes, caché distribuida, colas e infraestructura de aislamiento del runtime.
