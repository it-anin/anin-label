-- =================================================================
-- ANIN LABEL — Schema v3 (allow multiple sizes per SKU)
-- WARNING: drops & recreates medicines + translations → re-import after running
-- Run in Supabase SQL Editor
-- =================================================================

drop table if exists label.medicine_translations cascade;
drop table if exists label.medicines cascade;

-- medicines: sku is NOT unique — multiple sizes allowed
create table label.medicines (
  id             uuid primary key default gen_random_uuid(),
  sku            text not null,
  trade_name_ref text not null default '',   -- Thai trade name used as dedup key
  barcode        text unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(sku, trade_name_ref)                -- each size = unique row
);

create index on label.medicines (sku);
create index on label.medicines (barcode);

-- translations: unchanged
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

create extension if not exists pg_trgm;
create index on label.medicine_translations using gin (trade_name   gin_trgm_ops);
create index on label.medicine_translations using gin (generic_name gin_trgm_ops);

-- RLS
alter table label.medicines             enable row level security;
alter table label.medicine_translations enable row level security;

create policy "anon read medicines"    on label.medicines             for select using (true);
create policy "anon read translations" on label.medicine_translations for select using (true);
create policy "anon insert medicines"  on label.medicines             for insert with check (true);
create policy "anon update medicines"  on label.medicines             for update using (true) with check (true);
create policy "anon insert translations" on label.medicine_translations for insert with check (true);
create policy "anon update translations" on label.medicine_translations for update using (true) with check (true);

grant select, insert, update on label.medicines, label.medicine_translations to anon, authenticated;
grant usage  on schema label to service_role;
grant all    on label.medicines, label.medicine_translations to service_role;
