## Context
El catálogo consulta fuentes externas. Los resultados públicos correctos pueden reutilizarse.

## Goals / Non-Goals
Reducir tráfico, mantener disponibilidad sin Redis y evitar cachear errores o acciones. No se cachean páginas de lectura.

## Decisions
LRU local de TTL corto y Redis compartido opcional con ioredis. Clave por prefijo, proveedor, versión, operación y parámetros normalizados. Single-flight por clave. TTL de latest corto intencionalmente. Purga autenticada mediante token, deshabilitada sin token. La salud no depende de Redis.

## Risks / Trade-offs
Datos eventualmente obsoletos hasta el TTL; purga elimina claves del prefijo correspondiente. Redis indisponible degrada a memoria. La purga incrementa una versión compartida en Redis; cada proceso la comprueba periódicamente e invalida su L1 cuando cambia. Las operaciones en vuelo pueden terminar con datos anteriores; L1 caduca como máximo en 30 segundos.
