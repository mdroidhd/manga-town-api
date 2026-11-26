# Manga Town API

## Spec-Driven Development (SSDD) con OpenSpec

1. **Proponer.** Empieza cada funcionalidad o cambio de comportamiento en `openspec/changes/<change-id>/`. Lee `openspec/project.md` y los specs vigentes. Escribe `proposal.md`, `tasks.md` y los deltas `specs/<capacidad>/spec.md` con requisitos y escenarios verificables. Añade `design.md` para completar la planificación con el esquema `spec-driven`.
2. **Revisar.** Ejecuta `openspec validate <change-id> --strict` y presenta la propuesta, los deltas y las tareas para revisión antes de implementar. Todo cambio de comportamiento requiere un delta revisado. Si cambia el alcance, actualiza el delta y revísalo de nuevo.
3. **Implementar.** Sigue `tasks.md` y marca cada tarea cuando esté completada y comprobada.
4. **Validar.** Desde la raíz, ejecuta `npx -y @fission-ai/openspec@latest validate --all`, `npm run build`, `npm run lint`, `npm test -- --runInBand` y `npm run test:e2e -- --runInBand`. Comprueba los escenarios del delta.
5. **Archivar.** Cuando las tareas y comprobaciones estén completas, ejecuta `openspec archive <change-id>`. `openspec/specs/` es la fuente de verdad sobre el comportamiento vigente y se actualiza únicamente al archivar, cuando OpenSpec integra los deltas.

## Comandos de OpenSpec

Ejecuta los comandos desde la raíz del repo. Con `npx`, sustituye `openspec` por `npx -y @fission-ai/openspec@latest`.

| Comando | Uso |
| --- | --- |
| `openspec list` | Lista los cambios activos. Con `--specs` lista los specs vigentes. |
| `openspec show <change-id>` | Muestra un cambio. Para un spec, usa `openspec show <capacidad> --type spec`. |
| `openspec validate <change-id> --strict` | Valida el cambio antes de revisarlo. Usa `openspec validate --all` para validar todos los cambios y specs. |
| `openspec archive <change-id>` | Integra los deltas y mueve el cambio a `openspec/changes/archive/`. Añade `--yes` para archivar sin interacción. |

[Referencia del CLI de OpenSpec](https://github.com/Fission-AI/OpenSpec/blob/v2.2.0/docs/cli.md)
