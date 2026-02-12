# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro 5 project named "queryBox" built with Bun as the package manager. The project uses TypeScript with strict mode enabled.

## Development Commands

All commands use Bun:

- `bun install` - Install dependencies
- `bun dev` - Start development server at `localhost:4321`
- `bun build` - Build for production to `./dist/`
- `bun preview` - Preview production build locally
- `bun astro ...` - Run Astro CLI commands (e.g., `bun astro add`, `bun astro check`)

## Project Structure

```
src/
├── assets/        # Static assets (images, SVGs)
├── components/    # Reusable Astro components (.astro files)
├── layouts/       # Layout components that wrap pages
└── pages/         # File-based routing - each .astro file becomes a route
```

## Key Conventions

- **Routing**: Pages in `src/pages/` automatically become routes (e.g., `src/pages/index.astro` → `/`)
- **Components**: Use `.astro` file extension for Astro components
- **Layouts**: Shared page layouts go in `src/layouts/` and use `<slot />` for content injection
- **Assets**: Import assets from `src/assets/` to get optimized image handling
- **TypeScript**: Configured with Astro's strict TypeScript settings (`astro/tsconfigs/strict`)

## Astro-Specific Notes

- Astro components use frontmatter (between `---`) for component logic
- Components are server-rendered by default; client-side interactivity requires framework integrations
- Static assets in `public/` are served as-is at the root URL
- Tailwind CSS is integrated for styling

## Agent Workflow

This project uses specialized agents for structured development. **Always follow this workflow for features and significant changes:**

### 1. Planning Phase (planner agent)

When the user requests a new feature, refactoring, or architectural change:

1. Launch the `planner` agent using the Task tool
2. The planner will:
   - Clarify requirements and ask necessary questions
   - Analyze the codebase and existing patterns
   - Research official documentation (Astro, TypeScript, Bun, libraries)
   - Create a detailed implementation plan in `docs/[feature]/[feature]-plan.md`
3. Review the plan with the user before proceeding

### 2. Implementation Phase (senior-developer agent)

Once the plan is approved:

1. Launch the `senior-developer` agent using the Task tool
2. The senior-developer will:
   - Read the plan from `docs/[feature]/[feature]-plan.md`
   - Implement EXACTLY what the plan specifies (no scope creep)
   - Follow all technical standards (TypeScript strict, performance, security, a11y)
   - Run `bun astro check` and `bun build` to verify correctness
   - Report completion with a checklist of requirements

### 3. Review Phase (code-review agent)

After implementation is complete:

1. Launch the `code-review` agent using the Task tool
2. The code-review agent will:
   - Compare implementation against the plan
   - Verify all requirements and acceptance criteria are met
   - Check code quality, security, performance, and accessibility
   - Categorize issues by severity (ALTA, MEDIA, BAJA)
   - Generate a review report in `docs/[feature]/[feature]-review.md`
   - Approve ✅ or reject ❌ based on issues found

### 4. Fix & Re-Review Cycle

If the code-review agent finds ALTA or MEDIA issues:

1. Launch the `senior-developer` agent again to fix the issues
2. Launch the `code-review` agent again to verify fixes
3. Repeat until code-review approves with ✅

### When NOT to Use Agents

Skip the agent workflow for:
- Trivial changes (typo fixes, single-line tweaks)
- Simple one-file modifications with clear requirements
- Direct user instructions that are already highly specific

For these cases, implement directly without launching agents.

## Agent Locations

- Agent definitions: `.claude/agents/`
- Agent memory: `.claude/agent-memory/[agent-name]/`
- Agent skills: `.agents/skills/` (project-local skills available to all agents)
- Implementation plans: `docs/[feature]/[feature]-plan.md`
- Review reports: `docs/[feature]/review/[feature]-review.md` (all reviews appended to single file)

## Installed Skills

The following skills are available to all agents in this project:

### `architecture-patterns`
- **Source**: `miles990/claude-software-skills@architecture-patterns`
- **Purpose**: Software architecture patterns, Clean Architecture, DDD, modular design
- **Best for**: Planner agent when designing module structure and architectural decisions
- **Covers**: Monolith, Microservices, Event-Driven, Serverless, Modular Monolith, ADR templates

### `ui-design-system`
- **Source**: `samhvw8/dot-claude@ui-design-system`
- **Purpose**: Modern UI/UX design with TailwindCSS + Radix UI + shadcn/ui
- **Best for**: Planner and senior-developer agents when designing/implementing UI components
- **Covers**: Component architecture, WCAG accessibility, design tokens, dark mode, responsive design, forms

### `astro`
- **Source**: `briantbr/astro-best-practices@astro`
- **Purpose**: Astro 5.x framework best practices and patterns
- **Best for**: All agents when working with Astro-specific features
- **Covers**: Islands architecture, client directives (load/idle/visible/media/only), View Transitions, Content Collections, zero JavaScript by default, multi-framework support
