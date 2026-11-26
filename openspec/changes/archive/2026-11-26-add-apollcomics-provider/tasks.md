## 1. Propuesta

- [x] 1.1 Validar el cambio con `openspec validate add-apollcomics-provider --strict` y presentar la propuesta, el delta y las tareas antes de implementar.

## 2. Implementación y pruebas

- [x] 2.1 Crear el cliente con `fetch` inyectable, origen fijo, plazo, cancelación y traducción de errores.
- [x] 2.2 Implementar el manifiesto y las cuatro operaciones de catálogo con Cheerio, y registrar Apoll Comics en `ProvidersModule`.
- [x] 2.3 Añadir fixtures y pruebas unitarias y e2e que cubran los escenarios del delta con `fetch` simulado.

## 3. Verificación

- [x] 3.1 Ejecutar build, lint, pruebas unitarias y e2e, y `openspec validate --all`. Comprobar que todos pasan antes de archivar.
