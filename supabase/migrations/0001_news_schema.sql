-- Supabase schema for news ingestion and serving
-- Enable required extension for UUID generation
create extension if not exists pgcrypto;

-- News items table
create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  url text not null,
  source text,
  published_at timestamptz not null,
  sentiment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uniqueness and performance indexes
create unique index if not exists news_items_url_key on public.news_items (url);
create index if not exists news_items_published_at_idx on public.news_items (published_at desc);

-- Simple trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_news_items_updated_at on public.news_items;
create trigger trg_news_items_updated_at
before update on public.news_items
for each row execute function public.set_updated_at();

-- Fetch state table for throttling/etag/backoff persistence
create table if not exists public.fetch_state (
  key text primary key,
  etag text,
  last_modified text,
  fail_count int not null default 0,
  backoff_until timestamptz,
  last_fetch_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_fetch_state_updated_at on public.fetch_state;
create trigger trg_fetch_state_updated_at
before update on public.fetch_state
for each row execute function public.set_updated_at();

-- RLS policies: anonymous read-only access to news; writes via service role (which bypasses RLS)
alter table public.news_items enable row level security;

-- Allow public/anon read
drop policy if exists "news_anon_read" on public.news_items;
create policy "news_anon_read" on public.news_items for select using (true);

-- (Optional) Grant select to anon/authenticated roles for clarity
grant select on public.news_items to anon, authenticated;

