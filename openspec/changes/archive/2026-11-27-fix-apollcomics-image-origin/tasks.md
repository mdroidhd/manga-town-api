## 1. Orígenes de imágenes

- [x] 1.1 Añadir el CDN actual y conservar el CDN anterior en las constantes de orígenes de Apoll Comics.
- [x] 1.2 Usar la lista de orígenes permitidos para páginas y portadas y reflejarla en el manifest del provider.

## 2. Pruebas

- [x] 2.1 Añadir pruebas para páginas del CDN actual y del CDN anterior.
- [x] 2.2 Verificar que continúan rechazándose URLs externas, HTTP y URLs con credenciales.

## 3. Validación

- [x] 3.1 Ejecutar `npx -y @fission-ai/openspec@latest validate fix-apollcomics-image-origin --strict`.
- [x] 3.2 Ejecutar `npm run build`, `npm run lint`, `npm test -- --runInBand` y `npm run test:e2e -- --runInBand`.
- [x] 3.3 Comprobar el endpoint real del capítulo 48 contra Apoll Comics.
- [x] 3.4 Ejecutar `npx -y @fission-ai/openspec@latest validate --all`.
