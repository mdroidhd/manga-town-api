## ADDED Requirements

### Requirement: Recuperación del lector Olympus

Olympus SHALL enviar cabeceras de navegador y preparar una sesión canónica reutilizable de hasta cinco minutos antes del lector. SHALL reintentar una vez tras renovar la sesión ante redirects externos o placeholders, sin seguir el mirror. SHALL devolver `UPSTREAM_INVALID_RESPONSE` si persiste y conservar la validación de índices y CDN de los paneles.

#### Scenario: Redirección externa transitoria

- **GIVEN** el lector redirige a un host externo
- **WHEN** el reintento de la URL original devuelve un capítulo válido
- **THEN** se devuelven sus paneles sin consultar el host externo

#### Scenario: Placeholder transitorio

- **GIVEN** el lector devuelve imágenes `/cp/cp-*.jpg` o el marcador del mirror
- **WHEN** el reintento devuelve un capítulo válido
- **THEN** se devuelven sus paneles válidos

#### Scenario: Redirecciones externas persistentes

- **WHEN** ambos intentos redirigen fuera del origen canónico
- **THEN** se devuelve `UPSTREAM_INVALID_RESPONSE` sin consultar el mirror
