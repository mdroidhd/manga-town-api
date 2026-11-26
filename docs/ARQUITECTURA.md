# Arquitectura de Manga Town API

API NestJS para un lector móvil tipo Mihon. Las extensiones se instalan y ejecutan en el servidor. Cuando una fuente requiere la interacción del usuario o una sesión del dispositivo, la app ejecuta el paso correspondiente y la API coordina el flujo.

## Capas y módulos

| Capa | Carpetas y responsabilidades |
| --- | --- |
| HTTP | `src/api/` contiene controladores NestJS, autenticación del usuario, validación de solicitudes y traducción de errores a respuestas HTTP. |
| Aplicación | `src/modules/` contiene los módulos `catalog` para búsqueda, fichas y capítulos, `reader` para resolver páginas, `providers` para el registro de extensiones, `sessions` para sesiones de fuente y `continuations` para pausar y reanudar operaciones. |
| Dominio | `src/domain/` define entidades, resultados de operación y contratos de providers, sesiones y continuations. Es independiente de NestJS y del almacenamiento. |
| Infraestructura | `src/infrastructure/` contiene los adaptadores `persistence`, `cache`, `queues` y `provider-runtime`. Los módulos de aplicación coordinan estos adaptadores a través de los contratos del dominio. |

## Contrato del provider

Cada extensión publica un manifest versionado con `id` estable, `name`, `version`, `contractVersion`, idiomas, orígenes HTTPS autorizados para el servidor y la app, y capacidades declaradas. El registro valida el manifest y la compatibilidad antes de habilitar la extensión. Las operaciones base son `search`, `getManga` y `listChapters`. Los IDs externos se identifican junto con `providerId`.

| Capacidad | Contrato |
| --- | --- |
| `login` | `startLogin` inicia el acceso cuando la fuente exige cuenta. Puede solicitar que la app abra el flujo oficial de la fuente. |
| `captcha` | Una operación puede solicitar un reto interactivo oficial que resuelve el usuario en la app. |
| `pages` | `getPages` resuelve la lista ordenada de páginas de un capítulo. Cada entrada tiene índice y una referencia de imagen o una URL autorizada con caducidad si aplica. Una lista devuelta como `ok` permite a la app descargar y mostrar las imágenes con su sesión local cuando corresponda. |

Cada operación devuelve `ok`, `client_action_required` o `error` con código estable. Los providers reciben un contexto acotado a la operación y a su sesión. `resume` recibe el estado opaco del paso y un resultado validado según la acción declarada.

## Continuations

1. Si una operación necesita a la app, la API persiste el estado y devuelve `client_action_required` con `continuationId` opaco, `expiresAt` y una acción tipada `login`, `captcha` o `fetch`. Cada acción especifica el origen autorizado y el resultado esperado. Para `fetch`, también se fijan método, recurso y límites de respuesta. La app ejecuta únicamente esas acciones declaradas.
2. La app reanuda por `POST /continuations/{id}/resume` con su sesión de la API y los datos mínimos del paso.
3. La API valida el resultado y verifica que el paso siga vigente y pertenezca al usuario, a la operación, a su contexto de sesión de fuente y a la versión del provider. Reclama cada paso de forma atómica. Una solicitud duplicada recupera el estado o resultado ya registrado. El provider puede devolver otra acción o completar la operación. Si el paso expiró, la app vuelve a iniciar la operación.

## Sesiones, caché y colas

- **Sesiones.** La identidad de la API y la sesión de una fuente tienen ciclos de vida propios. La sesión de fuente se vincula a `userId` y `providerId`, con ámbito de dispositivo cuando la fuente lo requiere. Las cookies y los tokens ligados al dispositivo se guardan en la app. Cuando el servidor necesita y puede usar un artefacto de sesión, lo cifra en reposo y limita su vigencia. Cerrar la sesión de fuente invalida sus continuations y su caché privada.
- **Caché.** Compartir únicamente respuestas públicas. Las claves incluyen provider, versión, operación y parámetros normalizados. Las entradas privadas incluyen además usuario y sesión. Aplicar TTL según el recurso y respetar la caducidad de URLs firmadas. Cookies, tokens y retos quedan fuera de la caché de respuestas.
- **Colas.** Los workers ejecutan refrescos, precargas y consultas remotas lentas fuera de la petición HTTP. Los trabajos llevan referencias a su contexto, con deduplicación y reintentos acotados para fallos transitorios en operaciones idempotentes. Si un trabajo requiere a la app, el estado consultable del trabajo expone la continuation al usuario propietario y el worker queda libre.

## Aislamiento

Ejecutar las extensiones en procesos o contenedores separados de la API, con permisos mínimos sobre el sistema de archivos y límites de CPU, memoria, tiempo y concurrencia. El runtime autoriza las solicitudes de red según el manifest y bloquea destinos internos y redirecciones fuera de los orígenes permitidos. La app aplica la política de orígenes a sus acciones delegadas. Dar a cada ejecución acceso solo al contexto necesario para esa sesión, con los secretos fuera de logs, caché y cargas de cola.
