---
name: anin-label project context
description: BIGYA Sriracha pharmacy medicine-label printing app (90x65mm), React+Vite+TS+Supabase
type: project
---

Project: anin-label — internal medicine-label printing app for BIGYA Sriracha (บิ๊กยา ศรีราชา) pharmacy. Prints 90×65mm labels (Acetazolamide-style Thai pharmacy labels with header/usage/indication/warning/storage sections).

Stack: React 18 + Vite + TypeScript + @supabase/supabase-js. UI styling pulled from `design-template.css` (gold/dark theme — Outfit/Mitr/Sarabun fonts). No Tailwind. Print via `window.print()` + `@media print` + `@page 90mm 65mm`.

Supabase: project `hzxlulphlvisromrniat` is **shared with other projects in this org**. The `public` schema already contains tables for another project: `branches`, `layouts`, `layout_version`, `product_master`, `products`, `sku_reference`, `users`. To avoid collisions, anin-label uses an isolated `label` schema (`label.medicines`, `label.settings`) — NOT `public`. Any new tables for this project must go under `label.*`.

**Why:** user explicitly chose schema isolation (option b) over a `label_` prefix. When later offered a Hybrid option (read product data from existing `public.products` to avoid duplication), user explicitly chose **full separation** — accepting some data duplication in exchange for zero coupling to the other project's schema.

**How to apply:**
- Scope all tables/RLS/migrations to `label` schema; do NOT join or read from `public.products`, `public.branches`, etc., even if they look reusable.
- Remind user to add `label` to "Exposed schemas" in Supabase API settings if a new table isn't reachable from the client.
- The `supabase` client is initialized with `db: { schema: 'label' }`.
