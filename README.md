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

## 📚 Documentation

- [Astro Docs](https://docs.astro.build)
- [TypeScript Config](./tsconfig.json)
