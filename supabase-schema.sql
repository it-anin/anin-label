-- =================================================================
-- ANIN LABEL — Supabase schema (label namespace)
-- Run this in Supabase SQL Editor.
-- After running, go to: Project Settings → API → Exposed schemas
-- and ADD 'label' so the JS client can reach these tables.
-- =================================================================

-- 1. Schema
create schema if not exists label;
grant usage on schema label to anon, authenticated;

-- 2. Medicines table
create table if not exists label.medicines (
  id            uuid primary key default gen_random_uuid(),
  sku           text unique not null,
  barcode       text unique,
  trade_name    text not null,
  generic_name  text,
  usage         text,
  indication    text,
  warning       text,
  storage       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_label_medicines_sku     on label.medicines (sku);
create index if not exists idx_label_medicines_barcode on label.medicines (barcode);

-- Trigram index for fuzzy name search
create extension if not exists pg_trgm;
create index if not exists idx_label_medicines_trade_trgm   on label.medicines using gin (trade_name gin_trgm_ops);
create index if not exists idx_label_medicines_generic_trgm on label.medicines using gin (generic_name gin_trgm_ops);

-- 3. Settings table (single row, holds shop info)
create table if not exists label.settings (
  id             integer primary key default 1,
  shop_name_th   text not null,
  shop_name_en   text not null,
  phone          text not null,
  line_id        text not null,
  logo_text      text not null default 'BIGYA',
  updated_at     timestamptz not null default now(),
  constraint single_row check (id = 1)
);

-- 4. RLS — read-only for anon (admin can mutate via service_role)
alter table label.medicines enable row level security;
alter table label.settings  enable row level security;

drop policy if exists "anon read medicines" on label.medicines;
drop policy if exists "anon read settings"  on label.settings;
create policy "anon read medicines" on label.medicines for select using (true);
create policy "anon read settings"  on label.settings  for select using (true);

grant select on all tables in schema label to anon, authenticated;

-- 5. Default shop settings (from BIGYA label image)
insert into label.settings (id, shop_name_th, shop_name_en, phone, line_id, logo_text)
values (1, 'บิ๊กยา ศรีราชา', 'BIGYA Sriracha', '082-031-1590', '@bigya', 'BIGYA')
on conflict (id) do update set
  shop_name_th = excluded.shop_name_th,
  shop_name_en = excluded.shop_name_en,
  phone        = excluded.phone,
  line_id      = excluded.line_id,
  logo_text    = excluded.logo_text,
  updated_at   = now();

-- 6. Sample medicine (Acetazolamide from example label)
insert into label.medicines (sku, barcode, trade_name, generic_name, usage, indication, warning, storage)
values (
  'ACE250',
  '8851234567890',
  'Acetazolamide 250 mg 10x10''s',
  'Acetazolamide 250 mg',
  'ทานครั้งละ 1 เม็ด วันละ 2 ครั้ง (เช้า-เย็น) เริ่มกินก่อนขึ้นที่สูง 1-2 วัน และรับประทานต่อไปอีก 2-3 วันหลังจากอยู่ที่สูง เพื่อให้ร่างกายปรับตัว',
  'บรรเทาอาการผิดปกติเมื่อขึ้นที่สูง',
  'ห้ามใช้ในผู้ป่วยโรคตับและไตระยะรุนแรง ผู้ป่วยโรคต้อหิน',
  'เก็บในที่อุณหภูมิต่ำกว่า 25 องศา'
)
on conflict (sku) do nothing;
