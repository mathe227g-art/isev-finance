-- Phase 1 only. Apply once using Supabase migrations or SQL Editor.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.financial_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  kind text not null check (kind in ('CPF','CNPJ','OTHER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index financial_profiles_owner_idx on public.financial_profiles(owner_id);
create table public.financial_profile_members (
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (financial_profile_id,user_id)
);
create index financial_members_user_idx on public.financial_profile_members(user_id,financial_profile_id);
create unique index financial_members_one_owner on public.financial_profile_members(financial_profile_id) where role='owner';

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  institution text check (char_length(institution)<=100),
  kind text not null default 'checking' check(kind in ('checking','savings','wallet','cash','digital','investment','other')),
  opening_balance numeric(18,2) not null default 0 check (opening_balance between -9999999999999999.99 and 9999999999999999.99),
  currency text not null default 'BRL' check(currency='BRL'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(financial_profile_id,id)
);
create index accounts_profile_idx on public.accounts(financial_profile_id);
create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  kind text not null check(kind in ('income','expense')),
  color text not null default '#087DF0' check(color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'tag' check(char_length(icon) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(financial_profile_id,id),
  unique(financial_profile_id,name,kind)
);

create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger financial_profiles_updated before update on public.financial_profiles for each row execute function private.touch_updated_at();
create trigger accounts_updated before update on public.accounts for each row execute function private.touch_updated_at();
create trigger categories_updated before update on public.transaction_categories for each row execute function private.touch_updated_at();

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,full_name) values(new.id,
    case when char_length(btrim(coalesce(new.raw_user_meta_data->>'full_name',''))) between 2 and 100
      then btrim(new.raw_user_meta_data->>'full_name') else 'Meu perfil' end);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
-- Accommodate users created before this migration.
insert into public.profiles(id,full_name)
select id, case when char_length(btrim(coalesce(raw_user_meta_data->>'full_name',''))) between 2 and 100
then btrim(raw_user_meta_data->>'full_name') else 'Meu perfil' end from auth.users
on conflict(id) do nothing;

create function private.add_owner_membership() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.financial_profile_members(financial_profile_id,user_id,role) values(new.id,new.owner_id,'owner');
  return new;
end;
$$;
create trigger financial_profile_owner after insert on public.financial_profiles for each row execute function private.add_owner_membership();

-- Helpers avoid recursive RLS; identity is always taken from the verified JWT.
create function private.can_access_profile(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.financial_profile_members m where m.financial_profile_id=target and m.user_id=(select auth.uid()));
$$;
create function private.can_write_profile(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.financial_profile_members m where m.financial_profile_id=target and m.user_id=(select auth.uid()) and m.role in ('owner','editor'));
$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.can_access_profile(uuid),private.can_write_profile(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.financial_profiles enable row level security;
alter table public.financial_profile_members enable row level security;
alter table public.accounts enable row level security;
alter table public.transaction_categories enable row level security;

revoke all on public.profiles,public.financial_profiles,public.financial_profile_members,public.accounts,public.transaction_categories from public,anon,authenticated;
grant select on public.profiles to authenticated;
grant update(full_name) on public.profiles to authenticated;
grant select,delete on public.financial_profiles to authenticated;
grant insert(owner_id,name,kind),update(name,kind) on public.financial_profiles to authenticated;
-- Membership writes are intentionally unavailable through the public API in Phase 1.
-- Future invitations must use a separate, audited, consent-based flow.
grant select on public.financial_profile_members to authenticated;
grant select,delete on public.accounts,public.transaction_categories to authenticated;
grant insert(financial_profile_id,name,institution,kind,opening_balance,currency),update(name,institution,kind,opening_balance) on public.accounts to authenticated;
grant insert(financial_profile_id,name,kind,color,icon),update(name,kind,color,icon) on public.transaction_categories to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy financial_profiles_read on public.financial_profiles for select to authenticated using(owner_id=(select auth.uid()) or private.can_access_profile(id));
create policy financial_profiles_create on public.financial_profiles for insert to authenticated with check(owner_id=(select auth.uid()));
create policy financial_profiles_update on public.financial_profiles for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy financial_profiles_delete on public.financial_profiles for delete to authenticated using(owner_id=(select auth.uid()));
create policy members_read_self on public.financial_profile_members for select to authenticated using(user_id=(select auth.uid()));

create policy accounts_read on public.accounts for select to authenticated using(private.can_access_profile(financial_profile_id));
create policy accounts_create on public.accounts for insert to authenticated with check(private.can_write_profile(financial_profile_id));
create policy accounts_update on public.accounts for update to authenticated using(private.can_write_profile(financial_profile_id)) with check(private.can_write_profile(financial_profile_id));
create policy accounts_delete on public.accounts for delete to authenticated using(private.can_write_profile(financial_profile_id));
create policy categories_read on public.transaction_categories for select to authenticated using(private.can_access_profile(financial_profile_id));
create policy categories_create on public.transaction_categories for insert to authenticated with check(private.can_write_profile(financial_profile_id));
create policy categories_update on public.transaction_categories for update to authenticated using(private.can_write_profile(financial_profile_id)) with check(private.can_write_profile(financial_profile_id));
create policy categories_delete on public.transaction_categories for delete to authenticated using(private.can_write_profile(financial_profile_id));
commit;
