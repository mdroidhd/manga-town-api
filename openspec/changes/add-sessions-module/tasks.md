## 1. Almacenamiento y aislamiento

- [ ] 1.1 Crear `SessionsModule` y su servicio interno. Usar la identidad verificada del usuario y el `providerId` para crear, leer y actualizar una sesión de fuente.
- [ ] 1.2 Cifrar el cookie jar antes de persistirlo y cargar la clave desde la configuración de secretos. Probar la recuperación del jar, el aislamiento entre usuarios y providers y la ausencia de cookies en claro en el almacenamiento y en los errores.

## 2. Ciclo de vida

- [ ] 2.1 Validar un TTL positivo y fijar `expiresAt` al crear la sesión. Probar con reloj controlado la lectura anterior al vencimiento, el límite exacto y la fecha fija tras actualizar cookies.
- [ ] 2.2 Hacer el cierre de sesión idempotente. Probar que afecta solo al par solicitado, que una actualización tardía no restaura el jar y que un nuevo login permite crear otra sesión.

## 3. Validación

- [ ] 3.1 Ejecutar `openspec validate add-sessions-module --strict`, `npm run build`, `npm run lint`, `npm test -- --runInBand` y `npm run test:e2e -- --runInBand`. Comprobar los escenarios del delta.
