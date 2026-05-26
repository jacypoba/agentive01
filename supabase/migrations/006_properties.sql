-- Property listings for AI recommendations
-- Run after 005_visit_requests.sql

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  city text not null,
  neighborhood text,
  property_type text not null,
  price numeric(14, 2) not null check (price >= 0),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  description text,
  image_url text,
  listing_url text,
  created_at timestamptz not null default now()
);

create index if not exists properties_user_id_idx
  on public.properties (user_id);

create index if not exists properties_city_idx
  on public.properties (lower(city));

create index if not exists properties_property_type_idx
  on public.properties (lower(property_type));

create index if not exists properties_price_idx
  on public.properties (price);

alter table public.properties enable row level security;

create policy "Users can view own properties"
  on public.properties for select
  using (auth.uid() = user_id);

create policy "Users can insert own properties"
  on public.properties for insert
  with check (auth.uid() = user_id);

create policy "Users can update own properties"
  on public.properties for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own properties"
  on public.properties for delete
  using (auth.uid() = user_id);
