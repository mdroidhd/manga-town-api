# Recon: Apoll Comics (apollcomics.es)

Datos verificados el 2026-11-26 con peticiones reales. Sin login ni captcha.

## Base

- WordPress con el tema **Madara** (`wp-content/themes/madara`), el mismo que usan cientos de scans. Todos los selectores son los estándar del tema.
- `GET https://apollcomics.es/` responde 200 con HTML normal.

## Endpoints

| Uso | Petición | Extracción |
|---|---|---|
| Buscar | `GET /?s=<query>&post_type=wp-manga[&paged=N]` | Enlaces de resultados: `a.h4[href]` → `/manga/<slug>/`. |
| Detalle | `GET /manga/<slug>/` | Título `h1`; portada `.summary_image img` en `data-src` (el `src` es un placeholder `dflazy.jpg`); sinopsis `.description-summary`; géneros y estado en `.post-content_item`. |
| Capítulos | `GET /manga/<slug>/?style=list` | `li.wp-manga-chapter > a`: `href` y texto (`Capitulo 55`). `?style=list` fuerza la lista completa; la vista normal puede recortarla. |
| Páginas | `GET /manga/<slug>/<chapter-slug>/` | `div.reading-content .page-break img`, atributo `data-src` (recortar espacios) o `src` si falta. |
| ID interno (opcional) | `input.rating-post-id` en el detalle | Número de post de WordPress; solo hace falta si se usa el AJAX de Madara. |

Verificado:

- Detalle de `el-invocador-solitario-de-clase-sss`: `h1` = "El invocador solitario de clase SSS", 45 capítulos en la lista.
- Capítulos del mismo: primero `capitulo-55`, último de la lista `capitulo-1`.
- Páginas: 13 en `capitulo-1` de esa serie, 14 en `leviatan`, 30 en `harem-revenge`. Todas en `cdn1.apollcomics.com`, mezclando `.jpg` y `.png`.

## Identidad

- **Serie:** el slug de `/manga/<slug>/`. Estable y único.
- **Capítulo:** el slug del capítulo (`capitulo-55`). Con él se reconstruye la URL `/manga/<serieSlug>/<chapterSlug>/` sin guardar estado.
- El texto del enlace (`Capitulo 55`) sirve como número visible; el slug manda para construir URLs.

## Detalles que rompen si se ignoran

- `data-src` puede venir con espacios delante (`" https://cdn1..."`): hay que `trim()`.
- La portada real está en `data-src`, no en `src`.
- Algunas series usan `.png` en vez de `.jpg`.
- No hay paginación de capítulos por API: se lee la lista del HTML.
- Los hosts de imagen observados: `cdn1.apollcomics.com` (imágenes) y `apollcomics.es` (sitio y portadas en `wp-content/uploads`).

## Capacidades para el manifest

`login: none`, `captcha: none`, `pages: server`, `deviceEgress: false`. Orígenes permitidos: `https://apollcomics.es` y `https://cdn1.apollcomics.com`.
