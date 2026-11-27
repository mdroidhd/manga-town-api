## Why

La API ya se puede ejecutar con Node.js, pero no dispone de una imagen preparada para producción ni de instrucciones para desplegarla en Coolify. Hace falta empaquetarla y permitir arrancar el mismo servicio en local.

## What Changes

- Añadir una imagen Docker multi-stage con Node.js 22, dependencias de producción, usuario no root y comprobación de salud.
- Añadir el servicio de la API a Docker Compose y conservar PostgreSQL y Redis, esperando a que sus healthchecks pasen.
- Documentar el despliegue con Dockerfile en Coolify, la configuración y el arranque local.
- Mantener las dependencias actuales y no activar integración con PostgreSQL o Redis, que aún no está implementada.

## Capabilities

### New Capabilities

- `deployment` — Construcción y ejecución de la API en contenedor, configuración de Coolify y entorno local con Compose.

### Modified Capabilities

Ninguna.

## Impact

Se añaden `Dockerfile` y `.dockerignore`, se amplían `docker-compose.yml` y `README.md`, y se documenta la capacidad de despliegue en OpenSpec. No se cambian el contrato HTTP ni las dependencias npm.
