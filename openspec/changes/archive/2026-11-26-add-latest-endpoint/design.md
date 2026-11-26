## Context

El catálogo delega sus operaciones al provider registrado y usa un mismo mapeo de errores a HTTP. Las tres fuentes presentan las novedades en orden propio y las fuentes remotas indican la posibilidad de continuar de formas distintas.

## Goals / Non-Goals

**Goals**

- Devolver una página de resúmenes en el orden de la fuente e indicar si hay una página siguiente.
- Reutilizar el registro, el mapeo de errores y los clientes HTTP existentes.

**Non-Goals**

- Agregar resultados entre providers o cambiar las operaciones actuales del catálogo.

## Decisions

- El dominio declara `Paginated<T> = { items: T[]; hasNextPage: boolean }`. El contrato añade `listLatest(page: number, ctx: ProviderContext): Promise<OperationResult<Paginated<SeriesSummary>>>`.
- El controlador usa la página 1 cuando se omite `page` y acepta un único entero decimal positivo representable con precisión. Una entrada inválida recibe HTTP 400 con `INVALID_QUERY`. La respuesta de éxito contiene `data`, la página solicitada y `hasNextPage`.
- Demo devuelve sus resúmenes fijos en la primera página y una lista vacía en las siguientes. Su indicador de página siguiente siempre es falso.
- Olympus consulta `https://olympusxyz.com/api/new-chapters?page=N`. Valida el JSON, toma los elementos de tipo `comic`, conserva la primera aparición de cada slug y usa `current_page < last_page`. Normaliza la portada con las mismas reglas que su búsqueda.
- Apoll Comics consulta `https://apollcomics.es/manga/page/N/?m_orderby=latest`. Extrae los enlaces de serie de `.page-item-detail .post-title a` y conserva la primera aparición de cada slug. Identifica la página siguiente por un enlace del sitio cuyo path es `/manga/page/<N+1>` con barra final opcional.
- Los adaptadores reutilizan los errores estables de sus clientes HTTP. Un 404 del listado remoto se traduce a `NOT_FOUND`.

## Risks / Trade-offs

- Una página puede contener menos series que la respuesta de origen por el filtro y la deduplicación. La señal de paginación se obtiene del origen aunque la página esté vacía.
