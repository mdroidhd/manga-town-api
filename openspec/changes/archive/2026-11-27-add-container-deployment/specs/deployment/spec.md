## Purpose

Preparar la API para su despliegue en Coolify mediante una imagen Docker y facilitar un entorno local equivalente con Compose.

## ADDED Requirements

### Requirement: Imagen de producción

La aplicación SHALL proporcionar un Dockerfile multi-stage basado en `node:22-alpine`. La etapa de build SHALL instalar las dependencias incluyendo las de desarrollo con `npm ci --include=dev` y compilar la API. La etapa runtime SHALL contener `dist/`, `package.json`, `package-lock.json` y solo las dependencias de producción instaladas con `npm ci --omit=dev`. SHALL ejecutar `node dist/main.js` con el usuario `node`, `NODE_ENV=production` y el puerto 3000 expuesto.

#### Scenario: Construir y ejecutar la imagen

- **WHEN** se construye el Dockerfile con Docker y se inicia la imagen
- **THEN** la API compilada arranca como usuario no root con dependencias de producción
- **AND** escucha en el puerto 3000 con la configuración predeterminada

### Requirement: Salud y contexto de build

La imagen SHALL comprobar su salud con `wget` contra `http://127.0.0.1:3000/v1/health`. El contexto Docker SHALL excluir `node_modules`, `dist`, `coverage`, `.git`, `.github`, `test`, `docs`, `openspec` y `.env*`. La documentación SHALL indicar que cambiar `PORT` o `API_PREFIX` exige ajustar el healthcheck.

#### Scenario: Comprobar una API sana

- **WHEN** la API responde correctamente en `/v1/health` dentro del contenedor
- **THEN** el healthcheck de la imagen finaliza correctamente

#### Scenario: Construir con archivos locales adicionales

- **GIVEN** existen dependencias, artefactos, tests o archivos `.env` en el directorio local
- **WHEN** se envía el contexto de construcción
- **THEN** Docker excluye esos archivos según `.dockerignore`

### Requirement: Entorno local con Compose

Compose SHALL construir la aplicación desde el Dockerfile y publicar el puerto 3000. SHALL admitir un archivo `.env` opcional, conservar PostgreSQL y Redis con sus healthchecks y esperar a que ambos estén sanos antes de iniciar la API. La aplicación SHALL tener su propio healthcheck.

#### Scenario: Arrancar todos los servicios

- **WHEN** se ejecuta `docker compose up --build` con o sin un archivo `.env`
- **THEN** Compose construye la API y espera a que PostgreSQL y Redis estén sanos antes de iniciarla
- **AND** la API se puede consultar en el puerto 3000 con la configuración predeterminada

### Requirement: Guía de despliegue

El README SHALL documentar una Application de Coolify con Build Pack Dockerfile, puerto 3000, healthcheck `/v1/health` y variables `NODE_ENV`, `PORT`, `API_PREFIX`, `CORS_ORIGINS` y `SWAGGER_ENABLED`. SHALL indicar que PostgreSQL y Redis se añaden como recursos separados cuando se utilicen y describir el arranque local con Docker Compose.

#### Scenario: Configurar Coolify

- **WHEN** una persona sigue la guía para desplegar la API
- **THEN** configura el Dockerfile, puerto, ruta de salud y variables necesarias
- **AND** sabe que PostgreSQL y Redis aún no son necesarios para el funcionamiento actual
