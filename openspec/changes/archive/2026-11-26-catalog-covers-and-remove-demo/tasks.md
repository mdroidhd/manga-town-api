## 1. Portadas de catálogo

- [x] 1.1 Verificar que Olympus mapea `cover` en búsqueda y novedades con los orígenes permitidos y omite valores inválidos.
- [x] 1.2 Incluir las portadas de búsqueda y novedades de Apoll Comics a partir del contenedor de cada serie.
- [x] 1.3 Comprobar portadas de ejemplo, URLs inválidas, imágenes ausentes y asociación de cada imagen a su serie con respuestas simuladas.

## 2. Registro de producción

- [x] 2.1 Eliminar el provider de ejemplo y su registro. Actualizar README y `openspec/project.md`.
- [x] 2.2 Sustituir las referencias a `demo` en pruebas unitarias y e2e. Verificar el registro de producción, la paginación y el 404 de providers desconocidos.

## 3. Verificación

- [x] 3.1 Ejecutar `npm run build`, `npm run lint`, `npm test -- --runInBand` y `npm run test:e2e -- --runInBand`.
- [x] 3.2 Validar el conjunto con `npx -y @fission-ai/openspec@latest validate --all` antes de archivar.
