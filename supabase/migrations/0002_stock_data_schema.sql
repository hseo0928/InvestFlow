-- Supabase schema for stock data caching
-- Stock quotes table for real-time quote data
create table if not exists public.stock_quotes (
  id uuid primary key default gen_random_uuid(),
  symbol varchar(10) not null,
  name text,
  price decimal(12,2),
  change decimal(12,2),
  change_percent decimal(8,2),
  volume bigint,
  market_cap bigint,
  high decimal(12,2),
  low decimal(12,2),
  open decimal(12,2),
  previous_close decimal(12,2),
  source varchar(20) check (source in ('yfinance', 'kis', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uniqueness and performance indexes for stock_quotes
create unique index if not exists stock_quotes_symbol_key on public.stock_quotes (symbol);
create index if not exists idx_stock_quotes_updated on public.stock_quotes (updated_at desc);
create index if not exists idx_stock_quotes_symbol on public.stock_quotes (symbol);

-- Trigger to maintain updated_at for stock_quotes (reuse existing set_updated_at function)
drop trigger if exists trg_stock_quotes_updated_at on public.stock_quotes;
create trigger trg_stock_quotes_updated_at
before update on public.stock_quotes
for each row execute function public.set_updated_at();

-- Stock history table for OHLCV historical data
create table if not exists public.stock_history (
  symbol varchar(10) not null,
  date date not null,
  open decimal(12,2),
  high decimal(12,2),
  low decimal(12,2),
  close decimal(12,2),
  volume bigint,
  adj_close decimal(12,2),
  created_at timestamptz not null default now(),
  primary key (symbol, date)
);

-- Performance index for stock_history
create index if not exists idx_stock_history_symbol_date on public.stock_history (symbol, date desc);

-- RLS policies: anonymous read-only access to stock data
alter table public.stock_quotes enable row level security;
alter table public.stock_history enable row level security;

-- Allow public/anon read for stock_quotes
drop policy if exists "stock_quotes_anon_read" on public.stock_quotes;
create policy "stock_quotes_anon_read" on public.stock_quotes for select using (true);

-- Allow public/anon read for stock_history
drop policy if exists "stock_history_anon_read" on public.stock_history;
create policy "stock_history_anon_read" on public.stock_history for select using (true);

-- Grant select to anon/authenticated roles
grant select on public.stock_quotes to anon, authenticated;
grant select on public.stock_history to anon, authenticated;
