-- =================================================================
-- ANIN LABEL — Write permissions for browser (internal tool)
-- Run in Supabase SQL Editor
-- =================================================================

-- Grant INSERT / UPDATE to anon role
grant insert, update on label.medicines             to anon;
grant insert, update on label.medicine_translations to anon;

-- RLS policies
create policy "anon insert medicines"
  on label.medicines for insert with check (true);

create policy "anon update medicines"
  on label.medicines for update using (true) with check (true);

create policy "anon insert translations"
  on label.medicine_translations for insert with check (true);

create policy "anon update translations"
  on label.medicine_translations for update using (true) with check (true);
