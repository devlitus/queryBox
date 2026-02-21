# Code Review Report

## Feature: Authentication System
## Plan: `docs/auth-system/auth-system-plan.md`
## Date: 2026-02-21
## Status: APROBADO

---

### Summary

Se revisaron 14 archivos implementados (4 nuevos + 10 modificados) correspondientes a las 5 fases del plan. La implementación cubre completamente todos los requisitos: tipos TypeScript, utilidades puras, integración con stores, componente de UI, integración con el cliente HTTP y tests exhaustivos. Los comandos de verificación confirman 0 errores de TypeScript, build exitoso y 299/299 tests pasando.

**Comandos ejecutados:**
- `bun astro check` — 0 errors, 0 warnings en archivos del proyecto (warnings son de `coverage/prettify.js`, archivo de terceros fuera del scope)
- `bun run build` — build exitoso en 1.71s, 1 página generada
- `bun run test` — 299/299 tests pasando
- `bun run test:coverage` — cobertura global 92.43% statements

---

### Plan Compliance Checklist

#### Phase 1: Type Definitions and Auth Utilities

- [x] `src/types/auth.ts` creado con `AuthType`, `BasicAuthConfig`, `BearerTokenConfig`, `ApiKeyConfig`, `AuthConfig` (discriminated union) y `DEFAULT_AUTH`
- [x] `AuthConfig` es discriminated union con `type` como discriminant
- [x] `DEFAULT_AUTH = { type: "none" }` exportado
- [x] Campo `auth: AuthConfig` agregado a `RequestState` en `src/types/http.ts`
- [x] `src/utils/auth.ts` creado con `resolveAuthHeaders()` exportado
- [x] Logica correcta para `none`, `basic`, `bearer`, `apikey`
- [x] Unicode soportado via `TextEncoder` (riesgo de plan mitigado correctamente)
- [x] `src/utils/auth.test.ts` creado con 16 tests cubriendo todos los tipos
- [x] Tests para caracteres especiales (Unicode, colons en password)
- [x] Tests para Bearer con prefix custom
- [x] Tests para API Key como header vs query param
- [x] Tests para campos vacios (genera headers igualmente, sin filtrar)

#### Phase 2: Store Integration and Persistence

- [x] `DEFAULT_REQUEST` en `tab-store.ts` incluye `auth: DEFAULT_AUTH`
- [x] `updateAuthType()` exportado desde `http-store.ts` con reinicializacion completa por tipo
- [x] `updateBasicAuth()` exportado
- [x] `updateBearerToken()` exportado
- [x] `updateApiKey()` exportado
- [x] Migration guard en `initializeTabs()` de `tab-store.ts` con `t.request.auth ?? DEFAULT_AUTH`
- [x] Migration guard en `loadRequest()` de `http-store.ts` con `snapshot.auth ?? DEFAULT_AUTH`
- [x] `interpolateRequest()` en `interpolation.ts` llama a `interpolateAuth()`
- [x] `interpolateAuth()` interpola `basic.username`, `basic.password`, `bearer.token`, `apikey.key`, `apikey.value`
- [x] `bearer.prefix` NO es interpolado (decision correcta documentada)
- [x] `makeRequestState()` en `factories.ts` incluye `auth: DEFAULT_AUTH`
- [x] `makeAuthConfig()` factory creado en `factories.ts`

#### Phase 3: Auth Editor UI Component

- [x] `src/components/request/AuthEditor.tsx` creado
- [x] Selector de tipo con Dropdown existente (4 items: No Auth, Basic Auth, Bearer Token, API Key)
- [x] Panel "No Auth" con mensaje informativo correcto
- [x] Panel "Basic Auth" con campos username/password y toggle de visibilidad
- [x] Toggle implementado con `useSignal<boolean>(false)` local
- [x] Panel "Bearer Token" con campos prefix/token (textarea para token largo)
- [x] Panel "API Key" con campos key/value y radio buttons header/query
- [x] Radio buttons usan `fieldset` + `legend` semantico
- [x] `VariableIndicator` en campos relevantes (username, password, token, key, value)
- [x] `VariableIndicator` condicionado a `activeEnvironmentId !== null` (patron correcto)
- [x] `RequestConfigTabs.tsx` actualizado: `TAB_IDS` incluye "auth", tab item "Auth" agregado, tabpanel con `AuthEditor`
- [x] `AuthEditor` importado correctamente en `RequestConfigTabs.tsx`
- [x] ARIA: todos los inputs tienen `aria-label`, toggle tiene `aria-label="Toggle password visibility"`, SVGs tienen `aria-hidden="true"`, Dropdown tiene `label` prop

#### Phase 4: HTTP Client Integration

- [x] `resolveAuthHeaders()` importado e invocado en `sendRequest()` de `http-client.ts`
- [x] Auth headers inyectados ANTES de user-defined headers (menor precedencia)
- [x] User-defined headers tienen precedencia via `fetchHeaders.set()` (sobreescritura por colision)
- [x] API Key como query param inyectado via `new URL().searchParams.set()`
- [x] `finalUrl` usado en lugar de `resolvedUrl` para el fetch
- [x] `new URL()` solo se ejecuta cuando `resolvedAuth.params.length > 0`, despues de la validacion existente

#### Phase 5: Testing and Polish

- [x] Tests de store: `updateAuthType`, `updateBasicAuth`, `updateBearerToken`, `updateApiKey` en `http-store.test.ts`
- [x] Test de migration guard para `loadRequest` sin campo `auth`
- [x] Tests de migration en `tab-store.test.ts`: tab sin `auth` recibe `DEFAULT_AUTH`, tab con `auth` lo preserva
- [x] Tests de interpolacion de auth en `interpolation.test.ts`: todos los tipos, prefix no interpolado, inmutabilidad
- [x] `bun astro check` — 0 errores
- [x] `bun build` — exitoso
- [x] `bun run test` — 299/299 tests pasando

---

### Issues Found

#### ALTA (0 issues)

Ninguno.

#### MEDIA (0 issues)

Ninguno.

#### BAJA (2 issues)

1. **Double import de `http-store` en `AuthEditor.tsx`** - `src/components/request/AuthEditor.tsx` lineas 4-10

   - Descripcion: `requestState` se importa en una sentencia `import` separada (linea 4), y las acciones de auth se importan en otra sentencia del mismo modulo (lineas 5-10). Esto es un minor style issue; deberian consolidarse en un unico `import ... from "../../stores/http-store"`.
   - Suggestion: Consolidar en una sola sentencia:
     ```ts
     import {
       requestState,
       updateAuthType,
       updateBasicAuth,
       updateBearerToken,
       updateApiKey,
     } from "../../stores/http-store";
     ```

2. **`makeAuthConfig()` factory tiene type assertion fragil** - `src/test/factories.ts` linea 37

   - Descripcion: La funcion `makeAuthConfig` usa `return overrides as AuthConfig` que es un cast inseguro. Si el caller pasa un objeto incompleto (e.g., `{ type: "basic" }` sin el campo `basic`), TypeScript no lo detecta en el call site gracias al `Partial<AuthConfig>` y la funcion silencia el error con `as AuthConfig`.
   - Suggestion: Cambiar la firma para aceptar `AuthConfig` directamente (no `Partial`) ya que `AuthConfig` es un discriminated union donde todos los campos son requeridos para cada variante:
     ```ts
     export function makeAuthConfig(config?: AuthConfig): AuthConfig {
       return config ?? { type: "none" };
     }
     ```
     Alternativamente, documentar que el caller es responsable de pasar un objeto completo.

---

### Verdict

La implementacion esta **APROBADA**. Los 5 fases del plan estan completamente implementadas sin omisiones. El codigo es de alta calidad, TypeScript strict se cumple con 0 errores, todos los 299 tests pasan, y el build de produccion es exitoso.

**Aspectos positivos destacados:**

- La decision de Unicode (`TextEncoder` + manual base64) esta correctamente implementada y documentada en comentarios de codigo, siguiendo exactamente el plan.
- El migration guard backward-compatible (`?? DEFAULT_AUTH`) esta aplicado consistentemente en los tres puntos requeridos: `initializeTabs()`, `loadRequest()` del store, y existe cobertura de tests especifica para cada uno.
- La separacion de concerns entre `AuthEditor` y el store es correcta — el componente no hace logica de negocio.
- La precedencia de headers (auth < user-defined) esta correctamente implementada y comentada en el codigo.
- El `VariableIndicator` esta condicionado a `activeEnvironmentId !== null`, patron correcto ya establecido en el proyecto.
- Los tests de interpolacion verifican explicitamente que `bearer.prefix` NO se interpola, un edge case importante del plan.
- La cobertura de `utils/auth.ts` es 100% en todas las metricas.
- Los issues de cobertura en `storage.ts` (lineas 88-90, 174-198) son carry-forward de fases anteriores, no introducidos por esta feature.
