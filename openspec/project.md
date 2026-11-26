# Manga Town API

## Propósito

API NestJS para un lector móvil tipo Mihon. Las extensiones se registran y ejecutan en el servidor. La app elige una fuente y consume resultados normalizados de búsqueda, fichas, capítulos y páginas. Cuando la fuente necesita una acción del usuario o una petición desde su dispositivo, la API devuelve el paso tipado que debe ejecutar la app.

## Estado actual

- NestJS 11 y TypeScript sobre Node.js 20 o superior. Zod valida el entorno y el JSON de Olympus. Swagger está disponible en `/docs` cuando está habilitado. La API usa por defecto el prefijo `/v1` y expone rutas de salud, providers y catálogo, incluida la resolución de páginas. `CatalogController` pasa `userId: 'anonymous'` a los providers.
- `ProvidersModule` registra `olympus` y `apollcomics`, dos fuentes de cómics en español que operan en el servidor sin login ni captcha. Ambas usan el slug como ID de serie. Olympus descubre el origen canónico, cachea en memoria el origen y la lista pública de series y pagina capítulos. Apoll Comics extrae su catálogo del HTML de Madara. Las pruebas e2e simulan las respuestas de ambas fuentes.
- El dominio en `src/domain/` contiene tipos y contratos independientes de NestJS. `src/modules/` reúne el catálogo y el registro de extensiones. `src/infrastructure/` reserva los adaptadores compartidos del diseño.

## Contrato de providers

Cada `Provider` declara un `manifest` con ID estable, nombre, versión, `contractVersion`, tipos de contenido, idiomas, orígenes permitidos y capacidades. `login` y `captcha` aceptan `none`, `server` o `app`. `pages` indica `server` o `app`. `deviceEgress` señala si una petición debe salir desde el dispositivo del usuario.

| Operación | Resultado normalizado |
| --- | --- |
| `search(query, ctx)` | Lista de resúmenes de series. |
| `getSeries(id, ctx)` | Ficha de una serie. |
| `listChapters(id, ctx)` | Lista de capítulos. |
| `getPages(id, chapter, ctx)` | Lista ordenada de páginas con índice y URL o referencia opaca. `chapter` es el ID del capítulo. |

El contexto `ProviderContext` contiene `userId`, una sesión opcional y una señal opcional de cancelación. Las operaciones devuelven `ok` con datos, `client_action_required` con `continuationId`, `expiresAt` y la acción tipada, o `error` con código estable. La acción puede ser `login`, `captcha` o `fetch` y declara el origen autorizado y el tipo de resultado esperado. El catálogo ya traduce `client_action_required` a HTTP 202. El almacenamiento de continuations y su reanudación siguen pendientes.

## Módulos pendientes

| Módulo | Responsabilidad prevista |
| --- | --- |
| `sessions` | Separar la sesión de la API de la sesión de fuente. Aislar las sesiones de fuente por usuario y provider, con ámbito de dispositivo cuando la fuente lo requiera. Cifrar y limitar la vigencia de los artefactos que use el servidor. Los ligados al dispositivo permanecen en la app. |
| `continuations` | Persistir el estado de una operación y recibir el resultado mínimo que envía la app a `POST /continuations/{id}/resume`, bajo el prefijo de la API. Validar la acción, la vigencia, el propietario, la sesión y la versión del provider. Reclamar cada paso de forma atómica y permitir otra acción o un resultado final. |
| `cache` | Incorporar una caché compartida para resultados públicos y un ámbito privado por usuario y sesión cuando haga falta. Respetar el TTL y la caducidad de las URLs firmadas. Olympus ya cuenta con su propia caché local. |
| `queues` | Ejecutar refrescos, precargas y operaciones lentas en workers. Deduplicar trabajos y limitar reintentos a fallos transitorios de operaciones idempotentes. |
| `provider-runtime` | Aislar las extensiones con permisos mínimos y límites de recursos, tiempo y concurrencia. Restringir la red a los orígenes autorizados y bloquear destinos internos. |

`reader` y `persistence` también quedan pendientes como módulo de aplicación y adaptador compartido, respectivamente. Las rutas de catálogo ya llaman a `getPages`.

## Desarrollo y verificación

Usa `npm ci` para instalar las dependencias del repo. CI usa Node.js 22 y ejecuta lint con ESLint, build con NestJS, pruebas unitarias con Jest y pruebas e2e con Jest y Supertest. Mantén los secretos de sesión fuera de los logs, de las respuestas públicas, de la caché de respuestas y de las cargas de cola.

[README](../README.md) · [Arquitectura](../docs/ARQUITECTURA.md) · [Plan de Olympus](../docs/PLAN-OLYMPUS.md) · [Contrato en código](../src/domain/provider.contract.ts)
