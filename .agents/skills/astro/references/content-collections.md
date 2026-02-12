---
title: Content Collections
priority: high
category: patterns
---

# Content Collections (Type-Safe CMS)

Content Collections provide type-safe content management for Markdown, MDX, and JSON files.

> **Astro 5 Update**: Content Collections now use a new loader-based API. The config file moved from `src/content/config.ts` to `src/content.config.ts` in the root of `src/`.

## Schema Definition

```typescript
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  // Load Markdown/MDX files using glob loader
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(), // Coerce string to Date
    author: z.string().default('Anonymous'),
    tags: z.array(z.string()).default([]),
    image: z.object({
      src: z.string(),
      alt: z.string(),
    }).optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

const authors = defineCollection({
  // Load JSON data using file loader
  loader: file('src/data/authors.json'),
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    avatar: z.string().url(),
    bio: z.string(),
    social: z.object({
      twitter: z.string().optional(),
      github: z.string().optional(),
    }),
  }),
});

export const collections = { blog, authors };
```

---

## Query Content Collections

```astro
---
// src/pages/blog/index.astro
import { getCollection } from 'astro:content';

// Get all blog posts
const allPosts = await getCollection('blog');

// Filter published posts
const publishedPosts = await getCollection('blog', ({ data }) => {
  return data.draft !== true;
});

// Sort by date (newest first)
const sortedPosts = publishedPosts.sort((a, b) => {
  return b.data.publishDate.getTime() - a.data.publishDate.getTime();
});

// Get featured posts
const featuredPosts = await getCollection('blog', ({ data }) => {
  return data.featured === true && data.draft !== true;
});
---

<h1>Blog Posts</h1>

<!-- Featured Section -->
{featuredPosts.length > 0 && (
  <section>
    <h2>Featured</h2>
    {featuredPosts.map((post) => (
      <article>
        <a href={`/blog/${post.slug}`}>
          <h3>{post.data.title}</h3>
          <p>{post.data.description}</p>
        </a>
      </article>
    ))}
  </section>
)}

<!-- All Posts -->
<section>
  <h2>All Posts</h2>
  {sortedPosts.map((post) => (
    <article>
      <a href={`/blog/${post.slug}`}>
        <h3>{post.data.title}</h3>
        <time datetime={post.data.publishDate.toISOString()}>
          {post.data.publishDate.toLocaleDateString()}
        </time>
        <p>{post.data.description}</p>
      </a>
    </article>
  ))}
</section>
```

---

## Render Collection Entry

```astro
---
// src/pages/blog/[slug].astro
import { getCollection } from 'astro:content';

// Generate static paths for all posts
export async function getStaticPaths() {
  const posts = await getCollection('blog');
  
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;

// Render Markdown/MDX to HTML
const { Content } = await post.render();
---

<article>
  <header>
    <h1>{post.data.title}</h1>
    <p>By {post.data.author}</p>
    <time datetime={post.data.publishDate.toISOString()}>
      {post.data.publishDate.toLocaleDateString()}
    </time>
    
    {post.data.tags.length > 0 && (
      <ul>
        {post.data.tags.map((tag) => (
          <li><a href={`/tags/${tag}`}>{tag}</a></li>
        ))}
      </ul>
    )}
  </header>
  
  {post.data.image && (
    <img src={post.data.image.src} alt={post.data.image.alt} />
  )}
  
  <!-- Rendered Markdown/MDX content -->
  <Content />
</article>
```

---

## Resources

- **Content Collections Guide**: https://docs.astro.build/en/guides/content-collections/
