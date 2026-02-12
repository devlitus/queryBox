---
title: Environment Variables & Config
priority: medium
category: patterns
---

# Environment Variables & Configuration

Manage environment-specific settings and secrets securely.

## Environment Variables

```env
# .env
PUBLIC_API_URL=https://api.example.com
SECRET_API_KEY=your-secret-key
```

```astro
---
// Client-side (public)
const apiUrl = import.meta.env.PUBLIC_API_URL;

// Server-side only (secret)
const apiKey = import.meta.env.SECRET_API_KEY;
---

<script>
  // ✅ Works (public)
  console.log(import.meta.env.PUBLIC_API_URL);
  
  // ❌ Undefined (not public)
  console.log(import.meta.env.SECRET_API_KEY);
</script>
```

**Rule**: Variables prefixed with `PUBLIC_` are exposed to client-side code. All others are server-only.

---

## TypeScript Helpers

### Infer Props from Component

```astro
---
// src/components/Card.astro
interface Props {
  title: string;
  description?: string;
  href: string;
}

const { title, description, href } = Astro.props;
---

<a href={href}>
  <h3>{title}</h3>
  {description && <p>{description}</p>}
</a>
```

```typescript
// Usage with type safety
import type { ComponentProps } from 'astro/types';
import Card from './components/Card.astro';

type CardProps = ComponentProps<typeof Card>;

const props: CardProps = {
  title: 'My Card',
  href: '/page',
};
```

---

## Resources

- **Environment Variables**: https://docs.astro.build/en/guides/environment-variables/
