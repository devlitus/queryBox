# Code Review Agent Memory

## Patrones Recurrentes en este Proyecto

### Fase de Implementación Típica
- Las fases 1-5 (fundación, componentes visuales) suelen implementarse bien
- Las fases 6-7 (responsividad, accesibilidad) tienden a quedar incompletas o parciales
- El senior-developer enfoca esfuerzo en componentes visuales antes que en funcionalidad responsive/a11y

### Issues Comunes de Accesibilidad

#### ARIA Attributes Faltantes (Patrón recurrente)
1. **Tabs**: Olvidan `aria-controls` vinculando tab → tabpanel
2. **Trees**: Olvidan `aria-level` para indicar profundidad en jerarquía
3. **Dropdowns**: Olvidan `role="listbox"` y `role="option"` en los items del menú
4. **Iconos decorativos**: No agregan `aria-hidden="true"` a SVGs inline

#### Navegación por Teclado (CRÍTICO - Siempre verificar)
- Los Custom Elements solo implementan eventos `click`
- **Nunca implementan** `keydown` handlers para Arrow keys, Enter, Space, Escape
- Esto es un **bloqueo WCAG 2.1 AA** (criterio 2.1.1)
- Patrones esperados:
  - Tabs: ArrowLeft/Right para navegar, Enter/Space para activar
  - Dropdowns: ArrowUp/Down para navegar opciones, Enter para seleccionar, Escape para cerrar
  - Trees: ArrowRight (expand), ArrowLeft (collapse), ArrowUp/Down (navegar items)

### Issues Comunes de Responsividad

#### Breakpoints Implementados Solo en CSS
- El CSS define media queries pero **NO hay cambios en JSX/HTML** para adaptar layout
- Ejemplo típico: Media query para mobile pero **falta botón hamburguesa en el componente**

#### RequestBar/Formularios No Stack en Mobile
- Plan especifica "múltiples líneas en mobile" pero implementación usa solo `flex` sin `flex-col` responsive
- Necesitan clases Tailwind responsive: `flex md:flex-row flex-col`

### Calidad de Código - Patrones Positivos Observados

#### TypeScript Strict Compliance
- El proyecto usa `astro/tsconfigs/strict` y el código siempre pasa `bun astro check`
- Interfaces bien definidas para todos los props y datos mock
- No se usan tipos `any`

#### Custom Elements Pattern
- Usan guard `if (!customElements.get('name'))` antes de `customElements.define()`
- Esto previene errores de re-definición
- Patrón correcto observado en `tabs.ts`, `tree.ts`, `dropdown.ts`, `sidebar.ts`

#### DRY Compliance
- Componentes reutilizables bien implementados (KeyValueTable, CodeViewer, Badge)
- Un solo componente usado en múltiples contextos (ej: KeyValueTable en Params, Headers, Body form-data)

### Estructura de Archivos vs Plan

- El senior-developer **siempre crea todos los archivos** especificados en el plan
- A veces crea **más archivos** de los necesarios (ej: 14 iconos vs 6-8 esperados)
- Nunca faltan archivos estructurales, pero **sí falta funcionalidad dentro** de los archivos

## Checklist de Revisión Optimizada

### Fase 1-5 (Usualmente OK)
- [ ] Verificar `bun astro check` (0 errores)
- [ ] Verificar `bun build` (exitoso)
- [ ] Verificar design tokens en `@theme`
- [ ] Verificar datos mock tienen interfaces TypeScript
- [ ] Verificar componentes tienen props tipadas

### Fase 6 (SIEMPRE revisar a fondo)
- [ ] **Media queries en CSS tienen componentes JSX correspondientes**
- [ ] Botón hamburguesa existe en mobile/tablet
- [ ] RequestBar usa clases responsive (`flex-col` en mobile)
- [ ] Header se simplifica en mobile (búsqueda oculta)
- [ ] Sidebar tiene backdrop en overlay mode

### Fase 7 (SIEMPRE revisar a fondo)
- [ ] **Navegación por teclado implementada** en todos los Custom Elements
- [ ] `aria-controls` en tabs vincula a paneles
- [ ] `aria-level` en trees indica profundidad
- [ ] `role="listbox"` y `role="option"` en dropdowns
- [ ] `aria-hidden="true"` en todos los iconos decorativos
- [ ] Focus trap en modales/dropdowns abiertos
- [ ] Contraste de colores verificado (usar devtools)

## Severidad de Issues - Criterios

### ALTA (Bloquea aprobación)
1. Plan requirements no implementados (funcionalidad completa faltante)
2. Navegación por teclado ausente (WCAG 2.1.1 violation)
3. Responsividad no funcional en breakpoints especificados
4. Errores TypeScript (`bun astro check` falla)
5. Build falla

### MEDIA (Bloquea aprobación)
1. ARIA attributes faltantes que afectan lectores de pantalla
2. Contraste de colores < 4.5:1 para texto normal
3. Semántica HTML incorrecta (ej: `<div>` con `cursor-pointer` en lugar de `<button>`)
4. Performance issues evidentes (bundle size, re-renders)
5. Edge cases no manejados que el plan implica

### BAJA (No bloquea aprobación)
1. Props definidas pero no usadas (código muerto)
2. Inconsistencias menores de estilo
3. Falta documentación/comentarios
4. Oportunidades de refactoring
5. Mejoras nice-to-have no en el plan

## Comandos de Verificación

```bash
# Siempre ejecutar antes de revisar
cd D:/work/queryBox
bun astro check  # TypeScript + Astro validation
bun build        # Build de producción

# Para verificar contraste (manual en devtools)
# Chrome DevTools > Elements > Styles > Color picker > Contrast ratio
```

## Notas sobre el Proyecto queryBox

### Convenciones del Proyecto
- Package manager: **Bun** (no npm/yarn)
- Framework: **Astro 5**
- Tailwind: **v4** (usa `@theme` en CSS, NO `tailwind.config.js`)
- TypeScript: **Strict mode** (`astro/tsconfigs/strict`)
- Interactividad: **Custom Elements** (no React/Vue/Svelte)

### Design System
- Prefijo tokens: `pm-` (ej: `bg-pm-bg-primary`, `text-pm-accent`)
- Fuentes: Inter (UI), JetBrains Mono (código)
- Color terciario ajustado: `#808080` (para WCAG AA compliance)

### Ubicaciones Importantes
- Plan: `docs/[feature]/[feature]-plan.md`
- Review: `docs/[feature]/review/[feature]-review.md` (append, no sobrescribir)
- Componentes: `src/components/[area]/ComponentName.astro`
- Scripts: `src/scripts/script-name.ts`
- Datos mock: `src/data/mock-name.ts`

## Aprendizajes de la Revisión del Postman Clone

### Primera Revisión - Lo que salió Mal
1. **Responsividad**: CSS definido pero JSX sin cambios responsive
2. **Keyboard nav**: Ningún Custom Element lo implementó inicialmente
3. **ARIA**: Faltaron 4 patrones específicos (controls, level, listbox, hidden)
4. **Mobile UI**: Sin hamburguesa, sin RequestBar stack, sin header simplificado

### Segunda Revisión - Correcciones Exitosas
**TODAS las issues fueron corregidas exitosamente:**
1. ✅ Responsividad completa: hamburguesa, backdrop, RequestBar responsive, header simplificado
2. ✅ Navegación por teclado: todos los Custom Elements ahora tienen keyboard handlers completos
3. ✅ ARIA completo: `aria-controls`, `aria-level`, `role="listbox"`, `aria-hidden` implementados
4. ✅ Issues BAJA corregidos: props limpias, semántica correcta, design tokens consistentes

**Patrón de corrección observado:**
- El senior-developer es capaz de corregir TODOS los issues cuando se le da feedback específico
- Las correcciones son de alta calidad (no introducen nuevos problemas)
- Tiempo estimado de corrección: ~4-6 horas para 12 issues

### Red Flags para Detectar Temprano
- Si veo media queries en CSS pero no veo `md:hidden` o `lg:flex` en componentes → **Issue ALTA**
- Si veo Custom Elements sin `addEventListener('keydown')` → **Issue ALTA**
- Si veo tabs sin `aria-controls` → **Issue MEDIA**
- Si veo iconos SVG sin `aria-hidden="true"` → **Issue MEDIA**

### Calidad del Trabajo Final
**Metrics del Postman Clone aprobado:**
- Estructura: 56/53 archivos (106% del plan)
- TypeScript: 0 errores, 0 warnings
- Build: Exitoso (957ms)
- WCAG 2.1 AA: Completo
- Responsive: Mobile, tablet, desktop completo
- Keyboard nav: WAI-ARIA patterns completos

## Aprendizajes de la Revisión del HTTP Client MVP (Preact Islands)

### Patrón de Error: Integración de Framework en astro.config.mjs
- **CRÍTICO**: `bun astro check` NO verifica que los renderers de framework estén registrados
- El paquete `@astrojs/preact` puede estar instalado en `package.json` PERO si no está en `integrations: [preact()]` en `astro.config.mjs`, el build falla
- Error en producción: `[NoMatchingRenderer] Unable to render ComponentName`
- **Siempre verificar**: `grep -r "integrations" astro.config.mjs` y comparar con packages instalados
- `bun run build` es el único comando que detecta este error (no `bun astro check`)

### Patrón de Error: XSS en dangerouslySetInnerHTML
- `dangerouslySetInnerHTML` con datos de terceros (respuestas HTTP) es XSS si no se escapa HTML
- El plan puede decir "MVP aceptable" pero respuestas HTTP vienen de terceros, no solo del usuario
- **Siempre verificar**: si hay `dangerouslySetInnerHTML`, ¿los datos vienen de input del usuario o de red?
- Fix mínimo: `escapeHtml()` antes de insertar contenido en `__html`
- Patrón correcto: escapar primero, luego aplicar spans de highlighting

### Patrón de Error: IDs Duplicados en Componentes Múltiples de la Misma Página
- Cuando hay múltiples instancias de un componente de tabs en la misma página (request tabs + response tabs), generan IDs duplicados
- IDs `tabpanel-body` y `tabpanel-headers` aparecieron en AMBOS `RequestConfigTabs` y `ResponseTabs`
- Esto rompe `aria-controls` y viola la especificación HTML
- Fix: prop `idPrefix` en el componente `Tabs` reutilizable, o IDs hardcoded únicos por contexto

### Observaciones sobre Calidad - Implementación Preact
- Señales globales usadas directamente con `.value` en componentes es patrón idiomático de `@preact/signals` (autotracking)
- Keyboard navigation implementada correctamente en Dropdown y Tabs (aprendieron de feedback previo)
- ARIA implementado correctamente en Tabs (aria-controls linking correcto)
- Bidirectional URL-params sync implementado con flag `isUpdatingFromParams` para evitar re-entrada
- `batch()` usado correctamente para múltiples signal updates atómicos

### Checklist Adicional para Revisiones con Frameworks (Preact/React/etc.)
- [ ] `astro.config.mjs` tiene `integrations: [framework()]`
- [ ] `bun run build` (no solo `bun astro check`) pasa
- [ ] `dangerouslySetInnerHTML` escapa HTML entities antes de insertar
- [ ] IDs de DOM son únicos en toda la página (no solo en cada componente)

## Para la Próxima Revisión

1. **Leer el plan completo** antes de revisar código (5-10 min)
2. **Identificar Fase 6 y 7 requirements** específicos
3. **Ejecutar verificación** (`astro check` + `bun run build`) primero - AMBOS son necesarios
4. **Verificar astro.config.mjs** tiene integrations registradas si hay .tsx/.jsx
5. **Revisar dangerouslySetInnerHTML** para HTML escaping si datos vienen de terceros
6. **Revisar IDs de DOM** para duplicados cuando hay múltiples instancias de componentes reutilizables
7. **Revisar Custom Elements** para keyboard handlers (siempre faltan en primera implementación)
8. **Revisar media queries** contra componentes JSX (siempre desconectados)
9. **Usar grep** para encontrar todos los `role="tab"`, `role="treeitem"`, etc. y verificar ARIA
10. **Generar checklist** de plan compliance antes de empezar revisión detallada
