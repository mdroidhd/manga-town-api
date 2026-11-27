## Context

La API NestJS compila a `dist/main.js`, escucha en todas las interfaces y sirve `/v1/health` con la configuración predeterminada. PostgreSQL y Redis ya están definidos en Compose con healthchecks, pero la aplicación todavía no los utiliza.

## Goals / Non-Goals

**Goals**

- Construir una imagen de producción y ejecutarla como usuario no root.
- Facilitar el despliegue en Coolify y el arranque local con los servicios existentes.

**Non-Goals**

- Añadir dependencias, integración con bases de datos o cambiar rutas y comportamiento de la API.
- Aprovisionar PostgreSQL o Redis dentro de la imagen de la API.

## Decisions

- Usar `node:22-alpine` en las dos etapas. La etapa de build instala dependencias de desarrollo con `npm ci --include=dev` y compila; runtime instala solo dependencias de producción y copia únicamente `dist/` y los dos manifiestos.
- Ejecutar con el usuario `node` y definir producción en la imagen. El healthcheck utiliza `wget` contra `127.0.0.1:3000/v1/health`; puerto y prefijo personalizados requieren ajustar las comprobaciones.
- Compose construye la aplicación, publica 3000, lee un `.env` opcional y espera a que PostgreSQL y Redis estén sanos. Los servicios siguen sin ser dependencias funcionales de la API.
- Coolify despliega la aplicación con Build Pack Dockerfile; PostgreSQL y Redis se crearán como recursos separados cuando se utilicen.

## Risks / Trade-offs

- El healthcheck y el mapeo del puerto son fijos: cambiar `PORT` o `API_PREFIX` exige ajustar la configuración correspondiente.
- El entorno de trabajo no dispone de daemon Docker; se validará por inspección y mediante las comprobaciones de Node, sin afirmar que se ha construido o ejecutado la imagen.
