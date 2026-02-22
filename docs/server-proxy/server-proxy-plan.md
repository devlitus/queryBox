# Server Proxy - Plan de Implementacion

## Resumen Ejecutivo

Implementar un API route server-side en Astro SSR (`/api/proxy`) que actue como proxy HTTP para eliminar la limitacion de CORS que impide a queryBox hacer requests a APIs externas que no envian `Access-Control-Allow-Origin`. El proxy recibe la request del cliente, la reenvia server-to-server al API externo (donde CORS no aplica), y devuelve la respuesta completa al cliente.

## Contexto Tecnico

### Problema
- `http-client.ts` usa `fetch()` del navegador directamente contra APIs externas.
- Las APIs que no envian `Access-Control-Allow-Origin` son bloqueadas por la politica CORS del browser.
- Esto es una limitacion fundamental para una app tipo Postman que corre en el browser.
- El comentario en `src/services/http-client.ts:16` ya anticipa esta solucion.

### Solucion
Un API route de Astro SSR que actua como proxy transparente:

```
[Browser] --POST /api/proxy--> [Astro Server] --ANY method--> [External API]
[Browser] <--Response--------- [Astro Server] <--Response---- [External API]
```

### Infraestructura Existente
- **Adapter**: `@astrojs/vercel` ya configurado en `astro.config.mjs`.
- **API route existente**: `src/pages/api/diagnose.ts` con `export const prerender = false` -- patron de referencia.
- **Rate limiter**: `src/server/rate-limiter.ts` -- reutilizable pero requiere configuracion separada.
- **Middleware**: `src/middleware.ts` con CSP `connect-src 'self' https://api.groq.com`.
- **HttpMethod type**: `src/types/http.ts` define `"GET" | "POST" | "PUT" | "PATCH" | "DELETE"`.

### Compatibilidad con CSP
Con el proxy, TODAS las requests del cliente van a `'self'` (el propio servidor), lo cual ya esta permitido en la CSP. El proxy hace la request saliente server-side donde no aplica CSP. **No se requiere cambio en la CSP** -- sin embargo, con el proxy la CSP ya no necesitara la excepcion para `https://api.groq.com` porque `/api/diagnose` tambien opera server-side. Se puede simplificar `connect-src` a solo `'self'`.

## Decisiones de Diseno

### D1: Formato del payload al proxy

**Alternativas evaluadas:**

| Alternativa | Pros | Contras |
|---|---|---|
| A) URL como query param (`/api/proxy?url=...`) | Simple, compatible con GET | Limita largo de URL, no soporta body/headers arbitrarios |
| B) JSON body con todos los campos | Soporta todos los campos, tipado fuerte, extensible | Solo funciona con POST al proxy |
| C) Headers custom (`X-Proxy-Url`, etc.) | Separacion limpia | Headers tienen limites de tamano, complejo de manejar |

**Decision: Alternativa B (JSON body)**
- El proxy siempre recibe POST con un JSON que describe la request completa.
- El proxy luego ejecuta el metodo HTTP real (GET, POST, PUT, etc.) contra el API externo.
- Consistente con el patron de `diagnose.ts`.
- Permite enviar body, headers, y metodo sin restricciones de tamano.

### D2: Estructura del request al proxy

```typescript
interface ProxyRequest {
  url: string;         // URL completa del API externo (ya interpolada y con params)
  method: string;      // HTTP method: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
  headers: Record<string, string>;  // Headers a enviar al API externo
  body?: string;       // Body para POST/PUT/PATCH/DELETE (si aplica)
  timeout?: number;    // Timeout en ms (default: 30000, max: 120000)
}
```

**Justificacion**: Usar `Record<string, string>` para headers (en vez de `Array<{key, value}>`) porque los headers ya estan resueltos y deduplicados por `http-client.ts` antes de enviarlos al proxy. Los headers del proxy son un mapa plano key->value.

### D3: Estructura de la respuesta del proxy

La respuesta del proxy se envia como JSON cuando es exitosa:

```typescript
interface ProxySuccessResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;           // Body como texto
  /** Content-Type del API externo, extraido de headers para conveniencia */
  contentType: string;
}
```

**Justificacion**: Envolver la respuesta en JSON permite transmitir el status code real del API externo, sus headers, y su body como un paquete completo. Si el proxy devolviera directamente el status code del API externo, el cliente no podria distinguir entre "el proxy fallo" y "el API externo devolvio 500".

**Nota**: El nombre `ProxySuccessResponse` (en vez del genérico `ProxyResponse`) hace explícita la distinción con `ProxyErrorResponse`.

### D4: Codigos de error del proxy

| Situacion | HTTP Status del proxy | Error type |
|---|---|---|
| Payload invalido / campos faltantes | 400 | `invalid-request` |
| URL no permitida (localhost, IP privada) | 403 | `forbidden-url` |
| Rate limit excedido | 429 | `rate-limit` |
| Body excede tamano maximo | 413 | `payload-too-large` |
| Timeout al conectar con API externo | 504 | `gateway-timeout` |
| Error de red al conectar con API externo | 502 | `bad-gateway` |
| Error interno del proxy | 500 | `internal-error` |
| Exito (respuesta del API externo) | 200 | -- |

**Importante**: El proxy SIEMPRE devuelve 200 cuando la request al API externo se completo (incluso si el API externo devolvio 4xx/5xx). Los errores del API externo se transmiten en el campo `status` del JSON. Solo los errores del propio proxy usan codigos HTTP de error.

### D5: Rate limiter separado vs compartido

**Decision: Rate limiter separado para el proxy.**
- El rate limiter existente esta parametrizado con `AI_RATE_LIMIT_MAX` y `AI_RATE_LIMIT_WINDOW_MS`, enfocado en el endpoint de AI diagnosis.
- El proxy necesita limites mucho mas generosos (es la funcionalidad core de la app).
- Crear una instancia separada con `PROXY_RATE_LIMIT_MAX` (default: 100) y `PROXY_RATE_LIMIT_WINDOW_MS` (default: 60000).
- Reutilizar la logica del `rate-limiter.ts` refactorizandola en una funcion factory.

### D6: Seguridad -- Restricciones de URL

El proxy NO debe ser un open relay. Restricciones:

1. **Solo HTTP/HTTPS**: Rechazar URLs con otros protocolos (file://, ftp://, etc.)
2. **Bloquear IPs privadas y localhost**: Prevenir SSRF (Server-Side Request Forgery)
   - Bloquear: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `0.0.0.0`
   - Bloquear hostnames: `localhost`, `*.local`
   - **Excepcion en desarrollo**: En modo `DEV` (`import.meta.env.DEV === true`), se omiten estas restricciones para permitir requests a APIs locales. En produccion siempre se aplican.
3. **Tamano maximo de body**: 5 MB (alineado con `MAX_BODY_SIZE` en `http-client.ts`)
4. **Timeout configurable**: Default 30s, maximo 120s
5. **Sanitizar headers reenviados**: No reenviar headers internos del proxy (Host, Cookie del proxy, etc.)

**Justificacion de la excepcion DEV**: queryBox es una herramienta tipo Postman cuyo caso de uso core es testear APIs en desarrollo. Bloquear `localhost` en dev haría la app inutilizable para el escenario más común (desarrollar y testear una API local). En producción (Vercel), `localhost` refiere al propio servidor remoto, por lo que el bloqueo es siempre correcto allí.

### D7: Impacto en http-client.ts

`http-client.ts` se modifica para:
1. Construir un `ProxyRequest` con la URL, metodo, headers y body ya resueltos.
2. Enviar un `POST /api/proxy` con ese JSON.
3. Parsear la `ProxyResponse` del JSON devuelto.
4. Mapear la respuesta a los mismos campos que usa `updateActiveTabResponse()`.

Los errores de CORS dejan de ser posibles porque todas las requests pasan por el proxy. La logica de deteccion de CORS se puede simplificar pero NO eliminar (fallback en caso de que el proxy este caido y se haga fetch directo como degradacion futura).

### D8: HEAD y OPTIONS

- **HEAD**: El proxy ejecuta HEAD contra el API externo. El body estara vacio pero los headers se devuelven completos.
- **OPTIONS**: Se reenvia como cualquier otro metodo. No se confunde con el preflight CORS del browser porque el proxy opera server-side.

---

## Phase 1: Refactorizar Rate Limiter a Factory Pattern

### Objetivo
Transformar `rate-limiter.ts` de un singleton hardcoded a una factory que permita crear multiples instancias con configuraciones diferentes (una para AI diagnosis, otra para el proxy).

### Prerrequisitos
Ninguno -- esta es la primera fase.

### Tareas Detalladas

1. **Refactorizar `src/server/rate-limiter.ts`**:
   - Crear una funcion factory `createRateLimiter(config: RateLimiterConfig): RateLimiterInstance`.
   - `RateLimiterConfig`: `{ maxRequests: number, windowMs: number, cleanupInterval?: number }`.
   - `RateLimiterInstance`: `{ checkRateLimit(ip: string): RateLimitResult, reset(): void }`.
   - Mantener las constantes actuales `MAX_REQUESTS` y `WINDOW_MS` como defaults para el limiter de AI.
   - Exportar una instancia pre-construida `aiRateLimiter` para mantener compatibilidad con `diagnose.ts`.
   - Exportar la factory `createRateLimiter` para uso del proxy.

2. **Actualizar `src/pages/api/diagnose.ts`**:
   - Cambiar `import { checkRateLimit } from "../../server/rate-limiter"` a usar `aiRateLimiter.checkRateLimit`.
   - Sin cambios funcionales -- solo el import y la referencia.

3. **Actualizar tests existentes de rate-limiter** (si existen):
   - Adaptar imports a la nueva API factory.
   - Agregar test para `createRateLimiter` con configuracion custom.

### Archivos Afectados
- `src/server/rate-limiter.ts` -- modificar (refactor a factory)
- `src/pages/api/diagnose.ts` -- modificar (actualizar import)
- `src/server/rate-limiter.test.ts` -- modificar (si existe, adaptar tests)

### Mejores Practicas Aplicadas
- **Open/Closed Principle**: La factory permite crear nuevas instancias sin modificar la logica existente.
- **DRY**: La logica de sliding window se escribe una sola vez en la factory.
- **Backward Compatibility**: La instancia `aiRateLimiter` pre-construida evita breaking changes.

### Criterios de Completitud
- [ ] `createRateLimiter()` acepta configuracion custom y retorna una instancia funcional.
- [ ] `aiRateLimiter` exportado como instancia pre-construida con los defaults actuales.
- [ ] `diagnose.ts` usa `aiRateLimiter.checkRateLimit()` sin cambios funcionales.
- [ ] `bun astro check` pasa sin errores.
- [ ] Tests de rate-limiter pasan (si existen).

### Riesgos y Mitigaciones
- **Riesgo**: Romper el endpoint `/api/diagnose` al cambiar la API. -> **Mitigacion**: La instancia `aiRateLimiter` mantiene la misma interfaz. Verificar con build completo.

### Estimacion de Complejidad
**Baja** -- Refactor mecanico sin cambio de logica.

---

## Phase 2: Crear Tipos y Utilidades del Proxy

### Objetivo
Definir los tipos TypeScript para la comunicacion cliente-proxy y las funciones de validacion/seguridad.

### Prerrequisitos
Ninguno -- puede ejecutarse en paralelo con Phase 1.

### Tareas Detalladas

1. **Crear `src/types/proxy.ts`**:
   ```typescript
   /** Request payload sent from the client to /api/proxy */
   export interface ProxyRequest {
     url: string;
     method: string;
     headers: Record<string, string>;
     body?: string;
     timeout?: number;
   }

   /** Successful response from the proxy wrapping the external API's response */
   export interface ProxySuccessResponse {
     status: number;
     statusText: string;
     headers: Record<string, string>;
     body: string;
     contentType: string;
   }

   /** Error response from the proxy itself */
   export interface ProxyErrorResponse {
     error: string;
     message: string;
     retryAfter?: number;
   }
   ```

2. **Crear `src/server/proxy-validation.ts`**:
   - Funcion `validateProxyRequest(body: unknown): body is ProxyRequest` -- validacion de tipos y campos.
   - Funcion `isAllowedUrl(url: string, isDev?: boolean): { allowed: boolean; reason?: string }` -- validacion de seguridad SSRF.
     - Solo permite `http://` y `https://`.
     - Bloquea IPs privadas y localhost mediante parsing de hostname.
     - Bloquea hostnames que resuelvan a IPs privadas (solo via parsing, no DNS lookup para no agregar latencia).
     - **Si `isDev === true`, retorna `{ allowed: true }` inmediatamente** -- permite localhost e IPs privadas en desarrollo.
     - El parametro `isDev` lo pasa el handler (`src/pages/api/proxy.ts`) usando `import.meta.env.DEV`.
   - Constantes: `PROXY_MAX_BODY_SIZE = 5 * 1024 * 1024` (5 MB), `PROXY_DEFAULT_TIMEOUT = 30000`, `PROXY_MAX_TIMEOUT = 120000`.
   - Constantes: `VALID_PROXY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]`.
   - Funcion `sanitizeRequestHeaders(headers: Record<string, string>): Record<string, string>` -- remueve headers que no deben reenviarse (Host, Connection, Keep-Alive, Transfer-Encoding, etc.).

3. **Crear `src/server/proxy-validation.test.ts`**:
   - Tests para `validateProxyRequest`: payload valido, campos faltantes, tipos incorrectos, metodo invalido, URL vacia.
   - Tests para `isAllowedUrl` (modo produccion `isDev=false`): URLs validas, localhost bloqueado, IPs privadas bloqueadas, protocolos no-HTTP, hostname `.local`.
   - Tests para `isAllowedUrl` (modo desarrollo `isDev=true`): localhost permitido, IPs privadas permitidas, protocolos no-HTTP siguen bloqueados (el DEV solo omite la restriccion de IPs privadas, no la de protocolo).
   - Tests para `sanitizeRequestHeaders`: headers peligrosos removidos, headers normales preservados.

### Archivos Afectados
- `src/types/proxy.ts` -- crear
- `src/server/proxy-validation.ts` -- crear
- `src/server/proxy-validation.test.ts` -- crear

### Mejores Practicas Aplicadas
- **Fail Fast**: Toda validacion ocurre ANTES de ejecutar la request al API externo.
- **Separation of Concerns**: Validacion separada del handler del endpoint.
- **Type Safety**: Discriminated types para request/response del proxy.
- **Defense in Depth**: Multiples capas de validacion (tipo, formato, seguridad).

### Criterios de Completitud
- [ ] `ProxyRequest`, `ProxySuccessResponse`, `ProxyErrorResponse` exportados desde `types/proxy.ts`.
- [ ] `validateProxyRequest` valida todos los campos requeridos y restringe metodos HTTP.
- [ ] `isAllowedUrl` bloquea localhost, IPs privadas (127.x, 10.x, 172.16-31.x, 192.168.x, ::1), protocolos no HTTP cuando `isDev=false`.
   - [ ] `isAllowedUrl` permite localhost e IPs privadas cuando `isDev=true`, pero sigue bloqueando protocolos no HTTP.
   - [ ] `sanitizeRequestHeaders` remueve `Host`, `Connection`, `Keep-Alive`, `Transfer-Encoding`, `Upgrade`, `Proxy-*` headers.
   - [ ] Tests cubren todos los casos borde: IPs en formato decimal, IPv6 shorthand, hostnames `.local`, modo DEV vs produccion.
- [ ] `bun run test` pasa.

### Riesgos y Mitigaciones
- **Riesgo**: Falsos positivos en deteccion de IPs privadas (bloquear IPs publicas validas). -> **Mitigacion**: Solo parsear el hostname como IP literal; no hacer DNS resolution. Documentar que hostnames que resuelvan a IPs privadas no se bloquean en esta capa (eso requeriria DNS lookup asincronico).
- **Riesgo**: Headers edge-case que deberian bloquearse pero no estan en la lista. -> **Mitigacion**: Usar un blocklist conservador y documentar la lista. Revisar periodicamente.

### Estimacion de Complejidad
**Media** -- Requiere logica de parsing de IPs y testing exhaustivo de casos borde.

---

## Phase 3: Implementar el API Route del Proxy

### Objetivo
Crear el endpoint `/api/proxy` que recibe requests del cliente y las reenvia al API externo.

### Prerrequisitos
- Phase 1 completada (factory de rate limiter).
- Phase 2 completada (tipos y validacion).

### Tareas Detalladas

1. **Crear `src/pages/api/proxy.ts`**:
   - `export const prerender = false;` -- igual que `diagnose.ts`.
   - Exportar `POST` handler siguiendo el patron de `diagnose.ts`:
     1. Rate limiting con `proxyRateLimiter` (instancia separada creada con `createRateLimiter`).
     2. Validar `Content-Length` contra `PROXY_MAX_BODY_SIZE`.
     3. Leer y parsear el body JSON con stream reading (patron de `diagnose.ts`).
     4. Validar con `validateProxyRequest()`.
     5. Validar URL con `isAllowedUrl(url, import.meta.env.DEV)` -- en modo desarrollo se permiten localhost e IPs privadas.
     6. Sanitizar headers con `sanitizeRequestHeaders()`.
     7. Ejecutar `fetch()` server-side al API externo con:
        - Metodo, headers y body del `ProxyRequest`.
        - `AbortController` con timeout configurable.
     8. Leer la respuesta completa del API externo.
     9. Truncar body si excede `PROXY_MAX_BODY_SIZE`.
     10. Construir y devolver `ProxySuccessResponse` como JSON con status 200.
     11. Manejar errores: timeout (504), network error (502), errores de validacion (400/403/413).

   - **Instanciar el rate limiter del proxy** en el mismo archivo:
     ```typescript
     const proxyRateLimiter = createRateLimiter({
       maxRequests: parseInt(import.meta.env.PROXY_RATE_LIMIT_MAX || "100", 10),
       windowMs: parseInt(import.meta.env.PROXY_RATE_LIMIT_WINDOW_MS || "60000", 10),
     });
     ```

2. **Helper `jsonError()`**: Reutilizar el patron de `diagnose.ts` (funcion local que devuelve `new Response(JSON.stringify(body), { status, headers })`).

3. **Manejo de la respuesta del API externo**:
   - Leer body como texto con `response.text()`.
   - Extraer headers relevantes (iterar `response.headers` y construir `Record<string, string>`).
   - Calcular `contentType` desde el header `Content-Type`.
   - **Para HEAD requests**: El body sera vacio, lo cual es correcto.

4. **Timeout implementation**:
   ```typescript
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), timeout);
   try {
     const response = await fetch(url, { ...options, signal: controller.signal });
     // ...process response
   } finally {
     clearTimeout(timeoutId);
   }
   ```

### Archivos Afectados
- `src/pages/api/proxy.ts` -- crear

### Mejores Practicas Aplicadas
- **Fail Fast**: Cadena de validaciones antes del fetch (rate limit -> size -> parse -> validate -> URL check).
- **SOLID (SRP)**: El handler solo orquesta; la validacion y la logica de seguridad estan en modulos separados.
- **Resource Cleanup**: `clearTimeout()` en `finally` block para evitar leaks.
- **Principle of Least Surprise**: El proxy devuelve 200 cuando el API externo respondio (incluso con error), reservando codigos de error del proxy para problemas reales del proxy.

### Criterios de Completitud
- [ ] `POST /api/proxy` acepta un `ProxyRequest` JSON y reenvia la request al API externo.
- [ ] Rate limiting funciona con limites separados del endpoint de diagnosis.
- [ ] URLs prohibidas (localhost, IPs privadas) devuelven 403.
- [ ] Body mayor a 5 MB devuelve 413.
- [ ] Timeout devuelve 504.
- [ ] Error de red devuelve 502.
- [ ] Respuesta exitosa (200) contiene status, statusText, headers, body, contentType del API externo.
- [ ] `bun astro check` y `bun run build` pasan sin errores.

### Riesgos y Mitigaciones
- **Riesgo**: Timeout largo bloquea recursos del servidor. -> **Mitigacion**: Max 120s, AbortController con cleanup.
- **Riesgo**: Respuestas muy grandes del API externo consumen memoria. -> **Mitigacion**: Truncar a 5 MB. Futuro: streaming.
- **Riesgo**: Headers sensibles del servidor leak al cliente. -> **Mitigacion**: Solo reenviar headers del API externo, no headers internos del servidor.

### Estimacion de Complejidad
**Media** -- Logica directa pero con multiples casos de error a manejar correctamente.

---

## Phase 4: Modificar http-client.ts para Usar el Proxy

### Objetivo
Redirigir todas las requests HTTP del cliente a traves del proxy server-side en lugar de usar fetch directo al API externo.

### Prerrequisitos
- Phase 3 completada (endpoint del proxy funcional).

### Tareas Detalladas

1. **Modificar `src/services/http-client.ts`**:

   - **Construir `ProxyRequest`** a partir del estado actual:
     - `url`: usar `finalUrl` (ya interpolada, con auth params si aplica).
     - `method`: usar `interpolatedState.method`.
     - `headers`: convertir `fetchHeaders` (Headers object) a `Record<string, string>`.
     - `body`: usar `interpolatedState.body.raw` si `hasBody`.
     - `timeout`: no enviarlo (usar default del proxy, 30s).

   - **Reemplazar `fetch(finalUrl, fetchOptions)`** con:
     ```typescript
     const proxyPayload: ProxyRequest = {
       url: finalUrl,
       method: interpolatedState.method,
       headers: headersToRecord(fetchHeaders),
       ...(hasBody && { body: interpolatedState.body.raw }),
     };

     const proxyResponse = await fetch("/api/proxy", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(proxyPayload),
       signal,
     });
     ```

   - **Parsear la respuesta del proxy**:
     - Si `proxyResponse.ok` (200): parsear JSON como `ProxySuccessResponse` y mapear a `updateActiveTabResponse`.
     - Si `proxyResponse.status === 429`: manejar rate limit.
     - Si `proxyResponse.status === 504`: error de timeout.
     - Si otro error: parsear como `ProxyErrorResponse` y mapear a `HttpError`.

   - **Funcion helper `headersToRecord(headers: Headers): Record<string, string>`**: Iterar el Headers object y construir un plain object.

   - **Actualizar el calculo de `time`**: El `performance.now()` en el cliente sigue siendo correcto -- mide el tiempo total percibido por el usuario (incluye overhead del proxy).

   - **Actualizar el calculo de `size`**: Usar `body.length` de la `ProxySuccessResponse` (o el body real, no el JSON wrapper).

   - **Simplificar manejo de errores CORS**: Con el proxy, los errores CORS ya no deberian ocurrir. Sin embargo, mantener la deteccion como fallback defensivo (en caso de que el proxy este caido y el codigo caiga en un path de fetch directo en el futuro). Actualizar el mensaje de error CORS para sugerir que el proxy puede estar caido.

2. **Actualizar el comentario CORS** al inicio del archivo:
   - Reemplazar la seccion de "CORS LIMITATION NOTICE" con una nota de que las requests pasan por el proxy.
   - Documentar que el proxy elimina las restricciones CORS.

3. **Importar tipos del proxy**:
   - `import type { ProxyRequest, ProxySuccessResponse, ProxyErrorResponse } from "../types/proxy"`.

### Archivos Afectados
- `src/services/http-client.ts` -- modificar (cambio principal)
- `src/types/proxy.ts` -- sin cambios (ya creado en Phase 2)

### Mejores Practicas Aplicadas
- **Principle of Least Surprise**: El comportamiento externo de `sendRequest()` no cambia -- los consumidores (RequestBar.tsx) no necesitan modificaciones.
- **Error Mapping**: Mapeo explicito de errores del proxy a los tipos `HttpError` existentes.
- **Backward Compatibility**: La firma y los efectos de `sendRequest()` permanecen identicos.

### Criterios de Completitud
- [ ] `sendRequest()` envia todas las requests a `/api/proxy` en lugar de directamente al API externo.
- [ ] La respuesta se mapea correctamente a `ResponseState` (status, statusText, headers, body, contentType, time, size).
- [ ] Errores del proxy (429, 504, 502, 400, 403) se mapean a `HttpError` con mensajes descriptivos.
- [ ] El history sigue almacenando la URL original del API externo (no la URL del proxy).
- [ ] Auto-rename del tab sigue usando el hostname del API externo (no "localhost").
- [ ] `bun astro check` pasa sin errores.

### Riesgos y Mitigaciones
- **Riesgo**: Doble encoding del body (JSON dentro de JSON). -> **Mitigacion**: El body se envia como string en el campo `body` del `ProxyRequest`, no como JSON anidado.
- **Riesgo**: Headers response del proxy vs headers del API externo. -> **Mitigacion**: Los headers del API externo estan dentro del JSON response, no en los HTTP headers de la response del proxy.
- **Riesgo**: `AbortController` del cliente vs timeout del proxy. -> **Mitigacion**: El `signal` del `AbortController` se pasa al `fetch("/api/proxy", ...)`, lo que cancela la request al proxy. El proxy entonces cancelara su request al API externo porque el stream se cierra.

### Estimacion de Complejidad
**Media** -- El cambio es localizado pero critico; requiere mapeo cuidadoso entre tipos.

---

## Phase 5: Actualizar Middleware CSP y Tests

### Objetivo
Actualizar la Content Security Policy para reflejar que ya no se necesitan excepciones para dominios externos en `connect-src`, y agregar tests de integracion para el proxy.

### Prerrequisitos
- Phase 4 completada (http-client usando el proxy).

### Tareas Detalladas

1. **Actualizar `src/middleware.ts`**:
   - Cambiar `connect-src 'self' https://api.groq.com` a `connect-src 'self'`.
   - Actualizar el comentario que explica `connect-src` para documentar que todas las requests externas pasan por el proxy server-side.
   - La referencia a `api.groq.com` ya no es necesaria porque `/api/diagnose` ya opera server-side (el cliente solo llama a `/api/diagnose`, no directamente a Groq).

2. **Crear tests para el proxy endpoint** (`src/pages/api/__tests__/proxy.test.ts`):
   - Nota: Los tests de la API route en si son dificiles sin un server real, ya que el handler requiere el `APIContext` de Astro. Los tests se enfocaran en:
   - **Test de integracion a nivel de funcion**: Importar el handler `POST` directamente y mockear `fetch` global.
   - Escenarios:
     - Request valida -> devuelve ProxySuccessResponse con status 200.
     - URL invalida (localhost) -> devuelve 403.
     - Body faltante -> devuelve 400.
     - Metodo invalido (e.g., "INVALID") -> devuelve 400.
     - Timeout del API externo -> devuelve 504.
     - Error de red -> devuelve 502.
   - Mockear `fetch` global con `vi.stubGlobal('fetch', ...)` para simular respuestas del API externo.
   - Mockear `clientAddress` del `APIContext`.

3. **Actualizar `src/types/http.ts`**:
   - Extender `HttpMethod` para incluir `"HEAD" | "OPTIONS"` ya que el proxy los soporta.
   - Verificar que los componentes UI que usan `HttpMethod` no se rompan (el `MethodSelector` ya tiene una lista fija de opciones).
   - **NOTA**: Si agregar HEAD/OPTIONS al type causa impacto en la UI, NO agregarlo al type -- solo soportarlo en el proxy via validacion con `VALID_PROXY_METHODS` que es un string (no el tipo `HttpMethod`). El ProxyRequest.method ya es `string`, no `HttpMethod`.
   - **Decision final**: NO modificar `HttpMethod`. El type del proxy usa `string` validado en `validateProxyRequest`. HEAD y OPTIONS se soportan en el proxy sin afectar la UI.

### Archivos Afectados
- `src/middleware.ts` -- modificar (simplificar CSP)
- `src/pages/api/__tests__/proxy.test.ts` -- crear (tests de integracion)
- `src/types/http.ts` -- SIN CAMBIOS (ver nota arriba)

### Mejores Practicas Aplicadas
- **Principle of Least Privilege**: CSP con el minimo de excepciones necesarias.
- **Defense in Depth**: Tests validan que las capas de seguridad funcionan (URL validation, rate limiting).
- **YAGNI**: No se modifica `HttpMethod` porque la UI no necesita HEAD/OPTIONS.

### Criterios de Completitud
- [ ] `connect-src` en CSP simplificado a `'self'` unicamente.
- [ ] Tests de proxy cubren: request exitosa, URL prohibida, body faltante, metodo invalido, timeout, error de red.
- [ ] `bun astro check` pasa sin errores.
- [ ] `bun run test` pasa.
- [ ] `bun run build` pasa sin errores.

### Riesgos y Mitigaciones
- **Riesgo**: Cambiar CSP rompe algo. -> **Mitigacion**: `connect-src 'self'` es MAS restrictivo (quita una excepcion), lo cual no puede romper nada que funcione actualmente via el proxy. Verificar que `/api/diagnose` sigue funcionando (ya era `'self'`).
- **Riesgo**: Tests del proxy dificiles de configurar por dependencias de Astro. -> **Mitigacion**: Mockear el contexto minimo necesario; enfocarse en tests de las funciones de validacion (ya cubiertas en Phase 2) y tests funcionales del handler con mocks.

### Estimacion de Complejidad
**Media** -- El cambio de CSP es trivial pero los tests requieren setup de mocking.

---

## Phase 6: Actualizacion de Code Snippet Generator

### Objetivo
Asegurar que el generador de code snippets siga generando snippets correctos, ya que los snippets deben apuntar a la URL del API externo (no al proxy).

### Prerrequisitos
- Phase 4 completada (http-client usando el proxy).

### Tareas Detalladas

1. **Verificar `src/utils/snippet-generators.ts`**:
   - Los generadores de snippets (curl, fetch, python-requests, axios) usan la URL del API externo directamente desde el `RequestState`.
   - NO usan `sendRequest()` ni el proxy.
   - **Confirmar que no requieren cambios.** Los snippets son representaciones del request que el USUARIO quiere hacer, no de como queryBox lo ejecuta internamente.

2. **Verificar que no hay acoplamiento accidental**: Si algun generador importa desde `http-client.ts`, verificar que no se ve afectado.

### Archivos Afectados
- `src/utils/snippet-generators.ts` -- verificar (probablemente sin cambios)

### Mejores Practicas Aplicadas
- **Separation of Concerns**: Los snippets representan la intension del usuario, no la implementacion interna.

### Criterios de Completitud
- [ ] Los code snippets siguen apuntando a la URL del API externo, no al proxy.
- [ ] No hay imports de `http-client.ts` en `snippet-generators.ts`.

### Riesgos y Mitigaciones
- **Riesgo**: Ninguno identificado si los snippets no tienen acoplamiento con el proxy.

### Estimacion de Complejidad
**Baja** -- Solo verificacion, probablemente cero cambios de codigo.

---

## Validacion Final del Plan

### Coherencia entre fases
- Phase 1 (rate limiter factory) y Phase 2 (tipos y validacion) son independientes y pueden ejecutarse en paralelo.
- Phase 3 (API route) depende de Phase 1 y Phase 2.
- Phase 4 (http-client) depende de Phase 3.
- Phase 5 (CSP y tests) depende de Phase 4.
- Phase 6 (snippets) depende de Phase 4 para verificacion.

### Diagrama de dependencias
```
Phase 1 (rate limiter) ----\
                             +----> Phase 3 (proxy endpoint) ----> Phase 4 (http-client) ----> Phase 5 (CSP + tests)
Phase 2 (tipos + validacion)/                                                              \-> Phase 6 (snippets)
```

### No hay dependencias circulares.

### Cada fase es atomicamente ejecutable.

### Compatibilidad con convenciones del proyecto
- Patron de API route identico a `diagnose.ts` (prerender = false, POST handler, jsonError helper).
- Rate limiter usa la misma logica probada del rate limiter existente.
- Tipos en `src/types/`, server code en `src/server/`, services en `src/services/`.
- Tests co-locados con el codigo fuente o en `__tests__/` cuando son multiples archivos.

### Impacto en componentes existentes
- **RequestBar.tsx**: Sin cambios. Sigue llamando `sendRequest()`.
- **ResponsePanel, ResponseTabs, CodeViewer**: Sin cambios. Siguen leyendo `responseState`.
- **HistoryPanel, CollectionPanel**: Sin cambios. El history sigue almacenando la URL original.
- **CodeSnippetModal**: Sin cambios. Los snippets apuntan a la URL original.
- **AI Diagnosis**: Sin cambios funcionales. Solo el import del rate limiter cambia.

### Archivos nuevos (resumen)
| Archivo | Tipo |
|---|---|
| `src/types/proxy.ts` | Tipos TS |
| `src/server/proxy-validation.ts` | Validacion y seguridad |
| `src/server/proxy-validation.test.ts` | Tests unitarios |
| `src/pages/api/proxy.ts` | API route (endpoint) |
| `src/pages/api/__tests__/proxy.test.ts` | Tests del endpoint |

### Archivos modificados (resumen)
| Archivo | Cambio |
|---|---|
| `src/server/rate-limiter.ts` | Refactor a factory pattern |
| `src/pages/api/diagnose.ts` | Actualizar import de rate limiter |
| `src/services/http-client.ts` | Redirigir requests al proxy |
| `src/middleware.ts` | Simplificar CSP connect-src |
| Rate limiter tests (si existen) | Adaptar a nueva API |
