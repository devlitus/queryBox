# Plan de Deploy en Vercel - queryBox

## Resumen Ejecutivo

queryBox es una aplicacion **100% estatica** (SPA con islas Preact hidratadas en el cliente). No utiliza SSR, middleware, API routes, ni variables de entorno del servidor. Toda la logica de negocio (HTTP client, persistencia localStorage, gestion de estado con signals) se ejecuta exclusivamente en el navegador.

**Decision clave**: Deploy como sitio estatico SIN adaptador `@astrojs/vercel`. Segun la documentacion oficial de Astro: *"Your Astro project is a static site by default. You don't need any extra configuration to deploy a static Astro site to Vercel."*

## Analisis del Estado Actual

### Evidencia de que el proyecto es estatico

| Criterio                        | Estado       | Evidencia                                             |
|--------------------------------|-------------|-------------------------------------------------------|
| `output` en astro.config.mjs  | No definido  | Default = `'static'`                                  |
| Rutas API (`src/pages/api/`)  | No existen   | Solo `src/pages/index.astro`                          |
| Middleware (`src/middleware.*`)| No existe    | Directorio vacio                                      |
| `Astro.request/cookies/locals`| No usados    | Grep confirma 0 resultados                            |
| `getStaticPaths`/`prerender`  | No usados    | No hay rutas dinamicas                                |
| `import.meta.env`/`process.env`| No usados   | Grep confirma 0 resultados                            |
| HTTP requests                  | Cliente only | `fetch()` en `src/services/http-client.ts` (browser)  |
| Persistencia                   | localStorage | `src/services/storage.ts` (browser only)              |
| Build output                   | `dist/`      | Genera `index.html` + assets estaticos en `_astro/`   |

### Configuracion actual de Astro

```javascript
// astro.config.mjs
export default defineConfig({
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()]
  }
});
```

- Sin `output` (default: `'static'`)
- Sin `adapter`
- Sin `site` (necesario para SEO pero no bloqueante)

### Build verificado

```
$ bun run build
// ... genera dist/ con:
// - 1 pagina: /index.html
// - Assets en _astro/: ~20 JS bundles, CSS
// - Total build time: ~2s
```

---

## Phase 1: Configuracion de Vercel

### Objetivo
Preparar el repositorio con la configuracion minima necesaria para que Vercel detecte y construya correctamente el proyecto Astro estatico.

### Prerequisitos
- Cuenta de Vercel activa
- Repositorio accesible desde Vercel (GitHub/GitLab/Bitbucket)

### Tareas Detalladas

#### 1.1 Crear archivo `vercel.json` en la raiz del proyecto

Este archivo es **opcional** segun la documentacion (Vercel auto-detecta Astro), pero se recomienda crearlo para:
- Documentar la configuracion de forma explicita
- Configurar headers de seguridad
- Asegurar compatibilidad con el framework detection de Vercel

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "astro",
  "buildCommand": "bun run build",
  "installCommand": "bun install",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    },
    {
      "source": "/_astro/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**Justificacion de headers**:
- `X-Content-Type-Options: nosniff` -- Previene MIME-type sniffing (seguridad)
- `X-Frame-Options: DENY` -- Previene clickjacking (queryBox no necesita ser embebido en iframes)
- `Referrer-Policy` -- Limita informacion enviada en el header Referer
- Cache inmutable para `_astro/` -- Astro genera hashes en los nombres de archivo, por lo que son safe para cache agresivo (1 anio)

#### 1.2 Verificar que Bun es soportado como package manager en Vercel

Vercel soporta Bun nativamente. Detecta automaticamente `bun.lock` o `bun.lockb` en el repositorio. Verificar que existe el lockfile:

```bash
ls -la bun.lockb  # o bun.lock
```

Si no existe, generarlo con `bun install`.

### Archivos Afectados
- `vercel.json` - CREAR
- `bun.lockb` (o `bun.lock`) - VERIFICAR que existe (ya deberia existir)

### Mejores Practicas Aplicadas
- **KISS**: Configuracion minima necesaria; no instalar adaptador innecesario
- **Principle of Least Surprise**: Explicitar `framework`, `buildCommand`, `installCommand` para evitar problemas de auto-deteccion
- **Security by Default**: Headers de seguridad desde el primer deploy

### Criterios de Completado
- [ ] `vercel.json` creado con configuracion correcta
- [ ] Lockfile de Bun verificado en el repositorio
- [ ] `bun run build` sigue funcionando correctamente despues de los cambios

### Riesgos y Mitigaciones
- **Riesgo**: Vercel no detecta Bun como package manager -> **Mitigacion**: `installCommand` explicito en vercel.json
- **Riesgo**: Version de Bun en Vercel incompatible -> **Mitigacion**: Vercel usa la ultima version estable de Bun; si hay problemas, se puede fijar con `engines` en package.json o `BUN_VERSION` env var

### Estimacion de Complejidad
**Baja** - Solo creacion de un archivo de configuracion

---

## Phase 2: Configuracion de `site` en Astro (Post-Deploy)

### Objetivo
Agregar la URL de produccion al config de Astro para habilitar funcionalidades que dependen de la URL del sitio (meta tags, canonical URLs, sitemap futuro).

### Prerequisitos
- Phase 1 completada
- URL de Vercel conocida (se obtiene despues del primer deploy)

### Tareas Detalladas

#### 2.1 Actualizar `astro.config.mjs` con la propiedad `site`

```javascript
export default defineConfig({
  site: 'https://querybox.vercel.app', // Ajustar al dominio real
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()]
  }
});
```

> **NOTA**: La URL exacta se conocera despues del primer deploy. Vercel asigna un subdominio basado en el nombre del proyecto (ej: `querybox.vercel.app`). Si se configura un dominio personalizado, usar ese en su lugar.

#### 2.2 (Opcional) Agregar meta tags Open Graph en Layout.astro

Si se desea mejorar las previsualizaciones al compartir links en redes sociales, agregar meta tags OG en `src/layouts/Layout.astro`. Esto es opcional y no bloquea el deploy.

### Archivos Afectados
- `astro.config.mjs` - MODIFICAR (agregar `site`)
- `src/layouts/Layout.astro` - MODIFICAR (opcional, meta tags)

### Mejores Practicas Aplicadas
- **YAGNI**: Solo agregar `site` cuando se conozca la URL real; no agregar integraciones especulativas
- **Separation of Concerns**: La configuracion de deploy (vercel.json) esta separada de la configuracion del framework (astro.config.mjs)

### Criterios de Completado
- [ ] `site` configurado con la URL correcta de produccion
- [ ] Build sigue exitoso con la nueva configuracion
- [ ] `import.meta.env.SITE` disponible si se necesita en el futuro

### Riesgos y Mitigaciones
- **Riesgo**: URL de Vercel cambia si se renombra el proyecto -> **Mitigacion**: Usar dominio personalizado o actualizar config al renombrar

### Estimacion de Complejidad
**Baja** - Cambio de una linea en configuracion

---

## Phase 3: Deploy en Vercel

### Objetivo
Realizar el deploy efectivo del proyecto en Vercel.

### Prerequisitos
- Phase 1 completada
- Repositorio con todos los cambios pusheados a la rama principal (o rama de preview)
- Cuenta de Vercel configurada

### Tareas Detalladas

#### 3.1 Opcion A: Deploy via Website UI (Recomendado para primer deploy)

1. Ir a https://vercel.com/new
2. Importar el repositorio Git de queryBox
3. Vercel detectara automaticamente Astro como framework
4. Verificar que las settings sean:
   - **Framework Preset**: Astro
   - **Build Command**: `bun run build` (o dejar auto-detect)
   - **Output Directory**: `dist` (o dejar auto-detect)
   - **Install Command**: `bun install` (o dejar auto-detect)
5. Click "Deploy"

#### 3.2 Opcion B: Deploy via Vercel CLI

```bash
# Instalar Vercel CLI globalmente
bun add -g vercel

# Login
vercel login

# Deploy desde el directorio del proyecto
vercel

# Para production deploy:
vercel --prod
```

#### 3.3 Verificacion Post-Deploy

Checklist de verificacion manual:

1. **Pagina carga correctamente**: La UI del workbench se renderiza
2. **Estilos aplicados**: Tailwind CSS carga (colores, layout grid, tipografia)
3. **Interactividad funcional**:
   - Tabs se pueden crear, cerrar, renombrar
   - Sidebar se expande/colapsa
   - Method selector funciona (dropdown)
   - Enviar request a `https://jsonplaceholder.typicode.com/todos/1` retorna 200
4. **Persistencia funcional**:
   - Crear una coleccion, recargar la pagina, verificar que persiste
   - Enviar un request, verificar que aparece en historial
   - Crear un environment con variable, verificar persistencia
5. **Auth funcional**:
   - Configurar Bearer Token, enviar request, verificar header Authorization
   - Configurar API Key en query param, verificar que aparece en URL
6. **Assets estaticos**: favicon carga correctamente
7. **Headers de seguridad**: Verificar con DevTools > Network que los headers de `vercel.json` se aplican

### Archivos Afectados
- Ninguno (es un proceso operacional)

### Mejores Practicas Aplicadas
- **Fail Fast**: Verificar funcionalidad critica inmediatamente despues del deploy
- **Defense in Depth**: Verificar tanto UI como headers de seguridad

### Criterios de Completado
- [ ] Sitio accesible en URL de Vercel
- [ ] Todos los puntos del checklist de verificacion pasan
- [ ] No hay errores en la consola del navegador (excepto CORS esperados en requests cross-origin)
- [ ] Headers de seguridad presentes en las respuestas HTTP

### Riesgos y Mitigaciones
- **Riesgo**: CORS bloquea requests a APIs externas -> **Mitigacion**: Esto es comportamiento esperado y documentado en el proyecto. El HTTP client usa fetch() del browser directamente. Futuro: proxy via API routes requerira adaptador SSR
- **Riesgo**: Assets no cargan (paths rotos) -> **Mitigacion**: Astro maneja los paths automaticamente en static mode; verificar que no hay hardcoded absolute paths

### Estimacion de Complejidad
**Baja** - Proceso guiado por la plataforma

---

## Phase 4: Configuracion de CI/CD y Preview Deployments

### Objetivo
Configurar el flujo automatico de deployments para que cada push a `main` genere un production deploy y cada PR genere un preview deployment.

### Prerequisitos
- Phase 3 completada (primer deploy exitoso)
- Repositorio conectado a Vercel via Git integration

### Tareas Detalladas

#### 4.1 Verificar Git Integration

Vercel configura automaticamente:
- **Production Branch**: `main` -- cada push genera production deploy
- **Preview Branches**: todas las demas -- cada push genera preview deployment con URL unica

No se requiere configuracion adicional. Esto viene habilitado por defecto al conectar el repositorio.

#### 4.2 (Opcional) Agregar Ignored Build Step

Si se desea evitar rebuilds innecesarios (ej: cambios solo en `docs/` o archivos `.md`), configurar en `vercel.json`:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  },
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- src/ public/ astro.config.mjs package.json bun.lockb"
}
```

Esto hace que Vercel omita el build si solo cambiaron archivos fuera de `src/`, `public/`, y los archivos de configuracion.

#### 4.3 (Opcional) Agregar badge de estado en README

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/USUARIO/querybox)
```

### Archivos Afectados
- `vercel.json` - MODIFICAR (opcional, agregar `ignoreCommand`)

### Mejores Practicas Aplicadas
- **DRY**: Reutilizar la deteccion automatica de Vercel en lugar de configurar CI/CD manualmente
- **YAGNI**: El ignoreCommand es opcional; solo agregar si los rebuilds innecesarios se vuelven un problema

### Criterios de Completado
- [ ] Push a `main` genera production deployment automaticamente
- [ ] PR genera preview deployment con URL de preview
- [ ] (Opcional) Cambios solo en `docs/` no triggean rebuild

### Riesgos y Mitigaciones
- **Riesgo**: Preview deployments consumen minutos de build del plan gratuito -> **Mitigacion**: El build es rapido (~2s); el plan gratuito es generoso. Si es problema, configurar ignoreCommand

### Estimacion de Complejidad
**Baja** - Configuracion automatica de Vercel + opcional ignoreCommand

---

## Decisiones Arquitecturales

### Decision 1: NO usar `@astrojs/vercel` adapter

**Alternativas evaluadas**:

| Opcion                         | Pros                                        | Contras                                        |
|-------------------------------|---------------------------------------------|------------------------------------------------|
| A) Static (sin adaptador)    | Zero config, mas rapido, CDN edge global    | No SSR, no API routes, no middleware           |
| B) `@astrojs/vercel` adapter | SSR, API routes, Vercel-specific features   | Overhead innecesario, serverless cold starts   |

**Eleccion**: **Opcion A** -- El proyecto no usa ninguna feature que requiera SSR. Todas las interacciones son client-side (fetch, localStorage, signals). Agregar el adaptador introduciria complejidad sin beneficio.

**Cuando reconsiderar**: Si en el futuro se implementa un proxy CORS via API routes (mencionado en `http-client.ts` como mejora futura), sera necesario:
1. Instalar `@astrojs/vercel`: `bun add @astrojs/vercel`
2. Configurar `adapter: vercel()` y `output: 'server'` (o `'hybrid'` para pre-render la mayoria de paginas)
3. Crear la API route en `src/pages/api/proxy.ts`

### Decision 2: Headers de seguridad via `vercel.json`

En lugar de middleware (que requeriria SSR), los headers se configuran declarativamente en `vercel.json`. Esta es la forma estandar para sitios estaticos en Vercel.

### Decision 3: Cache agresivo para `_astro/`

Los assets generados por Astro en `_astro/` incluyen content-hash en el nombre del archivo (ej: `HttpWorkbench.CmNJYXGq.js`). Esto los hace seguros para cache inmutable de 1 anio, mejorando significativamente los tiempos de carga en visitas subsecuentes.

---

## Resumen de Archivos a Crear/Modificar

| Archivo             | Accion    | Phase | Descripcion                                  |
|--------------------|-----------|-------|----------------------------------------------|
| `vercel.json`      | CREAR     | 1     | Configuracion de Vercel + headers seguridad  |
| `astro.config.mjs` | MODIFICAR | 2     | Agregar propiedad `site` (post-deploy)       |

---

## Notas sobre Bun en Vercel

- Vercel soporta Bun nativamente desde 2023
- Detecta Bun automaticamente si encuentra `bun.lockb` o `bun.lock`
- El `buildCommand` y `installCommand` en `vercel.json` sirven como fallback explicito
- No se necesita configurar `BUN_VERSION` a menos que se requiera una version especifica
- `bun run build` ejecuta `astro build` (definido en package.json scripts)

## Estimacion Total

| Phase | Complejidad | Tiempo estimado |
|-------|------------|-----------------|
| 1     | Baja       | 10 minutos      |
| 2     | Baja       | 5 minutos       |
| 3     | Baja       | 15 minutos      |
| 4     | Baja       | 5 minutos       |
| **Total** | **Baja** | **~35 minutos** |
