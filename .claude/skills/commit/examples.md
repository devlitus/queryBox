# Ejemplos de Commits - Buenos y Malos

## ✅ BUENOS COMMITS

### Ejemplo 1: Nueva característica simple

```
feat(sidebar): add folder expand/collapse animation

Users can now smoothly expand and collapse folders
in the request sidebar with a visual animation.
```

**Por qué es bueno:**
- Type y scope claros
- Description imperativa y concisa
- Body explica el "qué" y "por qué"

---

### Ejemplo 2: Corrección de bug con contexto

```
fix(auth): prevent infinite redirect loop on logout

Fixed an issue where logging out would redirect to the login page,
which then tried to redirect back, causing an infinite loop.

The issue occurred when the redirect URL contained a query parameter
that wasn't being properly cleared on logout.

Fixes #234
```

**Por qué es bueno:**
- Explica el problema específico
- Incluye contexto técnico
- Referencia el issue resuelto

---

### Ejemplo 3: Refactoring con scope

```
refactor(components): consolidate request panel tabs

Extracted common logic from RequestConfigTabs into a reusable
Tabs component to reduce duplication and improve maintainability.

Changes:
- Moved tab switching logic to shared component
- Simplified TabItem component
- Updated all tab consumers to use new API
```

**Por qué es bueno:**
- Detalla qué se consolidó
- Explica el beneficio (mantenibilidad)
- Lista los cambios principales

---

### Ejemplo 4: Actualización de dependencias

```
chore(deps): upgrade Astro to 5.0.0

Upgrade Astro to the latest version with improved performance
and new features. All tests passing.

BREAKING CHANGE: Astro's generateStaticPage API has changed
```

**Por qué es bueno:**
- Tipo chore es correcto para deps
- Incluye nota de breaking change
- Menciona validación (tests passing)

---

### Ejemplo 5: Documentación

```
docs(contributing): add commit message guidelines

Add comprehensive guidelines for writing Conventional Commits
in the project, including examples and validation rules.

Refs #445
```

**Por qué es bueno:**
- Scope documenta qué área
- Description clara de qué se agregó
- Referencia relacionada

---

### Ejemplo 6: Performance improvement

```
perf(parser): optimize JSON parsing with streaming

Replace synchronous JSON parsing with streaming parser for
large payloads (>1MB). Reduces memory usage by 40% and
parsing time by 60% for typical requests.

Benchmarks:
- 1MB payload: 500ms -> 200ms
- 10MB payload: 5s -> 1.2s
```

**Por qué es bueno:**
- Métrica clara de mejora
- Incluye benchmarks
- Explica el impacto

---

### Ejemplo 7: Multiple changes with footer

```
feat(api): add webhook support for request events

Implement webhook notifications when requests are executed,
allowing external systems to react to API activity in queryBox.

Features:
- Create/update/delete webhooks via API
- Support for multiple event types (request_sent, response_received)
- Retry logic with exponential backoff
- Request signature validation

Fixes #567
Closes #234
Co-Authored-By: María García <maria@example.com>
```

**Por qué es bueno:**
- Scope específico
- Listado claro de features
- Múltiples footers para referencias

---

## ❌ MALOS COMMITS

### ❌ Malo 1: Description vaga

```
fix: bug fix
```

**Problemas:**
- Sin scope
- Description completamente vaga
- No hay contexto
- Sin footers

**Corrección:**
```
fix(auth): resolve token expiration during requests
```

---

### ❌ Malo 2: Cambios múltiples en uno

```
feat: update UI and fix database connection and add logging
```

**Problemas:**
- Mezcla múltiples cambios
- Sin scope
- Type incorrecto (es múltiple)
- Imposible de revertir parcialmente

**Corrección:**
```
feat(ui): redesign response panel layout
fix(api): resolve database connection timeout
chore(logging): add debug logging for requests
```

---

### ❌ Malo 3: Pasado en lugar de imperativo

```
feat(sidebar): Added folder drag and drop support
```

**Problemas:**
- "Added" está en pasado
- Capitalización incorrecta

**Corrección:**
```
feat(sidebar): add folder drag and drop support
```

---

### ❌ Malo 4: Description muy larga sin estructura

```
feat(request): this commit adds the ability to import requests from Postman collections and converts them to our internal format and also adds a UI dialog for selecting which requests to import and it validates the collection structure

BREAKING CHANGE: changed the Request type structure
```

**Problemas:**
- Header extremadamente largo (>50 chars)
- Todo en una oración
- Sin separación clara

**Corrección:**
```
feat(request): add Postman collection import

Users can now import requests directly from Postman collections.
The import dialog validates collection structure and converts
requests to our internal format.

BREAKING CHANGE: Request.metadata structure changed
```

---

### ❌ Malo 5: Sin referencia pero debería

```
fix: prevent duplicate requests in history
```

**Problemas:**
- Sin scope
- Sin footer referenciando el issue/PR

**Corrección:**
```
fix(history): prevent duplicate requests in history

Fixes #789
```

---

### ❌ Malo 6: Body con líneas muy largas

```
refactor(components): restructure components

This commit refactors the component structure to reduce complexity and improve maintainability by consolidating similar logic and removing unused code patterns throughout the codebase
```

**Problemas:**
- Body sin saltos de línea
- Segunda línea excede 72 caracteres

**Corrección:**
```
refactor(components): restructure components

This commit refactors the component structure to reduce complexity
and improve maintainability by consolidating similar logic and
removing unused code patterns.
```

---

### ❌ Malo 7: Breaking change sin marcar

```
feat(api): rename user endpoints

The /users endpoint is now /accounts and /user/{id} is now /account/{id}
```

**Problemas:**
- No marca breaking change explícitamente
- Usuario podría no notarlo

**Corrección:**
```
feat(api)!: rename user endpoints from /users to /accounts

BREAKING CHANGE: API endpoints renamed:
- /users → /accounts
- /user/{id} → /account/{id}
```

---

### ❌ Malo 8: Emoji o símbolos inapropiados

```
🚀 feat(release): v1.0.0 release 🎉

We're finally releasing v1.0.0! 🙌
```

**Problemas:**
- Emojis no estándar
- Exclamaciones excesivas
- Poco profesional

**Corrección:**
```
feat(release): release v1.0.0

After 6 months of development, we're releasing the first stable
version of queryBox with all planned features.
```

---

## Patrones Comunes en QueryBox

### Commits de componentes

```
feat(components): add response status badge

Fixes #456
```

```
refactor(components): simplify request panel structure
```

### Commits de API/Services

```
feat(api): add request retry logic

Fixes #234
```

```
perf(parser): optimize JSON parsing
```

### Commits de configuración

```
chore(config): update Astro strict TypeScript config

```

### Commits de tipos/interfaces

```
refactor(types): organize request types by feature

```

---

## Checklist Rápido

Antes de hacer commit, verifica:

- [ ] ¿Type válido? (feat, fix, docs, refactor, etc.)
- [ ] ¿Description < 50 chars (sin type:scope)?
- [ ] ¿Description en imperativo presente?
- [ ] ¿Sin capitalización en description?
- [ ] ¿Sin punto al final?
- [ ] ¿Body < 72 chars por línea?
- [ ] ¿Línea en blanco entre header y body?
- [ ] ¿Footers correctos si aplica?
- [ ] ¿Un solo cambio lógico por commit?
- [ ] ¿Context suficiente para entender el "por qué"?

---

## Flujo de Commit con el Skill

```bash
# 1. Haz cambios y stage
git add src/components/MyComponent.tsx

# 2. Usa el skill
claude /commit

# 3. Claude mostrará:
# - git status
# - git diff --staged
# - Propuesta de mensaje
# - Confirmación antes de commitear

# 4. Verifica el resultado
git log -1 --format=%B
```

---

## Recursos Adicionales

- [Conventional Commits Standard](./conventional-commits.md)
- [SKILL.md - Instrucciones del skill](./SKILL.md)
- [Conventional Commits Official](https://www.conventionalcommits.org/)
