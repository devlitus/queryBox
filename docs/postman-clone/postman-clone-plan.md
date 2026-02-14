# Plan de Implementacion: Clon Visual de Postman (queryBox)

## Resumen Ejecutivo

Este plan detalla la construccion de un clon visual de la interfaz de Postman como aplicacion web estatica usando Astro 5, TypeScript strict y Tailwind CSS v4. El alcance es exclusivamente UI/UX -- sin funcionalidad backend, sin envio real de peticiones HTTP, sin persistencia de datos. Se trata de una replica fiel del layout, la estructura de componentes y el sistema visual de Postman.

---

## Analisis del Estado Actual del Proyecto

### Estructura existente

```
D:\work\queryBox\
  astro.config.mjs      -> Astro 5 + Tailwind CSS v4 via @tailwindcss/vite
  package.json           -> astro ^5.17.1, tailwindcss ^4.1.18, bun
  tsconfig.json          -> extends astro/tsconfigs/strict
  src/
    assets/              -> astro.svg, background.svg
    components/          -> (vacio)
    layouts/Layout.astro -> Layout basico con <slot />
    pages/index.astro    -> "Hello world!" con Layout
    styles/global.css    -> @import "tailwindcss"
  public/
    favicon.ico, favicon.svg
```

### Dependencias actuales

- `astro@^5.17.1`
- `tailwindcss@^4.1.18` (v4 - configuracion via CSS, no JS config file)
- `@tailwindcss/vite@^4.1.18`
- `@types/bun@^1.3.9` (devDependency)

### Observaciones clave

1. **Tailwind CSS v4**: Usa `@import "tailwindcss"` y `@theme` directive para personalizar. No hay `tailwind.config.js`.
2. **Proyecto limpio**: Solo el scaffolding basico de Astro. No hay componentes, no hay rutas adicionales.
3. **TypeScript strict**: Habilitado via `astro/tsconfigs/strict`.
4. **Sin framework UI**: No hay React, Vue, ni Svelte instalados. Solo componentes `.astro`.

---

## Arquitectura de la Interfaz de Postman

### Anatomia del Layout Principal

Basado en el analisis de la documentacion oficial de Postman (<https://learning.postman.com/docs/getting-started/basics/navigating-postman>):

```
+------------------------------------------------------------------+
|                         HEADER BAR                                |
|  [Logo] [Home] [Workspaces v] [API Network] [Search...] [Avatar] |
+--------+---------------------------------------------------------+
|        |                    TAB BAR                               |
|        |  [+ New Tab] [GET /users] [POST /login] [...]           |
|        +-----+---------------------------------------------------+
|        |     |            REQUEST PANEL                           |
|  S     |     | [GET v] [https://api.example.com/users  ] [Send]  |
|  I     |     |                                                    |
|  D     |     | [Params] [Auth] [Headers] [Body] [Pre-req] [Tests]|
|  E     |     | +----------------------------------------------+  |
|  B     |     | | Key        | Value       | Description       |  |
|  A     |     | | page       | 1           | Page number       |  |
|  R     |     | | limit      | 10          | Items per page    |  |
|        |     | +----------------------------------------------+  |
|        |     +---------------------------------------------------+
| Colls  |     |           RESPONSE PANEL                          |
| Envs   |     | [Body] [Cookies] [Headers] [Test Results]         |
| Hist   |     | Status: 200 OK | Time: 245ms | Size: 1.2 KB      |
|        |     | +----------------------------------------------+  |
|        |     | | {                                             |  |
|        |     | |   "users": [                                 |  |
|        |     | |     { "id": 1, "name": "John" }              |  |
|        |     | |   ]                                          |  |
|        |     | | }                                             |  |
|        |     | +----------------------------------------------+  |
+--------+-----+---------------------------------------------------+
|                          FOOTER BAR                               |
|  [Find/Replace] [Console]      [Runner] [Trash] [Sidebar Toggle] |
+------------------------------------------------------------------+
```

### Componentes principales identificados

1. **Header Bar**: Logo, navegacion, busqueda, configuracion, avatar
2. **Sidebar**: Colecciones (arbol), Entornos, Historial (lista temporal)
3. **Tab Bar**: Pestanas de requests abiertos con metodo+nombre
4. **Request Bar**: Selector de metodo HTTP + campo URL + boton Send
5. **Request Config Tabs**: Params, Authorization, Headers, Body, Pre-request Script, Tests, Settings
6. **Request Config Panel**: Tabla clave-valor (Params/Headers), editor (Body), formulario (Auth)
7. **Response Panel**: Tabs de Body/Cookies/Headers/Test Results + barra de status
8. **Response Body Viewer**: JSON formateado con syntax highlighting
9. **Footer Bar**: Consola, runner, controles de sidebar

---

## Decision Tecnica: Interactividad en Astro

### Alternativas evaluadas

| Alternativa | Pros | Contras | Veredicto |
|---|---|---|---|
| **A) Solo componentes .astro + `<script>` tags** | Cero dependencias extra, rendimiento optimo, JS minimo | Manejo manual del DOM, mas verboso para tabs/toggles | **SELECCIONADA** |
| **B) Integrar React + shadcn/ui** | Componentes preconstruidos, estado reactivo | Agrega ~40KB+ de runtime, requiere `bun astro add react` | Descartada |
| **C) Integrar Svelte** | Ligero, reactivo, buena DX | Dependencia adicional, sobreingenieria para UI estatica | Descartada |

### Justificacion

Este es un clon **visual** sin funcionalidad real. No hay formularios que enviar, no hay estado complejo que gestionar, no hay API calls. La interactividad se limita a:

- Cambiar tabs activos (CSS `:target` o `<script>` con `classList.toggle`)
- Expandir/colapsar sidebar (CSS + `<script>`)
- Seleccionar items en listas (visual feedback)
- Toggle de paneles (CSS + `<script>`)

Astro con `<script>` tags nativos es suficiente y optimo. Los scripts se procesan automaticamente con TypeScript, se bundlean, y se deduplicand. Ademas, se pueden encapsular en **Custom Elements** (Web Components) para aislar el comportamiento por componente.

**Patron recomendado**: Custom Elements dentro de componentes `.astro` para manejar interactividad local (tabs, toggles, collapses) sin necesidad de framework externo.

---

## Paleta de Colores y Design Tokens

### Colores de Postman (Dark Theme)

Basado en la inspeccion visual y la documentacion de marca de Postman (<https://brandpalettes.com/postman-colors/>):

```
Tema oscuro (principal):
  --pm-bg-primary:       #1C1C1C    (fondo principal del workspace)
  --pm-bg-secondary:     #212121    (fondo de paneles, sidebar)
  --pm-bg-tertiary:      #2C2C2C    (fondo de inputs, campos)
  --pm-bg-elevated:      #333333    (fondo de tabs activos, hover states)
  --pm-bg-header:        #1A1A1A    (fondo de header y footer)

Bordes:
  --pm-border-default:   #3D3D3D    (bordes de paneles y separadores)
  --pm-border-subtle:    #2E2E2E    (bordes sutiles entre secciones)

Texto:
  --pm-text-primary:     #E0E0E0    (texto principal)
  --pm-text-secondary:   #A0A0A0    (texto secundario, labels)
  --pm-text-tertiary:    #6B6B6B    (texto deshabilitado, placeholders)

Marca:
  --pm-accent:           #FF6C37    (naranja Postman - botones, acciones)
  --pm-accent-hover:     #E85D2A    (hover del acento)

Metodos HTTP:
  --pm-method-get:       #61AFFE    (GET - azul)
  --pm-method-post:      #49CC90    (POST - verde)
  --pm-method-put:       #FCA130    (PUT - amarillo/naranja)
  --pm-method-patch:     #50E3C2    (PATCH - turquesa)
  --pm-method-delete:    #F93E3E    (DELETE - rojo)
  --pm-method-head:      #9012FE    (HEAD - purpura)
  --pm-method-options:   #0D5AA7    (OPTIONS - azul oscuro)

Status de respuesta:
  --pm-status-success:   #49CC90    (2xx - verde)
  --pm-status-redirect:  #FCA130    (3xx - amarillo)
  --pm-status-client-err:#F93E3E    (4xx - rojo)
  --pm-status-server-err:#F93E3E    (5xx - rojo)

Syntax highlighting (JSON):
  --pm-syntax-key:       #F97583    (claves JSON - rosa/rojo)
  --pm-syntax-string:    #9ECBFF    (strings - azul claro)
  --pm-syntax-number:    #79B8FF    (numeros - azul)
  --pm-syntax-boolean:   #FFAB70    (booleans - naranja)
  --pm-syntax-null:      #B392F0    (null - purpura)
  --pm-syntax-bracket:   #E0E0E0    (brackets, comas)
```

### Implementacion en Tailwind CSS v4

Estos tokens se definen usando una combinacion de `:root` para variables CSS semanticas y `@theme` para las que necesitan generar utility classes:

```css
/* En src/styles/global.css */
@import "tailwindcss";

@theme {
  --color-pm-bg-primary: #1C1C1C;
  --color-pm-bg-secondary: #212121;
  --color-pm-bg-tertiary: #2C2C2C;
  --color-pm-bg-elevated: #333333;
  --color-pm-bg-header: #1A1A1A;
  --color-pm-border: #3D3D3D;
  --color-pm-border-subtle: #2E2E2E;
  --color-pm-text-primary: #E0E0E0;
  --color-pm-text-secondary: #A0A0A0;
  --color-pm-text-tertiary: #6B6B6B;
  --color-pm-accent: #FF6C37;
  --color-pm-accent-hover: #E85D2A;
  --color-pm-method-get: #61AFFE;
  --color-pm-method-post: #49CC90;
  --color-pm-method-put: #FCA130;
  --color-pm-method-patch: #50E3C2;
  --color-pm-method-delete: #F93E3E;
  --color-pm-method-head: #9012FE;
  --color-pm-method-options: #0D5AA7;
  --color-pm-status-success: #49CC90;
  --color-pm-status-redirect: #FCA130;
  --color-pm-status-error: #F93E3E;
  --color-pm-syntax-key: #F97583;
  --color-pm-syntax-string: #9ECBFF;
  --color-pm-syntax-number: #79B8FF;
  --color-pm-syntax-boolean: #FFAB70;
  --color-pm-syntax-null: #B392F0;
}
```

Esto genera utility classes como `bg-pm-bg-primary`, `text-pm-accent`, `border-pm-border`, etc.

### Tipografia

```css
@theme {
  --font-pm-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-pm-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
}
```

- **Inter**: Fuente principal para la interfaz (o system-ui como fallback)
- **JetBrains Mono / Fira Code**: Para editores de codigo y JSON viewer

---

## Estructura de Archivos Propuesta

```
src/
  assets/
    icons/                          # Iconos SVG inline
      chevron-down.svg
      chevron-right.svg
      close.svg
      collection.svg
      folder.svg
      history.svg
      environment.svg
      plus.svg
      search.svg
      send.svg
      settings.svg
      trash.svg
  components/
    header/
      HeaderBar.astro               # Barra superior principal
      SearchInput.astro             # Campo de busqueda global
      WorkspaceSelector.astro       # Dropdown de workspaces
    sidebar/
      Sidebar.astro                 # Contenedor del sidebar
      SidebarTabs.astro             # Tabs: Collections, Environments, History
      CollectionTree.astro          # Arbol de colecciones con folders y requests
      CollectionItem.astro          # Item individual de coleccion
      FolderItem.astro              # Carpeta dentro de coleccion
      RequestItem.astro             # Request individual en el arbol
      EnvironmentList.astro         # Lista de entornos
      EnvironmentItem.astro         # Item de entorno individual
      HistoryList.astro             # Lista de historial
      HistoryItem.astro             # Item de historial individual
    workbench/
      Workbench.astro               # Contenedor del area de trabajo principal
      TabBar.astro                  # Barra de pestanas de requests abiertos
      TabItem.astro                 # Pestana individual
    request/
      RequestPanel.astro            # Contenedor del panel de request
      RequestBar.astro              # [Metodo v] [URL input] [Send]
      MethodSelector.astro          # Dropdown del metodo HTTP
      RequestConfigTabs.astro       # Tabs: Params, Auth, Headers, Body...
      ParamsTable.astro             # Tabla clave-valor para params
      AuthPanel.astro               # Panel de autorizacion (visual)
      HeadersTable.astro            # Tabla clave-valor para headers
      BodyEditor.astro              # Editor del body (visual con tabs raw/form)
      PreRequestPanel.astro         # Panel de pre-request scripts (visual)
      TestsPanel.astro              # Panel de tests (visual)
      SettingsPanel.astro           # Panel de settings del request
    response/
      ResponsePanel.astro           # Contenedor del panel de respuesta
      ResponseStatusBar.astro       # Status: 200 OK | Time | Size
      ResponseTabs.astro            # Tabs: Body, Cookies, Headers, Test Results
      ResponseBody.astro            # Visor de JSON con syntax highlighting
      ResponseHeaders.astro         # Tabla de headers de respuesta
      ResponseCookies.astro         # Tabla de cookies
      ResponseTestResults.astro     # Resultados de tests (visual)
    shared/
      KeyValueTable.astro           # Tabla reutilizable clave-valor-descripcion
      KeyValueRow.astro             # Fila individual de la tabla
      CodeViewer.astro              # Visor de codigo con syntax highlighting
      Badge.astro                   # Badge para metodos HTTP y status codes
      IconButton.astro              # Boton con icono
      Tooltip.astro                 # Tooltip basico
      Dropdown.astro                # Dropdown menu generico
      Toggle.astro                  # Toggle/checkbox estilizado
    footer/
      FooterBar.astro               # Barra inferior
  layouts/
    Layout.astro                    # (modificar) Layout base con theme tokens
    AppLayout.astro                 # Layout de la aplicacion con grid principal
  pages/
    index.astro                     # (modificar) Pagina principal del clon
  styles/
    global.css                      # (modificar) Tokens, @theme, fuentes, reset
  scripts/
    tabs.ts                         # Logica de cambio de tabs (Custom Element)
    sidebar.ts                      # Logica de expand/collapse sidebar
    dropdown.ts                     # Logica de dropdown menus
    tree.ts                         # Logica de expand/collapse de arbol
  data/
    mock-collections.ts             # Datos de ejemplo para colecciones
    mock-environments.ts            # Datos de ejemplo para entornos
    mock-history.ts                 # Datos de ejemplo para historial
    mock-request.ts                 # Datos de ejemplo para un request completo
    mock-response.ts                # Datos de ejemplo para una respuesta
```

### Total de archivos a crear: ~50 archivos

- **Componentes**: ~38 archivos `.astro`
- **Scripts**: 4 archivos `.ts`
- **Datos mock**: 5 archivos `.ts`
- **Layouts**: 1 nuevo, 1 modificado
- **Paginas**: 1 modificado
- **Estilos**: 1 modificado

---

## Fases de Implementacion

---

### Fase 1: Fundacion - Design Tokens, Layout Base y Estructura

#### Objetivo

Establecer la base visual del proyecto: design tokens en Tailwind CSS v4, layout principal de la aplicacion (grid de 3 columnas), fuentes, y los contenedores vacios de las areas principales.

#### Prerrequisitos

- Proyecto Astro 5 funcional (ya disponible)
- Tailwind CSS v4 configurado (ya disponible)

#### Tareas Detalladas

1. **Modificar `src/styles/global.css`**
   - Agregar `@theme` block con todos los design tokens de color, tipografia y spacing definidos en la seccion "Paleta de Colores"
   - Agregar `@font-face` o `<link>` para Inter y JetBrains Mono (via Google Fonts CDN, cargadas en Layout)
   - Definir estilos base del `body`: `bg-pm-bg-primary`, `text-pm-text-primary`, `font-pm-sans`
   - Agregar CSS utilities custom para scrollbars estilizadas (webkit-scrollbar)

2. **Modificar `src/layouts/Layout.astro`**
   - Actualizar `<title>` a "queryBox"
   - Agregar `<link>` para fuentes de Google Fonts (Inter, JetBrains Mono)
   - Aplicar clases base: `bg-pm-bg-primary text-pm-text-primary font-pm-sans min-h-screen`
   - Agregar `<meta name="color-scheme" content="dark" />` para indicar tema oscuro nativo

3. **Crear `src/layouts/AppLayout.astro`**
   - Importar `Layout.astro`
   - Definir la estructura grid principal:

     ```
     grid-template-rows: auto 1fr auto  (header, main, footer)
     grid-template-columns: auto 1fr    (sidebar, workbench)
     ```

   - Usar CSS Grid con `h-screen` y `overflow-hidden` para layout de app de escritorio
   - Slots nombrados: `header`, `sidebar`, `main`, `footer`

4. **Crear componentes contenedor vacios (skeleton)**
   - `src/components/header/HeaderBar.astro`: `<header>` con altura fija (~48px), fondo `bg-pm-bg-header`
   - `src/components/sidebar/Sidebar.astro`: `<aside>` con ancho fijo (260px), fondo `bg-pm-bg-secondary`, borde derecho
   - `src/components/workbench/Workbench.astro`: `<main>` con flex column
   - `src/components/footer/FooterBar.astro`: `<footer>` con altura fija (~28px), fondo `bg-pm-bg-header`

5. **Modificar `src/pages/index.astro`**
   - Importar `AppLayout` y los componentes contenedor
   - Componer la pagina principal con los 4 contenedores

6. **Crear `src/data/mock-collections.ts`**
   - Definir interfaces TypeScript: `Collection`, `Folder`, `Request`, `HttpMethod`
   - Crear datos de ejemplo: 2-3 colecciones con folders y requests
   - Exportar como constantes tipadas

7. **Crear `src/data/mock-environments.ts`**
   - Definir interfaz `Environment` con variables clave-valor
   - Crear 2 entornos de ejemplo: "Development", "Production"

8. **Crear `src/data/mock-history.ts`**
   - Definir interfaz `HistoryEntry` con metodo, URL, timestamp, status
   - Crear 10-15 entries de ejemplo

9. **Crear `src/data/mock-request.ts`**
   - Definir interfaz `RequestConfig` con method, url, params, headers, body, auth
   - Crear un request de ejemplo completo

10. **Crear `src/data/mock-response.ts`**
    - Definir interfaz `ResponseData` con status, time, size, headers, body, cookies
    - Crear una respuesta JSON de ejemplo

#### Archivos Afectados

- `src/styles/global.css` - modificar
- `src/layouts/Layout.astro` - modificar
- `src/layouts/AppLayout.astro` - crear
- `src/components/header/HeaderBar.astro` - crear (skeleton)
- `src/components/sidebar/Sidebar.astro` - crear (skeleton)
- `src/components/workbench/Workbench.astro` - crear (skeleton)
- `src/components/footer/FooterBar.astro` - crear (skeleton)
- `src/pages/index.astro` - modificar
- `src/data/mock-collections.ts` - crear
- `src/data/mock-environments.ts` - crear
- `src/data/mock-history.ts` - crear
- `src/data/mock-request.ts` - crear
- `src/data/mock-response.ts` - crear

#### Mejores Practicas Aplicadas

- **Separation of Concerns**: Design tokens separados de la logica de componentes. Los datos mock en `src/data/` aislan la capa de datos de la presentacion.
- **DRY**: Los tokens se definen una sola vez en `@theme` y se reutilizan via utility classes en todos los componentes.
- **KISS**: Layout con CSS Grid nativo -- la herramienta correcta para este tipo de grid de aplicacion.
- **Type Safety**: Interfaces TypeScript para todos los datos mock, facilitando autocompletado y validacion.

#### Criterios de Completitud

- [ ] `bun dev` inicia sin errores
- [ ] La pagina muestra 4 areas visibles: header (oscuro, arriba), sidebar (gris oscuro, izquierda), area de trabajo (centro), footer (oscuro, abajo)
- [ ] Las utility classes personalizadas (`bg-pm-bg-primary`, `text-pm-accent`, etc.) funcionan en Tailwind
- [ ] `bun astro check` pasa sin errores de tipo
- [ ] `bun build` completa exitosamente
- [ ] Los archivos de datos mock exportan tipos e instancias correctamente

#### Riesgos y Mitigaciones

- **Riesgo**: Las fuentes de Google Fonts podrian ralentizar la carga inicial. **Mitigacion**: Usar `font-display: swap` y `<link rel="preconnect">`. Incluir fallback `system-ui`.
- **Riesgo**: El grid layout podria no funcionar correctamente en viewport muy pequeno. **Mitigacion**: Para esta fase, enfocar en desktop (>=1024px). La responsividad se aborda en Fase 6.

#### Estimacion de Complejidad

**Baja** - Configuracion basica, sin logica compleja. Principalmente CSS y estructura de archivos.

---

### Fase 2: Header y Footer

#### Objetivo

Construir el header bar con logo, navegacion, barra de busqueda, y controles. Construir el footer bar con indicadores de status.

#### Prerrequisitos

- Fase 1 completada (layout base, tokens)

#### Tareas Detalladas

1. **Crear `src/components/shared/IconButton.astro`**
   - Props: `icon` (nombre del icono SVG), `label` (aria-label), `size` (sm/md), `variant` (ghost/default)
   - Renderizar boton con icono SVG inline y estilos hover/focus
   - Incluir `aria-label` para accesibilidad

2. **Crear `src/components/shared/Badge.astro`**
   - Props: `text`, `variant` (method/status), `color` (usar token de color)
   - Renderizar span con clases de color y padding minimo
   - Usar para mostrar metodos HTTP y status codes con colores apropiados

3. **Crear `src/components/shared/Tooltip.astro`**
   - Props: `text`, `position` (top/bottom/left/right)
   - Implementar con CSS puro: `group` + `invisible group-hover:visible`
   - Sin JavaScript necesario

4. **Crear iconos SVG en `src/assets/icons/`**
   - Crear archivos SVG simples para: search, settings, bell, home, plus, chevron-down
   - Mantener tamanio consistente (16x16 o 20x20 viewBox)
   - Usar `currentColor` para heredar color del padre

5. **Implementar `src/components/header/SearchInput.astro`**
   - Input field con icono de busqueda, placeholder "Search Postman", bordes redondeados
   - Estilizar con `bg-pm-bg-tertiary`, `border-pm-border`, `text-pm-text-primary`
   - Ancho flexible con `flex-1 max-w-md`

6. **Implementar `src/components/header/WorkspaceSelector.astro`**
   - Boton que simula dropdown: texto "My Workspace" + icono chevron-down
   - Solo visual -- no abre dropdown real en esta fase
   - Estilizar como boton ghost con hover state

7. **Completar `src/components/header/HeaderBar.astro`**
   - Layout flex con `justify-between items-center`
   - Zona izquierda: Logo (texto "queryBox" en naranja), Home button, WorkspaceSelector, "API Network" link
   - Zona central: SearchInput
   - Zona derecha: Settings IconButton, Notifications IconButton, Avatar (circulo con iniciales)
   - Borde inferior `border-b border-pm-border`
   - Altura fija `h-12`

8. **Completar `src/components/footer/FooterBar.astro`**
   - Layout flex con `justify-between items-center`
   - Zona izquierda: "Find and Replace", "Console" (botones ghost pequenos)
   - Zona derecha: "Runner", "Trash", icono de toggle sidebar
   - Texto pequeno `text-xs`, `text-pm-text-secondary`
   - Altura fija `h-7`, borde superior

#### Archivos Afectados

- `src/components/shared/IconButton.astro` - crear
- `src/components/shared/Badge.astro` - crear
- `src/components/shared/Tooltip.astro` - crear
- `src/assets/icons/*.svg` - crear (~6-8 iconos)
- `src/components/header/SearchInput.astro` - crear
- `src/components/header/WorkspaceSelector.astro` - crear
- `src/components/header/HeaderBar.astro` - modificar (completar)
- `src/components/footer/FooterBar.astro` - modificar (completar)

#### Mejores Practicas Aplicadas

- **Single Responsibility (SRP)**: Cada componente shared tiene una responsabilidad clara: Badge muestra etiquetas, IconButton renderiza un boton con icono, Tooltip muestra informacion contextual.
- **Open/Closed Principle**: Badge acepta `variant` y `color` como props, permitiendo extender sin modificar.
- **Accessibility**: Todos los botones incluyen `aria-label`. Los iconos decorativos usan `aria-hidden="true"`. El SearchInput tiene `role="search"`.

#### Criterios de Completitud

- [ ] Header visible con logo naranja "queryBox", botones de navegacion, barra de busqueda, y zona de avatar
- [ ] Footer visible con botones de consola/runner y toggle de sidebar
- [ ] Todos los botones muestran cursor pointer y estados hover visibles
- [ ] Los iconos se muestran correctamente con el color del contexto
- [ ] `bun astro check` pasa sin errores

#### Riesgos y Mitigaciones

- **Riesgo**: SVGs inline pueden ser verbosos en componentes `.astro`. **Mitigacion**: Crear un componente `Icon.astro` que importe SVGs dinamicamente, o usar SVGs como strings en frontmatter.
- **Riesgo**: Header demasiado alto en pantallas pequenas. **Mitigacion**: No es critico para esta fase (desktop-first). Se abordara en Fase 6 (responsive).

#### Estimacion de Complejidad

**Baja** - Componentes presentacionales simples, sin logica compleja.

---

### Fase 3: Sidebar - Colecciones, Entornos e Historial

#### Objetivo

Construir el sidebar completo con tres vistas (Collections, Environments, History), arbol de colecciones con folders y requests, lista de entornos, e historial de peticiones.

#### Prerrequisitos

- Fase 1 completada (layout, tokens, datos mock)
- Fase 2 completada (shared components: IconButton, Badge)

#### Tareas Detalladas

1. **Crear `src/scripts/tabs.ts`**
   - Definir Custom Element `<pm-tabs>` que gestiona tabs
   - Escuchar clicks en elementos con `[data-tab]`
   - Toggle class `hidden` en paneles correspondientes con `[data-panel]`
   - Toggle class activa en tab seleccionado
   - Patron: Custom Element con `connectedCallback()`

2. **Crear `src/scripts/tree.ts`**
   - Definir Custom Element `<pm-tree>` para expand/collapse de items
   - Escuchar clicks en elementos con `[data-tree-toggle]`
   - Toggle `aria-expanded` y visibilidad de hijos
   - Rotar icono chevron segun estado expandido/colapsado

3. **Implementar `src/components/sidebar/SidebarTabs.astro`**
   - Tres tabs: "Collections", "Environments", "History"
   - Usar `<pm-tabs>` Custom Element para interactividad
   - Tab activo con borde inferior naranja y texto claro
   - Incluir boton "+" para crear nuevo elemento (solo visual)
   - `<script>` tag que importa `tabs.ts`

4. **Crear `src/components/sidebar/RequestItem.astro`**
   - Props: `method` (HttpMethod), `name` (string)
   - Mostrar badge de metodo (GET/POST/etc. con color correcto) + nombre
   - Hover state con `bg-pm-bg-elevated`
   - Estilo de texto: method en `text-xs font-semibold`, nombre en `text-sm`
   - `cursor-pointer`

5. **Crear `src/components/sidebar/FolderItem.astro`**
   - Props: `name`, `requests` (Request[])
   - Icono de carpeta + nombre + chevron para expand/collapse
   - Dentro: lista de `RequestItem` (hijos)
   - Usar `data-tree-toggle` para la interactividad

6. **Crear `src/components/sidebar/CollectionItem.astro`**
   - Props: `collection` (Collection)
   - Icono de coleccion + nombre + menu de acciones (tres puntos)
   - Expandible: muestra folders y requests hijos
   - Indentacion visual con `pl-` creciente por nivel

7. **Implementar `src/components/sidebar/CollectionTree.astro`**
   - Importar datos mock de colecciones
   - Iterar con `.map()` renderizando `CollectionItem` para cada coleccion
   - Envolver en `<pm-tree>` Custom Element
   - Incluir `<script>` tag para importar `tree.ts`

8. **Crear `src/components/sidebar/EnvironmentItem.astro`**
   - Props: `name`, `isActive` (boolean)
   - Mostrar icono + nombre + indicador de activo (circulo verde)
   - Hover state

9. **Implementar `src/components/sidebar/EnvironmentList.astro`**
   - Importar datos mock de entornos
   - Renderizar lista de `EnvironmentItem`
   - Incluir selector de entorno activo (radio visual)

10. **Crear `src/components/sidebar/HistoryItem.astro`**
    - Props: `method`, `url`, `timestamp`, `status`
    - Badge de metodo + URL truncada + timestamp relativo
    - Hover state con `bg-pm-bg-elevated`

11. **Implementar `src/components/sidebar/HistoryList.astro`**
    - Importar datos mock de historial
    - Agrupar por fecha (Today, Yesterday, etc.)
    - Renderizar `HistoryItem` dentro de cada grupo

12. **Completar `src/components/sidebar/Sidebar.astro`**
    - Componer: SidebarTabs + CollectionTree (panel 1) + EnvironmentList (panel 2) + HistoryList (panel 3)
    - Ancho fijo `w-64` (256px)
    - Overflow vertical con `overflow-y-auto` para listas largas
    - Scrollbar estilizada
    - Borde derecho `border-r border-pm-border`

#### Archivos Afectados

- `src/scripts/tabs.ts` - crear
- `src/scripts/tree.ts` - crear
- `src/components/sidebar/SidebarTabs.astro` - crear
- `src/components/sidebar/CollectionTree.astro` - crear
- `src/components/sidebar/CollectionItem.astro` - crear
- `src/components/sidebar/FolderItem.astro` - crear
- `src/components/sidebar/RequestItem.astro` - crear
- `src/components/sidebar/EnvironmentList.astro` - crear
- `src/components/sidebar/EnvironmentItem.astro` - crear
- `src/components/sidebar/HistoryList.astro` - crear
- `src/components/sidebar/HistoryItem.astro` - crear
- `src/components/sidebar/Sidebar.astro` - modificar (completar)

#### Mejores Practicas Aplicadas

- **Composition over Inheritance**: El sidebar se compone de partes independientes (SidebarTabs, CollectionTree, etc.) que se pueden desarrollar y testear por separado.
- **Principle of Least Surprise**: Los Custom Elements (`<pm-tabs>`, `<pm-tree>`) encapsulan su comportamiento. El HTML funciona sin JS (muestra contenido por defecto), y JS mejora la experiencia.
- **Progressive Enhancement**: El arbol de colecciones renderiza completamente expandido en SSR. El script de tree agrega la capacidad de colapsar.
- **Accessibility**: Items del arbol usan `aria-expanded`, tabs usan `role="tablist"`/`role="tab"`/`role="tabpanel"`, items con `role="treeitem"`.

#### Criterios de Completitud

- [ ] Sidebar muestra 3 tabs funcionales que cambian el contenido visible
- [ ] Tab "Collections" muestra arbol expandible con colecciones, carpetas y requests
- [ ] Tab "Environments" muestra lista de entornos con indicador de activo
- [ ] Tab "History" muestra lista agrupada por fecha con badges de metodo HTTP
- [ ] Los arboles se expanden/colapsan al hacer click
- [ ] El scroll funciona correctamente en listas largas
- [ ] `bun astro check` pasa sin errores

#### Riesgos y Mitigaciones

- **Riesgo**: Los Custom Elements podrian no inicializarse correctamente si se definen multiples veces (Astro deduplica scripts pero `customElements.define` falla si se llama dos veces con el mismo nombre). **Mitigacion**: Usar guard `if (!customElements.get('pm-tabs'))` antes de `customElements.define()`.
- **Riesgo**: El arbol de colecciones podria ser visualmente confuso con mucha anidacion. **Mitigacion**: Limitar datos mock a 2 niveles de profundidad maximo. Usar indentacion clara con `pl-4` por nivel.

#### Estimacion de Complejidad

**Media** - Requiere logica de interactividad (Custom Elements) y estructura de arbol con datos jerarquicos.

---

### Fase 4: Panel de Request - Tab Bar, Request Bar y Config Tabs

#### Objetivo

Construir el area central superior: la barra de tabs de requests abiertos, la barra de request (metodo + URL + Send), y los tabs de configuracion (Params, Auth, Headers, Body, etc.) con sus paneles.

#### Prerrequisitos

- Fase 1 completada (layout, tokens, datos mock)
- Fase 3 completada (scripts/tabs.ts reutilizable)

#### Tareas Detalladas

1. **Crear `src/components/shared/KeyValueRow.astro`**
   - Props: `key`, `value`, `description`, `enabled` (boolean), `isPlaceholder` (boolean)
   - Renderizar fila con: checkbox de enabled, input de key, input de value, input de description
   - Estilo de inputs: `bg-transparent border-b border-pm-border-subtle` (underline style)
   - Fila placeholder (ultima fila vacia para "agregar nuevo")
   - Usar clases `focus-within:border-pm-accent` para indicar fila activa

2. **Crear `src/components/shared/KeyValueTable.astro`**
   - Props: `items` (array de {key, value, description, enabled}), `showDescription` (boolean)
   - Header row: "Key", "Value", "Description" (condicional)
   - Iterar items y renderizar `KeyValueRow` para cada uno
   - Agregar fila placeholder vacia al final
   - Estilo de tabla: sin bordes visibles entre filas, fondo `bg-pm-bg-tertiary`

3. **Crear `src/components/shared/CodeViewer.astro`**
   - Props: `code` (string), `language` ("json" | "javascript" | "text")
   - Renderizar codigo con syntax highlighting manual para JSON:
     - Claves en `text-pm-syntax-key`
     - Strings en `text-pm-syntax-string`
     - Numeros en `text-pm-syntax-number`
     - Booleans en `text-pm-syntax-boolean`
     - Null en `text-pm-syntax-null`
   - Fuente mono `font-pm-mono`, lineas numeradas
   - Background `bg-pm-bg-tertiary` con padding
   - Nota: NO usar libreria de syntax highlighting. Implementar con regex basico para JSON en el frontmatter de Astro (server-side). Esto es suficiente para una UI visual.

4. **Crear `src/components/workbench/TabItem.astro`**
   - Props: `method` (HttpMethod), `name` (string), `isActive` (boolean), `isModified` (boolean)
   - Mostrar: Badge del metodo (pequeno) + nombre + boton cerrar (x)
   - Tab activo: `bg-pm-bg-primary border-b-2 border-pm-accent`
   - Tab inactivo: `bg-pm-bg-secondary hover:bg-pm-bg-elevated`
   - Indicador de modificado: punto naranja junto al nombre

5. **Implementar `src/components/workbench/TabBar.astro`**
   - Layout flex con tabs en fila + boton "+" al final
   - Fondo `bg-pm-bg-secondary`
   - Scroll horizontal si hay muchos tabs (overflow-x-auto)
   - Renderizar 3-4 TabItems de ejemplo (uno activo)
   - Borde inferior sutil

6. **Crear `src/scripts/dropdown.ts`**
   - Definir Custom Element `<pm-dropdown>` para menus desplegables
   - Toggle visibilidad del panel al click en trigger
   - Cerrar al hacer click fuera (document listener)
   - Posicionar panel debajo del trigger

7. **Crear `src/components/request/MethodSelector.astro`**
   - Dropdown que muestra metodo actual (ej: "GET") con color correspondiente
   - Panel desplegable con lista de metodos: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
   - Cada opcion con su color de metodo
   - Usar `<pm-dropdown>` Custom Element
   - `<script>` tag importando `dropdown.ts`

8. **Implementar `src/components/request/RequestBar.astro`**
   - Layout flex: MethodSelector (ancho fijo) + URL Input (flex-1) + Send Button (ancho fijo)
   - URL Input: `bg-pm-bg-tertiary`, placeholder "Enter URL or paste text"
   - Send Button: `bg-pm-accent hover:bg-pm-accent-hover text-white font-semibold px-6`
   - Borde redondeado del grupo completo
   - Padding vertical `py-2`

9. **Implementar `src/components/request/RequestConfigTabs.astro`**
   - 7 tabs: Params, Authorization, Headers, Body, Pre-request Script, Tests, Settings
   - Tab activo con underline naranja
   - Badges opcionales: "Headers (3)" mostrando cantidad de items
   - Usar `<pm-tabs>` Custom Element (reutilizado de Fase 3)
   - Cada tab muestra un panel diferente

10. **Implementar `src/components/request/ParamsTable.astro`**
    - Usar `KeyValueTable` con datos mock de query params
    - Mostrar columna de descripcion

11. **Implementar `src/components/request/AuthPanel.astro`**
    - Layout de 2 columnas: tipo de auth (izquierda) + formulario (derecha)
    - Dropdown "Type": No Auth, API Key, Bearer Token, Basic Auth, OAuth 2.0
    - Para "Bearer Token": mostrar campo "Token" (visual)
    - Para "API Key": mostrar campos Key/Value/Add To
    - Contenido estatico mostrando un tipo de auth seleccionado

12. **Implementar `src/components/request/HeadersTable.astro`**
    - Usar `KeyValueTable` con datos mock de headers
    - Headers predefinidos en gris mas claro (auto-generated)

13. **Implementar `src/components/request/BodyEditor.astro`**
    - Sub-tabs: none, form-data, x-www-form-urlencoded, raw, binary, GraphQL
    - Para "raw": mostrar `CodeViewer` con JSON de ejemplo
    - Para "form-data": mostrar `KeyValueTable`
    - Sub-tab activa seleccionada: "raw"
    - Dropdown de content type junto a raw: "JSON" (visual)

14. **Implementar `src/components/request/PreRequestPanel.astro`**
    - Area de codigo con `CodeViewer` mostrando script de ejemplo
    - Placeholder visual similar a un editor de codigo

15. **Implementar `src/components/request/TestsPanel.astro`**
    - Similar a PreRequestPanel
    - Mostrar snippet de tests de ejemplo

16. **Implementar `src/components/request/SettingsPanel.astro`**
    - Lista de opciones con toggles visuales
    - Opciones: Follow redirects, Enable SSL, Timeout settings
    - Usar componente `Toggle` para los switches

17. **Crear `src/components/shared/Toggle.astro`**
    - Props: `checked` (boolean), `label` (string)
    - Switch visual estilo iOS con animacion CSS
    - Colores: off = `bg-pm-bg-elevated`, on = `bg-pm-accent`

18. **Completar `src/components/request/RequestPanel.astro`**
    - Componer: RequestBar + RequestConfigTabs + paneles de config
    - Layout vertical (flex-col) con gap

#### Archivos Afectados

- `src/components/shared/KeyValueRow.astro` - crear
- `src/components/shared/KeyValueTable.astro` - crear
- `src/components/shared/CodeViewer.astro` - crear
- `src/components/shared/Toggle.astro` - crear
- `src/components/workbench/TabItem.astro` - crear
- `src/components/workbench/TabBar.astro` - crear
- `src/scripts/dropdown.ts` - crear
- `src/components/request/MethodSelector.astro` - crear
- `src/components/request/RequestBar.astro` - crear
- `src/components/request/RequestConfigTabs.astro` - crear
- `src/components/request/ParamsTable.astro` - crear
- `src/components/request/AuthPanel.astro` - crear
- `src/components/request/HeadersTable.astro` - crear
- `src/components/request/BodyEditor.astro` - crear
- `src/components/request/PreRequestPanel.astro` - crear
- `src/components/request/TestsPanel.astro` - crear
- `src/components/request/SettingsPanel.astro` - crear
- `src/components/request/RequestPanel.astro` - crear

#### Mejores Practicas Aplicadas

- **DRY**: `KeyValueTable` y `KeyValueRow` son componentes reutilizables usados en Params, Headers, y form-data del Body. Un unico componente para tres contextos.
- **DRY**: `<pm-tabs>` Custom Element se reutiliza del Fase 3 -- mismo script, diferente contenido.
- **Interface Segregation**: Cada panel de config (Auth, Body, Tests) es independiente y no conoce a los otros.
- **KISS**: Syntax highlighting manual con regex es mas simple que integrar una libreria completa (Prism, Shiki) para un visor visual que no necesita ser perfecto.
- **Fail Fast**: El `CodeViewer` valida el language prop y renderiza como texto plano si no reconoce el formato.

#### Criterios de Completitud

- [ ] Tab bar muestra 3-4 requests abiertos con colores de metodo correctos
- [ ] Request bar muestra selector de metodo, campo URL, y boton Send naranja
- [ ] El selector de metodo se despliega mostrando lista de metodos con colores
- [ ] Los 7 tabs de configuracion cambian el panel visible
- [ ] Params y Headers muestran tabla clave-valor estilizada
- [ ] Body muestra sub-tabs y un editor JSON visual
- [ ] Auth muestra panel de configuracion con tipo seleccionable
- [ ] `bun astro check` pasa sin errores

#### Riesgos y Mitigaciones

- **Riesgo**: El dropdown del MethodSelector podria quedar cortado por el overflow del contenedor padre. **Mitigacion**: Usar `position: absolute` con `z-50` y asegurar que el contenedor padre no tenga `overflow: hidden`.
- **Riesgo**: El syntax highlighting con regex podria fallar con JSON complejo (strings con comillas escapadas). **Mitigacion**: Usar JSON preconstruido simple en los datos mock, sin edge cases. Es un visor visual, no un parser completo.

#### Estimacion de Complejidad

**Alta** - Mayor cantidad de componentes, interactividad de dropdown, logica de syntax highlighting, y multiples sub-paneles.

---

### Fase 5: Panel de Respuesta

#### Objetivo

Construir el panel de respuesta debajo del request: barra de status, tabs de respuesta (Body, Cookies, Headers, Test Results), visor de JSON, y tablas de datos.

#### Prerrequisitos

- Fase 4 completada (componentes shared: KeyValueTable, CodeViewer, Badge)
- Datos mock de respuesta disponibles (Fase 1)

#### Tareas Detalladas

1. **Implementar `src/components/response/ResponseStatusBar.astro`**
   - Props: `status` (number), `statusText` (string), `time` (number, ms), `size` (string)
   - Mostrar: "Status: 200 OK" (verde) | "Time: 245ms" | "Size: 1.2 KB"
   - Color del status segun rango: 2xx verde, 3xx amarillo, 4xx/5xx rojo
   - Layout flex con separadores visuales entre metricas
   - Fuente pequena `text-xs`

2. **Implementar `src/components/response/ResponseTabs.astro`**
   - Tabs: Body, Cookies, Headers, Test Results
   - Similar a RequestConfigTabs pero mas compacto
   - Usar `<pm-tabs>` reutilizado
   - Tab activo con underline naranja

3. **Implementar `src/components/response/ResponseBody.astro`**
   - Usar `CodeViewer` con el JSON de respuesta mock
   - Sub-controles: "Pretty" | "Raw" | "Preview" (radio buttons visuales)
   - Dropdown de formato: JSON (seleccionado), XML, HTML, Text
   - Boton de copiar y boton de buscar (solo visuales)
   - Mostrar vista "Pretty" por defecto con JSON formateado

4. **Implementar `src/components/response/ResponseHeaders.astro`**
   - Tabla de headers de respuesta (no editable, solo lectura)
   - Columnas: Key, Value
   - Datos mock: Content-Type, Date, Server, Cache-Control, etc.
   - Usar `KeyValueTable` en modo solo lectura (sin checkboxes, sin fila placeholder)

5. **Implementar `src/components/response/ResponseCookies.astro`**
   - Tabla de cookies
   - Columnas: Name, Value, Domain, Path, Expires, HttpOnly, Secure
   - 1-2 cookies de ejemplo
   - Fuente mono para valores

6. **Implementar `src/components/response/ResponseTestResults.astro`**
   - Lista de resultados: icono check/cross + nombre del test + duracion
   - 3-4 tests de ejemplo: 2 pasados (verde), 1 fallido (rojo)
   - Barra de resumen: "2/3 tests passed"
   - Fondo verde claro para pasados, rojo claro para fallidos

7. **Completar `src/components/response/ResponsePanel.astro`**
   - Componer: ResponseStatusBar + ResponseTabs + paneles
   - Separador visual entre request y response (borde o gap)
   - Fondo ligeramente diferente para distinguir del request panel

8. **Integrar en `src/components/workbench/Workbench.astro`**
   - Componer: TabBar (arriba) + RequestPanel (medio-arriba) + ResponsePanel (medio-abajo)
   - Los dos paneles (request y response) comparten el espacio vertical
   - Separador visual horizontal entre ambos

#### Archivos Afectados

- `src/components/response/ResponseStatusBar.astro` - crear
- `src/components/response/ResponseTabs.astro` - crear
- `src/components/response/ResponseBody.astro` - crear
- `src/components/response/ResponseHeaders.astro` - crear
- `src/components/response/ResponseCookies.astro` - crear
- `src/components/response/ResponseTestResults.astro` - crear
- `src/components/response/ResponsePanel.astro` - crear
- `src/components/workbench/Workbench.astro` - modificar (integrar todo)

#### Mejores Practicas Aplicadas

- **DRY**: `CodeViewer` y `KeyValueTable` son reutilizados del panel de request. Cero duplicacion de componentes.
- **Open/Closed**: `KeyValueTable` acepta props opcionales (`showCheckbox`, `showDescription`, `readOnly`) para adaptarse a diferentes contextos sin modificar su implementacion base.
- **Separation of Concerns**: Cada tab de respuesta es un componente independiente con su propia logica de presentacion.
- **Accessibility**: Los resultados de tests usan iconos con `aria-label` ("passed"/"failed") y no dependen solo del color para transmitir el resultado (tambien usan texto).

#### Criterios de Completitud

- [ ] Barra de status muestra "200 OK" en verde con metricas de tiempo y tamanio
- [ ] Los 4 tabs de respuesta cambian el contenido visible
- [ ] Body muestra JSON formateado con syntax highlighting basico
- [ ] Headers muestra tabla de headers de respuesta
- [ ] Cookies muestra tabla con datos de cookies
- [ ] Test Results muestra lista con items pasados (verde) y fallidos (rojo)
- [ ] El workbench completo muestra: tabs arriba, request en medio, response abajo
- [ ] `bun astro check` pasa sin errores

#### Riesgos y Mitigaciones

- **Riesgo**: El espacio vertical puede ser insuficiente para mostrar tanto el request como el response panel. **Mitigacion**: Usar alturas relativas (50%/50% o flex-1 para ambos) con overflow-y-auto en cada panel. Considerar un separador visual que simule ser arrastrble (sin funcionalidad real de resize).
- **Riesgo**: El JSON formateado podria no verse bien con valores muy largos. **Mitigacion**: Agregar `overflow-x-auto` y `whitespace-pre` al CodeViewer.

#### Estimacion de Complejidad

**Media** - Reutiliza componentes existentes pero requiere integracion cuidadosa del layout vertical.

---

### Fase 6: Responsividad y Pulido Visual

#### Objetivo

Adaptar la interfaz para diferentes tamanios de pantalla, agregar transiciones y animaciones sutiles, pulir detalles visuales, y asegurar que el layout se vea cohesivo y profesional.

#### Prerrequisitos

- Fases 1-5 completadas (todos los componentes funcionales)

#### Tareas Detalladas

1. **Crear `src/scripts/sidebar.ts`**
   - Definir Custom Element `<pm-sidebar-toggle>` para colapsar/expandir el sidebar
   - Escuchar click en boton de toggle del footer
   - Agregar/remover clase en sidebar: transicion de ancho `w-64 -> w-0` o `w-64 -> w-12` (modo iconos)
   - Guardar preferencia en `localStorage` (opcional para UI visual)
   - Transicion suave con `transition-all duration-200`

2. **Responsive: pantallas >= 1024px (desktop)**
   - Layout completo: sidebar visible, panels side by side (o stacked)
   - Sin cambios respecto a la version base

3. **Responsive: pantallas 768px - 1023px (tablet)**
   - Sidebar colapsado por defecto (oculto o modo iconos de 48px)
   - Boton de hamburguesa en el header para toggle sidebar
   - Sidebar se superpone como overlay con backdrop oscuro
   - Request/Response panels ocupan todo el ancho

4. **Responsive: pantallas < 768px (mobile)**
   - Sidebar completamente oculto, accesible via hamburguesa
   - Header simplificado: logo + hamburguesa + avatar
   - Busqueda oculta, accesible via icono
   - Tab bar con scroll horizontal
   - Request bar en multiples lineas: metodo arriba, URL abajo, Send ocupa ancho completo
   - Response panel debajo con scroll

5. **Transiciones y animaciones**
   - Sidebar collapse/expand: `transition-[width] duration-200 ease-in-out`
   - Tab switch: fade suave con `transition-opacity duration-150`
   - Hover states en todos los elementos interactivos
   - Focus rings visibles para navegacion por teclado: `focus-visible:ring-2 ring-pm-accent`
   - Dropdown aparece con `transition-[opacity,transform] duration-150`

6. **Pulido visual**
   - Verificar alineacion de todos los elementos (padding consistente)
   - Asegurar contraste WCAG AA en todos los textos (4.5:1 minimo)
   - Revisar que todos los colores de metodos HTTP sean consistentes
   - Agregar sombras sutiles al header y footer (`shadow-sm`)
   - Asegurar que los scrollbars personalizados se vean bien
   - Verificar que los bordes entre paneles son consistentes

7. **Simulacion de resize handle entre Request y Response**
   - Barra visual horizontal entre request y response panels
   - Estilo: linea con 3 puntos centrados, cursor `row-resize`
   - No funcional (solo visual) -- indica que seria resizable

8. **Actualizar `src/layouts/Layout.astro`**
   - Agregar `<meta name="theme-color" content="#1A1A1A">` para el color de la barra del navegador
   - Agregar favicon personalizado (si se desea)

#### Archivos Afectados

- `src/scripts/sidebar.ts` - crear
- `src/styles/global.css` - modificar (agregar responsive utilities, scrollbar styles, animaciones)
- `src/layouts/AppLayout.astro` - modificar (responsive grid)
- `src/components/header/HeaderBar.astro` - modificar (responsive: hamburguesa)
- `src/components/sidebar/Sidebar.astro` - modificar (responsive: overlay mode)
- `src/components/request/RequestBar.astro` - modificar (responsive: stack en mobile)
- `src/components/workbench/TabBar.astro` - modificar (responsive: scroll horizontal)
- `src/components/workbench/Workbench.astro` - modificar (agregar resize handle visual)

#### Mejores Practicas Aplicadas

- **Progressive Enhancement**: La interfaz funciona sin JavaScript para el contenido estatico. El sidebar toggle y las transiciones son mejoras progresivas.
- **Mobile-First en CSS**: Aunque la aplicacion es desktop-first por naturaleza (clon de app de escritorio), las media queries usan el patron `base -> md: -> lg:` de Tailwind.
- **Accessibility**: Focus rings visibles para navegacion por teclado. Reducir motion respeta `prefers-reduced-motion`. Sidebar toggle tiene `aria-label` y `aria-expanded`.
- **Performance**: Las transiciones usan `transform` y `opacity` cuando es posible (propiedades que no causan layout/paint). Las animaciones se desactivan con `prefers-reduced-motion: reduce`.

#### Criterios de Completitud

- [ ] En desktop (>=1024px): layout completo con sidebar visible
- [ ] En tablet (768-1023px): sidebar colapsado, accesible via boton
- [ ] En mobile (<768px): interfaz simplificada y funcional
- [ ] Transiciones suaves en sidebar toggle, tabs, y dropdowns
- [ ] Focus rings visibles en todos los elementos interactivos
- [ ] El resize handle visual aparece entre request y response
- [ ] No hay scrolls horizontales no deseados en ningun breakpoint
- [ ] `bun build` produce un bundle optimizado sin errores

#### Riesgos y Mitigaciones

- **Riesgo**: Las transiciones CSS podrian causar layout shifts o jank visual. **Mitigacion**: Usar `will-change` con moderacion, preferir `transform` sobre `width`/`height` para animaciones. Testear en hardware de gama baja.
- **Riesgo**: El overlay del sidebar en tablet podria cubrir contenido importante. **Mitigacion**: Agregar backdrop semi-transparente oscuro que cierre el sidebar al hacer click.

#### Estimacion de Complejidad

**Media-Alta** - Requiere atencion al detalle en multiples breakpoints y estados de interaccion.

---

### Fase 7: Accesibilidad y Verificacion Final

#### Objetivo

Auditar toda la interfaz para cumplimiento WCAG 2.1 AA, verificar navegacion por teclado completa, y validar con herramientas de accesibilidad.

#### Prerrequisitos

- Todas las fases anteriores completadas

#### Tareas Detalladas

1. **Auditoria de landmarks semanticos**
   - `<header>` para HeaderBar
   - `<nav>` para Sidebar (con `aria-label="Sidebar navigation"`)
   - `<main>` para Workbench
   - `<footer>` para FooterBar
   - `<aside>` para el sidebar si no se usa `<nav>`

2. **Navegacion por teclado**
   - Tab order logico: Header -> Sidebar tabs -> Sidebar content -> Tab bar -> Request bar -> Config tabs -> Config panel -> Response tabs -> Response panel -> Footer
   - Focus trap dentro de dropdowns abiertos
   - Escape cierra dropdowns y modales
   - Arrow keys navegan dentro de tabs y listas
   - Enter/Space activan botones y selecciones

3. **ARIA attributes**
   - Tabs: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`
   - Tree: `role="tree"`, `role="treeitem"`, `aria-expanded`, `aria-level`
   - Dropdowns: `aria-haspopup`, `aria-expanded`
   - Status bar: `role="status"` o `aria-live="polite"`
   - Inputs: `<label>` asociado o `aria-label`

4. **Contraste de colores**
   - Verificar con herramienta (Chrome DevTools o axe-core) que todos los textos cumplen 4.5:1
   - Especial atencion a texto secundario (`#A0A0A0` sobre `#1C1C1C` = ~6.3:1 -- OK)
   - Verificar texto terciario (`#6B6B6B` sobre `#1C1C1C` = ~3.5:1 -- **no cumple 4.5:1 para texto normal**)
   - Ajustar `--pm-text-tertiary` a al menos `#808080` para cumplir 4.5:1

5. **Textos alternativos**
   - Todos los iconos decorativos: `aria-hidden="true"`
   - Todos los iconos funcionales: `aria-label` descriptivo
   - El logo "queryBox": es texto, no necesita alt
   - Badges de metodo HTTP: texto visible ya es descriptivo

6. **Prefers-reduced-motion**
   - Verificar que las transiciones se desactivan o reducen
   - Agregar en global.css:

     ```css
     @media (prefers-reduced-motion: reduce) {
       *, *::before, *::after {
         animation-duration: 0.01ms !important;
         transition-duration: 0.01ms !important;
       }
     }
     ```

7. **Verificacion con herramientas**
   - Ejecutar `bun astro check` para errores de TypeScript
   - Ejecutar `bun build` para verificar build de produccion
   - Probar con lector de pantalla (NVDA o Narrator en Windows)
   - Probar navegacion completa solo con teclado
   - Verificar con Chrome Lighthouse (Accessibility score >= 90)

#### Archivos Afectados

- Multiples componentes `.astro` - modificar (agregar ARIA attributes)
- `src/styles/global.css` - modificar (prefers-reduced-motion, ajustes de contraste)
- `src/scripts/*.ts` - modificar (keyboard navigation en Custom Elements)

#### Mejores Practicas Aplicadas

- **WCAG 2.1 AA Compliance**: Contraste minimo 4.5:1 para texto normal, 3:1 para texto grande y componentes UI.
- **Semantic HTML**: Uso correcto de landmarks, roles, y atributos ARIA.
- **Keyboard Navigation**: Patron de "roving tabindex" para grupos de tabs y listas.
- **No Color-Only Information**: Los status codes y test results usan texto e iconos ademas de color.

#### Criterios de Completitud

- [ ] Todos los landmarks semanticos correctos
- [ ] Navegacion por teclado funcional en toda la interfaz
- [ ] ARIA attributes correctos en tabs, arboles, dropdowns
- [ ] Contraste >= 4.5:1 en todo el texto normal
- [ ] `prefers-reduced-motion` respetado
- [ ] Chrome Lighthouse Accessibility >= 90
- [ ] `bun astro check` sin errores
- [ ] `bun build` exitoso

#### Riesgos y Mitigaciones

- **Riesgo**: La navegacion por teclado en Custom Elements podria no funcionar con lectores de pantalla en todos los navegadores. **Mitigacion**: Testear con NVDA + Firefox y Narrator + Edge como minimo. Seguir los patrones de WAI-ARIA Authoring Practices para tabs y tree.
- **Riesgo**: El ajuste del color terciario podria afectar la jerarquia visual. **Mitigacion**: Ajustar minimamente (de `#6B6B6B` a `#808080`) para mantener la distincion visual mientras se cumple el contraste.

#### Estimacion de Complejidad

**Media** - Requiere revision detallada de cada componente, pero no cambios estructurales significativos.

---

## Diagrama de Dependencias entre Fases

```
Fase 1: Fundacion
   |
   +---> Fase 2: Header y Footer
   |        |
   |        +---> Fase 6: Responsividad (parcial)
   |
   +---> Fase 3: Sidebar
   |        |
   |        +---> Fase 4: Panel de Request (usa scripts de Fase 3)
   |                 |
   |                 +---> Fase 5: Panel de Respuesta
   |                          |
   |                          +---> Fase 6: Responsividad (completar)
   |                                   |
   |                                   +---> Fase 7: Accesibilidad
```

Las fases 2 y 3 pueden ejecutarse en **paralelo** despues de la Fase 1.
Las fases 4 y 5 son secuenciales entre si.
La Fase 6 requiere que todas las anteriores esten completas.
La Fase 7 es la fase final de verificacion.

---

## Resumen de Componentes por Area

| Area | Componentes | Archivos |
|---|---|---|
| Shared | IconButton, Badge, Tooltip, KeyValueTable, KeyValueRow, CodeViewer, Toggle, Dropdown | 8 |
| Header | HeaderBar, SearchInput, WorkspaceSelector | 3 |
| Footer | FooterBar | 1 |
| Sidebar | Sidebar, SidebarTabs, CollectionTree, CollectionItem, FolderItem, RequestItem, EnvironmentList, EnvironmentItem, HistoryList, HistoryItem | 10 |
| Workbench | Workbench, TabBar, TabItem | 3 |
| Request | RequestPanel, RequestBar, MethodSelector, RequestConfigTabs, ParamsTable, AuthPanel, HeadersTable, BodyEditor, PreRequestPanel, TestsPanel, SettingsPanel | 11 |
| Response | ResponsePanel, ResponseStatusBar, ResponseTabs, ResponseBody, ResponseHeaders, ResponseCookies, ResponseTestResults | 7 |
| **Total componentes** | | **43** |
| Scripts | tabs.ts, tree.ts, dropdown.ts, sidebar.ts | 4 |
| Data | mock-collections.ts, mock-environments.ts, mock-history.ts, mock-request.ts, mock-response.ts | 5 |
| Layouts | AppLayout.astro (nuevo), Layout.astro (modificar) | 2 |
| **Total archivos nuevos/modificados** | | **~55** |

---

## Dependencias Externas

### Sin dependencias adicionales necesarias

El plan esta disenado para funcionar con las dependencias actuales:

- `astro@^5.17.1`
- `tailwindcss@^4.1.18`
- `@tailwindcss/vite@^4.1.18`

**No se requiere instalar nada adicional.** Las fuentes (Inter, JetBrains Mono) se cargan via CDN de Google Fonts, no como paquetes npm. La interactividad se implementa con vanilla JavaScript (Custom Elements) en `<script>` tags nativos de Astro.

### Alternativa considerada y descartada

Se evaluo instalar `@fontsource/inter` y `@fontsource/jetbrains-mono` para autoalojar las fuentes, pero para un clon visual sin requisitos de produccion, el CDN es mas simple y rapido de implementar.

---

## Notas para el Implementador

1. **Orden de implementacion**: Seguir las fases estrictamente en orden. Cada fase construye sobre la anterior.

2. **Verificacion continua**: Al final de cada fase, ejecutar `bun astro check` y `bun build` para detectar errores temprano.

3. **Datos mock**: Los datos en `src/data/` son esenciales para que los componentes tengan contenido realista. Deben crearse al inicio (Fase 1) y refinarse si es necesario en fases posteriores.

4. **Custom Elements**: Registrar siempre con guard:

   ```typescript
   if (!customElements.get('pm-tabs')) {
     customElements.define('pm-tabs', PmTabs);
   }
   ```

5. **Tailwind CSS v4**: Los design tokens se definen con `@theme` en `global.css`, NO con archivo `tailwind.config.js`. Las utility classes se generan automaticamente (ej: `--color-pm-accent` genera `bg-pm-accent`, `text-pm-accent`, `border-pm-accent`).

6. **SVG Icons**: Preferir SVGs inline en componentes para poder heredar `currentColor`. Si la cantidad de iconos crece, considerar crear un sistema de iconos con `<use>` y sprite.

7. **Sin framework UI extra**: Todo se implementa con componentes `.astro` puro y `<script>` tags. No instalar React, Vue, ni Svelte.
