# Authentication System - Plan de Implementacion

## Resumen

Agregar soporte nativo para metodos de autenticacion en las requests HTTP de queryBox. Incluye Basic Auth, Bearer Token y API Key, integrados como nueva pestana "Auth" en `RequestConfigTabs`, con persistencia por tab y compatibilidad con environment variables.

**Branch**: `feature/auth-system`
**Complejidad total**: Media-Alta
**Fases**: 5

---

## Arquitectura General

```
                    RequestConfigTabs
                    +-----------+---------+---------+---------+
                    | Params    | Headers | Body    |  Auth   |
                    +-----------+---------+---------+---------+
                                                        |
                                                   AuthEditor.tsx
                                                   (auth type selector)
                                                        |
                        +---------------+---------------+---------------+
                        |               |               |               |
                   NoAuth          BasicAuth       BearerToken      ApiKey
                   (panel)         (panel)          (panel)         (panel)

                    At send time:
                    http-client.ts --> resolveAuthHeaders(authConfig, variables)
                                      returns { headers?, params? }
                                      merged into fetch request
```

### Flujo de datos

1. El usuario configura la autenticacion en la pestana "Auth" del tab activo.
2. `AuthConfig` se almacena como parte de `RequestState` (campo `auth`).
3. Al enviar la request, `http-client.ts` llama a `resolveAuthHeaders()` que:
   - Lee la configuracion `auth` del request state interpolado.
   - Genera los headers o query params correspondientes.
   - Los fusiona con los headers/params explícitos del usuario.
4. Los headers generados por auth NO se agregan a la lista visible de headers del usuario (separacion de concerns).
5. El historial y las colecciones persisten el `auth` config completo como parte de `requestSnapshot`.

---

## Phase 1: Type Definitions and Auth Utilities

### Objective
Definir los tipos TypeScript para la configuracion de autenticacion y crear las funciones utilitarias puras que resuelven los headers/params de auth.

### Prerequisites
Ninguno.

### Detailed Tasks

1. **Crear `src/types/auth.ts`** con los tipos de autenticacion:
   ```
   AuthType = "none" | "basic" | "bearer" | "apikey"

   BasicAuthConfig {
     username: string;
     password: string;
   }

   BearerTokenConfig {
     token: string;
     prefix: string;    // default "Bearer", configurable (e.g. "Token")
   }

   ApiKeyConfig {
     key: string;
     value: string;
     addTo: "header" | "query";  // donde enviar la API key
   }

   AuthConfig (discriminated union):
     | { type: "none" }
     | { type: "basic"; basic: BasicAuthConfig }
     | { type: "bearer"; bearer: BearerTokenConfig }
     | { type: "apikey"; apikey: ApiKeyConfig }
   ```
   Usar discriminated union con `type` como discriminant permite type narrowing seguro y extensibilidad futura (OAuth 2.0).

2. **Crear constante `DEFAULT_AUTH`** en el mismo archivo:
   ```
   DEFAULT_AUTH: AuthConfig = { type: "none" }
   ```

3. **Agregar campo `auth` a `RequestState`** en `src/types/http.ts`:
   ```
   auth: AuthConfig;   // defaults to { type: "none" }
   ```
   Importar `AuthConfig` desde `../types/auth`.

4. **Crear `src/utils/auth.ts`** con la funcion pura `resolveAuthHeaders()`:
   ```
   interface ResolvedAuth {
     headers: Array<{ key: string; value: string }>;
     params: Array<{ key: string; value: string }>;
   }

   function resolveAuthHeaders(auth: AuthConfig): ResolvedAuth
   ```
   Logica por tipo:
   - `none`: retorna `{ headers: [], params: [] }`
   - `basic`: genera header `Authorization: Basic <base64(username:password)>`. Usar `btoa()` del navegador.
   - `bearer`: genera header `Authorization: <prefix> <token>`. El prefix por defecto es `"Bearer"`.
   - `apikey`: si `addTo === "header"`, genera header `{ key, value }`. Si `addTo === "query"`, genera param `{ key, value }`.

5. **Crear `src/utils/auth.test.ts`** con tests unitarios para `resolveAuthHeaders()`:
   - Test para cada tipo de auth.
   - Test de Basic Auth con caracteres especiales (unicode, dos puntos en password).
   - Test de Bearer con prefix custom.
   - Test de API Key como header vs query param.
   - Test de `none` retorna arrays vacios.
   - Test de campos vacios (username/password vacios, token vacio) -- debe generar headers igualmente (no filtra).

### Affected Files
- `src/types/auth.ts` - CREATE
- `src/types/http.ts` - MODIFY (agregar campo `auth`)
- `src/utils/auth.ts` - CREATE
- `src/utils/auth.test.ts` - CREATE

### Applied Best Practices
- **Single Responsibility**: `resolveAuthHeaders` es una funcion pura sin side effects, facil de testear.
- **Open/Closed Principle**: discriminated union permite agregar nuevos tipos de auth sin modificar codigo existente (solo agregar un case).
- **Type Safety**: TypeScript discriminated union garantiza exhaustive checking en switches.

### Completion Criteria
- [ ] Tipos `AuthConfig` compilados sin errores con `bun astro check`
- [ ] `resolveAuthHeaders()` implementada y exportada
- [ ] Todos los tests pasan con `bun test`
- [ ] `RequestState` incluye campo `auth: AuthConfig`

### Risks and Mitigations
- **Risk**: `btoa()` no soporta caracteres Unicode directamente --> **Mitigation**: Usar el patron `btoa(unescape(encodeURIComponent(str)))` o `TextEncoder` + manual base64 para soporte completo de Unicode. Documentar la decision en un comentario.
- **Risk**: Cambio en `RequestState` rompe la compatibilidad de datos persistidos --> **Mitigation**: Tratado en Phase 2 (migration guard en StorageService).

### Complexity Estimation
**Baja** - Solo tipos y una funcion pura con tests.

---

## Phase 2: Store Integration and Persistence

### Objective
Integrar `AuthConfig` en el sistema de stores y garantizar persistencia backward-compatible en localStorage.

### Prerequisites
Phase 1 completada.

### Detailed Tasks

1. **Actualizar `DEFAULT_REQUEST` en `src/stores/tab-store.ts`**:
   ```
   import { DEFAULT_AUTH } from "../types/auth";

   export const DEFAULT_REQUEST: RequestState = {
     method: "GET",
     url: "",
     params: [],
     headers: [],
     body: { mode: "none", contentType: "json", raw: "" },
     auth: DEFAULT_AUTH,        // <-- nuevo campo
   };
   ```

2. **Agregar acciones de auth en `src/stores/http-store.ts`**:
   ```
   function updateAuthType(type: AuthType): void
   function updateBasicAuth(field: "username" | "password", value: string): void
   function updateBearerToken(field: "token" | "prefix", value: string): void
   function updateApiKey(field: "key" | "value" | "addTo", value: string): void
   ```
   Todas usan `updateActiveTabRequest({ auth: ... })`. El cambio de `type` debe reinicializar la config del nuevo tipo con valores por defecto para evitar estado residual del tipo anterior.

   Logica de `updateAuthType`:
   ```
   switch (type) {
     case "none":   auth = { type: "none" };
     case "basic":  auth = { type: "basic", basic: { username: "", password: "" } };
     case "bearer": auth = { type: "bearer", bearer: { token: "", prefix: "Bearer" } };
     case "apikey": auth = { type: "apikey", apikey: { key: "", value: "", addTo: "header" } };
   }
   ```

3. **Migration guard en `StorageService`** (`src/services/storage.ts`):
   Modificar `isRequestState()` para ser tolerante con la ausencia del campo `auth` (backward compatibility). Las tabs guardadas antes de esta feature no tendran el campo `auth`.

   Opcion elegida: **NO modificar** `isRequestState()` ya que el type guard solo verifica campos esenciales (`method`, `url`, `params`, `headers`, `body`). El campo `auth` sera opcional en runtime.

   En su lugar, agregar un migration guard en `initializeTabs()` dentro de `tab-store.ts`: al restaurar tabs, si `tab.request.auth` es `undefined`, asignar `DEFAULT_AUTH`.
   ```
   const restoredTabs = persisted.map((t) => ({
     ...t,
     request: {
       ...t.request,
       auth: t.request.auth ?? DEFAULT_AUTH,
     },
     response: null,
     requestStatus: "idle" as RequestStatus,
     requestError: null,
   }));
   ```
   Este mismo patron debe aplicarse en `loadRequest()` de `http-store.ts`.

4. **Actualizar `loadRequest()` en `http-store.ts`**:
   Agregar fallback para `auth` al cargar snapshots de historial/colecciones:
   ```
   auth: snapshot.auth ?? DEFAULT_AUTH,
   ```

5. **Actualizar `interpolateRequest()` en `src/utils/interpolation.ts`**:
   Interpolar variables en los campos de auth:
   - `basic.username`, `basic.password`
   - `bearer.token` (NO `bearer.prefix`, el prefix no deberia contener variables)
   - `apikey.key`, `apikey.value`

   Agregar al final de la funcion, despues de interpolar body:
   ```
   clone.auth = interpolateAuth(clone.auth, variables);
   ```

   Crear funcion helper `interpolateAuth()` dentro del mismo archivo:
   ```
   function interpolateAuth(auth: AuthConfig, variables: Map<string, string>): AuthConfig {
     switch (auth.type) {
       case "none": return auth;
       case "basic": return {
         ...auth, basic: {
           username: interpolateVariables(auth.basic.username, variables),
           password: interpolateVariables(auth.basic.password, variables),
         }
       };
       case "bearer": return {
         ...auth, bearer: {
           ...auth.bearer,
           token: interpolateVariables(auth.bearer.token, variables),
         }
       };
       case "apikey": return {
         ...auth, apikey: {
           ...auth.apikey,
           key: interpolateVariables(auth.apikey.key, variables),
           value: interpolateVariables(auth.apikey.value, variables),
         }
       };
     }
   }
   ```

6. **Actualizar test factories** en `src/test/factories.ts`:
   - Agregar `auth: DEFAULT_AUTH` al return de `makeRequestState()`.
   - Crear factory `makeAuthConfig(overrides?)` con variantes por tipo.

7. **Actualizar tests existentes** que puedan verse afectados:
   - `src/stores/http-store.test.ts` - verificar que los tests pasan con el nuevo campo.
   - `src/stores/tab-store.test.ts` - verificar migration guard.
   - `src/utils/interpolation.test.ts` - agregar tests para interpolacion de auth.

### Affected Files
- `src/stores/tab-store.ts` - MODIFY (DEFAULT_REQUEST, migration guard)
- `src/stores/http-store.ts` - MODIFY (auth actions, loadRequest fallback)
- `src/utils/interpolation.ts` - MODIFY (interpolateAuth)
- `src/utils/interpolation.test.ts` - MODIFY (nuevos tests)
- `src/test/factories.ts` - MODIFY (auth en makeRequestState, nueva factory)
- `src/stores/http-store.test.ts` - MODIFY (verificar compatibilidad)
- `src/stores/tab-store.test.ts` - MODIFY (migration guard test)

### Applied Best Practices
- **Backward Compatibility**: Migration guard asegura que tabs persistidas sin `auth` se inicializan correctamente.
- **Fail Fast**: `updateAuthType` reinicializa la config completa al cambiar tipo, evitando estado inconsistente.
- **DRY**: La logica de interpolacion de auth se encapsula en una funcion helper dentro del modulo existente.

### Completion Criteria
- [ ] `DEFAULT_REQUEST` incluye `auth: DEFAULT_AUTH`
- [ ] Todas las acciones de auth exportadas desde `http-store.ts`
- [ ] Tabs antiguas sin campo `auth` se restauran correctamente con `DEFAULT_AUTH`
- [ ] `loadRequest()` maneja snapshots sin `auth`
- [ ] `interpolateRequest()` interpola campos de auth
- [ ] Todos los tests existentes siguen pasando
- [ ] Nuevos tests de interpolacion de auth pasan
- [ ] `bun astro check` sin errores

### Risks and Mitigations
- **Risk**: Tests existentes fallan por el nuevo campo `auth` en `RequestState` --> **Mitigation**: Las factories se actualizan en esta fase; los tests que usan `makeRequestState()` obtienen automaticamente el campo.
- **Risk**: Datos corruptos en localStorage sin campo `auth` --> **Mitigation**: Migration guard con fallback a `DEFAULT_AUTH` (nullish coalescing).

### Complexity Estimation
**Media** - Multiples archivos que modificar, pero cambios mecanicos y predecibles.

---

## Phase 3: Auth Editor UI Component

### Objective
Crear el componente `AuthEditor.tsx` e integrarlo como pestana "Auth" en `RequestConfigTabs`.

### Prerequisites
Phase 2 completada.

### Detailed Tasks

1. **Crear `src/components/request/AuthEditor.tsx`**:
   Componente principal que renderiza el selector de tipo de auth y el panel correspondiente.

   Estructura:
   ```
   AuthEditor
   +------------------------------------------------------+
   | Type: [Dropdown: No Auth | Basic Auth | Bearer | API Key] |
   +------------------------------------------------------+
   |                                                      |
   |  (panel dinamico segun tipo seleccionado)            |
   |                                                      |
   +------------------------------------------------------+
   ```

   - Importar `requestState` de `http-store` para leer `auth`.
   - Importar acciones `updateAuthType`, `updateBasicAuth`, `updateBearerToken`, `updateApiKey` de `http-store`.
   - Usar el componente `Dropdown` existente para el selector de tipo.
   - Items del dropdown:
     ```
     [
       { label: "No Auth",     value: "none" },
       { label: "Basic Auth",  value: "basic" },
       { label: "Bearer Token", value: "bearer" },
       { label: "API Key",     value: "apikey" },
     ]
     ```

2. **Panel para tipo "none"**:
   Texto informativo centrado:
   ```
   "This request does not use any authentication."
   ```
   Usar las mismas clases que el BodyEditor para modo "none": `text-sm text-pm-text-tertiary text-center py-8`.

3. **Panel para tipo "basic"**:
   Dos campos de texto apilados verticalmente:
   ```
   +-----------------------------------+
   | Username:                         |
   | [_________________________]       |
   |                                   |
   | Password:                         |
   | [_________________________] [eye] |
   +-----------------------------------+
   ```
   - Labels con clase `text-xs font-semibold text-pm-text-secondary uppercase`.
   - Inputs con las mismas clases de los inputs de KeyValueTable.
   - El campo password tiene `type="password"` por defecto con toggle de visibilidad (icono eye).
   - Toggle implementado con `useSignal<boolean>(false)` local al componente.
   - Soporte para `VariableIndicator` en ambos campos: detectar `{{...}}` y mostrar indicador.

4. **Panel para tipo "bearer"**:
   ```
   +-----------------------------------+
   | Prefix:                           |
   | [Bearer___________]               |
   |                                   |
   | Token:                            |
   | [_________________________]       |
   +-----------------------------------+
   ```
   - Input de prefix con placeholder "Bearer" y valor por defecto "Bearer".
   - Textarea de token (puede ser largo, JWT suele tener ~800+ chars).
   - `VariableIndicator` en el campo token.

5. **Panel para tipo "apikey"**:
   ```
   +-----------------------------------+
   | Key:                              |
   | [_________________________]       |
   |                                   |
   | Value:                            |
   | [_________________________]       |
   |                                   |
   | Add to: (o) Header  (o) Query Params |
   +-----------------------------------+
   ```
   - Dos inputs de texto para key y value.
   - Radio buttons para `addTo` (misma estructura que BodyEditor con radio buttons para body mode).
   - `VariableIndicator` en key y value.

6. **Integrar en `RequestConfigTabs.tsx`**:
   - Agregar "auth" al `TAB_IDS` const array:
     ```
     const TAB_IDS = ["params", "headers", "body", "auth"] as const;
     ```
   - Agregar tab item:
     ```
     { id: "auth", label: "Auth" }
     ```
   - Agregar tabpanel con `AuthEditor`:
     ```
     <div id="req-tabpanel-auth" role="tabpanel" class={`p-4 ${activeTab.value !== "auth" ? "hidden" : ""}`}>
       <AuthEditor />
     </div>
     ```
   - Importar `AuthEditor` al inicio del archivo.

7. **Accesibilidad**:
   - Todos los inputs tienen `aria-label` descriptivos.
   - El toggle de visibilidad de password tiene `aria-label="Toggle password visibility"`.
   - Los radio buttons de API Key usan `fieldset` + `legend` semantico.
   - El selector de tipo de auth usa el componente `Dropdown` que ya implementa ARIA listbox.

### Affected Files
- `src/components/request/AuthEditor.tsx` - CREATE
- `src/components/request/RequestConfigTabs.tsx` - MODIFY

### Applied Best Practices
- **Separation of Concerns**: AuthEditor es un componente standalone que solo lee/escribe a traves del store.
- **Reuse**: Usa `Dropdown` y `VariableIndicator` existentes; estilos consistentes con `BodyEditor` y `KeyValueTable`.
- **Principle of Least Surprise**: La UI sigue los patrones ya establecidos en Postman/Insomnia (dropdown de tipo + panel dinamico).
- **Accessibility**: ARIA labels, fieldset/legend, keyboard navigation via Dropdown.

### Completion Criteria
- [ ] Pestana "Auth" visible en `RequestConfigTabs`
- [ ] Dropdown de tipo de auth funciona y cambia el panel
- [ ] Panel "No Auth" muestra mensaje informativo
- [ ] Panel "Basic Auth" con campos username/password y toggle visibility
- [ ] Panel "Bearer Token" con campos prefix/token
- [ ] Panel "API Key" con campos key/value y radio buttons header/query
- [ ] `VariableIndicator` funciona en campos de auth (username, password, token, api key/value)
- [ ] Cambiar de tab y volver preserva los valores de auth (persistidos en RequestState)
- [ ] `bun astro check` sin errores
- [ ] `bun build` sin errores

### Risks and Mitigations
- **Risk**: El componente AuthEditor crece demasiado si se ponen todos los paneles inline --> **Mitigation**: Si el componente supera ~150 lineas, extraer cada panel en su propio subcomponente (BasicAuthPanel.tsx, etc.). Dejar a criterio del implementador.
- **Risk**: VariableIndicator necesita `activeVariablesMap` --> **Mitigation**: Importar directamente desde `environment-store` como ya lo hacen otros componentes.

### Complexity Estimation
**Media** - Un componente nuevo con multiples paneles, pero sigue patrones existentes.

---

## Phase 4: HTTP Client Integration

### Objective
Inyectar los headers/params de autenticacion al enviar la request HTTP.

### Prerequisites
Phase 2 completada (Phase 3 puede estar en progreso en paralelo).

### Detailed Tasks

1. **Modificar `sendRequest()` en `src/services/http-client.ts`**:

   Despues de interpolar variables y antes de construir fetchHeaders, resolver la autenticacion:

   ```
   import { resolveAuthHeaders } from "../utils/auth";

   // ... dentro de sendRequest(), despues de obtener interpolatedState:

   // Resolve auth headers/params
   const resolvedAuth = resolveAuthHeaders(interpolatedState.auth);
   ```

   Al construir fetchHeaders, agregar los headers de auth:
   ```
   // Add auth headers (before user headers so user can override)
   for (const h of resolvedAuth.headers) {
     fetchHeaders.set(h.key, h.value);
   }

   // Add user-defined headers (these take precedence over auth headers)
   for (const h of interpolatedState.headers.filter(h => h.enabled && h.key !== "")) {
     fetchHeaders.set(h.key, h.value);
   }
   ```

   **Orden de precedencia** (de menor a mayor):
   1. Headers generados por auth (se aplican primero)
   2. Headers explícitos del usuario (pueden sobreescribir auth)

   Esto permite al usuario override manual si lo necesita (principio de least surprise).

2. **Manejar API Key como query param**:
   Si `resolvedAuth.params` tiene entradas, inyectarlas en la URL resuelta:
   ```
   let finalUrl = resolvedUrl;
   if (resolvedAuth.params.length > 0) {
     const url = new URL(resolvedUrl);
     for (const p of resolvedAuth.params) {
       url.searchParams.set(p.key, p.value);
     }
     finalUrl = url.toString();
   }
   ```
   Usar `finalUrl` en lugar de `resolvedUrl` para el `fetch()`.

3. **Verificar que el historial almacena la auth config**:
   El historial ya persiste `requestSnapshot: structuredClone(state)` que incluye `auth` porque es parte de `RequestState`. No se necesitan cambios adicionales en history.

4. **Verificar que las colecciones almacenan la auth config**:
   Similar al historial, `SavedRequest.requestSnapshot` es de tipo `RequestState`, que ahora incluye `auth`. No se necesitan cambios.

### Affected Files
- `src/services/http-client.ts` - MODIFY

### Applied Best Practices
- **Separation of Concerns**: La resolucion de auth es delegada a `resolveAuthHeaders()` (funcion pura); el http-client solo consume el resultado.
- **Principle of Least Surprise**: User-defined headers tienen precedencia sobre auth headers, permitiendo override manual.
- **KISS**: La inyeccion de auth es un paso aditivo al flujo existente, no reemplaza logica.

### Completion Criteria
- [ ] Basic Auth envia header `Authorization: Basic <base64>` correctamente
- [ ] Bearer Token envia header `Authorization: <prefix> <token>` correctamente
- [ ] API Key como header envia el header custom correctamente
- [ ] API Key como query param agrega el parametro a la URL correctamente
- [ ] Headers explícitos del usuario sobreescriben auth headers si colisionan
- [ ] Variables de entorno se interpolan en campos de auth antes del envio
- [ ] Auth config se persiste en historial via requestSnapshot
- [ ] Auth config "none" no agrega ningun header ni param
- [ ] `bun astro check` sin errores
- [ ] `bun build` sin errores

### Risks and Mitigations
- **Risk**: `new URL()` puede fallar si `resolvedUrl` es invalido --> **Mitigation**: Este codigo se ejecuta DESPUES de la validacion de URL existente, que ya hace `new URL(resolvedUrl)` y retorna early si falla.
- **Risk**: API Keys como query param podrian conflictar con params explícitos del usuario --> **Mitigation**: Se usa `searchParams.set()` (no `append`), por lo que el param de auth sobreescribe si hay colision. Esto es intencional: auth config es la fuente de verdad para autenticacion.

### Complexity Estimation
**Baja** - Cambios puntuales en un solo archivo, logica clara.

---

## Phase 5: Testing and Polish

### Objective
Agregar tests de integracion para el flujo completo, verificar edge cases, y asegurar que todo el sistema funciona end-to-end.

### Prerequisites
Phases 1-4 completadas.

### Detailed Tasks

1. **Tests de store para acciones de auth** en `src/stores/http-store.test.ts`:
   - Test `updateAuthType` cambia el tipo y reinicializa config.
   - Test `updateBasicAuth` actualiza username/password.
   - Test `updateBearerToken` actualiza token/prefix.
   - Test `updateApiKey` actualiza key/value/addTo.
   - Test de cambio de tipo no pierde datos de otros campos de request.

2. **Tests de migration** en `src/stores/tab-store.test.ts`:
   - Test que tabs sin campo `auth` se restauran con `DEFAULT_AUTH`.
   - Test que tabs con campo `auth` existente se preservan.

3. **Tests de interpolacion de auth** en `src/utils/interpolation.test.ts`:
   - Test que `interpolateRequest` interpola `basic.username` con variables.
   - Test que `interpolateRequest` interpola `bearer.token` con variables.
   - Test que `interpolateRequest` interpola `apikey.key` y `apikey.value` con variables.
   - Test que `interpolateRequest` NO interpola `bearer.prefix`.
   - Test que auth tipo "none" pasa sin cambios.

4. **Actualizar factory** `makeRequestState` si no se hizo en Phase 2.

5. **Verificacion final**:
   - Ejecutar `bun astro check` - cero errores de tipo.
   - Ejecutar `bun build` - build de produccion exitoso.
   - Ejecutar `bun test` - todos los tests pasan.
   - Verificar visualmente en el navegador:
     - Crear nueva tab, ir a Auth, configurar Basic Auth, enviar request.
     - Cambiar a Bearer Token, enviar request.
     - Configurar API Key como query param, verificar URL enviada.
     - Configurar API Key como header, verificar headers enviados.
     - Usar `{{variable}}` en token/password, verificar interpolacion.
     - Guardar request en coleccion, recargar, verificar que auth persiste.
     - Revisar historial, recargar request, verificar auth preservada.

### Affected Files
- `src/stores/http-store.test.ts` - MODIFY
- `src/stores/tab-store.test.ts` - MODIFY
- `src/utils/interpolation.test.ts` - MODIFY (si no se hizo en Phase 2)

### Applied Best Practices
- **Testing**: Coverage completo de la feature incluyendo edge cases y backward compatibility.
- **Fail Fast**: Verificacion temprana de integracion con build y type-check.

### Completion Criteria
- [ ] Todos los tests nuevos pasan con `bun test`
- [ ] `bun astro check` cero errores
- [ ] `bun build` exitoso
- [ ] Coverage de la feature: tipos, utilidades, store actions, interpolacion, migration

### Risks and Mitigations
- **Risk**: Tests de store requieren `vi.resetModules()` por la inicializacion module-level de signals --> **Mitigation**: Seguir el patron ya establecido en `http-store.test.ts` y `tab-store.test.ts`.

### Complexity Estimation
**Baja** - Tests siguiendo patrones existentes.

---

## Resumen de Archivos

| Archivo | Accion | Phase |
|---------|--------|-------|
| `src/types/auth.ts` | CREATE | 1 |
| `src/types/http.ts` | MODIFY | 1 |
| `src/utils/auth.ts` | CREATE | 1 |
| `src/utils/auth.test.ts` | CREATE | 1 |
| `src/stores/tab-store.ts` | MODIFY | 2 |
| `src/stores/http-store.ts` | MODIFY | 2 |
| `src/utils/interpolation.ts` | MODIFY | 2 |
| `src/utils/interpolation.test.ts` | MODIFY | 2 |
| `src/test/factories.ts` | MODIFY | 2 |
| `src/stores/http-store.test.ts` | MODIFY | 2, 5 |
| `src/stores/tab-store.test.ts` | MODIFY | 2, 5 |
| `src/components/request/AuthEditor.tsx` | CREATE | 3 |
| `src/components/request/RequestConfigTabs.tsx` | MODIFY | 3 |
| `src/services/http-client.ts` | MODIFY | 4 |

**Total**: 4 archivos nuevos, 10 archivos modificados.

---

## Decisiones Tecnicas Clave

### 1. Auth como parte de RequestState (no como store separado)
**Decision**: `auth` es un campo de `RequestState`, no un store independiente.
**Razon**: La autenticacion es intrinseca a la request. Almacenarla fuera romperia la atomicidad de snapshot/restore (historial, colecciones, tabs). Seguimos el mismo patron que `body`.

### 2. Discriminated Union para AuthConfig
**Decision**: Usar discriminated union con campo `type` en vez de una interfaz plana con campos opcionales.
**Razon**: Type safety. El compilador fuerza que solo accedamos a `basic.username` cuando `type === "basic"`. Extensible para OAuth 2.0 futuro.

### 3. Headers de auth inyectados en send-time, no visibles en UI
**Decision**: Los headers generados por auth (Authorization, API Key) se inyectan al momento de enviar y no aparecen en la lista de headers del usuario.
**Razon**: Separacion de concerns. Evita confusion si el usuario ve un header "Authorization" que no agrego manualmente. Postman e Insomnia siguen este mismo patron. Si el usuario quiere override, puede agregar un header `Authorization` manualmente (que tendra precedencia).

### 4. Prefix configurable en Bearer Token
**Decision**: El campo `prefix` del Bearer Token es configurable con default "Bearer".
**Razon**: Algunas APIs usan prefijos distintos como "Token" (Django REST), "Bot" (Discord), o "key=" (custom APIs).

### 5. Unicode en Basic Auth
**Decision**: Usar `TextEncoder` + manual base64 en vez de `btoa()` plano.
**Razon**: `btoa()` falla con caracteres fuera de Latin1. El patron `btoa(String.fromCharCode(...new TextEncoder().encode(str)))` soporta el rango completo de Unicode.

---

## Dependencias entre Phases

```
Phase 1 (Types + Utils)
   |
   v
Phase 2 (Store + Persistence)
   |
   +--> Phase 3 (UI Component)     -- puede iniciar tan pronto Phase 2 termine
   |
   +--> Phase 4 (HTTP Client)      -- puede iniciar en paralelo con Phase 3
   |
   v
Phase 5 (Testing + Polish)          -- requiere Phases 1-4 completadas
```

Phase 3 y Phase 4 son independientes entre si y pueden implementarse en paralelo.
