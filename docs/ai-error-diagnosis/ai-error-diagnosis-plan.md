# Plan de Implementación: Diagnóstico Inteligente de Errores (AI-Powered Error Diagnosis)

- **Feature branch**: `feature/ai-error-diagnosis`
- **Plan directory**: `docs/ai-error-diagnosis/`
- **Fecha**: 2026-02-22
- **Estado**: ✅ Aprobado para implementación

---

## Resumen Ejecutivo

Cuando una solicitud HTTP falla (4xx, 5xx, CORS, timeout, errores de red), el usuario podrá obtener un diagnóstico inteligente generado por IA (vía Groq SDK) que analice el contexto de la request/response y ofrezca sugerencias accionables para resolver el problema.

### Decisión Arquitectónica: Server-Side (SSR Hybrid)

La integración con Groq se ejecuta **server-side** mediante un API route de Astro. La API key se almacena en `.env` del servidor y **nunca se expone al browser**. Astro se configura en modo `hybrid`: todas las páginas siguen siendo estáticas (pre-rendered), solo el endpoint `/api/diagnose` se ejecuta en el servidor.

El API route incluye **rate limiting in-memory** para prevenir abuso (máximo de requests por IP por ventana de tiempo).

---

## Análisis de Dependencias

### Nueva dependencia

| Package     | Versión   | Justificación                                                      |
| ----------- | --------- | ------------------------------------------------------------------ |
| `groq-sdk`  | `^0.37.0` | SDK oficial de Groq para TypeScript. Ejecutado **server-side** en el API route de Astro. Compatible con Bun y TypeScript ≥4.9. Proporciona tipos para streaming y chat completions. |

### Dependencias existentes aprovechadas

- `@preact/signals` — estado reactivo para el diagnóstico AI
- `preact` — componentes de UI (islands)
- `tailwindcss` — estilos consistentes con el design system existente
- `astro` — API routes con SSR hybrid mode para el endpoint `/api/diagnose`

### Dependencia de markdown rendering

No se añadirá una librería de markdown. La respuesta de la IA se renderizará como texto plano con estilos básicos aplicados por CSS (párrafos separados por doble salto de línea, listas detectadas por regex simple, code blocks con backticks). Esto mantiene el bundle pequeño y evita dependencias innecesarias (**YAGNI**). Si en el futuro se necesita markdown completo, se puede añadir `marked` o similar sin cambios arquitectónicos.

### Dependencia de rate limiting

No se añadirá una librería de rate limiting. Se implementará un **rate limiter in-memory** simple basado en un `Map<string, number[]>` (IP → timestamps). Esto es suficiente para un single-instance server y evita dependencias innecesarias. Para producción multi-instancia se podría migrar a Redis en el futuro.

---

## Arquitectura de la Feature

```
┌─────────────────────────────────────────────────────────────┐
│                       UI Layer (Browser)                    │
│                                                             │
│  ResponsePanel.tsx                                          │
│    ├─ [status === "error"]  → ErrorDisplay + DiagnoseButton │
│    └─ [status === "success" && non-2xx] → DiagnoseButton    │
│                                                             │
│  AiDiagnosisPanel.tsx  (nuevo)                              │
│    ├─ DiagnosisContent   (streaming text via SSE)           │
│    ├─ PrivacyPreview     (datos que se enviarán)            │
│    └─ Loading / Error states                                │
├─────────────────────────────────────────────────────────────┤
│                      Store Layer (Browser)                  │
│                                                             │
│  ai-diagnosis-store.ts  (nuevo)                             │
│    ├─ diagnosisState signal (per-tab via computed)           │
│    ├─ diagnosisStatus signal                                │
│    └─ Action functions (startDiagnosis, cancelDiagnosis)    │
├─────────────────────────────────────────────────────────────┤
│                   Client Service Layer (Browser)            │
│                                                             │
│  ai-client.ts  (nuevo)                                      │
│    ├─ requestDiagnosis(context) → fetch('/api/diagnose')    │
│    └─ Consume streaming response via ReadableStream         │
│                                                             │
│  ai-sanitizer.ts  (nuevo)                                   │
│    └─ sanitizeRequestContext() — elimina credenciales/keys  │
├═════════════════════════════════════════════════════════════╡
│               ↕ HTTP (fetch with streaming)                 │
├═════════════════════════════════════════════════════════════╡
│                   Server Layer (Astro SSR)                  │
│                                                             │
│  src/pages/api/diagnose.ts  (nuevo — API Route)             │
│    ├─ POST handler con streaming response                   │
│    ├─ Rate limiter in-memory (IP-based)                     │
│    ├─ Valida y sanitiza input del client                    │
│    ├─ Groq SDK (server-side, API key desde .env)            │
│    └─ Retorna stream de texto al browser                    │
│                                                             │
│  src/server/rate-limiter.ts  (nuevo)                        │
│    ├─ Sliding window rate limiting por IP                   │
│    ├─ Configurable: max requests, window size               │
│    └─ Auto-cleanup de entries expiradas                     │
│                                                             │
│  src/server/groq-service.ts  (nuevo)                        │
│    ├─ createGroqClient() — API key desde import.meta.env    │
│    ├─ streamDiagnosis() — streaming chat completion         │
│    └─ buildDiagnosisMessages() — system + user prompt       │
├─────────────────────────────────────────────────────────────┤
│                      Types Layer (compartido)               │
│                                                             │
│  src/types/ai.ts  (nuevo)                                   │
│    ├─ DiagnosisState, DiagnosisStatus                       │
│    ├─ DiagnosisContext                                      │
│    └─ DiagnosisApiRequest / DiagnosisApiError               │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de datos

```
Usuario hace click en "Diagnosticar con AI"
    │
    ▼
ai-diagnosis-store.startDiagnosis()          [BROWSER]
    │
    ├─ 1. Obtiene requestState + responseState/requestError del tab activo
    ├─ 2. ai-sanitizer.sanitizeRequestContext() → elimina auth/secrets
    ├─ 3. ai-client.requestDiagnosis(context) → fetch POST /api/diagnose
    │
    ▼
API Route: POST /api/diagnose               [SERVIDOR]
    │
    ├─ 4. Rate limiter verifica IP del request
    │       ├─ Si excede límite → 429 Too Many Requests
    │       └─ Si OK → continúa
    ├─ 5. Valida schema del DiagnosisContext recibido
    ├─ 6. Groq SDK crea streaming chat completion
    │       ├─ API key desde import.meta.env.GROQ_API_KEY (nunca expuesta)
    │       └─ Construye prompt con el contexto sanitizado
    ├─ 7. Retorna ReadableStream (text/event-stream) al browser
    │
    ▼
ai-client.ts consume el stream              [BROWSER]
    │
    ├─ 8. Itera chunks del ReadableStream
    ├─ 9. Llama onChunk() → actualiza diagnosisState signal
    └─ 10. UI se actualiza reactivamente via signals
```

---

## Phase 1: Tipos y Interfaces

### Objetivo
Definir todas las interfaces TypeScript necesarias antes de cualquier implementación lógica o de UI.

### Prerequisitos
Ninguno — es la fase fundacional.

### Tareas Detalladas

1. **Crear `src/types/ai.ts`** con las siguientes interfaces:

   - `DiagnosisStatus`: type literal union `"idle" | "previewing" | "loading" | "streaming" | "done" | "error"`
   - `DiagnosisResult`: objeto con `content: string`, `timestamp: number`, `model: string`
   - `DiagnosisError`: objeto con `message: string`, `type: "rate-limit" | "network" | "server" | "unknown"`, `retryAfter?: number`
   - `DiagnosisContext`: objeto con los datos sanitizados que se envían a la IA:
     - `method: string`
     - `url: string` (sanitized — sin query params sensibles)
     - `statusCode: number | null`
     - `statusText: string`
     - `errorType: string` (de HttpError.type)
     - `errorMessage: string`
     - `responseBodyExcerpt: string` (primeros 2000 chars)
     - `requestHeaders: Array<{ key: string; value: string }>` (filtrados)
     - `responseHeaders: Array<{ key: string; value: string }>`
     - `requestBodyExcerpt: string` (primeros 1000 chars, sin secrets)
     - `contentType: string`
   - `AiSettings`: **eliminado** — la configuración vive en `.env` del servidor
   - `DiagnosisApiRequest`: tipo del body que se envía al API route (alias de `DiagnosisContext`)
   - `DiagnosisApiError`: tipo del error response del API route `{ error: string; message: string; retryAfter?: number }`
   - `RateLimitInfo`: `{ remaining: number; resetIn: number }` — info de rate limit para la UI
   - `TabDiagnosisState`: estado del diagnóstico por tab — `{ status: DiagnosisStatus; result: DiagnosisResult | null; error: DiagnosisError | null; context: DiagnosisContext | null; rateLimitInfo: RateLimitInfo | null }`

### Archivos Afectados
- `src/types/ai.ts` — **crear**

### Mejores Prácticas Aplicadas
- **Type Safety**: Todos los tipos con TypeScript strict. Discriminated unions para `DiagnosisStatus`.
- **Separation of Concerns**: Tipos en su propio archivo, siguiendo el patrón de `src/types/http.ts` y `src/types/auth.ts`.
- **YAGNI**: Solo los tipos necesarios para esta feature.

### Criterios de Completitud
- [ ] `src/types/ai.ts` existe y exporta todos los tipos listados
- [ ] `bun astro check` pasa sin errores
- [ ] Los tipos siguen las convenciones del proyecto (misma estructura que `http.ts`)

### Riesgos y Mitigaciones
- Riesgo: Evolución del schema de la API de Groq → Mitigación: Los tipos internos (`DiagnosisContext`) son independientes del SDK; solo `ai-client.ts` interactúa con los tipos de Groq.

### Estimación de Complejidad
**Baja** — Solo definición de tipos, sin lógica.

---

## Phase 2: Servicio de Sanitización

### Objetivo
Crear un servicio que tome el contexto de request/response y elimine cualquier información sensible (credenciales, API keys, tokens) antes de enviarlo a la IA.

### Prerequisitos
- Phase 1 completada (tipos `DiagnosisContext` disponibles)

### Tareas Detalladas

1. **Crear `src/services/ai-sanitizer.ts`**:

   - Función `sanitizeRequestContext(request: RequestState, response: ResponseState | null, error: HttpError | null): DiagnosisContext`
   - **Sanitización de URL**:
     - Parsear la URL y eliminar query params que contengan patrones sensibles (`key`, `token`, `secret`, `password`, `auth`, `api_key`, `apikey`, `access_token`)
     - Reemplazar valores de params sensibles con `[REDACTED]`
   - **Sanitización de Headers**:
     - Excluir completamente: `Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`, y cualquier header cuyo nombre contenga `token`, `secret`, `key`, `auth`, `credential`
     - De los request headers, solo incluir los enabled
   - **Sanitización del Body**:
     - Truncar a 1000 caracteres el request body
     - Truncar a 2000 caracteres el response body
     - Intentar detectar y redactar campos JSON sensibles (password, secret, token, apiKey) si el body es JSON parseable
   - **Auth config**: NUNCA incluir datos de `request.auth` en el contexto

2. **Crear `src/services/__tests__/ai-sanitizer.test.ts`** (tests unitarios):
   - Test: URL con `?api_key=xyz` → params redactados
   - Test: Headers con `Authorization: Bearer xxx` → excluidos
   - Test: Body JSON con campo `password` → redactado
   - Test: Body largo → truncado correctamente
   - Test: URL mal formada → manejo graceful sin crash

### Archivos Afectados
- `src/services/ai-sanitizer.ts` — **crear**
- `src/services/__tests__/ai-sanitizer.test.ts` — **crear**

### Mejores Prácticas Aplicadas
- **Security by Design**: Deny-list + heurísticas para detectar secrets. Mejor sobre-redactar que sub-redactar.
- **Fail Fast**: Si la URL no se puede parsear, usar la URL raw sin query params.
- **Pure Functions**: `sanitizeRequestContext` es una función pura sin side effects, fácil de testear.
- **DRY**: Regex patterns de detección de secrets reutilizables como constantes.

### Criterios de Completitud
- [ ] `ai-sanitizer.ts` exporta `sanitizeRequestContext`
- [ ] Todos los tests pasan (`bun run test`)
- [ ] Credenciales y tokens NUNCA aparecen en el output
- [ ] Truncamiento de body funciona correctamente
- [ ] `bun astro check` pasa sin errores

### Riesgos y Mitigaciones
- Riesgo: Falsos negativos en sanitización (se escapan secrets no reconocidos) → Mitigación: Usar una deny-list conservadora + advertir al usuario en la UI que revise los datos antes de enviar (Phase 6).
- Riesgo: Falsos positivos (se redacta demasiado) → Mitigación: Aceptable — es preferible a filtrar secrets.

### Estimación de Complejidad
**Media** — Requiere lógica de parsing y redacción cuidadosa con buenos tests.

---

## Phase 3: API Route Server-Side, Groq SDK y Rate Limiter

### Objetivo
Crear el API route de Astro que recibe el contexto de error del browser, lo envía a Groq vía SDK server-side, y retorna la respuesta en streaming. Incluir rate limiting por IP para prevenir abuso. Configurar Astro en modo `hybrid`.

### Prerequisitos
- Phase 1 completada (tipos)
- `groq-sdk` instalado como dependencia (`bun add groq-sdk`)

### Tareas Detalladas

1. **Instalar dependencia**: `bun add groq-sdk`

2. **Configurar Astro hybrid mode** — modificar `astro.config.mjs`:

   ```js
   export default defineConfig({
     output: 'hybrid', // ← páginas estáticas + API routes server-side
     integrations: [preact()],
     vite: { plugins: [tailwindcss()] }
   });
   ```

3. **Crear `.env`** (y `.env.example`):

   ```env
   GROQ_API_KEY=gsk_your_key_here
   ```

4. **Crear `src/server/rate-limiter.ts`** — Rate limiter in-memory:

   - **Algoritmo**: Sliding window counter por IP
   - **Configuración por defecto**:
     - `MAX_REQUESTS = 10` — máximo 10 diagnósticos por ventana
     - `WINDOW_MS = 60_000` — ventana de 1 minuto
     - Constantes exportadas para fácil ajuste
   - **Interfaz**:
     - `checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number }`
     - `remaining`: cuántas requests quedan en la ventana actual
     - `resetIn`: ms hasta que se libere el siguiente slot
   - **Almacenamiento**: `Map<string, number[]>` donde cada entry es un array de timestamps
   - **Auto-cleanup**: Función `cleanupExpiredEntries()` que elimina IPs sin actividad reciente. Llamada cada 100 requests para evitar memory leaks.
   - **Thread safety**: No aplica (Node/Bun es single-threaded), pero la implementación es idempotente.

   ```typescript
   // Ejemplo de API:
   const MAX_REQUESTS = 10;
   const WINDOW_MS = 60_000; // 1 minuto

   const requestLog = new Map<string, number[]>();

   export function checkRateLimit(ip: string): {
     allowed: boolean;
     remaining: number;
     resetIn: number;
   } {
     const now = Date.now();
     const windowStart = now - WINDOW_MS;
     
     // Filtrar timestamps dentro de la ventana
     const timestamps = (requestLog.get(ip) ?? []).filter(t => t > windowStart);
     
     if (timestamps.length >= MAX_REQUESTS) {
       const oldestInWindow = timestamps[0];
       return {
         allowed: false,
         remaining: 0,
         resetIn: oldestInWindow + WINDOW_MS - now,
       };
     }
     
     timestamps.push(now);
     requestLog.set(ip, timestamps);
     
     return {
       allowed: true,
       remaining: MAX_REQUESTS - timestamps.length,
       resetIn: 0,
     };
   }
   ```

5. **Crear `src/server/groq-service.ts`** — Servicio server-side de Groq:

   - **`createGroqClient(): Groq`**
     - Instancia `new Groq({ apiKey: import.meta.env.GROQ_API_KEY, maxRetries: 1, timeout: 30000 })`
     - **Sin** `dangerouslyAllowBrowser` — corre en el servidor
     - Lanza error si `GROQ_API_KEY` no está configurada

   - **`buildDiagnosisMessages(context: DiagnosisContext): ChatCompletionMessageParam[]`**
     - Construir array de mensajes con:
       - **System message**: Prompt del experto HTTP (ver sección "Diseño del Prompt" abajo)
       - **User message**: Contexto serializado de forma estructurada

   - **`streamDiagnosis(context: DiagnosisContext): ReadableStream`**
     - Crear el client con `createGroqClient()`
     - Llamar a `client.chat.completions.create({ messages, model: "llama-3.3-70b-versatile", stream: true, temperature: 0.3, max_completion_tokens: 1024 })`
     - Retornar un `ReadableStream` que emite chunks de texto (`text/event-stream`)
     - Mapear errores de Groq (`Groq.APIError`) a respuestas HTTP apropiadas:
       - `401` → HTTP 502 con `{ error: "AI service authentication failed" }`
       - `429` → HTTP 502 con `{ error: "AI service rate limit reached" }`
       - Otros → HTTP 502 con `{ error: "AI service unavailable" }`

6. **Crear `src/pages/api/diagnose.ts`** — API Route de Astro:

   ```typescript
   // Marcar como server-rendered (no pre-rendered)
   export const prerender = false;

   export async function POST({ request, clientAddress }: APIContext) {
     // 1. Rate limiting
     const rateLimit = checkRateLimit(clientAddress);
     if (!rateLimit.allowed) {
       return new Response(
         JSON.stringify({
           error: "rate-limit",
           message: "Too many diagnosis requests. Try again later.",
           retryAfter: Math.ceil(rateLimit.resetIn / 1000),
         }),
         {
           status: 429,
           headers: {
             "Content-Type": "application/json",
             "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)),
             "X-RateLimit-Remaining": String(rateLimit.remaining),
           },
         }
       );
     }

     // 2. Validar y parsear body
     const body = await request.json();
     // Validar que body cumple DiagnosisContext schema...

     // 3. Stream diagnosis
     const stream = streamDiagnosis(body as DiagnosisContext);

     return new Response(stream, {
       status: 200,
       headers: {
         "Content-Type": "text/event-stream",
         "Cache-Control": "no-cache",
         "X-RateLimit-Remaining": String(rateLimit.remaining),
       },
     });
   }
   ```

   - **Validación del body**: Verificar que el `DiagnosisContext` tiene los campos requeridos con tipos correctos. Rechazar con 400 si es inválido.
   - **Headers de rate limit**: Incluir `X-RateLimit-Remaining` y `Retry-After` en las respuestas para que el client pueda mostrar información al usuario.
   - **CORS**: No necesario — el browser llama a su propio origin.

7. **Actualizar `src/services/ai-client.ts`** — Ahora es un **client-side service** que llama al API route:

   - **`requestDiagnosis(context: DiagnosisContext, onChunk: (text: string) => void, signal?: AbortSignal): Promise<void>`**
     - `fetch('/api/diagnose', { method: 'POST', body: JSON.stringify(context), signal })`
     - Si `response.status === 429` → extraer `retryAfter` y lanzar `DiagnosisError` de tipo `"rate-limit"`
     - Si `response.status !== 200` → lanzar `DiagnosisError` apropiado
     - Si OK → leer `response.body` como `ReadableStream`, decodificar con `TextDecoder`, iterar chunks y llamar `onChunk()`
   - **Ya NO importa groq-sdk** — solo hace fetch al API route
   - **Ya NO recibe `apiKey`** — la key está en el servidor

### Archivos Afectados
- `astro.config.mjs` — **modificar** (añadir `output: 'hybrid'`)
- `.env` — **crear** (con `GROQ_API_KEY`)
- `.env.example` — **crear** (con placeholder)
- `src/server/rate-limiter.ts` — **crear**
- `src/server/groq-service.ts` — **crear**
- `src/pages/api/diagnose.ts` — **crear**
- `src/services/ai-client.ts` — **crear** (versión client-side simplificada)
- `package.json` — **modificar** (nueva dependencia `groq-sdk`)

### Mejores Prácticas Aplicadas
- **Security (Defense in Depth)**: API key nunca sale del servidor. Rate limiting previene abuso. Validación de input en el servidor.
- **Single Responsibility**: Rate limiter, Groq service, y API route son módulos independientes.
- **Error Handling (Fail Fast)**: Errores de Groq mapeados a respuestas HTTP estándar. Rate limit usa códigos estándar (429).
- **Cancellation**: Soporte para `AbortSignal` en el client-side para cancelar requests al API route.
- **Streaming**: El servidor retorna un `ReadableStream` que el browser consume progresivamente — mismo UX que client-side pero sin exponer la API key.
- **12-Factor App**: Configuración sensible vía environment variables (`.env`), no hardcodeada.

### Criterios de Completitud
- [ ] `astro.config.mjs` configurado con `output: 'hybrid'`
- [ ] `.env` con `GROQ_API_KEY` y `.env.example` como documentación
- [ ] Rate limiter implementado con sliding window (10 req/min por IP)
- [ ] Rate limiter retorna headers estándar (`Retry-After`, `X-RateLimit-Remaining`)
- [ ] API route `POST /api/diagnose` funcional con streaming
- [ ] API route valida el body del request
- [ ] `ai-client.ts` consume el stream del API route (no usa groq-sdk)
- [ ] Errores de Groq mapeados a respuestas HTTP apropiadas (502)
- [ ] Errores de rate limit mapeados a 429 con `retryAfter`
- [ ] `groq-sdk` añadido a `package.json`
- [ ] `bun astro check` pasa sin errores
- [ ] `bun build` compila correctamente

### Riesgos y Mitigaciones
- Riesgo: Rate limiter in-memory se pierde al reiniciar el servidor → Mitigación: Aceptable para desarrollo. En producción se puede migrar a Redis/KV store sin cambiar la interfaz.
- Riesgo: Memory leak en el rate limiter si muchas IPs únicas → Mitigación: Auto-cleanup cada 100 requests elimina entries expiradas.
- Riesgo: `clientAddress` no disponible en todos los adaptadores de Astro → Mitigación: Fallback a `request.headers.get('x-forwarded-for')`, o `'unknown'` como último recurso.
- Riesgo: Streaming no funciona con algunos reverse proxies → Mitigación: Headers `Cache-Control: no-cache` y `Content-Type: text/event-stream` ayudan. Si hay problemas, se puede degradar a respuesta completa (no streaming).

### Estimación de Complejidad
**Media-Alta** — API route con streaming + rate limiter + Groq SDK server-side + configuración SSR.

---

## Phase 4: Stores de Estado

### Objetivo
Crear los stores de Preact signals para gestionar el estado de la configuración AI y del diagnóstico por tab.

### Prerequisitos
- Phase 1 completada (tipos)
- Phase 3 completada (servicio AI client)

### Tareas Detalladas

1. **Crear `src/stores/ai-diagnosis-store.ts`**:

   - **Estado diagnosis por tab**: Usar un `signal<Map<string, TabDiagnosisState>>` donde la key es el tab ID
   - **Computed signals** (proxies al tab activo, mismo patrón que `http-store.ts`):
     - `diagnosisState = computed(() => ...)` — `TabDiagnosisState` del tab activo
     - `diagnosisStatus = computed(() => diagnosisState.value?.status ?? "idle")`
     - `diagnosisResult = computed(() => diagnosisState.value?.result ?? null)`
     - `diagnosisError = computed(() => diagnosisState.value?.error ?? null)`
     - `diagnosisContext = computed(() => diagnosisState.value?.context ?? null)`
     - `rateLimitInfo = computed(() => diagnosisState.value?.rateLimitInfo ?? null)` — info de rate limit del servidor
   - **Actions**:
     - `previewDiagnosis(): void` — genera el `DiagnosisContext` sanitizado y lo guarda en el state con status `"previewing"` para que el usuario revise qué se va a enviar
     - `startDiagnosis(): Promise<void>` — crea AbortController, llama a `requestDiagnosis()` del ai-client con callback de streaming que actualiza el result progresivamente, gestiona status transitions (`loading` → `streaming` → `done`/`error`). Si recibe error de rate-limit, guarda el `retryAfter` en el state.
     - `cancelDiagnosis(): void` — aborta el AbortController activo
     - `clearDiagnosis(): void` — resetea el state del tab activo a idle
   - **AbortController management**: Mantener referencia al controller activo para permitir cancelación
   - **Nota**: Ya no necesita `ai-settings-store` — no hay API key ni modelo que configurar en el client. Todo se gestiona server-side.

### Archivos Afectados
- `src/stores/ai-diagnosis-store.ts` — **crear**

### Mejores Prácticas Aplicadas
- **Consistency**: Mismo patrón de computed signals + actions que `http-store.ts` y `tab-store.ts`.
- **Single Source of Truth**: El estado de diagnóstico se asocia al tab ID, evitando conflictos entre tabs.
- **Open/Closed Principle**: Nuevo store sin modificar los existentes. Solo se lee de `tab-store` (activeTabId) y `http-store` (signals computados).
- **Simplificación**: Sin `ai-settings-store` — la configuración de API key y modelo vive server-side en `.env`.

### Criterios de Completitud
- [ ] `ai-diagnosis-store.ts` gestiona estado por tab
- [ ] Computed signals reflejan el tab activo correctamente
- [ ] `startDiagnosis()` invoca el servicio AI via API route con streaming
- [ ] `cancelDiagnosis()` aborta peticiones en progreso
- [ ] `previewDiagnosis()` genera y expone el contexto sanitizado
- [ ] Manejo de rate limit errors con `retryAfter` en el state
- [ ] `bun astro check` pasa sin errores

### Riesgos y Mitigaciones
- Riesgo: Memory leak si no se limpian los estados de diagnosis de tabs cerrados → Mitigación: Escuchar cambios en `tabs` signal y limpiar entries de la Map para tabs que ya no existen.
- Riesgo: Race condition si el usuario cambia de tab durante un diagnóstico → Mitigación: El AbortController se asocia al tab ID actual. Cambiar de tab no cancela el diagnóstico del tab anterior; su resultado estará disponible al volver.

### Estimación de Complejidad
**Media** — Requiere coordinación entre stores existentes y manejo de streaming asíncrono.

---

## Phase 5: Componentes UI — Botón de Diagnóstico

### Objetivo
Añadir el botón "Diagnosticar con AI" al `ResponsePanel` en los estados de error y respuestas non-2xx.

### Prerequisitos
- Phase 4 completada (stores disponibles)

### Tareas Detalladas

1. **Crear `src/components/response/AiDiagnoseButton.tsx`**:

   - Botón con icono de IA (sparkles/wand SVG) y texto "Diagnosticar con AI"
   - **Estados del botón**:
     - Idle → botón habilitado, color accent
     - Previewing/Loading/Streaming → botón cambia a "Cancelar diagnóstico", color de cancelación
     - Done → botón cambia a "Diagnosticar de nuevo"
     - Rate limited → botón deshabilitado con texto "Reintentar en Xs" (countdown con `retryAfter` del state)
   - Lee `diagnosisStatus` y `rateLimitInfo` de `ai-diagnosis-store`
   - Click handler llama a `previewDiagnosis()` (para mostrar preview antes de enviar)
   - Accesibilidad: `aria-label` descriptivo, `aria-busy` durante loading

2. **Modificar `src/components/response/ResponsePanel.tsx`**:

   - En la sección `status === "error"`, añadir `<AiDiagnoseButton />` debajo del mensaje de error
   - Añadir nueva condición: si `status === "success"` y el status code es ≥ 400, mostrar `<AiDiagnoseButton />` en el `<ResponseStatusBar />`
   - Añadir `<AiDiagnosisPanel />` (Phase 6) debajo/al lado del área de error

### Archivos Afectados
- `src/components/response/AiDiagnoseButton.tsx` — **crear**
- `src/components/response/ResponsePanel.tsx` — **modificar**

### Mejores Prácticas Aplicadas
- **Accessibility (a11y)**: Aria labels, estados disabled correctos, indicadores de loading.
- **Separation of Concerns**: El botón es un componente independiente que solo interactúa con los stores.
- **Progressive Enhancement**: Si el servidor está en rate limit, el botón muestra countdown en vez de desaparecer.

### Criterios de Completitud
- [ ] Botón visible en estado de error
- [ ] Botón visible para respuestas con status ≥ 400
- [ ] Botón deshabilitado durante rate limit con countdown visible
- [ ] Estados del botón reflejan correctamente el flujo de diagnóstico
- [ ] `bun astro check` pasa sin errores

### Riesgos y Mitigaciones
- Riesgo: El botón rompe el layout actual de error → Mitigación: Posicionarlo debajo del mensaje de error con margen adecuado, manteniendo el diseño centrado.

### Estimación de Complejidad
**Baja** — Componente presentacional con binding a signals.

---

## Phase 6: Componentes UI — Panel de Diagnóstico AI

### Objetivo
Crear el panel que muestra la preview del contexto a enviar, el diagnóstico en streaming, y los estados de error/carga.

### Prerequisitos
- Phase 4 y Phase 5 completadas

### Tareas Detalladas

1. **Crear `src/components/response/AiDiagnosisPanel.tsx`**:

   - Panel que se muestra debajo del error display / StatusBar cuando `diagnosisStatus !== "idle"`
   - **Sub-estados del panel**:
     - **`previewing`**: Muestra el contexto sanitizado que se enviará al AI (JSON formateado en un `<CodeViewer>` o pre/code block) con dos botones: "Enviar a Groq" y "Cancelar"
       - Texto de advertencia: "Los siguientes datos se enviarán a la API de Groq para análisis. Revisa que no contengan información sensible."
     - **`loading`**: Spinner + "Conectando con Groq AI..."
     - **`streaming`**: Texto del diagnóstico renderizándose progresivamente + botón "Cancelar"
     - **`done`**: Diagnóstico completo + metadatos (modelo usado, timestamp) + botón "Cerrar" y "Diagnosticar de nuevo"
     - **`error`**: Mensaje de error específico + botón "Reintentar"
       - Si error es `"rate-limit"` → mostrar countdown "Reintentar en Xs" usando `retryAfter` del state
       - Si error es `"network"` → sugerir verificar conexión
       - Si error es `"server"` → "El servicio de AI no está disponible. Intenta más tarde."
   - **Renderizado de texto**:
     - Utilizar un componente interno `AiResponseRenderer` que procese la respuesta del AI:
       - Separar párrafos por doble newline
       - Detectar bloques de código (triple backtick) y renderizarlos en `<pre><code>` con estilo `bg-pm-bg-tertiary font-pm-mono`
       - Detectar listas (líneas que empiezan con `- ` o `1. `) y renderizar como `<ul>/<ol>`
       - Detectar inline code (backticks simples) y renderizar en `<code>`
       - Detectar **bold** (doble asterisco) y renderizar en `<strong>`
       - Escapar HTML del contenido de la IA antes de renderizar para prevenir XSS
   - **Layout**: Panel con borde superior, fondo `bg-pm-bg-secondary`, esquinas redondeadas, max-height con scroll

2. **Crear `src/utils/markdown-lite.ts`**:
   - Función `renderMarkdownLite(text: string): string` que retorna HTML seguro (escaped + styled)
   - Manejo de XSS: SIEMPRE escapar el texto crudo antes de aplicar regex de formato
   - Seguir el patrón de `escapeHtml()` usado en `CodeViewer.tsx`
   - Esta función es pura y testeable

3. **Crear `src/utils/__tests__/markdown-lite.test.ts`**:
   - Tests para: párrafos, code blocks, inline code, bold, listas, XSS prevention

### Archivos Afectados
- `src/components/response/AiDiagnosisPanel.tsx` — **crear**
- `src/utils/markdown-lite.ts` — **crear**
- `src/utils/__tests__/markdown-lite.test.ts` — **crear**

### Mejores Prácticas Aplicadas
- **Security (XSS Prevention)**: El contenido de la IA se escapa con `escapeHtml()` ANTES de aplicar cualquier transformación de markdown, siguiendo el patrón existente de `CodeViewer.tsx`.
- **Principle of Least Surprise**: El panel aparece en contexto, cerca del error, no en un modal invasivo que bloquee el workflow.
- **Accessibility**: `aria-live="polite"` para el contenido que se actualiza por streaming. `role="region"` con `aria-label`.
- **YAGNI**: Markdown-lite solo implementa los elementos comunes en respuestas de debugging (párrafos, code, listas, bold). No un parser completo.

### Criterios de Completitud
- [ ] Panel muestra preview del contexto antes de enviar
- [ ] Advertencia de privacidad visible en preview
- [ ] Streaming renderiza texto progresivamente
- [ ] Code blocks, listas, bold e inline code se renderizan correctamente
- [ ] No hay vulnerabilidades XSS con contenido malicioso de la IA
- [ ] Estados de error muestran mensajes actionables
- [ ] Tests de `markdown-lite` pasan
- [ ] `bun astro check` pasa sin errores

### Riesgos y Mitigaciones
- Riesgo: Rendimiento de re-render durante streaming (múltiples actualizaciones por segundo) → Mitigación: Acumular chunks y actualizar el signal con debounce o requestAnimationFrame para agrupar updates.
- Riesgo: Respuesta de IA con formato inesperado → Mitigación: El markdown-lite es graceful — si no detecta patrones, renderiza como texto plano.

### Estimación de Complejidad
**Alta** — Componente complejo con múltiples estados, streaming, rendering de texto, y consideraciones de seguridad.

---

## Phase 7: Configuración del Entorno de Servidor

### Objetivo
Documentar y validar la configuración server-side necesaria para que el API route funcione correctamente.

### Prerequisitos
- Phase 3 completada (API route y Groq service)

### Tareas Detalladas

1. **Crear `.env.example`** con documentación inline:

   ```env
   # Groq API Key — obtén la tuya en https://console.groq.com
   # REQUERIDO: sin esta key, el endpoint /api/diagnose retornará 503
   GROQ_API_KEY=gsk_your_key_here

   # Rate Limiting (opcional — valores por defecto si no se especifican)
   # AI_RATE_LIMIT_MAX=10        # máximo requests por ventana
   # AI_RATE_LIMIT_WINDOW_MS=60000  # tamaño de ventana en ms (1 minuto)
   ```

2. **Validación en startup del API route**:
   - Si `GROQ_API_KEY` no está configurada, el endpoint retorna `503 Service Unavailable` con un mensaje claro
   - Log de warning al inicio si la key no está presente

3. **Configuración de rate limit desde environment variables** (opcional):
   - `AI_RATE_LIMIT_MAX` → override del default de 10
   - `AI_RATE_LIMIT_WINDOW_MS` → override del default de 60000
   - Esto permite ajustar el rate limit sin tocar código

4. **Actualizar `README.md`**:
   - Documentar la configuración de `.env` para el diagnóstico AI
   - Mencionar que `bun dev` inicia el servidor con SSR hybrid
   - Nota sobre requisitos de deploy (necesita runtime, no solo CDN estático)

### Archivos Afectados
- `.env.example` — **crear**
- `README.md` — **modificar** (añadir sección de configuración AI)

### Mejores Prácticas Aplicadas
- **12-Factor App**: Toda configuración sensible via environment variables
- **Fail-Safe**: Si no hay API key, el endpoint falla gracefully con 503 en vez de crashear
- **Documentation**: `.env.example` documenta todas las variables con sus defaults

### Criterios de Completitud
- [ ] `.env.example` creado con documentación inline
- [ ] API route retorna 503 si `GROQ_API_KEY` no está configurada
- [ ] Rate limit configurable via env vars (opcional)
- [ ] `README.md` actualizado con instrucciones de setup

### Estimación de Complejidad
**Baja** — Configuración y documentación.

---

## Phase 8: Integración con ResponsePanel y Non-2xx Responses

### Objetivo
Conectar todos los componentes y manejar el caso de respuestas non-2xx (que tienen status `"success"` pero con código ≥ 400).

### Prerequisitos
- Phases 5, 6, 7 completadas

### Tareas Detalladas

1. **Modificar `src/components/response/ResponsePanel.tsx`**:
   - Añadir import de `AiDiagnosisPanel`
   - En el bloque `status === "error"`: renderizar `<AiDiagnoseButton />` y `<AiDiagnosisPanel />`
   - En el bloque `status === "success"`: si `responseState.value.status >= 400`, renderizar `<AiDiagnoseButton />` integrado en `<ResponseStatusBar />`

2. **Modificar `src/components/response/ResponseStatusBar.tsx`**:
   - Añadir `<AiDiagnoseButton />` como elemento inline al final de la status bar, solo si `response.status >= 400`
   - Usar estilo compacto del botón para que encaje en la barra

3. **Renderizar `<AiDiagnosisPanel />`** en `ResponsePanel`:
   - Si `diagnosisStatus !== "idle"`, renderizar el panel entre el status bar y los tabs de response (para success con error codes)
   - Si hay error HTTP (status === "error"), renderizar el panel debajo del mensaje de error

4. **Computed signal para "needs diagnosis"**:
   - Añadir en `ai-diagnosis-store.ts`: `canDiagnose = computed(() => ...)` que retorna `true` cuando hay un error HTTP O una respuesta con status ≥ 400

### Archivos Afectados
- `src/components/response/ResponsePanel.tsx` — **modificar**
- `src/components/response/ResponseStatusBar.tsx` — **modificar**
- `src/stores/ai-diagnosis-store.ts` — **modificar** (añadir `canDiagnose`)

### Mejores Prácticas Aplicadas
- **Open/Closed Principle**: Minimizar cambios en componentes existentes; la lógica nueva vive en componentes nuevos.
- **Single Responsibility**: `ResponsePanel` solo decide cuándo mostrar los componentes AI; la lógica vive en los stores y servicios.

### Criterios de Completitud
- [ ] Botón visible para errores HTTP (network, CORS, timeout, etc.)
- [ ] Botón visible para respuestas con status ≥ 400
- [ ] Panel de diagnóstico se renderiza en la posición correcta
- [ ] No hay regresiones en el layout del ResponsePanel existente
- [ ] `bun astro check` y `bun build` pasan sin errores

### Riesgos y Mitigaciones
- Riesgo: Cambios en `ResponsePanel.tsx` introducen regresiones visuales → Mitigación: Los componentes AI son condicionales y no afectan el flujo existente cuando `diagnosisStatus === "idle"`.

### Estimación de Complejidad
**Baja** — Integración de componentes ya creados, cambios mínimos en existentes.

---

## Phase 9: Verificación Final y Cleanup

### Objetivo
Validar que toda la feature funciona end-to-end, sin regresiones, y con build exitoso.

### Prerequisitos
- Todas las fases anteriores completadas

### Tareas Detalladas

1. **Ejecutar validaciones**:
   - `bun astro check` — sin errores TypeScript
   - `bun build` — build de producción exitoso
   - `bun run test` — todos los tests pasan (existentes + nuevos)

2. **Verificar flujo end-to-end manualmente**:
   - Verificar que `.env` tiene `GROQ_API_KEY` configurada
   - Hacer request a URL inválida → ver botón de diagnóstico
   - Hacer request a endpoint que retorna 404 → ver botón en status bar
   - Click en diagnóstico → ver preview → confirmar envío → ver streaming
   - Cancelar diagnóstico en progreso
   - Verificar que cambiar de tab durante diagnóstico no causa crashes
   - Verificar rate limiting: hacer más de 10 requests en 1 minuto → ver 429 con countdown
   - Verificar sin `GROQ_API_KEY` en `.env` → endpoint retorna 503
   - Verificar headers `X-RateLimit-Remaining` y `Retry-After` en las respuestas

3. **Cleanup**:
   - Remover console.log de debugging si existieran
   - Verificar que no hay imports no utilizados
   - Asegurar que todos los archivos nuevos siguen las convenciones del proyecto

### Archivos Afectados
- Ninguno nuevo — revisión de todos los archivos creados/modificados

### Criterios de Completitud
- [ ] `bun astro check` pasa sin errores
- [ ] `bun build` genera output de producción
- [ ] `bun run test` — todos los tests pasan
- [ ] No hay console.log de debugging
- [ ] Flujo end-to-end funcional

### Estimación de Complejidad
**Baja** — Verificación y cleanup.

---

## Diseño del Prompt

### System Prompt

```
You are an expert HTTP debugging assistant. Your role is to analyze failed HTTP requests and responses, diagnose the root cause of the error, and provide actionable suggestions to fix the issue.

Guidelines:
1. Analyze the error type, status code, and response body to identify the most likely cause.
2. Provide a clear, concise diagnosis in 2-3 paragraphs maximum.
3. Always suggest specific, actionable steps to resolve the issue.
4. When relevant, mention common causes for the specific status code.
5. If the error is CORS-related, explain what CORS headers are needed and where to configure them.
6. If the error is a timeout or network error, suggest connectivity checks and alternative approaches.
7. Format your response with clear headings and bullet points for readability.
8. If the response body contains an error message from the API, incorporate it into your diagnosis.
9. Be direct and practical — avoid unnecessary preamble.
10. Respond in the same language as the error message when possible, otherwise use English.
```

### User Message Template

```
Diagnose this HTTP request failure:

**Request:**
- Method: {method}
- URL: {url}
- Content-Type: {contentType}

**Request Headers:**
{requestHeaders formatted as key: value list}

**Request Body (excerpt):**
{requestBodyExcerpt}

**Error:**
- Type: {errorType}
- Message: {errorMessage}

**Response (if available):**
- Status: {statusCode} {statusText}
- Response Headers: {responseHeaders formatted as key: value list}
- Body (excerpt): {responseBodyExcerpt}
```

### Notas sobre el Prompt
- `temperature: 0.3` — respuestas más consistentes y técnicas
- `max_completion_tokens: 1024` — suficiente para un diagnóstico conciso
- El prompt está en inglés porque los modelos responden mejor en inglés para contenido técnico, pero se le indica que responda en el idioma del error

---

## Consideraciones de Seguridad y Privacidad

| Aspecto | Medida |
|---|---|
| **API Key** | Almacenada en `.env` del servidor. **Nunca expuesta al browser**. No viaja en ningún response al client. |
| **Rate Limiting** | Sliding window por IP: 10 requests/minuto por defecto. Previene abuso del endpoint y del crédito de Groq. Configurable via env vars. |
| **Rate Limit Headers** | `X-RateLimit-Remaining` y `Retry-After` en cada respuesta para feedback transparente al client. |
| **Credenciales del request** | NUNCA se envían a Groq. `Auth` headers, `Authorization`, `Cookie`, API keys en URL son redactados por `ai-sanitizer.ts` en el browser ANTES de enviar al API route. |
| **Body del request** | Truncado a 1000 chars. Campos sensibles en JSON (`password`, `secret`, `token`) redactados. |
| **Response body** | Truncado a 2000 chars. |
| **Validación server-side** | El API route valida el schema del `DiagnosisContext` recibido. Datos malformados se rechazan con 400. |
| **User consent** | El usuario ve una preview de los datos exactos que se enviarán antes de confirmar (estado `previewing`). |
| **Aviso de privacidad** | Texto explícito en el panel de preview sobre que los datos se envían a Groq (tercero). |
| **XSS** | Todo contenido de la IA se escapa con `escapeHtml()` antes de renderizar, usando `dangerouslySetInnerHTML` con HTML seguro. |
| **Sin API key** | Si `GROQ_API_KEY` no está en `.env`, el endpoint retorna 503 sin crashear. |
| **IP Spoofing** | Rate limiter usa `clientAddress` de Astro (directo), no headers manipulables como `X-Forwarded-For`. Fallback seguro si no está disponible. |

---

## Listado Completo de Archivos

### Archivos Nuevos (11)

| Archivo | Tipo | Fase |
|---|---|---|
| `src/types/ai.ts` | Types | 1 |
| `src/services/ai-sanitizer.ts` | Service (browser) | 2 |
| `src/services/__tests__/ai-sanitizer.test.ts` | Test | 2 |
| `src/server/rate-limiter.ts` | Service (server) | 3 |
| `src/server/groq-service.ts` | Service (server) | 3 |
| `src/pages/api/diagnose.ts` | API Route (server) | 3 |
| `src/services/ai-client.ts` | Service (browser) | 3 |
| `src/stores/ai-diagnosis-store.ts` | Store (browser) | 4 |
| `src/components/response/AiDiagnoseButton.tsx` | Component | 5 |
| `src/components/response/AiDiagnosisPanel.tsx` | Component | 6 |
| `src/utils/markdown-lite.ts` | Utility | 6 |
| `src/utils/__tests__/markdown-lite.test.ts` | Test | 6 |
| `.env.example` | Config | 7 |

### Archivos Modificados (4)

| Archivo | Cambio | Fase |
|---|---|---|
| `astro.config.mjs` | Añadir `output: 'hybrid'` | 3 |
| `package.json` | Añadir `groq-sdk` | 3 |
| `src/components/response/ResponsePanel.tsx` | Integrar botón + panel AI | 5, 8 |
| `src/components/response/ResponseStatusBar.tsx` | Añadir botón para non-2xx | 8 |

---

## Criterios de Aceptación Generales

- [ ] **Funcionalidad**: El diagnóstico AI se activa para errores HTTP y respuestas non-2xx
- [ ] **Streaming**: La respuesta se muestra progresivamente mientras se genera
- [ ] **Server-Side**: API key en `.env`, nunca expuesta al browser
- [ ] **Rate Limiting**: Máximo 10 requests/minuto por IP, con headers `Retry-After` y `X-RateLimit-Remaining`
- [ ] **Rate Limit UX**: El botón muestra countdown cuando se alcanza el límite
- [ ] **Privacidad**: Se muestra preview de datos antes de enviar; credenciales NUNCA se envían
- [ ] **Seguridad**: No hay XSS posible desde contenido de la IA
- [ ] **UX**: Estados de loading claros, posibilidad de cancelar
- [ ] **Per-tab**: Cada tab mantiene su propio estado de diagnóstico
- [ ] **Error handling**: Errores del servidor (502, 429, 503) se muestran con mensajes claros
- [ ] **Sin API key**: Si `GROQ_API_KEY` no está en `.env`, endpoint retorna 503 gracefully
- [ ] **TypeScript**: Todos los archivos pasan `bun astro check` en modo strict
- [ ] **Build**: `bun build` completa sin errores
- [ ] **Tests**: Tests de sanitizer y markdown-lite pasan
- [ ] **No regresiones**: La funcionalidad existente del ResponsePanel no se ve afectada
- [ ] **Accesibilidad**: Aria labels, estados disabled, live regions para streaming
- [ ] **SSR Hybrid**: Páginas siguen siendo estáticas, solo `/api/diagnose` es server-rendered

---

## Orden de Implementación

```
Phase 1 (Tipos)
    │
    ▼
Phase 2 (Sanitizer)  ←→  Phase 3 (API Route + Groq + Rate Limiter)  [parallelizable]
    │                         │
    └──────────┬──────────────┘
               ▼
         Phase 4 (Store)
               │
       ┌───────┼───────┐
       ▼       ▼       ▼
  Phase 5   Phase 6   Phase 7   [parallelizable]
  (Button)  (Panel)   (Server Config)
       │       │       │
       └───────┼───────┘
               ▼
         Phase 8 (Integración)
               │
               ▼
         Phase 9 (Verificación)
```

**Tiempo estimado total**: 5-7 horas de implementación para un senior developer.
