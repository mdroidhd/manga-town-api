## Context
El lector puede retornar un redirect externo o HTML placeholder. Node fetch no conserva cookies automáticamente.

## Goals / Non-Goals
Preparar y reutilizar una sesión canónica, limitar el reintento y mantener las validaciones del lector. No confiar en el mirror ni modificar Apoll.

## Decisions
Usar cabeceras comunes, almacenar cookies canónicas y compartir el warm-up con TTL de cinco minutos. Ante redirect externo o placeholder, renovar warm-up y repetir URL original una vez. No seguir destinos externos. Mantener límites de saltos y validación de CDN.

## Risks / Trade-offs
Las cookies deben limitarse al origen canónico; una sesión temporal no garantiza evitar todos los fallos del upstream, que se traducen a error estable.
