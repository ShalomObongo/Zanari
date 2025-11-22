create table if not exists savings_investment_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  auto_invest_enabled boolean not null default false,
  target_allocation_pct integer not null default 100 check (target_allocation_pct between 0 and 100),
  preferred_product_code text not null default 'default_savings_pool',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists savings_investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  product_code text not null,
  invested_amount bigint not null default 0,
  accrued_interest bigint not null default 0,
  last_accrued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_code)
);

create index if not exists idx_savings_investment_positions_user on savings_investment_positions(user_id);
