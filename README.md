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

Servicios opcionales para las siguientes fases:

```bash
docker compose up -d
```

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
