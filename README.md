# queryBox

A modern web application built with **Astro 5** and **Bun**, featuring TypeScript and a structured agent-driven development workflow.

## 🚀 Project Structure

```text
src/
├── assets/        # Static assets (images, SVGs)
├── components/    # Reusable Astro components
├── layouts/       # Layout components for pages
└── pages/         # File-based routing

docs/              # Feature documentation and implementation plans
.claude/           # Agent definitions and memory
```

Learn more at [Astro project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands use Bun:

| Command           | Action                                    |
| :---------------- | :---------------------------------------- |
| `bun install`     | Install dependencies                      |
| `bun dev`         | Start dev server at `localhost:4321`      |
| `bun build`       | Build production site to `./dist/`        |
| `bun preview`     | Preview production build locally           |
| `bun astro check` | Check TypeScript and Astro types           |
| `bun astro add`   | Add integrations (e.g., React, Tailwind)   |

## 🏗️ Development Workflow

This project uses specialized agents for structured development:

1. **Planning** — The `planner` agent analyzes requirements and creates implementation plans
2. **Implementation** — The `senior-developer` agent codes the feature exactly as planned
3. **Review** — The `code-review` agent validates against the plan and standards

Feature plans are stored in `docs/[feature-name]/` with acceptance criteria and technical decisions documented.

## 💻 Stack

- **Framework**: Astro 5
- **Package Manager**: Bun
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS

## 🤖 AI-Powered Error Diagnosis

Este proyecto incluye diagnóstico inteligente de errores HTTP mediante IA (Groq SDK). Cuando una solicitud HTTP falla o retorna un error (4xx/5xx), puedes obtener un análisis y sugerencias accionables generadas por IA.

### Configuración

1. **Obtén una API key de Groq** en https://console.groq.com
2. **Copia el archivo de ejemplo**:
   ```bash
   cp .env.example .env
   ```
3. **Edita `.env`** y configura tu `GROQ_API_KEY`:
   ```env
   GROQ_API_KEY=gsk_tu_key_aquí
   ```

### Rate Limiting (opcional)

Puedes ajustar los límites de rate limiting en `.env`:
- `AI_RATE_LIMIT_MAX` — máximo de requests por ventana (default: 10)
- `AI_RATE_LIMIT_WINDOW_MS` — tamaño de ventana en ms (default: 60000)

### Deployment

⚠️ **Este feature requiere un servidor Node.js** — no puede deployarse como sitio estático. El proyecto usa `@astrojs/node` adapter en modo `standalone`. Las páginas siguen siendo estáticas; solo el endpoint `/api/diagnose` se ejecuta en el servidor.

### Uso

- Cuando una request falla (CORS, timeout, network error), verás un botón **"Diagnosticar con AI"**
- Para respuestas HTTP con status ≥ 400, el botón aparece en la barra de estado
- El sistema muestra una preview de los datos antes de enviarlos a Groq (credenciales NUNCA se envían)
- El diagnóstico se genera en streaming con sugerencias accionables

## 📚 Documentation

- [Astro Docs](https://docs.astro.build)
- [TypeScript Config](./tsconfig.json)
