-- =================================================================
-- ANIN LABEL — Schema v2 (multilingual)
-- Run in Supabase SQL Editor AFTER supabase-schema.sql
-- =================================================================

-- 1. Drop old medicines table (cascade removes old data)
drop table if exists label.medicines cascade;

-- 2. New medicines table — SKU / barcode only (lang-agnostic)
create table label.medicines (
  id         uuid primary key default gen_random_uuid(),
  sku        text unique not null,
  barcode    text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on label.medicines (sku);
create index on label.medicines (barcode);

-- 3. Translations table — one row per medicine × language
create table label.medicine_translations (
  id           uuid primary key default gen_random_uuid(),
  medicine_id  uuid not null references label.medicines(id) on delete cascade,
  lang         text not null check (lang in ('th','en','zh','ja','my','km')),
  trade_name   text,
  generic_name text,
  usage        text,
  indication   text,
  warning      text,
  storage      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(medicine_id, lang)
);

create index on label.medicine_translations (medicine_id);
create index on label.medicine_translations (lang);

-- Trigram full-text search on names
create extension if not exists pg_trgm;
create index on label.medicine_translations using gin (trade_name   gin_trgm_ops);
create index on label.medicine_translations using gin (generic_name gin_trgm_ops);

-- 4. RLS
alter table label.medicines              enable row level security;
alter table label.medicine_translations  enable row level security;

drop policy if exists "anon read medicines"      on label.medicines;
drop policy if exists "anon read translations"   on label.medicine_translations;

create policy "anon read medicines"    on label.medicines             for select using (true);
create policy "anon read translations" on label.medicine_translations for select using (true);

grant select on label.medicines, label.medicine_translations to anon, authenticated;

-- 5. Service role permissions (needed for import script)
grant usage on schema label to service_role;
grant all on label.medicines, label.medicine_translations to service_role;
