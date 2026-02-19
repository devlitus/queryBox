# Conventional Commits - Standard de Referencia

## Especificación Oficial

La especificación de Conventional Commits es una convención ligera sobre los mensajes de commit que permite:

- **Automatizar el versionamiento semántico** (semantic versioning)
- **Generar CHANGELOGs automáticamente**
- **Mejorar la legibilidad** del historial de git
- **Facilitar el análisis** de cambios

Basado en: https://www.conventionalcommits.org/en/v1.0.0/

## Estructura Completa

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Ejemplo Completo

```
feat(auth): add JWT token refresh mechanism

Implement automatic JWT token refresh when token is about to expire.
This prevents users from being unexpectedly logged out during long sessions.

- Add refreshToken method to AuthService
- Add 5-minute warning before expiration
- Add refresh token endpoint to API

Fixes #456
Closes #789
```

## 1. Type (Obligatorio)

El tipo indica la categoría del cambio:

| Type | Propósito | Semantic Version |
|------|-----------|------------------|
| `feat` | Nueva funcionalidad | Minor (y.X.z) |
| `fix` | Corrección de bug | Patch (y.z.X) |
| `docs` | Cambios en documentación | Patch |
| `style` | Formato, espacios, comas (sin lógica) | Patch |
| `refactor` | Reorganización de código (sin cambios funcionales) | Patch |
| `perf` | Mejora de rendimiento | Patch |
| `test` | Agregar o actualizar tests | Patch |
| `chore` | Cambios en build, deps, config | Patch |
| `ci` | Cambios en CI/CD | Patch |

### BREAKING CHANGE (importante)

Si un cambio **rompe la compatibilidad hacia atrás**, marca con `!`:

```
feat!: restructure API endpoints

BREAKING CHANGE: The /api/v1/users endpoint has been renamed to /api/v2/users
```

O usa `!` después del scope:

```
feat(api)!: restructure endpoints

BREAKING CHANGE: v1 API endpoints deprecated
```

## 2. Scope (Opcional pero recomendado)

Especifica qué parte del proyecto cambia.

**Ejemplos válidos en queryBox:**

- `components` - Cambios en componentes
- `api` - Cambios en servicios/API
- `types` - Cambios en tipos TypeScript
- `utils` - Cambios en funciones utilitarias
- `config` - Cambios en configuración (tsconfig, astro.config, etc.)
- `deps` - Actualización de dependencias
- `styles` - Cambios globales de CSS/Tailwind
- `build` - Cambios en build/compilación
- `tests` - Cambios en testing

**Formato:**

```
<type>(<scope>): <description>
```

## 3. Description (Obligatorio)

La descripción es breve y clara:

### Reglas

1. **Imperativo, presente:** "add" no "added", "fix" no "fixed"
2. **Sin capitalizar** la primera letra
3. **Sin punto** al final
4. **Máximo 50 caracteres** (sin incluir type:scope:)
5. **Completa la frase:** "This commit will ___ "

### Buenos ejemplos

```
feat(auth): add two-factor authentication
fix(api): resolve timeout on large responses
docs(readme): update installation instructions
refactor(components): simplify request panel structure
perf(parser): optimize JSON parsing speed
chore(deps): update TypeScript to 5.3
```

### Malos ejemplos

```
feat(auth): Added two-factor authentication ❌ (capitalizado, pasado)
fix: bug fix ❌ (vago, sin scope)
docs(readme): Update installation instructions. ❌ (capitalizado, punto)
refactor(components): Simplifying request panel structure ❌ (gerundio)
```

## 4. Body (Opcional pero recomendado)

El cuerpo proporciona contexto adicional:

### Cuándo usar

- Cambios complejos o poco obvios
- Explicación de **por qué** se hizo, no **qué** se hizo
- Cambios que afectan múltiples áreas
- Decisiones de diseño importantes

### Formato

- Separa del header con **una línea en blanco**
- **Máximo 72 caracteres** por línea
- **Texto natural**, no listas (a menos que sea necesario)
- Explica la **motivación y contexto**

### Ejemplo

```
feat(api): add request history export

Users frequently asked for a way to export their request history
for analysis and documentation purposes. This commit adds support
for exporting collections and history as JSON files.

The export format matches our internal request schema to ensure
compatibility with import functionality in future releases.
```

## 5. Footer (Opcional)

Utilizado para referencias y notas importantes:

### Tipos de footer

```
Fixes #123
Closes #456
Refs #789
Co-Authored-By: Juan Pérez <juan@example.com>
BREAKING CHANGE: The API response format has changed
```

### Múltiples footers

```
Fixes #123
Fixes #456
Closes #789
```

## Ejemplos por Tipo

### feat

```
feat(sidebar): add folder drag-and-drop
feat(response): support streaming responses
feat(env): add environment variable validation
```

### fix

```
fix(auth): prevent token expiration during request
fix(ui): resolve tab switching animation glitch
fix(parser): handle malformed JSON gracefully
```

### docs

```
docs: add authentication setup guide
docs(api): document rate limiting behavior
docs(contributing): update development workflow
```

### chore

```
chore(deps): update Astro to 5.0.0
chore(config): add ESLint rules for accessibility
chore(build): optimize bundle size
```

### refactor

```
refactor(request): extract header validation logic
refactor(components): consolidate duplicate code
refactor(types): reorganize type definitions
```

## Validación Rápida

Antes de commitear, verifica:

- [ ] ¿Tipo válido? (feat, fix, docs, etc.)
- [ ] ¿Scope relevante? (si no aplica, dejar vacío)
- [ ] ¿Description en imperativo presente?
- [ ] ¿Description bajo 50 caracteres?
- [ ] ¿Cada línea del body bajo 72 caracteres?
- [ ] ¿Separación en blanco entre header y body?
- [ ] ¿Footers correctos si aplica?

## Herramientas de Ayuda

Para validar commits en el proyecto, se puede usar:

```bash
# Verificar último commit
git log -1 --format=%B

# Ver commits recientes con formato
git log --oneline -10
```

## Beneficios Clave

✅ **Historia clara y navegable**
✅ **Changelog automático**
✅ **Versionamiento semántico automático**
✅ **Búsqueda fácil de cambios**
✅ **Code reviews más rápidos**
✅ **Debugging facilitado**

## Referencias Externas

- [Conventional Commits - Official](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#-commit-message-guidelines)
