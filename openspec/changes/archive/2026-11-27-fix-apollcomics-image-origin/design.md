## Context

El parser exige que las URLs de páginas pertenezcan al origen del sitio o a `cdn1.apollcomics.com`. La respuesta real del capítulo usa `cdn1.apollcomics.es` para todas sus imágenes, por lo que la validación de seguridad rechaza contenido legítimo aunque el HTML y la selección de elementos sean válidos.

## Goals / Non-Goals

Se actualizará la lista cerrada de orígenes de imagen de Apoll Comics y su declaración de permisos. No se relajará la validación para aceptar hosts arbitrarios, HTTP, credenciales de usuario o redirecciones externas.

## Decisions

- Definir los dos CDNs como constantes explícitas y comprobar la pertenencia exacta de la URL al origen permitido.
- Mantener `apollcomics.es` como origen permitido para enlaces e imágenes relativas o alojadas directamente en el sitio.
- Exponer en el manifest los mismos orígenes que acepta el parser para evitar diferencias entre declaración y ejecución.
- Cubrir con pruebas el CDN actual, el CDN anterior y URLs no autorizadas.

## Risks / Trade-offs

Conservar el CDN anterior permite compatibilidad temporal, pero amplía deliberadamente la lista de dos hosts a orígenes exactos conocidos. Si Apoll Comics cambia de nuevo de dominio, una actualización explícita seguirá siendo necesaria y la API rechazará el nuevo host de forma segura.
