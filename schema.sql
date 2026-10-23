-- Run this once in Supabase > SQL Editor
create table public.wishes (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  guest_name   text not null check (char_length(guest_name) between 1 and 80),
  relationship text check (char_length(relationship) <= 80),
  message      text not null check (char_length(message) between 1 and 1000),
  signature    text not null check (char_length(signature) < 200000), -- PNG data URL (~10-30 KB)
  lang         text
);

alter table public.wishes enable row level security;

-- Anyone with the QR link can ADD a wish (but never read or change others)
create policy "anyone can add wishes"
  on public.wishes for insert to anon, authenticated
  with check (true);

-- Only the logged-in admin (you) can read and delete
create policy "admin can read"   on public.wishes for select to authenticated using (true);
create policy "admin can delete" on public.wishes for delete to authenticated using (true);
