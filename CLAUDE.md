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
