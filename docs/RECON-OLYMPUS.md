# Recon: Olympus Scanlation (olympusxyz.com)

Datos verificados el 2026-11-26 haciendo peticiones reales. No requiere login ni captcha.

## Base

- Dominio de entrada: `https://olympus.pages.dev` responde con un `meta[property=og:url]` que apunta al dominio canónico. La extensión de Mihon lo resuelve así, por si cambian de dominio.
- **Verificado el 26-11-2026:** `pages.dev` anuncia `https://olympusbiblioteca.com/`, que responde **301** hacia `https://olympusxyz.com/`. Hay que seguir esa redirección para quedarse con el origen real. El cliente acepta el anuncio si es canónico o si pertenece a la familia conocida (`olympusxyz.com`, `olympusbiblioteca.com`) y termina en un canónico.
- App Nuxt. Las llamadas de datos son XHR a `/api/...` y devuelven JSON.

## Endpoints

| Uso | Petición | Forma de la respuesta |
|---|---|---|
| Listado completo (para buscar) | `GET /api/series/list` | `{ data: [{ id, name, slug, cover, type }] }` |
| Catálogo paginado | `GET /api/series?page=N&type=comic[&genres=ID][&status=ID]` | `{ data: { series: { data: [...], meta/total, ... } } }` |
| Populares | `GET /api/rankings?page=N&period=total_ranking` | `{ current_page, data: [{ id, name, slug, status:{id,name}, cover, ... }] }` |
| Novedades | `GET /api/new-chapters?page=N` | `{ current_page, data: [{ name, slug, id, cover, ... }] }` |
| Detalle | `GET /api/series/{slug}?type=comic` | `{ data: { id, name, summary, ... } }` |
| Capítulos | `GET /api/series/{slug}/chapters?page=N&direction=desc&type=comic` | `{ data: [{ name, id, published_at, team:{id,name}\|null, read_by_auth }], meta: { total } }` |
| Filtros | `GET /api/genres-statuses` | listas de géneros y estados con `{ name, id }` |

Notas:

- Solo interesan las series con `type === "comic"`; la lista completa trae otros tipos.
- El campo `id` es numérico y el `slug` es la clave real para detalle y capítulos. El `slug` no se puede derivar del nombre: hay que quedarse con el que devuelve la API.
- Para paginar capítulos: `meta.total` frente al número ya acumulado.
- `name` del capítulo es el número como texto (por ejemplo `"190"`).

## Páginas de un capítulo

La URL `/capitulo/{chapterId}/comic-{serieSlug}` responde **301** y redirige a:

```
https://olympusxyz.com/series/comic-{serieSlug}/capitulo/{numero}
```

Hay que seguir la redirección. El HTML final trae:

```html
<main class="strip">
  <div class="panel" data-i="0">
    <img src="https://media.imagesolymp.xyz/comics/743/135953/0_1.webp" ...>
    <span class="panel-n">1 / 46</span>
  </div>
  ...
</main>
```

- Las páginas son `main.strip div.panel > img`, en orden de `data-i`.
- Verificado: 46 `img` y 46 `div.panel` en el capítulo 190 de `20-225-2sabueso13424`.
- Las imágenes están en `media.imagesolymp.xyz` y se sirven sin cookies. Se pueden devolver como URL directa.

## Implicaciones para el provider

- No hay login, captcha ni límite conocido: todas las capacidades caen en `server` y `login: none`, `captcha: none`.
- El dominio puede cambiar (`olympus.pages.dev` → `og:url`), así que conviene resolverlo al arrancar y cachearlo.
- `series/list` es grande y sirve para buscar en local; cachear con TTL y refrescar en segundo plano.
- El detalle y los capítulos van por `slug`; el manifiesto debe tratar el `id` externo como `slug` (o mantener un mapa id→slug como la extensión).
