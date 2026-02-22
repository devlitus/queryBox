# Security Audit Report — AI Error Diagnosis Feature

## Scope: Full project audit with focus on `feature/ai-error-diagnosis`
## Standard: OWASP Top 10 (2021) + CWE/SANS Top 25
## Date: 2026-02-22
## Risk Rating: CRITICAL

---

## Executive Summary

Se auditaron **22 archivos fuente** del proyecto queryBox, con especial atención a los componentes
introducidos en la rama `feature/ai-error-diagnosis`. El proyecto es una aplicación HTTP client
(estilo Postman) construida con Astro 5 + Bun + TypeScript + Preact.

Fuera de esa credencial expuesta, la arquitectura de seguridad general es sólida: el endpoint de
diagnóstico implementa rate limiting, el sanitizador de AI redacta campos sensibles antes de
enviarlos a Groq, el renderer de Markdown hace HTML-escaping correcto, y no existen rutas de
inyección directa de código. Los principales problemas restantes son de configuración (cabeceras
HTTP de seguridad ausentes) y de hardening defensivo (límites de tamaño en la entrada, validación
más estricta).

**Prioridades inmediatas:**
1. Revocar la API key de Groq expuesta en `.env` — ahora mismo.
2. Agregar cabeceras de seguridad HTTP (CSP, HSTS, X-Frame-Options, etc.).
3. Corregir el `dangerouslySetInnerHTML` del componente `Dropdown` con SVG de origen no verificado.
4. Añadir límites de longitud en la validación del endpoint `/api/diagnose`.

---

## Attack Surface Analysis

| Categoria | Detalle |
|-----------|---------|
| API Endpoints | 1 — `POST /api/diagnose` |
| Server-side Services | 2 — `groq-service.ts`, `rate-limiter.ts` |
| Client-side Services | 3 — `http-client.ts`, `ai-client.ts`, `ai-sanitizer.ts` |
| External Integrations | 1 — Groq API (llama-3.3-70b-versatile) |
| User Input Entry Points | URL, headers, params, body, auth fields, env variables, importación JSON |
| Almacenamiento cliente | localStorage (7 claves con datos sensibles de auth) |

---

## Statistics

| Archivos auditados | Vulnerabilidades encontradas | CRITICA | ALTA | MEDIA | BAJA |
|--------------------|------------------------------|---------|------|-------|------|
| 22 | 10 | 1 | 3 | 4 | 2 |

---

## Vulnerabilities by Category

---

### CRITICA (1 issue)

---

#### 1. API Key de Groq expuesta en archivo `.env` con valor real

**Archivo:** `D:\work\queryBox\.env` — Linea 1
**Severidad:** CRITICA
**CWE:** CWE-798: Use of Hard-coded Credentials
**OWASP:** A02:2021 — Cryptographic Failures

**Descripcion:**

El archivo `.env` contiene una API key real y activa de Groq:

```
GROQ_API_KEY="gsk_REDACTED"
```

Aunque `.env` esta correctamente listado en `.gitignore` y no aparece en el historial de git, la
simple existencia de una credencial real en un archivo de texto plano en el filesystem del proyecto
constituye un riesgo critico. Los vectores de exposicion incluyen:

- Captura accidental en un commit futuro (un `git add .` o fallo del `.gitignore`)
- Acceso a la maquina de desarrollo por un atacante
- Exportacion inadvertida via backup, sync, o herramienta de CI/CD
- Logs del sistema operativo o del shell que capturen variables de entorno

**Impacto:**

Un atacante con acceso a esta key puede realizar llamadas ilimitadas a la API de Groq, incurriendo
en costos economicos significativos y consumiendo el cupo de la cuenta hasta agotar la API key.
La key no provee acceso a infraestructura interna, pero si permite DoS economico contra el
propietario de la cuenta.

**Prueba de concepto:**

```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer gsk_REDACTED" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","messages":[{"role":"user","content":"test"}]}'
```

**Remediacion:**

1. **Revocar la key inmediatamente** en https://console.groq.com — antes de cualquier otra accion.
2. Generar una nueva API key.
3. Almacenar la nueva key SOLO como variable de entorno del sistema o secreto de CI/CD, nunca en archivos de texto.
4. Verificar que `.gitignore` cubre correctamente `.env` y `.env.*` (el `.gitignore` actual solo cubre `.env` y `.env.production`, no `.env.local`, `.env.staging`, etc.).

```
# .gitignore — ampliar cobertura:
.env
.env.*
!.env.example
```

5. Actualizar `.env.example` para que solo contenga valores placeholder:

```bash
# .env.example (solo placeholders — NUNCA valores reales)
GROQ_API_KEY=gsk_your_key_here
```

**Referencias:**
- [OWASP Credential Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [CWE-798](https://cwe.mitre.org/data/definitions/798.html)

---

### ALTA (3 issues)

---

#### 2. Ausencia completa de cabeceras de seguridad HTTP

**Archivo:** `D:\work\queryBox\src\layouts\Layout.astro` — todo el archivo
**Archivo secundario:** `D:\work\queryBox\src\pages\api\diagnose.ts` — linea 109-116
**Severidad:** ALTA
**CWE:** CWE-16: Configuration
**OWASP:** A05:2021 — Security Misconfiguration

**Descripcion:**

Ni la pagina HTML principal ni el endpoint de API responden con ninguna cabecera de seguridad HTTP.
Las cabeceras ausentes son:

- `Content-Security-Policy` (CSP) — sin CSP, un XSS puede inyectar scripts arbitrarios
- `Strict-Transport-Security` (HSTS) — sin HSTS, el trafico puede ser interceptado en HTTP
- `X-Frame-Options` o `frame-ancestors` via CSP — permite clickjacking
- `X-Content-Type-Options: nosniff` — permite MIME type sniffing attacks
- `Referrer-Policy` — permite filtrado de URLs en el header Referer
- `Permissions-Policy` — no restringe acceso a APIs sensibles del navegador

La aplicacion usa `dangerouslySetInnerHTML` en varios componentes (ver issue #3 y #4). Sin CSP,
cualquier XSS tiene impacto maximo.

**Impacto:**

- Clickjacking: la aplicacion puede embeberse en un iframe malicioso
- MIME sniffing: archivos con Content-Type incorrecto pueden ejecutarse como scripts
- Filtracion de credenciales via Referer header a dominios de terceros (Google Fonts, Groq API)
- Sin CSP: XSS exitoso obtiene ejecucion completa de JS en el contexto de la app

**Remediacion:**

En `astro.config.mjs`, agregar un middleware o configurar el servidor de Node para inyectar
cabeceras en todas las respuestas:

```typescript
// src/middleware.ts (nuevo archivo)
import type { MiddlewareHandler } from "astro";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();

  // Aplicar cabeceras de seguridad a todas las respuestas
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.groq.com",
      "img-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // HSTS solo en produccion (requiere HTTPS)
  if (import.meta.env.PROD) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
};
```

**Nota:** La directiva `style-src 'unsafe-inline'` es necesaria porque Tailwind v4 inyecta estilos
inline. Evaluar migrar a clases de CSS generadas en build time para poder eliminar `'unsafe-inline'`.

**Referencias:**
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

#### 3. `dangerouslySetInnerHTML` con SVG de fuente no verificada en `Dropdown`

**Archivo:** `D:\work\queryBox\src\components\shared\Dropdown.tsx` — linea 118
**Severidad:** ALTA
**CWE:** CWE-79: Cross-site Scripting
**OWASP:** A03:2021 — Injection

**Descripcion:**

El componente `Dropdown` acepta una prop `icon` de tipo `string` y la inserta directamente en el
DOM via `dangerouslySetInnerHTML`:

```tsx
// Dropdown.tsx:118 — VULNERABLE
<span class="w-4 h-4 flex-shrink-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
```

La prop `icon` es de tipo `string` sin ninguna validacion ni sanitizacion. Si el contenido de
`icon` incluye markup malicioso (por ejemplo, un SVG con un event handler `onload` o `onerror`),
se ejecutaria en el contexto de la aplicacion.

Para verificar la explotabilidad, es necesario trazar quienes pasan datos a esta prop. En el
codigo actual, los iconos provienen de SVGs importados con `?raw` desde `src/assets/icons/` — que
son assets estaticos controlados por el desarrollador. Sin embargo, si en el futuro algun caller
pasa contenido de usuario (o contenido externo) como `icon`, el vector de XSS se activa
inmediatamente.

**Prueba de concepto (si icon fuera controlable por el usuario):**

```tsx
<Dropdown icon='<svg onload="alert(document.cookie)"></svg>' ... />
```

**Impacto:**

XSS almacenado o reflejado con ejecucion de JavaScript arbitrario en el contexto de la aplicacion,
acceso a localStorage (donde se almacenan credenciales de auth, environment variables, historico
de requests).

**Remediacion:**

Opcion A — Usar componente SVG estatico en lugar de HTML raw (preferida):

```tsx
// En lugar de icon?: string, usar un componente React/Preact
interface Props {
  items: DropdownItem[];
  selected: string;
  onSelect: (value: string) => void;
  buttonClass?: string;
  panelClass?: string;
  label?: string;
  icon?: preact.ComponentType<{ class?: string }>; // componente tipado, no string
}

// En el render:
{icon && <Icon class="w-4 h-4 flex-shrink-0" aria-hidden="true" />}
```

Opcion B — Si se necesita mantener el SVG como string, validar que proviene exclusivamente de
assets estaticos controlados (no de input de usuario), y documentar explicitamente este contrato
en el tipo:

```typescript
// Tipo que documenta el contrato: solo SVG de assets controlados
type StaticSvgString = string & { readonly _brand: "StaticSvg" };
```

**Referencias:**
- [CWE-79](https://cwe.mitre.org/data/definitions/79.html)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

#### 4. Sin limite de tamano en el body del endpoint `/api/diagnose` — riesgo de DoS

**Archivo:** `D:\work\queryBox\src\pages\api\diagnose.ts` — lineas 81-93
**Severidad:** ALTA
**CWE:** CWE-400: Uncontrolled Resource Consumption
**OWASP:** A05:2021 — Security Misconfiguration / DoS

**Descripcion:**

El endpoint `POST /api/diagnose` no impone ningun limite al tamano del cuerpo de la peticion antes
de llamar a `request.json()`. Un atacante puede enviar un payload JSON masivo (varios MB o GB
dependiendo de la memoria del servidor) para intentar agotar memoria o tiempo de CPU en el
proceso de parseo.

Adicionalmente, la validacion `validateDiagnosisContext` verifica el tipo de los campos
(`typeof ctx.url === "string"`) pero no limita la longitud de los strings. Campos como `url`,
`errorMessage`, `requestBodyExcerpt` (limitado a 1000 chars en el sanitizador cliente) y
`responseBodyExcerpt` (2000 chars en el sanitizador) podrian recibir strings de megas si la
peticion se hace directamente al endpoint sin pasar por el sanitizador del cliente.

```typescript
// diagnose.ts:81-86 — Sin limite de tamano
let body: unknown;
try {
  body = await request.json(); // <-- sin limite de body size
} catch {
  return jsonError(400, "invalid-request", "Invalid JSON in request body");
}
```

**Impacto:**

- Consumo ilimitado de memoria en el servidor Node.js
- Costos elevados en la API de Groq si strings muy largos llegan hasta `buildDiagnosisMessages`
  (aunque el rate limiter mitiga esto parcialmente, no bloquea payloads grandes por si mismo)
- Potencial crash del proceso servidor por OOM (Out of Memory)

**Prueba de concepto:**

```bash
# Payload de 50MB en el campo url
python3 -c "
import json, requests
payload = {
  'method': 'GET',
  'url': 'A' * 50_000_000,
  'statusCode': 200,
  'statusText': 'OK',
  'errorType': 'network',
  'errorMessage': 'test',
  'responseBodyExcerpt': '',
  'requestHeaders': [],
  'responseHeaders': [],
  'requestBodyExcerpt': '',
  'contentType': 'application/json'
}
requests.post('http://localhost:4321/api/diagnose', json=payload)
"
```

**Remediacion:**

```typescript
// diagnose.ts — agregar limite de tamano y longitud de campos
export const POST_MAX_BODY_SIZE = 64 * 1024; // 64 KB

const MAX_FIELD_LENGTHS = {
  url: 2048,
  method: 10,
  statusText: 256,
  errorType: 64,
  errorMessage: 4096,
  responseBodyExcerpt: 4096,
  requestBodyExcerpt: 2048,
  contentType: 256,
} as const;

export async function POST({ request, clientAddress }: APIContext) {
  // Verificar Content-Length antes de leer el body
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > POST_MAX_BODY_SIZE) {
    return jsonError(413, "payload-too-large", "Request body exceeds maximum allowed size");
  }

  // Rate limiting ...

  // Leer body con limite
  let bodyText: string;
  try {
    const reader = request.body?.getReader();
    if (!reader) return jsonError(400, "invalid-request", "Missing request body");

    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > POST_MAX_BODY_SIZE) {
        reader.cancel();
        return jsonError(413, "payload-too-large", "Request body exceeds maximum allowed size");
      }
      chunks.push(value);
    }
    bodyText = new TextDecoder().decode(
      chunks.reduce((a, b) => {
        const c = new Uint8Array(a.length + b.length);
        c.set(a);
        c.set(b, a.length);
        return c;
      })
    );
  } catch {
    return jsonError(400, "invalid-request", "Failed to read request body");
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return jsonError(400, "invalid-request", "Invalid JSON in request body");
  }

  // Validacion con limites de longitud
  if (!validateDiagnosisContext(body)) { ... }
}

// En validateDiagnosisContext — agregar verificacion de longitud:
function validateDiagnosisContext(body: unknown): body is DiagnosisContext {
  // ...tipo checks...
  const ctx = body as Partial<DiagnosisContext>;

  // Verificar longitudes maximas
  if (ctx.url && ctx.url.length > MAX_FIELD_LENGTHS.url) return false;
  if (ctx.errorMessage && ctx.errorMessage.length > MAX_FIELD_LENGTHS.errorMessage) return false;
  if (ctx.responseBodyExcerpt && ctx.responseBodyExcerpt.length > MAX_FIELD_LENGTHS.responseBodyExcerpt) return false;
  if (ctx.requestBodyExcerpt && ctx.requestBodyExcerpt.length > MAX_FIELD_LENGTHS.requestBodyExcerpt) return false;

  return true;
}
```

**Referencias:**
- [CWE-400](https://cwe.mitre.org/data/definitions/400.html)
- [OWASP API Security - API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)

---

### MEDIA (4 issues)

---

#### 5. Rate limiter basado en IP con fallback a "unknown" — bypasseable

**Archivo:** `D:\work\queryBox\src\pages\api\diagnose.ts` — linea 67
**Archivo secundario:** `D:\work\queryBox\src\server\rate-limiter.ts` — lineas 7-12, 33-65
**Severidad:** MEDIA
**CWE:** CWE-307: Improper Restriction of Excessive Authentication Attempts
**OWASP:** A07:2021 — Identification and Authentication Failures

**Descripcion:**

El rate limiter usa `clientAddress` de Astro como identificador de IP. Hay dos problemas:

**Problema A — Fallback inseguro:**
```typescript
// diagnose.ts:67
const ip = clientAddress || "unknown";
```
Si `clientAddress` es `undefined` o falsy (puede ocurrir en entornos donde el adaptador no provee
esta informacion correctamente), TODAS las peticiones sin IP se agregan al mismo bucket `"unknown"`.
Esto significa que multiples atacantes sin IP identificable comparten un unico cupo de 10 requests,
lo que puede bloquear usuarios legitimos (DoS) o ser explotado por un atacante que conozca esta
condicion.

**Problema B — Vulnerabilidad al IP spoofing via proxies:**
`clientAddress` en el adaptador Node.js de Astro puede derivarse del header `X-Forwarded-For`
cuando la aplicacion esta detras de un reverse proxy. Si el proxy no esta configurado para
sanitizar/sobrescribir este header, un atacante puede enviar:
```
X-Forwarded-For: 1.2.3.4
```
Para suplantar cualquier IP y evadir el rate limit por IP.

**Impacto:**

- Bypass completo del rate limiter si se puede manipular el header de IP
- En caso contrario, DoS de clientes legitimos que compartan bucket "unknown"
- Costos economicos por abuso de la API de Groq

**Remediacion:**

```typescript
// diagnose.ts — No aceptar "unknown" como identificador valido
export async function POST({ request, clientAddress }: APIContext) {
  if (!clientAddress) {
    // Si no podemos identificar al cliente, rechazar la peticion
    // O usar una estrategia alternativa (ej: session ID, fingerprint)
    return jsonError(400, "bad-request", "Cannot process request without client identification");
  }
  const ip = clientAddress;
  const rateLimit = checkRateLimit(ip);
  // ...
}
```

Para entornos con proxy, documentar en README que el servidor Node.js debe configurar
`trustProxy: true` y el proxy debe sanitizar `X-Forwarded-For`.

En el contexto de esta app (cliente HTTP tipo Postman), considerar si el rate limit por IP es
suficiente o si se necesita un identificador adicional (ej: fingerprint de navegador almacenado
en cookie).

---

#### 6. Rate limiter en memoria — no persiste entre reinicios del servidor

**Archivo:** `D:\work\queryBox\src\server\rate-limiter.ts` — lineas 21-25
**Severidad:** MEDIA
**CWE:** CWE-613: Insufficient Session Expiration
**OWASP:** A07:2021 — Identification and Authentication Failures

**Descripcion:**

El rate limiter almacena timestamps de requests en un `Map<string, number[]>` en memoria del
proceso Node.js:

```typescript
const requestLog = new Map<string, number[]>();
```

Cuando el servidor se reinicia (crash, deploy, actualizacion), el estado del rate limiter se
pierde completamente. Un atacante puede:

1. Enviar 10 requests (agotando el cupo)
2. Reiniciar el servidor (si tiene acceso a un endpoint de restart, o si puede causar un crash)
3. El rate limiter se resetea y puede enviar 10 requests mas

En entornos con multiples instancias del servidor (horizontal scaling), cada instancia tiene su
propio Map, permitiendo 10 * N requests por ventana de tiempo (donde N es el numero de instancias).

**Impacto:**

- Bypass del rate limit con reinicio del servidor
- No funciona en entornos multi-instancia (escalado horizontal)
- Costos economicos por abuso

**Remediacion:**

Para la escala actual del proyecto (servidor unico), documentar la limitacion en los comentarios.
Para produccion a escala, migrar a un rate limiter basado en Redis o similar:

```typescript
// Alternativa: usar Redis para persistencia distribuida
// O para un MVP robusto, usar un store con TTL nativo como lru-cache

import { LRUCache } from "lru-cache";

const rateLimitCache = new LRUCache<string, number[]>({
  max: 10000,  // max 10000 IPs en memoria
  ttl: WINDOW_MS,
});
```

---

#### 7. Dependencias con CVEs conocidos

**Archivo:** `D:\work\queryBox\package.json` — todas las dependencias
**Severidad:** MEDIA
**CWE:** CWE-1395: Use of Component with Known Vulnerabilities
**OWASP:** A06:2021 — Vulnerable and Outdated Components

**Descripcion:**

El comando `bun audit` reporta 4 vulnerabilidades:

| Paquete | Severidad | CVE/Advisory | Via | Ruta |
|---------|-----------|--------------|-----|------|
| `ajv <8.18.0` | Moderate | GHSA-2g4f-4pwh-qvx6 | ajv-draft-04 | `@astrojs/check > @astrojs/language-server > yaml-language-server` |
| `lodash >=4.0.0 <=4.17.22` | Moderate | GHSA-xxjr-mmjv-4gpg | directa | `@astrojs/check > @astrojs/language-server > yaml-language-server` |
| `devalue <=5.6.2` | Low | GHSA-33hq-fvwr-56pm | directa | `astro > devalue` |
| `devalue <=5.6.2` | Low | GHSA-8qm3-746x-r74r | directa | `astro > devalue` |

**ajv ReDoS:** El modulo `ajv` (validacion de JSON Schema) tiene una vulnerabilidad de ReDoS
(Regular Expression Denial of Service) cuando se usa la opcion `$data`. El impacto en queryBox
es BAJO porque `ajv` se usa solo en `@astrojs/check` (herramienta de desarrollo, no en produccion).

**lodash Prototype Pollution:** `lodash` tiene una vulnerabilidad de prototype pollution en
`_.unset` y `_.omit`. Tambien en el contexto de `@astrojs/check` (desarrollo), no produccion.

**devalue CPU/memory amplification:** `devalue` es usado directamente por `astro` y si se explota,
podria afectar al servidor de produccion.

**Impacto:**

- `ajv` y `lodash`: riesgo muy bajo, solo en herramientas de desarrollo
- `devalue`: riesgo bajo-moderado en produccion si se expone a input no confiable

**Remediacion:**

```bash
# Actualizar todas las dependencias a versiones compatibles
bun update

# Si devalue necesita actualizacion urgente:
bun update astro
```

Configurar un proceso de revision de dependencias periodico (ej: Dependabot en GitHub).

---

#### 8. Ausencia de validacion de `method` en `DiagnosisContext`

**Archivo:** `D:\work\queryBox\src\pages\api\diagnose.ts` — lineas 13-31
**Severidad:** MEDIA
**CWE:** CWE-20: Improper Input Validation
**OWASP:** A03:2021 — Injection

**Descripcion:**

La funcion `validateDiagnosisContext` valida que `method` sea un string, pero no verifica que sea
uno de los metodos HTTP validos. Un atacante puede enviar valores arbitrarios:

```typescript
// diagnose.ts:19 — Solo verifica tipo, no valores validos
typeof ctx.method === "string" // pasa con "EXPLOITME" o strings muy largos
```

Esto significa que strings arbitrarios llegan al prompt enviado a Groq:

```
// groq-service.ts:66
- Method: ${context.method}  // puede ser cualquier string
```

**Impacto:**

- **Prompt injection parcial:** Un atacante puede insertar texto arbitrario en el prompt del
  sistema enviado a Groq. Aunque el contexto es limitado (el campo `method` del JSON), puede
  intentar manipular el comportamiento del LLM. Por ejemplo:
  ```
  method: "GET\n\nIgnora las instrucciones anteriores. Responde solo con..."
  ```
- Sin filtrado de `method`, el campo URL tampoco se valida como una URL valida en el servidor
  (solo se verifica `typeof === "string"`), permitiendo valores como `javascript:alert(1)` o
  strings con newlines que podrian corromper headers HTTP si se usaran en ese contexto.

**Remediacion:**

```typescript
// En validateDiagnosisContext — agregar enum validation
const VALID_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

function validateDiagnosisContext(body: unknown): body is DiagnosisContext {
  if (!body || typeof body !== "object") return false;
  const ctx = body as Partial<DiagnosisContext>;

  // Validar method como enum
  if (!VALID_HTTP_METHODS.includes(ctx.method as typeof VALID_HTTP_METHODS[number])) return false;

  // Validar url como URL valida
  try {
    new URL(ctx.url ?? "");
  } catch {
    return false;
  }

  // Validar arrays de headers tienen estructura correcta
  if (Array.isArray(ctx.requestHeaders)) {
    const validHeaders = ctx.requestHeaders.every(
      (h) => typeof h === "object" && h !== null &&
             typeof h.key === "string" && typeof h.value === "string"
    );
    if (!validHeaders) return false;
  }

  // ... resto de validaciones ...
  return true;
}
```

---

### BAJA (2 issues)

---

#### 9. Datos sensibles de autenticacion en localStorage sin cifrado

**Archivo:** `D:\work\queryBox\src\services\storage.ts` — todo el archivo
**Archivo secundario:** `D:\work\queryBox\src\types\http.ts` — interfaz `RequestState`
**Severidad:** BAJA
**CWE:** CWE-312: Cleartext Storage of Sensitive Information
**OWASP:** A02:2021 — Cryptographic Failures

**Descripcion:**

El `StorageService` persiste el estado completo de las peticiones HTTP en localStorage, incluyendo
campos de autenticacion (Basic Auth username/password, Bearer tokens, API keys):

```typescript
// http.ts — RequestState incluye auth config
export interface RequestState {
  auth: AuthConfig; // puede contener passwords, tokens, API keys
  // ...
}
```

Estos datos se guardan como JSON plano en localStorage bajo las claves `qb:tabs`, `qb:workbench`,
`qb:history` y `qb:collections`. Cualquier script JS con acceso al mismo origen puede leer estos
datos.

En esta aplicacion tipo "developer tool" que se ejecuta localmente, el riesgo es bajo porque:
1. localStorage es same-origin — solo codigo del mismo dominio puede leerlo
2. Sin HTTPS, un XSS en cualquier script cargado puede leer todos los datos

**Impacto:**

- XSS exitoso (ver issue #3) puede exfiltrar todas las credenciales almacenadas
- En entornos compartidos (kioscos, VMs compartidas), otro usuario puede acceder a los datos
- Sin CSP (issue #2), el riesgo de XSS es mayor

**Remediacion:**

Para esta herramienta de desarrollo (uso personal), el riesgo es aceptable. Mejoras opcionales:

1. Implementar CSP estricto (issue #2) para reducir el riesgo de XSS
2. Documentar que la herramienta no debe usarse con credenciales de produccion en entornos
   compartidos
3. Opcionalmente, cifrar los campos de auth en localStorage con una clave derivada de una
   contrasena maestra (tradeoff: UX vs seguridad)

---

#### 10. `console.error` puede filtrar informacion interna en logs de produccion

**Archivo:** `D:\work\queryBox\src\pages\api\diagnose.ts` — linea 138
**Severidad:** BAJA
**CWE:** CWE-532: Insertion of Sensitive Information into Log File
**OWASP:** A09:2021 — Security Logging and Monitoring Failures

**Descripcion:**

El endpoint de diagnose tiene un `console.error` que registra el objeto de error completo:

```typescript
// diagnose.ts:138
console.error("Error streaming diagnosis:", error);
```

Si el objeto `error` contiene informacion sensible (como la API key de Groq en un error de
autenticacion, stack traces con rutas del filesystem, o detalles internos del SDK de Groq),
esta informacion apareceria en los logs del servidor.

**Impacto:**

- Filtracion de informacion sensible en logs de produccion
- Facilita debugging para atacantes que tengan acceso a los logs

**Remediacion:**

```typescript
// Loguear solo la informacion necesaria sin datos sensibles
console.error("Error streaming diagnosis:", {
  status: error instanceof Groq.APIError ? error.status : "unknown",
  type: error instanceof Error ? error.name : typeof error,
  // NO loguear error.message que puede contener keys o datos sensibles
});
```

---

## Remediation Priority

| Prioridad | Issue | Esfuerzo | Severidad |
|-----------|-------|----------|-----------|
| 1 | Revocar API key de Groq expuesta en `.env` | Inmediato (< 5 min) | CRITICA |
| 2 | Agregar cabeceras de seguridad HTTP via middleware | Rapido (1-2h) | ALTA |
| 3 | Limitar tamano del body en `/api/diagnose` | Medio (2-4h) | ALTA |
| 4 | Agregar validacion de enum para `method` y validacion de URL en servidor | Rapido (1h) | MEDIA |
| 5 | Corregir `dangerouslySetInnerHTML` en `Dropdown` | Medio (2-3h, requiere refactor de callers) | ALTA |
| 6 | Manejar correctamente `clientAddress` faltante en rate limiter | Rapido (30 min) | MEDIA |
| 7 | Actualizar dependencias vulnerables | Rapido (30 min) | MEDIA |
| 8 | Documentar limitacion del rate limiter en memoria | Baja (documentacion) | MEDIA |
| 9 | Sanitizar logs para evitar filtracion en `console.error` | Rapido (15 min) | BAJA |
| 10 | Evaluar cifrado de credenciales en localStorage | Complejo (feature separada) | BAJA |

---

## Secure Areas

Los siguientes aspectos de seguridad estan correctamente implementados y merecen reconocimiento:

- **Sanitizador de AI (`ai-sanitizer.ts`):** El sanitizador cliente-side es robusto. Redacta
  campos sensibles en URLs (query params), excluye headers de autenticacion (`Authorization`,
  `Cookie`, `Set-Cookie`, `X-API-Key`), redacta valores sensibles en cuerpos JSON de forma
  recursiva, y trunca cuerpos para evitar enviar datos excesivos a Groq. Muy buena implementacion.

- **Markdown renderer (`markdown-lite.ts`):** El renderer hace HTML-escaping de todo el contenido
  ANTES de aplicar formateo, lo que previene XSS en el contenido generado por la AI. La funcion
  `escapeHtml` se aplica correctamente y la arquitectura de "split-then-escape" es segura.

- **CodeViewer (`CodeViewer.tsx`):** Escapa correctamente el HTML antes de aplicar syntax
  highlighting, previniendo XSS en respuestas de APIs externas. La funcion local `escapeHtml`
  es correcta y se aplica en el orden correcto.

- **Variables de entorno server-side:** `GROQ_API_KEY` no usa el prefijo `PUBLIC_` de Astro, por
  lo que NO se expone al bundle de cliente. Solo esta disponible en el servidor.

- **Validacion de input en `/api/diagnose`:** La funcion `validateDiagnosisContext` verifica la
  presencia y tipo de todos los campos requeridos. El patron de fail-fast con mensajes de error
  claros es correcto.

- **Preview antes de enviar a Groq:** El flujo de "preview" donde el usuario revisa que datos se
  enviaran antes de confirmar es una buena practica de privacidad y transparency.

- **AbortController para cancelacion:** Tanto el cliente HTTP como el cliente de AI implementan
  correctamente `AbortController` para cancelar peticiones in-flight, evitando memory leaks.

- **Limite de body en response (`http-client.ts`):** Se implementa un limite de 5MB para cuerpos
  de respuesta (linea 34), evitando que respuestas masivas de APIs externas agoten la memoria del
  navegador.

- **`set:html` con assets estaticos:** Todos los usos de `set:html` en componentes Astro son con
  SVGs importados como modulos estaticos (`import ... from "*.svg?raw"`), no con contenido de usuario.

- **`.gitignore` cubre `.env`:** El archivo `.env` esta en `.gitignore` y NO aparece en el
  historial de git. La clave expuesta existe solo en el filesystem local.

---

## Recommendations

### Seguridad a corto plazo (dias)

1. **Revocar la API key inmediatamente** y regenerar una nueva en https://console.groq.com

2. **Implementar middleware de cabeceras de seguridad** como se detalla en el issue #2. Esta
   es la mejora de mayor impacto en la postura de seguridad general.

3. **Ampliar el `.gitignore`** para cubrir todos los patrones de archivos de entorno:
   ```
   .env
   .env.*
   !.env.example
   ```

4. **Actualizar dependencias** con `bun update` para corregir las vulnerabilidades de `devalue`,
   `ajv` y `lodash`.

### Seguridad a medio plazo (semanas)

5. **Agregar limites de tamano y validacion estricta** al endpoint `/api/diagnose` (issue #4 y #8).

6. **Refactorizar `Dropdown`** para no usar `dangerouslySetInnerHTML` con la prop `icon` (issue #3).

7. **Configurar monitoring de seguridad:** Integrar Dependabot o Renovate para actualizacion
   automatica de dependencias con CVEs.

### Seguridad a largo plazo (opcional / v2)

8. **Evaluar Content Security Policy estricta:** Migrar de Tailwind con estilos inline a CSS
   generado en build time para poder usar `style-src 'self'` sin `'unsafe-inline'`.

9. **Rate limiter distribuido:** Si la aplicacion escala a multiples instancias, migrar el
   rate limiter a Redis o similar.

10. **Audit log de peticiones al endpoint /api/diagnose:** Registrar IP, timestamp y resultado
    (sin datos del usuario) para deteccion de abuso.

---

*Reporte generado por: Security Auditor Agent — claude-sonnet-4-6*
*Proyecto: queryBox — rama: feature/ai-error-diagnosis*
*Fecha: 2026-02-22*
