# Code Snippet Generator - Plan de Implementacion

## Resumen

Generar fragmentos de codigo listos para copiar a partir de la request configurada en el workbench. Soporta cuatro lenguajes/herramientas: cURL, JavaScript (fetch), Python (requests), y Node.js (axios). Se accede mediante un boton "</> Code" en el RequestBar que abre un modal con selector de lenguaje, preview del snippet, y boton de copiar al portapapeles.

---

## Decisiones Tecnicas

### 1. Ubicacion del boton de acceso: RequestBar

**Decision**: Agregar un boton "</> Code" en el RequestBar, junto a los botones "Save" y "Send" existentes.

**Justificacion**:
- El RequestBar ya contiene acciones contextuales a la request (Save, Send).
- Un boton al mismo nivel es mas visible y accesible que una pestana adicional en RequestConfigTabs.
- Sigue el patron de Postman/Insomnia donde "Code" es un boton de accion, no una pestana de configuracion.
- No compite con el espacio de las pestanas Params/Headers/Body/Auth que son para **editar** la request.

### 2. UI: Modal (no panel lateral)

**Decision**: Usar un modal para mostrar el snippet generado.

**Justificacion**:
- El proyecto ya tiene un patron de modal establecido (SaveToCollectionModal.tsx) con overlay, focus trap, y accesibilidad.
- Un panel lateral competiria con el sidebar existente y complicaria el layout de grid.
- El modal permite una experiencia enfocada: seleccionar lenguaje, ver snippet, copiar, cerrar.
- Es el patron que usan Postman e Insomnia para esta funcionalidad.

### 3. Generacion de snippets: funciones puras en utils/

**Decision**: Crear funciones puras de generacion en `src/utils/snippet-generators.ts`, una por cada lenguaje.

**Justificacion**:
- **Testabilidad**: Las funciones puras son triviales de testear con Vitest sin DOM ni componentes.
- **SRP (Single Responsibility)**: Separar la logica de generacion de la UI.
- **Extensibilidad (OCP)**: Agregar un nuevo lenguaje = agregar una funcion + una entrada en el registro.
- **Sin dependencias externas**: No se necesitan librerias de terceros. Los snippets son generacion de strings que siguen formatos bien definidos.

### 4. Variables de entorno: opcion de interpolar o mostrar placeholders

**Decision**: Ofrecer un toggle en el modal para que el usuario elija entre ver valores interpolados o los placeholders `{{variable}}`.

**Justificacion**:
- **Valor interpolado**: Util cuando se quiere un snippet ejecutable inmediatamente (copiar y pegar en terminal).
- **Placeholders**: Util cuando se quiere compartir el snippet como template sin exponer credenciales/valores reales.
- Se reutiliza la funcion `interpolateRequest()` existente cuando el toggle esta activo.
- El toggle solo se muestra si hay un entorno activo con variables (de lo contrario no tiene sentido).

### 5. Copiar al portapapeles: Clipboard API

**Decision**: Usar `navigator.clipboard.writeText()` con feedback visual.

**Justificacion**:
- API nativa del navegador, disponible en todos los navegadores modernos (soporte >95%).
- Feedback visual: el boton cambia temporalmente su texto/icono a "Copied!" durante 2 segundos.
- No se necesita fallback con `document.execCommand` para el target audience de queryBox (desarrolladores con navegadores modernos).

### 6. Tipo de snippet: SnippetLanguage como union de strings

**Decision**: Definir `type SnippetLanguage = "curl" | "javascript-fetch" | "python-requests" | "nodejs-axios"`.

**Justificacion**:
- TypeScript narrow typing evita errores en switch/map.
- Los IDs son descriptivos y no colisionan.
- Extensible: agregar un lenguaje futuro es agregar un valor al union type.

---

## Arquitectura de Archivos

```
src/
  types/
    snippet.ts                    [CREAR] - Tipos SnippetLanguage, SnippetOption
  utils/
    snippet-generators.ts         [CREAR] - Funciones puras de generacion
    snippet-generators.test.ts    [CREAR] - Tests unitarios
  components/
    workbench/
      CodeSnippetModal.tsx        [CREAR] - Modal con selector + preview + copy
    request/
      RequestBar.tsx              [MODIFICAR] - Agregar boton "</> Code"
  stores/
    ui-store.ts                   [MODIFICAR] - Agregar signal showCodeSnippetModal
  components/
    workbench/
      HttpWorkbench.tsx           [MODIFICAR] - Montar CodeSnippetModal
```

---

## Phase 1: Tipos y Funciones de Generacion de Snippets

### Objetivo
Crear la capa de logica pura que transforma un `RequestState` en strings de codigo para cada lenguaje soportado.

### Prerrequisitos
Ninguno. Esta fase es autocontenida.

### Tareas Detalladas

1. **Crear `src/types/snippet.ts`** con:
   ```
   - SnippetLanguage: "curl" | "javascript-fetch" | "python-requests" | "nodejs-axios"
   - SnippetOption: { id: SnippetLanguage; label: string; language: string }
     (language es para syntax highlighting futuro: "bash", "javascript", "python", "javascript")
   - SNIPPET_OPTIONS: readonly SnippetOption[] - registro de opciones disponibles
   ```

2. **Crear `src/utils/snippet-generators.ts`** con funciones puras:

   a. **`generateCurl(request: RequestState): string`**
      - Genera un comando `curl` completo.
      - Incluye: `-X METHOD` (omitido para GET), `URL` con params, `-H "key: value"` para cada header habilitado, `-d 'body'` para raw body.
      - Auth: `-H "Authorization: ..."` para basic/bearer, `-H "key: value"` para apikey en header, param en URL para apikey en query.
      - Escapa comillas simples en body con `'\''`.
      - Usa `\` para multilnea (legibilidad).

   b. **`generateJavaScriptFetch(request: RequestState): string`**
      - Genera codigo ES6+ con async/await.
      - Estructura: `const response = await fetch(url, { method, headers, body })`.
      - Incluye `const data = await response.json()` o `.text()` segun content-type.
      - Headers como objeto literal `{ 'Key': 'Value' }`.
      - Auth integrado en headers.

   c. **`generatePythonRequests(request: RequestState): string`**
      - Genera codigo Python usando `import requests`.
      - Usa `requests.get/post/put/patch/delete(url, headers=headers, json=data)`.
      - `json=` para content-type json, `data=` para otros.
      - Auth: usa `headers=` dict con Authorization, o `auth=('user', 'pass')` para basic.
      - Params como dict en `params=` cuando hay query params.

   d. **`generateNodeAxios(request: RequestState): string`**
      - Genera codigo Node.js con `const axios = require('axios')` o import.
      - Usa `axios({ method, url, headers, data })`.
      - Auth integrado en headers.

   e. **`generateSnippet(language: SnippetLanguage, request: RequestState): string`**
      - Funcion dispatcher que llama a la funcion correcta segun el lenguaje.
      - Single entry point para el componente UI.

   Cada funcion generadora:
   - Recibe un `RequestState` ya procesado (con o sin interpolacion, segun eleccion del usuario).
   - Filtra solo headers/params habilitados (`enabled === true && key !== ""`).
   - Resuelve auth llamando a `resolveAuthHeaders()` de `src/utils/auth.ts`.
   - Construye la URL completa con `buildUrlWithParams()` de `src/utils/url.ts`.
   - Inyecta API Key como param en la URL si `auth.apikey.addTo === "query"`.

### Archivos Afectados
- `src/types/snippet.ts` - CREAR
- `src/utils/snippet-generators.ts` - CREAR

### Buenas Practicas Aplicadas
- **SRP**: Cada funcion genera un solo lenguaje.
- **OCP**: Agregar un lenguaje = agregar una funcion + una entrada en SNIPPET_OPTIONS.
- **Funciones puras**: Sin side effects, entrada -> salida determinista, facil de testear.
- **DRY**: Las funciones comparten helpers internos para filtrar headers/params y resolver auth.

### Criterios de Completitud
- [ ] `generateCurl` genera comandos validos con method, headers, body, y auth.
- [ ] `generateJavaScriptFetch` genera codigo ES6+ ejecutable con async/await.
- [ ] `generatePythonRequests` genera codigo Python ejecutable con la libreria requests.
- [ ] `generateNodeAxios` genera codigo Node.js ejecutable con axios.
- [ ] `generateSnippet` despacha correctamente a cada generador.
- [ ] Todas las funciones filtran solo headers/params habilitados con key no vacia.
- [ ] Auth se resuelve correctamente para los 4 tipos (none, basic, bearer, apikey).
- [ ] API Key con `addTo: "query"` se inyecta en la URL, no en headers.
- [ ] Body solo se incluye para metodos POST/PUT/PATCH/DELETE con mode "raw".
- [ ] Caracteres especiales en body se escapan correctamente (comillas en cURL).

### Riesgos y Mitigaciones
- **Riesgo**: Edge cases en el escapado de caracteres especiales en body (comillas, newlines, backslashes).
  Mitigacion: Tests exhaustivos con bodies que contengan comillas simples, dobles, newlines, y caracteres unicode.
- **Riesgo**: URLs malformadas causan errores en buildUrlWithParams.
  Mitigacion: buildUrlWithParams ya maneja URLs sin protocolo y malformadas con fallback.

### Estimacion de Complejidad
**Media** - Cuatro funciones de generacion de strings con logica de formateo.

---

## Phase 2: Tests Unitarios para los Generadores

### Objetivo
Validar exhaustivamente la generacion de snippets para todos los lenguajes, metodos HTTP, tipos de auth, y edge cases.

### Prerrequisitos
Phase 1 completada.

### Tareas Detalladas

1. **Crear `src/utils/snippet-generators.test.ts`** con los siguientes grupos de tests:

   a. **cURL**:
      - GET simple sin headers ni body
      - POST con body JSON y Content-Type header
      - PUT con headers custom y basic auth
      - DELETE con bearer token
      - Request con API Key en header
      - Request con API Key en query param
      - Body con comillas simples (escapado)
      - URL con query params habilitados/deshabilitados
      - Request sin URL (edge case)

   b. **JavaScript fetch**:
      - GET simple (sin body en options)
      - POST con JSON body
      - Headers custom con auth bearer
      - Basic auth con header Authorization
      - Formato correcto de async/await

   c. **Python requests**:
      - GET con params
      - POST con json body
      - Basic auth con `auth=` tuple
      - Bearer con headers dict
      - API Key en header y query

   d. **Node.js axios**:
      - GET simple
      - POST con data
      - Headers con auth
      - Config object bien formado

   e. **generateSnippet dispatcher**:
      - Despacha correctamente a cada lenguaje
      - TypeScript narrowing funciona

2. **Usar factories existentes** de `src/test/factories.ts` para crear RequestState de prueba, o extenderlas si es necesario.

### Archivos Afectados
- `src/utils/snippet-generators.test.ts` - CREAR
- `src/test/factories.ts` - MODIFICAR (agregar factory helper si es necesario)

### Buenas Practicas Aplicadas
- **AAA (Arrange-Act-Assert)**: Cada test sigue el patron.
- **Test isolation**: Cada test es independiente, sin estado compartido.
- **Edge case coverage**: Comillas, URLs vacias, bodies vacios, auth none.

### Criterios de Completitud
- [ ] Minimo 4 tests por lenguaje (20+ tests total).
- [ ] Todos los tipos de auth cubiertos para al menos cURL y JavaScript fetch.
- [ ] Edge cases cubiertos: body vacio, URL vacia, headers deshabilitados.
- [ ] `bun run test` pasa sin errores.

### Riesgos y Mitigaciones
- **Riesgo**: Tests fragiles por comparacion exacta de strings.
  Mitigacion: Usar `toContain()` para partes criticas y `toMatch()` para patrones, en lugar de `toBe()` para el snippet completo.

### Estimacion de Complejidad
**Media** - Muchos casos de prueba pero logica simple.

---

## Phase 3: Signal de UI y Boton en RequestBar

### Objetivo
Agregar el punto de entrada para abrir el modal de snippets.

### Prerrequisitos
Ninguno (puede hacerse en paralelo con Phase 1-2, pero se recomienda despues).

### Tareas Detalladas

1. **Modificar `src/stores/ui-store.ts`**:
   - Agregar `export const showCodeSnippetModal = signal<boolean>(false);`
   - Sigue el patron exacto de `showSaveModal`.

2. **Modificar `src/components/request/RequestBar.tsx`**:
   - Importar `showCodeSnippetModal` de `ui-store`.
   - Agregar un boton "</> Code" en el grupo de acciones, entre "Save" y el boton Send/Cancel.
   - El boton debe:
     - Usar un icono SVG de "code" (`</>` o similar).
     - Tener `aria-label="Generate code snippet"`.
     - Tener `title="Generate code snippet"`.
     - Estar deshabilitado cuando la URL esta vacia (mismo patron que Save).
     - Al hacer click: `showCodeSnippetModal.value = true`.
   - Estilo: Mismo patron visual que el boton Save (text-pm-text-secondary, hover states).

### Archivos Afectados
- `src/stores/ui-store.ts` - MODIFICAR
- `src/components/request/RequestBar.tsx` - MODIFICAR

### Buenas Practicas Aplicadas
- **Consistencia**: El boton sigue el mismo patron visual y de comportamiento que el boton Save existente.
- **Accesibilidad**: aria-label, title, disabled state con cursor y opacity.
- **Separacion de concerns**: El boton solo cambia un signal; la logica del modal es independiente.

### Criterios de Completitud
- [ ] Signal `showCodeSnippetModal` exportado desde ui-store.
- [ ] Boton "</> Code" visible en RequestBar entre Save y Send.
- [ ] Boton deshabilitado cuando URL esta vacia.
- [ ] Click en el boton pone `showCodeSnippetModal.value = true`.
- [ ] Estilos consistentes con el boton Save existente.
- [ ] `bun astro check` pasa sin errores de tipos.

### Riesgos y Mitigaciones
- **Riesgo**: El RequestBar se vuelve muy ancho en pantallas pequenas con 3+ botones.
  Mitigacion: Los botones ya usan flex-wrap y responsive design (hidden md:inline para texto). El boton Code sigue el mismo patron: icono siempre visible, texto solo en md+.

### Estimacion de Complejidad
**Baja** - Dos cambios menores en archivos existentes.

---

## Phase 4: Componente CodeSnippetModal

### Objetivo
Crear el modal que muestra el snippet generado con selector de lenguaje, toggle de variables, preview del codigo, y boton de copiar.

### Prerrequisitos
Phase 1 (generadores) y Phase 3 (signal de UI).

### Tareas Detalladas

1. **Crear `src/components/workbench/CodeSnippetModal.tsx`** con:

   a. **Estado interno**:
      - `selectedLanguage: SnippetLanguage` (default: "curl") via `useSignal`.
      - `interpolateVars: boolean` (default: true) via `useSignal`.
      - `copied: boolean` (feedback visual) via `useSignal`.

   b. **Layout del modal** (siguiendo el patron de SaveToCollectionModal):
      - Overlay fijo `fixed inset-0 z-60 bg-black/50`.
      - Dialog card centrado con `max-w-2xl` (mas ancho que SaveModal por el codigo).
      - Cierre con Escape, click en overlay, y boton X.
      - Focus trap: focus en el primer elemento interactivo al abrir.
      - Restore focus al trigger button al cerrar.

   c. **Header del modal**:
      - Titulo "Code Snippet" con `aria-labelledby`.
      - Boton X de cierre en la esquina superior derecha.

   d. **Barra de controles**:
      - **Selector de lenguaje**: Usar el componente `Dropdown` existente con las opciones de SNIPPET_OPTIONS.
        Los items del dropdown: `{ label: "cURL", value: "curl" }`, `{ label: "JavaScript - fetch", value: "javascript-fetch" }`, etc.
      - **Toggle "Resolve variables"**: Solo visible si hay un entorno activo (`activeEnvironmentId.value !== null`).
        Checkbox o toggle simple. Cuando esta activo, el snippet usa valores interpolados.
      - **Boton "Copy"**: Icono de portapapeles + texto "Copy" / "Copied!".

   e. **Area de preview del codigo**:
      - Reutilizar el patron de `CodeViewer` (fondo pm-bg-tertiary, font mono, pre/code).
      - El snippet se genera llamando a `generateSnippet(language, processedRequest)`.
      - `processedRequest` es `interpolateRequest(requestState.value, activeVariablesMap.value)` si el toggle esta activo, o `requestState.value` si no.
      - Scroll horizontal para lineas largas (`overflow-x-auto`).
      - Seleccion de texto facil (`select-all` o `user-select: all` no es necesario, el usuario copia con el boton).

   f. **Logica de copiar**:
      - `navigator.clipboard.writeText(snippet)`.
      - Al copiar: cambiar texto del boton a "Copied!" y icono de checkmark durante 2 segundos.
      - Usar `setTimeout` para resetear el estado (limpiar con cleanup en useEffect).

   g. **Reactividad**:
      - El snippet se regenera reactivamente cuando cambia `requestState`, `selectedLanguage`, o `interpolateVars`.
      - Usar `useMemo` o calculo directo en render (el costo de generacion es negligible).

2. **Modificar `src/components/workbench/HttpWorkbench.tsx`**:
   - Importar y montar `<CodeSnippetModal />` junto a `<SaveToCollectionModal />`.

### Archivos Afectados
- `src/components/workbench/CodeSnippetModal.tsx` - CREAR
- `src/components/workbench/HttpWorkbench.tsx` - MODIFICAR

### Buenas Practicas Aplicadas
- **Reutilizacion**: Usa Dropdown existente para selector de lenguaje.
- **Patron modal establecido**: Sigue SaveToCollectionModal para overlay, focus, y keyboard.
- **Accesibilidad**: role="dialog", aria-modal, aria-labelledby, Escape para cerrar, focus management.
- **KISS**: Calculo del snippet directamente en render, sin store adicional.
- **Feedback visual**: El boton de copiar cambia estado para confirmar la accion.

### Criterios de Completitud
- [ ] Modal se abre al hacer click en el boton "</> Code".
- [ ] Modal se cierra con Escape, click en overlay, y boton X.
- [ ] Selector de lenguaje muestra 4 opciones y cambia el snippet al seleccionar.
- [ ] Toggle "Resolve variables" solo visible cuando hay entorno activo.
- [ ] Toggle funciona: snippet cambia entre valores interpolados y placeholders.
- [ ] Snippet se actualiza reactivamente si se cambia la request con el modal abierto.
- [ ] Boton "Copy" copia el snippet al portapapeles.
- [ ] Feedback visual "Copied!" por 2 segundos despues de copiar.
- [ ] Focus trap funciona correctamente.
- [ ] `bun astro check` y `bun build` pasan sin errores.

### Riesgos y Mitigaciones
- **Riesgo**: `navigator.clipboard.writeText()` falla en contextos inseguros (HTTP sin HTTPS).
  Mitigacion: Envolver en try/catch. En caso de error, mostrar un fallback: seleccionar todo el texto del pre para que el usuario copie manualmente. En desarrollo local (localhost) funciona sin HTTPS.
- **Riesgo**: El modal es muy grande en pantallas pequenas.
  Mitigacion: Usar `max-w-2xl` con `mx-4` para margen, y `max-h-[80vh] overflow-y-auto` para el contenido.

### Estimacion de Complejidad
**Media** - Componente UI con multiples interacciones, pero siguiendo patron existente.

---

## Phase 5: Integracion Final y Verificacion

### Objetivo
Asegurar que todo funciona correctamente end-to-end, que el build no tiene errores, y que el codigo cumple los estandares del proyecto.

### Prerrequisitos
Phases 1-4 completadas.

### Tareas Detalladas

1. **Verificar TypeScript**: Ejecutar `bun astro check` y corregir cualquier error de tipos.

2. **Verificar build**: Ejecutar `bun build` y confirmar que el build de produccion se genera sin errores.

3. **Ejecutar tests**: `bun run test` - todos los tests existentes + los nuevos deben pasar.

4. **Verificacion manual** (lista para el developer):
   - Abrir queryBox en el navegador.
   - Configurar una request GET con URL y params.
   - Click en "</> Code" -- el modal se abre.
   - Verificar snippet cURL.
   - Cambiar a JavaScript fetch -- el snippet cambia.
   - Cambiar a Python requests -- el snippet cambia.
   - Cambiar a Node.js axios -- el snippet cambia.
   - Click en "Copy" -- feedback "Copied!" y snippet en portapapeles.
   - Activar un entorno con variables.
   - Usar `{{variable}}` en la URL.
   - Toggle "Resolve variables" ON: snippet muestra valor real.
   - Toggle "Resolve variables" OFF: snippet muestra `{{variable}}`.
   - Agregar auth Bearer -- snippet incluye Authorization header.
   - Agregar body JSON a un POST -- snippet incluye el body.
   - Cerrar modal con Escape, overlay click, y boton X.
   - Verificar que el focus regresa al boton "</> Code".

### Archivos Afectados
- Ninguno nuevo. Solo verificacion.

### Buenas Practicas Aplicadas
- **Smoke testing**: Verificacion end-to-end de todos los flujos.
- **Build validation**: El build de produccion debe funcionar.

### Criterios de Completitud
- [ ] `bun astro check` pasa sin errores.
- [ ] `bun build` pasa sin errores.
- [ ] `bun run test` pasa sin errores (todos los tests).
- [ ] Verificacion manual de todos los flujos listados arriba.

### Riesgos y Mitigaciones
- Ninguno adicional a esta altura.

### Estimacion de Complejidad
**Baja** - Solo verificacion y correccion de errores menores.

---

## Resumen de Archivos

| Archivo | Accion | Phase |
|---|---|---|
| `src/types/snippet.ts` | CREAR | 1 |
| `src/utils/snippet-generators.ts` | CREAR | 1 |
| `src/utils/snippet-generators.test.ts` | CREAR | 2 |
| `src/test/factories.ts` | MODIFICAR (si necesario) | 2 |
| `src/stores/ui-store.ts` | MODIFICAR | 3 |
| `src/components/request/RequestBar.tsx` | MODIFICAR | 3 |
| `src/components/workbench/CodeSnippetModal.tsx` | CREAR | 4 |
| `src/components/workbench/HttpWorkbench.tsx` | MODIFICAR | 4 |

## Dependencias entre Phases

```
Phase 1 (Generadores) ──> Phase 2 (Tests)
     │
     └──> Phase 4 (Modal) ──> Phase 5 (Verificacion)
              │
Phase 3 (UI Signal + Boton) ─┘
```

- Phase 1 y Phase 3 pueden ejecutarse en paralelo.
- Phase 2 depende de Phase 1.
- Phase 4 depende de Phase 1 y Phase 3.
- Phase 5 depende de todas las anteriores.

## Estimacion Total

- **Phase 1**: Media
- **Phase 2**: Media
- **Phase 3**: Baja
- **Phase 4**: Media
- **Phase 5**: Baja

**Complejidad global**: Media. No hay nuevas dependencias externas, no hay cambios en el store pattern, y se reutilizan componentes y utilidades existentes.
