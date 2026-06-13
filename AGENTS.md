# AGENTS.md

## Project

Standalone private multi-product image upload and optimization worker built with Bun, Hono,
Zod, Drizzle, R2, Cloudflare Images, D1, and Queues.

## Rules

- Use Bun exclusively.
- Keep TypeScript strict and avoid `any`.
- Keep the Worker private to same-account service bindings; do not add browser CORS.
- Treat configured consumers as trusted and keep presets and storage profiles closed server-side.
- Never accept bucket names, object keys, dimensions, quality, or arbitrary transforms from callers.
- Keep product business metadata and product database writes outside this repository.
- Do not log signed URLs, credentials, image bytes, or operational metadata values.
- Preserve module boundaries enforced by ESLint.
- Run `bun test`, `bun run check`, `bun run lint`, and `bun run build` before merging.

## Architecture

```text
Browser -> Product backend -> service binding -> ming-image-worker -> signed R2 PUT
R2 object-create -> Queue -> ming-image-worker -> Cloudflare Images -> output R2
Product backend -> service binding polling -> product database
```
