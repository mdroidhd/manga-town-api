## Why

Apoll Comics sirve actualmente las imágenes de sus capítulos desde `https://cdn1.apollcomics.es`, mientras la API únicamente permite `https://cdn1.apollcomics.com`. El lector encuentra las imágenes en el HTML correcto, pero rechaza la primera URL y responde `UPSTREAM_INVALID_RESPONSE`.

## What Changes

- Admitir el CDN actual `https://cdn1.apollcomics.es` al extraer páginas y portadas de Apoll Comics.
- Conservar `https://cdn1.apollcomics.com` durante la transición para capítulos o cachés antiguos.
- Declarar ambos orígenes en el manifest del provider y mantener el rechazo de URLs externas, con credenciales o que no sean HTTPS.
- Añadir pruebas de resolución correcta para ambos CDNs y de rechazo de orígenes no autorizados.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `provider-catalog`: Las páginas y portadas aceptadas de Apoll Comics incluyen su CDN actual y el CDN anterior.

## Impact

La implementación modificará el cliente y el provider de Apoll Comics en `src/modules/providers/apollcomics/`, junto con sus pruebas unitarias. No cambia rutas HTTP, tipos de respuesta ni la configuración de despliegue.
