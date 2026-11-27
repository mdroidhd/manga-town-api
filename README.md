# Manga Town API

API NestJS para un lector tipo Mihon donde **las extensiones viven en el servidor**. La app elige una fuente y consume datos normalizados; cuando una fuente exige login, captcha o una petición desde el dispositivo, la API devuelve una acción tipada que la app ejecuta y reanuda.

## Estado

- Configuración validada con Zod al arrancar (`src/config/env.ts`).
- Prefijo de API versionado, CORS, validación global y errores uniformes.
- Swagger en `/docs`.
- Salud en `/v1/health` y contador de extensiones en `/v1/health/providers`.
- Registro de providers con manifiesto y capacidades (`src/modules/providers`).
- Endpoints de catálogo (`/v1/catalog/:provider/...`) que traducen `OperationResult` a HTTP.
- Olympus Scanlation y Apoll Comics ofrecen búsquedas, novedades, fichas, capítulos y páginas de lectura.
- Tests unitarios y e2e.

## Arranque

```bash
npm install
cp .env.example .env
npm run start:dev
```

- API: `http://localhost:3000/v1`
- Swagger: `http://localhost:3000/docs`
- Salud: `http://localhost:3000/v1/health`

## Docker Compose en local

Para levantar la API junto a PostgreSQL y Redis (requiere Docker Compose 2.24.0 o posterior):

```bash
docker compose up --build -d
curl http://localhost:3000/v1/health
```

El archivo `.env` es opcional. Si existe, Compose pasa sus variables a la aplicación; puedes crearlo con `cp .env.example .env` y editarlo. El ejemplo usa `NODE_ENV=development` y habilita Swagger; sin `.env`, la imagen usa `NODE_ENV=production`. PostgreSQL y Redis se arrancan y se comprueba su salud antes de iniciar la API, pero la API todavía no los utiliza. Para detener los servicios: `docker compose down`.

La aplicación, el mapeo y los healthchecks de Dockerfile y Compose usan el puerto 3000 y el prefijo `v1`. Si cambias `PORT`, ajusta el puerto publicado y ambos healthchecks; si cambias `API_PREFIX`, ajusta la ruta de ambos healthchecks. Dentro de Compose, las futuras URLs de PostgreSQL y Redis deberán usar los nombres de servicio `postgres` y `redis`, no `localhost`.

## Despliegue en Coolify

1. Crea un recurso **Application** desde el repositorio y elige **Dockerfile** como Build Pack.
2. Configura **Ports Exposes** en **3000**. En **Healthcheck**, selecciona **HTTP**, método **GET**, esquema **http**, host **localhost**, puerto **3000** y ruta **`/v1/health`**; guarda los cambios y habilita el healthcheck. Esta configuración sustituye al `HEALTHCHECK` incluido en el Dockerfile. Si prefieres el de la imagen, deja el healthcheck del panel deshabilitado.
3. Añade estas variables de entorno en Coolify:

   ```text
   NODE_ENV=production
   PORT=3000
   API_PREFIX=v1
   CORS_ORIGINS=https://tu-cliente.example
   SWAGGER_ENABLED=false
   ```

   Sustituye `CORS_ORIGINS` por los orígenes permitidos, separados por comas si hay varios.

4. Despliega la aplicación. Comprueba que `/v1/health` responde a través de la URL configurada.

Si cambias `PORT`, actualiza el puerto de Coolify y el healthcheck del Dockerfile; si cambias `API_PREFIX`, actualiza también las rutas de salud del Dockerfile y de Coolify. PostgreSQL y Redis aún no son necesarios para la API. Cuando se usen, añádelos como recursos separados en Coolify y configura las URLs de conexión correspondientes.

## Contrato de provider

Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). En resumen: cada extensión expone un `manifest` con id, versión, tipos, idiomas, orígenes permitidos y capacidades (`login`, `captcha`, `pages`, `deviceEgress`), e implementa `search`, `getSeries`, `listChapters` y `getPages`.

Las operaciones devuelven:

- `ok` con datos.
- `client_action_required` con una acción (`login`, `captcha`, `fetch`) y un `continuationId` que la app reanuda.
- `error` con un código estable.

## Estructura

```
src/
  api/                 controladores HTTP (catalog, providers)
  common/              filtros e interceptores
  config/              validación de entorno
  domain/              contratos y tipos, sin NestJS
  health/              chequeos
  infrastructure/      adaptadores (cache, persistence, queues, provider-runtime)
  modules/             casos de uso (catalog, providers, sessions, continuations, reader)
```

`infrastructure/` y los módulos `sessions`, `continuations` y `reader` están creados pero vacíos: son las siguientes piezas del diseño.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run start:dev` | Arranca con recarga |
| `npm run build` | Compila a `dist/` |
| `npm run lint` | ESLint sin warnings |
| `npm test` | Tests unitarios |
| `npm run test:e2e` | Tests e2e |
