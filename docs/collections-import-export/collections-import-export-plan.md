# Collections Import/Export - Plan de Implementacion

## Resumen

Permitir exportar e importar colecciones y environments como archivos JSON con formato propio de queryBox, habilitando backup, restauracion y comparticion entre equipos.

## Contexto del Codebase

### Tipos existentes

- `Collection` (src/types/persistence.ts): `{ id, name, createdAt, requests: SavedRequest[] }`
- `SavedRequest` (src/types/persistence.ts): `{ id, name, method, url, savedAt, requestSnapshot: RequestState }`
- `RequestState` (src/types/http.ts): `{ method, url, params, headers, body, auth }`
- `Environment` (src/types/environment.ts): `{ id, name, variables: EnvironmentVariable[], createdAt }`
- `EnvironmentVariable` (src/types/environment.ts): `{ id, key, value, enabled }`

### Stores existentes

- `collection-store.ts`: signal `collections`, funciones `createCollection`, `deleteCollection`, `renameCollection`, `saveRequestToCollection`, `removeRequestFromCollection`
- `environment-store.ts`: signal `environments`, `activeEnvironmentId`, funciones CRUD para environments y variables
- `ui-store.ts`: signals `showSaveModal`, `showCodeSnippetModal`, `shouldFocusUrl`

### Componentes existentes

- `CollectionPanel.tsx`: Panel de sidebar con tree view de colecciones. Header con titulo "Collections" y boton "+" para crear.
- `EnvironmentPanel.tsx`: Panel de sidebar con tree view de environments. Header con titulo "Environments" y boton "+".
- `SaveToCollectionModal.tsx`: Patron de modal referencia (overlay, dialog, focus trap, Escape).
- `CodeSnippetModal.tsx`: Otro patron de modal referencia con header/body separados.

### Validacion existente

- `StorageService` (src/services/storage.ts) ya tiene type guards: `isCollection`, `isEnvironment`, `isEnvironmentVariable`, `isRequestState`, `isHistoryEntry`, `isTab`. Estas funciones validan campos esenciales y son reutilizables para validar datos importados.

### Patron de persistencia

- Todas las stores usan explicit-persist: mutate signal + `StorageService.setX()`.
- Keys: `qb:collections`, `qb:environments`, `qb:active-environment`.

---

## Formato de Exportacion queryBox

```json
{
  "format": "querybox",
  "version": 1,
  "exportedAt": 1708617600000,
  "type": "collections" | "environments",
  "data": Collection[] | Environment[]
}
```

El campo `type` determina si el archivo contiene colecciones o environments. El campo `version` permite migraciones futuras del schema. El campo `format` identifica el archivo como originario de queryBox.

---

## Phase 1: Tipos y utilidades de export/import

### Objetivo

Definir los tipos del formato de exportacion y las funciones puras de serialization/deserialization/validacion, sin UI.

### Prerrequisitos

Ninguno.

### Tareas detalladas

1. **Crear `src/types/export.ts`** con los tipos del formato de exportacion:

   ```typescript
   export interface ExportEnvelope<T extends "collections" | "environments"> {
     format: "querybox";
     version: 1;
     exportedAt: number;
     type: T;
     data: T extends "collections" ? Collection[] : Environment[];
   }

   export type CollectionExport = ExportEnvelope<"collections">;
   export type EnvironmentExport = ExportEnvelope<"environments">;
   export type ExportFile = CollectionExport | EnvironmentExport;

   export type ImportStrategy = "merge" | "replace";
   ```

2. **Crear `src/utils/export-import.ts`** con las funciones puras:

   - `exportCollections(collections: Collection[]): CollectionExport` -- Construye el envelope de exportacion para colecciones.
   - `exportEnvironments(environments: Environment[]): EnvironmentExport` -- Construye el envelope de exportacion para environments.
   - `downloadJson(data: ExportFile, filename: string): void` -- Crea un Blob con `JSON.stringify(data, null, 2)`, genera un Object URL, crea un `<a>` temporal con `download` attribute, lo clickea, y revoca el URL. Patron estandar del navegador para descargar archivos.
   - `parseImportFile(text: string): ExportFile` -- Parsea JSON, valida el envelope (format === "querybox", version === 1, type valido), y valida cada item del array `data` usando los type guards existentes de `StorageService` (expuestos como utilidades). Lanza `Error` con mensaje descriptivo si la validacion falla.
   - `readFileAsText(file: File): Promise<string>` -- Wrapper sobre `FileReader` que devuelve una Promise con el contenido del archivo como texto.

3. **Exponer type guards de StorageService como funciones reutilizables.** Actualmente `isCollection`, `isEnvironment`, etc. son funciones privadas dentro de `storage.ts`. Se deben exportar las que necesitamos para la validacion de imports:
   - Exportar `isCollection` y `isEnvironment` como named exports desde `storage.ts`, sin modificar su logica interna.
   - `parseImportFile` las importara directamente.

4. **Crear `src/utils/__tests__/export-import.test.ts`** con tests unitarios:
   - Test que `exportCollections` genera un envelope valido con todos los campos.
   - Test que `exportEnvironments` genera un envelope valido.
   - Test que `parseImportFile` acepta un JSON valido de colecciones.
   - Test que `parseImportFile` acepta un JSON valido de environments.
   - Test que `parseImportFile` lanza error para JSON invalido (no es objeto, falta `format`, `format` incorrecto, `version` incorrecta, `type` invalido, `data` no es array, items del array no pasan type guard).
   - Test que `parseImportFile` filtra items invalidos del array `data` y retorna solo los validos (comportamiento permisivo: importar lo que se pueda).

### Archivos afectados

- `src/types/export.ts` -- crear
- `src/utils/export-import.ts` -- crear
- `src/services/storage.ts` -- modificar (exportar type guards)
- `src/utils/__tests__/export-import.test.ts` -- crear

### Buenas practicas aplicadas

- **Separation of Concerns**: Logica de exportacion/importacion en utilidades puras, desacoplada de UI y stores.
- **Fail Fast**: `parseImportFile` valida estructura del envelope antes de procesar items individuales.
- **Open/Closed**: El campo `version` permite extender el formato sin romper importaciones de versiones anteriores.
- **DRY**: Reutilizar type guards existentes de `StorageService` en lugar de duplicarlos.

### Criterios de completitud

- [ ] Tipos `ExportEnvelope`, `CollectionExport`, `EnvironmentExport`, `ImportStrategy` definidos en `src/types/export.ts`.
- [ ] Funciones `exportCollections`, `exportEnvironments`, `downloadJson`, `parseImportFile`, `readFileAsText` implementadas en `src/utils/export-import.ts`.
- [ ] Type guards `isCollection`, `isEnvironment` exportados desde `src/services/storage.ts`.
- [ ] Tests unitarios pasando para todos los escenarios de validacion.
- [ ] `bun run test` pasa sin errores.
- [ ] `bun astro check` pasa sin errores.

### Riesgos y mitigaciones

- Riesgo: Al exportar los type guards desde storage.ts, podrian importarse desde otros modulos inesperadamente. Mitigacion: Son funciones puras sin side effects, exportarlas no afecta el comportamiento existente.
- Riesgo: `downloadJson` usa APIs del DOM (`createElement`, `URL.createObjectURL`) que no estan disponibles en tests. Mitigacion: La funcion es simple y declarativa, no necesita test unitario; se valida manualmente. Los tests cubren la logica de serializacion/validacion.

### Estimacion de complejidad

Baja -- Son tipos y funciones puras sin dependencias complejas.

---

## Phase 2: Funciones de merge/replace en los stores

### Objetivo

Agregar a los stores las funciones necesarias para importar datos con las dos estrategias (merge y replace).

### Prerrequisitos

Phase 1 completada.

### Tareas detalladas

1. **Agregar a `src/stores/collection-store.ts`:**

   - `importCollections(imported: Collection[], strategy: ImportStrategy): { added: number; skipped: number }` --
     - `"replace"`: Reemplaza `collections.value` completamente con `imported` (asignando nuevos IDs con `crypto.randomUUID()` para evitar conflictos).
     - `"merge"`: Agrega solo colecciones cuyo `name` no exista ya (case-insensitive). Las colecciones con nombres duplicados se omiten. Retorna conteo de agregadas/omitidas para feedback al usuario.
     - En ambos casos, llama a `StorageService.setCollections()` al final.

2. **Agregar a `src/stores/environment-store.ts`:**

   - `importEnvironments(imported: Environment[], strategy: ImportStrategy): { added: number; skipped: number }` --
     - `"replace"`: Reemplaza `environments.value` completamente con `imported` (nuevos IDs). Si el environment activo fue eliminado, resetea `activeEnvironmentId` a null.
     - `"merge"`: Agrega solo environments cuyo `name` no exista ya (case-insensitive). Los environments con nombres duplicados se omiten.
     - En ambos casos, llama a `StorageService.setEnvironments()` al final.

3. **Crear tests:**
   - `src/stores/__tests__/collection-store-import.test.ts` -- Tests para `importCollections` con ambas estrategias, validando conteos, que los IDs se regeneran en replace, y que merge es case-insensitive.
   - `src/stores/__tests__/environment-store-import.test.ts` -- Tests para `importEnvironments` con ambas estrategias, incluyendo el reset de `activeEnvironmentId` cuando se usa replace.

### Archivos afectados

- `src/stores/collection-store.ts` -- modificar (agregar `importCollections`)
- `src/stores/environment-store.ts` -- modificar (agregar `importEnvironments`)
- `src/stores/__tests__/collection-store-import.test.ts` -- crear
- `src/stores/__tests__/environment-store-import.test.ts` -- crear

### Buenas practicas aplicadas

- **Single Responsibility**: Cada store maneja solo su propia logica de importacion.
- **Immutability**: Los datos importados se clonan con nuevos IDs para evitar conflictos y mutacion accidental.
- **Principle of Least Surprise**: Merge no sobreescribe datos existentes; replace es destructivo pero explicitamente solicitado por el usuario.

### Criterios de completitud

- [ ] `importCollections` implementada con merge y replace.
- [ ] `importEnvironments` implementada con merge y replace.
- [ ] Tests unitarios pasando para ambas estrategias en ambos stores.
- [ ] `bun run test` pasa sin errores.
- [ ] `bun astro check` pasa sin errores.

### Riesgos y mitigaciones

- Riesgo: Replace destruye datos existentes sin posibilidad de undo. Mitigacion: El modal de confirmacion (Phase 3) advertira al usuario antes de ejecutar replace. Ademas, el usuario puede exportar antes de importar.
- Riesgo: La deteccion de duplicados por nombre (case-insensitive) podria no ser la heuristica correcta en todos los casos. Mitigacion: Es la heuristica mas intuitiva; la alternativa (comparar por ID) fallaria siempre porque regeneramos IDs en la importacion.

### Estimacion de complejidad

Baja -- Logica directa de array manipulation.

---

## Phase 3: Modal de Import

### Objetivo

Crear el componente modal que permite al usuario seleccionar un archivo JSON, elegir estrategia (merge/replace), y confirmar la importacion con feedback de resultado.

### Prerrequisitos

Phase 1 y Phase 2 completadas.

### Tareas detalladas

1. **Agregar signals de UI en `src/stores/ui-store.ts`:**

   - `showImportModal = signal<ImportModalState | null>(null)` donde:
     ```typescript
     type ImportModalState = {
       target: "collections" | "environments";
     };
     ```
   - Cuando es `null`, el modal esta cerrado. Cuando tiene valor, indica que tipo de datos se esta importando.

2. **Crear `src/components/shared/ImportModal.tsx`:**

   Componente modal reutilizable que sigue el patron exacto de `SaveToCollectionModal.tsx` y `CodeSnippetModal.tsx`:

   - **Overlay**: `fixed inset-0 z-60`, click-outside cierra, Escape cierra.
   - **Dialog card**: `role="dialog"`, `aria-modal="true"`, con `aria-labelledby`.
   - **Focus management**: Guarda `document.activeElement` al abrir, restaura al cerrar. Auto-focus en el boton de seleccion de archivo.
   - **Contenido del modal:**
     - Titulo: "Import Collections" o "Import Environments" segun `target`.
     - Zona de seleccion de archivo: Un boton estilizado "Select File" que activa un `<input type="file" accept=".json" />` oculto. Al seleccionar un archivo, muestra el nombre del archivo seleccionado.
     - Selector de estrategia: Dos radio buttons con labels descriptivos:
       - "Merge -- Add new items, keep existing ones" (seleccionado por defecto).
       - "Replace -- Remove all existing items and import these".
       - El radio "Replace" muestra un texto de advertencia en `text-pm-status-error` cuando esta seleccionado: "This will permanently delete all existing [collections/environments]."
     - Resumen de contenido del archivo: Despues de parsear exitosamente, mostrar "Found X collections with Y total requests" o "Found X environments" segun el tipo.
     - Mensaje de error: Si `parseImportFile` lanza error, mostrar el mensaje en `text-pm-status-error` con role="alert".
   - **Botones de accion:**
     - "Cancel" -- cierra el modal.
     - "Import" -- deshabilitado hasta que se haya seleccionado y parseado exitosamente un archivo. Al clickear, ejecuta la importacion llamando a `importCollections` o `importEnvironments` del store correspondiente, y cierra el modal.
   - **Feedback post-importacion:** Tras importar exitosamente, se puede usar un estado local breve (no es necesario un sistema de toast complejo). El modal se cierra y los datos aparecen inmediatamente en el panel lateral gracias a la reactividad de los signals.

   **Estado interno del componente (useState):**
   - `selectedFile: File | null`
   - `parseResult: ExportFile | null`
   - `parseError: string`
   - `strategy: ImportStrategy` (default: "merge")
   - `importResult: { added: number; skipped: number } | null`

   **Flujo de usuario:**
   1. Usuario clickea boton de importar en CollectionPanel o EnvironmentPanel.
   2. Modal se abre con `target` correcto.
   3. Usuario selecciona archivo .json.
   4. Archivo se lee y parsea inmediatamente (`readFileAsText` + `parseImportFile`).
   5. Si falla, muestra error. Si OK, muestra resumen.
   6. Usuario elige estrategia.
   7. Usuario clickea "Import".
   8. Store se actualiza, modal se cierra.

3. **Validacion cruzada de tipo:** Si el usuario abre el modal de import para colecciones pero selecciona un archivo de environments (o viceversa), mostrar un error claro: "This file contains [environments], but you are importing [collections]." Esto se logra comparando `parseResult.type` con `target`.

### Archivos afectados

- `src/stores/ui-store.ts` -- modificar (agregar `showImportModal` signal y tipo `ImportModalState`)
- `src/components/shared/ImportModal.tsx` -- crear

### Buenas practicas aplicadas

- **DRY**: Un unico modal reutilizable para ambos tipos (colecciones y environments), parametrizado por `target`.
- **Fail Fast**: Parseo y validacion inmediatos al seleccionar archivo, antes de permitir la importacion.
- **Accessibility**: Focus management, aria-modal, aria-labelledby, role="alert" para errores, keyboard navigation (Escape cierra).
- **Principle of Least Surprise**: Merge es el default (no destructivo). Replace requiere seleccion explicita y muestra advertencia.

### Criterios de completitud

- [ ] Signal `showImportModal` agregada a `ui-store.ts`.
- [ ] `ImportModal.tsx` creado siguiendo patrones de modales existentes.
- [ ] Seleccion de archivo funcional con input file oculto.
- [ ] Parseo y validacion inmediatos con feedback de error o resumen.
- [ ] Validacion cruzada de tipo (collections vs environments).
- [ ] Selector de estrategia merge/replace con advertencia visual en replace.
- [ ] Boton Import deshabilitado hasta tener archivo valido parseado.
- [ ] Importacion ejecuta store function correcta y cierra modal.
- [ ] Focus management correcto (auto-focus al abrir, restaurar al cerrar).
- [ ] Escape y click-outside cierran el modal.
- [ ] `bun astro check` pasa sin errores.

### Riesgos y mitigaciones

- Riesgo: Archivos muy grandes podrian bloquear el hilo principal durante parseo. Mitigacion: Para la v1, `JSON.parse` sincrono es aceptable dado que las colecciones/environments tipicos son <1MB. Se podria migrar a Web Worker en el futuro si se detectan problemas.
- Riesgo: El `<input type="file">` tiene estilo nativo inconsistente entre navegadores. Mitigacion: Se oculta con `class="hidden"` y se activa desde un boton estilizado.

### Estimacion de complejidad

Media -- Componente con multiples estados, validacion, y manejo de archivos.

---

## Phase 4: Botones Export/Import en los paneles de sidebar

### Objetivo

Integrar los botones de Export e Import en los headers de `CollectionPanel` y `EnvironmentPanel`, conectando la UI con las utilidades y el modal.

### Prerrequisitos

Phase 1, Phase 2 y Phase 3 completadas.

### Tareas detalladas

1. **Modificar `src/components/sidebar/CollectionPanel.tsx`:**

   - Agregar dos botones icono en el header (junto al boton "+" existente):
     - Boton **Export** (icono de download/flecha abajo): Llama a `downloadJson(exportCollections(collections.value), "querybox-collections.json")`. Deshabilitado si no hay colecciones (`collections.value.length === 0`).
     - Boton **Import** (icono de upload/flecha arriba): Abre el modal seteando `showImportModal.value = { target: "collections" }`.
   - Los botones usan las mismas clases que el boton "+" existente: `text-xs text-pm-text-secondary hover:text-pm-text-primary transition-colors p-1 rounded hover:bg-pm-bg-elevated`.
   - Orden de los botones en el header: Import | Export | + (Create).
   - Cada boton tiene `aria-label` y `title` descriptivos.

2. **Modificar `src/components/sidebar/EnvironmentPanel.tsx`:**

   - Misma estructura que CollectionPanel: dos botones Export e Import en el header.
   - Export llama a `downloadJson(exportEnvironments(environments.value), "querybox-environments.json")`.
   - Import abre `showImportModal.value = { target: "environments" }`.

3. **Montar `ImportModal` en el arbol de componentes.**

   El `ImportModal` necesita montarse dentro de una isla Preact que ya este hidratada. Dado que `CollectionPanel` y `EnvironmentPanel` son ambos islands independientes, y el modal necesita ser accesible desde ambos, la mejor opcion es:

   - Montar `<ImportModal />` dentro de `CollectionPanel.tsx` (se renderiza condicionalmente cuando `showImportModal.value?.target === "collections"`).
   - Montar `<ImportModal />` dentro de `EnvironmentPanel.tsx` (se renderiza condicionalmente cuando `showImportModal.value?.target === "environments"`).
   - Cada panel solo renderiza el modal cuando le corresponde por `target`. Como el modal usa `fixed inset-0`, se renderiza sobre todo el viewport independientemente de donde este montado.

4. **Iconos SVG a utilizar:**

   - **Export (download):**
     ```html
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
       <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
       <polyline points="7 10 12 15 17 10" />
       <line x1="12" y1="15" x2="12" y2="3" />
     </svg>
     ```
   - **Import (upload):**
     ```html
     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
       <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
       <polyline points="17 8 12 3 7 8" />
       <line x1="12" y1="3" x2="12" y2="15" />
     </svg>
     ```

### Archivos afectados

- `src/components/sidebar/CollectionPanel.tsx` -- modificar (agregar botones + montar ImportModal)
- `src/components/sidebar/EnvironmentPanel.tsx` -- modificar (agregar botones + montar ImportModal)

### Buenas practicas aplicadas

- **Consistency**: Los botones siguen exactamente el mismo estilo visual y posicionamiento que el boton "+" existente.
- **Accessibility**: `aria-label` y `title` en cada boton. Botones deshabilitados con `disabled` y `opacity-50`.
- **KISS**: Export es una accion directa (un click, descarga inmediata). Import abre modal para confirmacion.

### Criterios de completitud

- [ ] Botones Export e Import visibles en el header de CollectionPanel.
- [ ] Botones Export e Import visibles en el header de EnvironmentPanel.
- [ ] Export descarga archivo JSON correcto con nombre descriptivo.
- [ ] Export deshabilitado cuando no hay datos.
- [ ] Import abre el modal con el `target` correcto.
- [ ] ImportModal montado y funcional desde ambos paneles.
- [ ] `bun astro check` pasa sin errores.
- [ ] `bun build` pasa sin errores.

### Riesgos y mitigaciones

- Riesgo: Demasiados botones en el header del panel podrian verse apretados en la sidebar (w-80 = 320px). Mitigacion: Los botones son de 24x24px (p-1 + w-4 h-4 icon), tres botones ocupan ~96px, mas el titulo queda ~224px disponibles. Es suficiente.
- Riesgo: Montar ImportModal en dos lugares podria causar conflictos si ambos se abren simultaneamente. Mitigacion: Solo uno puede estar activo a la vez porque `showImportModal.value.target` es un unico valor.

### Estimacion de complejidad

Baja -- Integracion de componentes existentes con wiring minimo.

---

## Phase 5: Pruebas de integracion y verificacion final

### Objetivo

Verificar que toda la feature funciona end-to-end y que no se han introducido regresiones.

### Prerrequisitos

Phases 1-4 completadas.

### Tareas detalladas

1. **Ejecutar la suite de tests completa:**
   - `bun run test` -- Todos los tests existentes + los nuevos deben pasar.
   - `bun run test:coverage` -- Verificar que la cobertura de utils y stores se mantiene.

2. **Ejecutar verificaciones de tipos y build:**
   - `bun astro check` -- Sin errores de TypeScript.
   - `bun build` -- Build de produccion exitoso sin warnings criticos.

3. **Verificacion manual (checklist para el reviewer):**
   - [ ] Crear 2-3 colecciones con requests variados (diferentes metodos, headers, auth, body).
   - [ ] Exportar colecciones: verificar que se descarga un archivo .json con estructura correcta.
   - [ ] Abrir el archivo JSON exportado y verificar que contiene todas las colecciones y requests.
   - [ ] Borrar todas las colecciones del localStorage.
   - [ ] Importar el archivo con estrategia "replace": verificar que las colecciones aparecen en el sidebar.
   - [ ] Crear una coleccion nueva, importar el mismo archivo con estrategia "merge": verificar que no se duplican las existentes y solo se agregan las nuevas.
   - [ ] Repetir flujo completo para environments.
   - [ ] Intentar importar un archivo JSON invalido: verificar mensaje de error claro.
   - [ ] Intentar importar un archivo de environments cuando se espera colecciones: verificar error de tipo cruzado.
   - [ ] Verificar que el boton Export esta deshabilitado cuando no hay datos.
   - [ ] Verificar accesibilidad del modal con keyboard: Tab navega entre elementos, Escape cierra, Enter activa botones.

### Archivos afectados

Ninguno -- solo ejecucion de tests y verificacion.

### Criterios de completitud

- [ ] `bun run test` pasa al 100%.
- [ ] `bun astro check` sin errores.
- [ ] `bun build` exitoso.
- [ ] Checklist de verificacion manual completada.

### Riesgos y mitigaciones

- Riesgo: Tests de stores que usan `vi.resetModules()` podrian ser fragiles con las nuevas funciones de import. Mitigacion: Los nuevos tests siguen el mismo patron establecido en tests existentes del proyecto.

### Estimacion de complejidad

Baja -- Solo ejecucion y verificacion.

---

## Resumen de archivos

| Archivo | Accion | Phase |
|---------|--------|-------|
| `src/types/export.ts` | Crear | 1 |
| `src/utils/export-import.ts` | Crear | 1 |
| `src/services/storage.ts` | Modificar (exportar type guards) | 1 |
| `src/utils/__tests__/export-import.test.ts` | Crear | 1 |
| `src/stores/collection-store.ts` | Modificar (agregar `importCollections`) | 2 |
| `src/stores/environment-store.ts` | Modificar (agregar `importEnvironments`) | 2 |
| `src/stores/__tests__/collection-store-import.test.ts` | Crear | 2 |
| `src/stores/__tests__/environment-store-import.test.ts` | Crear | 2 |
| `src/stores/ui-store.ts` | Modificar (agregar `showImportModal`) | 3 |
| `src/components/shared/ImportModal.tsx` | Crear | 3 |
| `src/components/sidebar/CollectionPanel.tsx` | Modificar (botones + modal mount) | 4 |
| `src/components/sidebar/EnvironmentPanel.tsx` | Modificar (botones + modal mount) | 4 |

**Total: 7 archivos nuevos, 5 archivos modificados.**

---

## Decisiones de diseno

### Por que un unico ImportModal reutilizable

Alternativa considerada: Dos modales separados (`ImportCollectionsModal`, `ImportEnvironmentsModal`). Descartada porque el 95% del codigo seria identico (seleccion de archivo, parseo, estrategia, botones). Un unico componente parametrizado por `target` es mas DRY y mas facil de mantener.

### Por que merge usa comparacion por nombre (no por ID)

Al importar, todos los IDs se regeneran con `crypto.randomUUID()`. Comparar por ID original seria inutil porque siempre serian diferentes. El nombre es la unica heuristica estable para detectar duplicados. La comparacion es case-insensitive para ser mas permisiva.

### Por que no incluir Postman import en esta fase

La especificacion indica que la compatibilidad con Postman es para "fase posterior". Incluirlo ahora violaria YAGNI y expandiria el scope innecesariamente. La arquitectura actual (con `parseImportFile` centralizado y `version` en el envelope) permite agregar un parser de Postman en el futuro sin cambios estructurales.

### Por que no usar toast notifications

El proyecto no tiene un sistema de notifications/toast. Implementar uno solo para esta feature seria scope creep. El feedback visual inmediato (los datos aparecen en el sidebar por reactividad de signals) es suficiente para la v1. Se puede agregar un sistema de toasts como feature independiente en el futuro.

### Por que regenerar IDs en replace

Si el usuario importa el mismo archivo dos veces con "replace", los IDs deben ser unicos para evitar conflictos con otras partes del sistema que puedan referenciar IDs (ej: tabs que tienen requests cargados de colecciones). Regenerar IDs es la opcion mas segura.
