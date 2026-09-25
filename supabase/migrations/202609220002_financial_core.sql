-- iSev Finance / Phase 2. Apply manually AFTER Phase 1. Never reapply Phase 1.
begin;

create function private.finance_today() returns date language sql stable set search_path='' as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;
create function private.owns_profile(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.financial_profiles where id=target and owner_id=(select auth.uid()));
$$;
revoke all on function private.finance_today(),private.owns_profile(uuid) from public,anon;
grant execute on function private.finance_today(),private.owns_profile(uuid) to authenticated;

-- Keep Phase 1 policies; restrict destructive account/category operations to owners.
create policy accounts_delete_owner on public.accounts as restrictive for delete to authenticated using(private.owns_profile(financial_profile_id));
create policy categories_delete_owner on public.transaction_categories as restrictive for delete to authenticated using(private.owns_profile(financial_profile_id));
alter table public.transaction_categories add constraint categories_profile_id_kind_key unique(financial_profile_id,id,kind);

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  type text not null check(type in ('income','expense')),
  description text not null check(char_length(btrim(description)) between 2 and 160),
  amount numeric(18,2) not null check(amount>0 and amount<=9999999999999999.99),
  frequency text not null check(frequency in ('weekly','monthly','bimonthly','quarterly','semiannual','annual')),
  due_day integer not null check(due_day between 1 and 31),
  start_date date not null check(start_date between date '1900-01-01' and date '2100-12-31'),
  end_date date check(end_date>=start_date and end_date<=date '2100-12-31'),
  notes text not null default '' check(char_length(notes)<=2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(financial_profile_id,id),
  foreign key(financial_profile_id,account_id) references public.accounts(financial_profile_id,id) on delete restrict,
  foreign key(financial_profile_id,category_id,type) references public.transaction_categories(financial_profile_id,id,kind) on delete restrict on update restrict
);
create index recurring_profile_idx on public.recurring_transactions(financial_profile_id,active);
create index recurring_account_idx on public.recurring_transactions(financial_profile_id,account_id);
create index recurring_category_idx on public.recurring_transactions(financial_profile_id,category_id);

-- A transfer is ONE atomic row: origin=account_id, destination=destination_account_id.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  account_id uuid not null,
  destination_account_id uuid,
  category_id uuid,
  type text not null check(type in ('income','expense','transfer')),
  description text not null check(char_length(btrim(description)) between 2 and 160),
  amount numeric(18,2) not null check(amount>0 and amount<=9999999999999999.99),
  transaction_date date not null check(transaction_date between date '1900-01-01' and date '2100-12-31'),
  due_date date check(due_date between date '1900-01-01' and date '2100-12-31'),
  status text not null default 'pending' check(status in ('pending','completed','cancelled')),
  notes text not null default '' check(char_length(notes)<=2000),
  recurring_transaction_id uuid,
  occurrence_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((type='transfer' and destination_account_id is not null and destination_account_id<>account_id and category_id is null)
     or (type in ('income','expense') and category_id is not null and destination_account_id is null)),
  check((recurring_transaction_id is null and occurrence_date is null) or (recurring_transaction_id is not null and occurrence_date is not null and type<>'transfer')),
  unique(recurring_transaction_id,occurrence_date),
  foreign key(financial_profile_id,account_id) references public.accounts(financial_profile_id,id) on delete restrict,
  foreign key(financial_profile_id,destination_account_id) references public.accounts(financial_profile_id,id) on delete restrict,
  foreign key(financial_profile_id,category_id,type) references public.transaction_categories(financial_profile_id,id,kind) on delete restrict on update restrict,
  foreign key(financial_profile_id,recurring_transaction_id) references public.recurring_transactions(financial_profile_id,id) on delete restrict
);
create index transactions_profile_date_idx on public.transactions(financial_profile_id,transaction_date desc,id);
create index transactions_profile_due_idx on public.transactions(financial_profile_id,(coalesce(due_date,transaction_date))) where status='pending';
create index transactions_account_idx on public.transactions(financial_profile_id,account_id);
create index transactions_destination_idx on public.transactions(financial_profile_id,destination_account_id) where destination_account_id is not null;
create index transactions_category_idx on public.transactions(financial_profile_id,category_id);
create index transactions_status_idx on public.transactions(financial_profile_id,status,transaction_date);

create function private.validate_transaction() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='completed' and new.transaction_date>private.finance_today() then
    raise exception 'Future transactions must remain pending' using errcode='23514';
  end if;
  if tg_op='UPDATE' and (new.financial_profile_id<>old.financial_profile_id
    or new.recurring_transaction_id is distinct from old.recurring_transaction_id
    or new.occurrence_date is distinct from old.occurrence_date) then
    raise exception 'Transaction context and occurrence are immutable' using errcode='23514';
  end if;
  if new.recurring_transaction_id is not null and not exists(
    select 1 from public.recurring_transactions r where r.id=new.recurring_transaction_id
    and r.financial_profile_id=new.financial_profile_id and r.type=new.type
    and (r.active or new.status='cancelled' or tg_op='UPDATE')
  ) then raise exception 'Invalid recurrence' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger transactions_validate before insert or update on public.transactions for each row execute function private.validate_transaction();
create trigger transactions_updated before update on public.transactions for each row execute function private.touch_updated_at();
create trigger recurring_updated before update on public.recurring_transactions for each row execute function private.touch_updated_at();
-- Generated occurrences are cancelled, never erased, so generation cannot recreate them.
create function private.keep_occurrence() returns trigger language plpgsql set search_path='' as $$
begin
  if old.recurring_transaction_id is not null then raise exception 'Cancel recurring occurrences instead of deleting them' using errcode='23514'; end if;
  return old;
end;
$$;
create trigger transactions_keep_occurrence before delete on public.transactions for each row execute function private.keep_occurrence();
revoke all on function private.validate_transaction(),private.keep_occurrence() from public,anon,authenticated;

alter table public.recurring_transactions enable row level security;
alter table public.transactions enable row level security;
revoke all on public.transactions,public.recurring_transactions from public,anon,authenticated;
grant select,delete on public.transactions to authenticated;
grant insert(financial_profile_id,account_id,destination_account_id,category_id,type,description,amount,transaction_date,due_date,status,notes,recurring_transaction_id,occurrence_date) on public.transactions to authenticated;
grant update(account_id,destination_account_id,category_id,type,description,amount,transaction_date,due_date,status,notes) on public.transactions to authenticated;
grant select on public.recurring_transactions to authenticated;
grant insert(financial_profile_id,account_id,category_id,type,description,amount,frequency,due_day,start_date,end_date,notes) on public.recurring_transactions to authenticated;
grant update(active) on public.recurring_transactions to authenticated;
create policy transactions_read on public.transactions for select to authenticated using(private.can_access_profile(financial_profile_id));
create policy transactions_create on public.transactions for insert to authenticated with check(private.can_write_profile(financial_profile_id));
create policy transactions_update on public.transactions for update to authenticated using(private.can_write_profile(financial_profile_id)) with check(private.can_write_profile(financial_profile_id));
create policy transactions_delete on public.transactions for delete to authenticated using(private.owns_profile(financial_profile_id));
create policy recurring_read on public.recurring_transactions for select to authenticated using(private.can_access_profile(financial_profile_id));
create policy recurring_create on public.recurring_transactions for insert to authenticated with check(private.can_write_profile(financial_profile_id));
create policy recurring_update on public.recurring_transactions for update to authenticated using(private.can_write_profile(financial_profile_id)) with check(private.can_write_profile(financial_profile_id));

create function private.cancel_future_occurrences() returns trigger language plpgsql set search_path='' as $$
begin
  if old.active and not new.active then
    update public.transactions set status='cancelled'
    where financial_profile_id=new.financial_profile_id and recurring_transaction_id=new.id
      and status='pending' and coalesce(due_date,transaction_date)>=private.finance_today();
  elsif not old.active and new.active then
    raise exception 'Create a new recurrence instead of reactivating a cancelled one' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.cancel_future_occurrences() from public,anon,authenticated;
create trigger recurring_cancel after update of active on public.recurring_transactions for each row execute function private.cancel_future_occurrences();

-- Explicit bounded generation; safe to repeat and safe against concurrent requests.
create function public.materialize_recurring(p_profile uuid,p_from date,p_to date) returns integer
language plpgsql security invoker set search_path='' as $$
declare r record; d date; anchor date; step integer; n integer; added integer; total integer:=0;
begin
  if not private.can_write_profile(p_profile) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366
     or p_from<date '1900-01-01' or p_to>private.finance_today()+366 then
    raise exception 'Choose a range of up to 366 days, at most one year ahead' using errcode='22023';
  end if;
  for r in select * from public.recurring_transactions where financial_profile_id=p_profile and active and start_date<=p_to and (end_date is null or end_date>=p_from) for update loop
    step:=case r.frequency when 'monthly' then 1 when 'bimonthly' then 2 when 'quarterly' then 3 when 'semiannual' then 6 when 'annual' then 12 else 0 end;
    if step=0 then
      n:=greatest(0,ceil((p_from-r.start_date)::numeric/7)::integer);
    else
      n:=greatest(0,((extract(year from p_from)::integer-extract(year from r.start_date)::integer)*12+extract(month from p_from)::integer-extract(month from r.start_date)::integer)/step);
    end if;
    loop
      if step=0 then d:=r.start_date+7*n;
      else
        anchor:=(date_trunc('month',r.start_date)+(n*step)*interval '1 month')::date;
        d:=least(anchor+(r.due_day-1),(anchor+interval '1 month'-interval '1 day')::date);
      end if;
      exit when d>p_to or (r.end_date is not null and d>r.end_date);
      if d>=p_from and d>=r.start_date then
        insert into public.transactions(financial_profile_id,account_id,category_id,type,description,amount,transaction_date,due_date,status,notes,recurring_transaction_id,occurrence_date)
        values(r.financial_profile_id,r.account_id,r.category_id,r.type,r.description,r.amount,d,d,'pending',r.notes,r.id,d)
        on conflict(recurring_transaction_id,occurrence_date) do nothing;
        get diagnostics added=row_count; total:=total+added;
      end if;
      n:=n+1;
    end loop;
  end loop;
  return total;
end;
$$;

-- Invoker views keep all underlying RLS checks active.
create view public.financial_account_balances with(security_invoker=true) as
with effects as (
  select financial_profile_id,account_id,status,case when type='income' then amount else -amount end as delta from public.transactions where status<>'cancelled'
  union all
  select financial_profile_id,destination_account_id,status,amount from public.transactions where type='transfer' and status<>'cancelled'
), totals as (
  select financial_profile_id,account_id,coalesce(sum(delta) filter(where status='completed'),0) as settled,coalesce(sum(delta),0) as projected
  from effects group by financial_profile_id,account_id
)
select a.id,a.financial_profile_id,a.name,a.institution,a.kind,a.currency,a.opening_balance::text,
  (a.opening_balance+coalesce(t.settled,0))::text as current_balance,
  (a.opening_balance+coalesce(t.projected,0))::text as projected_balance
from public.accounts a left join totals t on t.account_id=a.id and t.financial_profile_id=a.financial_profile_id;

create view public.financial_transaction_feed with(security_invoker=true) as
select t.id,t.financial_profile_id,t.account_id,t.destination_account_id,t.category_id,t.type,t.description,t.amount::text,
  t.transaction_date,t.due_date,t.status,t.notes,t.recurring_transaction_id,t.occurrence_date,t.created_at,
  case when t.status='pending' and coalesce(t.due_date,t.transaction_date)<private.finance_today() then 'overdue' else t.status end as display_status,
  case when t.recurring_transaction_id is null then 'variable' else 'fixed' end as expense_kind,
  a.name as account_name,d.name as destination_name,c.name as category_name,c.color as category_color,c.icon as category_icon
from public.transactions t join public.accounts a on a.id=t.account_id and a.financial_profile_id=t.financial_profile_id
left join public.accounts d on d.id=t.destination_account_id and d.financial_profile_id=t.financial_profile_id
left join public.transaction_categories c on c.id=t.category_id and c.financial_profile_id=t.financial_profile_id;
create view public.financial_recurring_feed with(security_invoker=true) as
select id,financial_profile_id,account_id,category_id,type,description,amount::text,frequency,due_day,start_date,end_date,notes,active,created_at,updated_at from public.recurring_transactions;
revoke all on public.financial_account_balances,public.financial_transaction_feed,public.financial_recurring_feed from public,anon,authenticated;
grant select on public.financial_account_balances,public.financial_transaction_feed,public.financial_recurring_feed to authenticated;

create function public.finance_transactions(p_profile uuid,p_from date,p_to date,p_type text default '',p_account text default '',p_category text default '',p_status text default '',p_search text default '',p_kind text default '',p_page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$
with filtered as (
  select * from public.financial_transaction_feed f where financial_profile_id=p_profile
    and transaction_date between p_from and p_to
    and (p_type='' or type=p_type) and (p_account='' or account_id::text=p_account or destination_account_id::text=p_account)
    and (p_category='' or category_id::text=p_category) and (p_status='' or display_status=p_status)
    and (p_kind='' or expense_kind=p_kind) and (p_search='' or position(lower(p_search) in lower(description))>0)
), page as (select * from filtered order by transaction_date desc,created_at desc,id limit 30 offset (greatest(1,least(p_page,100000))-1)*30)
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from filtered),
  'summary',(select jsonb_build_object('completed',coalesce(sum(amount::numeric) filter(where status='completed' and type<>'transfer'),0)::text,
    'pending',coalesce(sum(amount::numeric) filter(where status='pending' and type<>'transfer'),0)::text,
    'overdue',coalesce(sum(amount::numeric) filter(where display_status='overdue' and type<>'transfer'),0)::text,
    'expected',coalesce(sum(amount::numeric) filter(where status<>'cancelled' and type<>'transfer'),0)::text) from filtered));
$$;

create function public.finance_dashboard(p_profile uuid,p_month date) returns jsonb
language sql stable security invoker set search_path='' as $$
with bounds as (select date_trunc('month',p_month)::date as first,(date_trunc('month',p_month)+interval '1 month')::date as last),
tx as (select t.* from public.transactions t where financial_profile_id=p_profile),
metrics as (select
  coalesce(sum(amount) filter(where type='income' and status='completed' and transaction_date>=b.first and transaction_date<b.last),0) as income,
  coalesce(sum(amount) filter(where type='expense' and status='completed' and transaction_date>=b.first and transaction_date<b.last),0) as expense,
  coalesce(sum(amount) filter(where type='expense' and status='pending' and coalesce(due_date,transaction_date)>=b.first and coalesce(due_date,transaction_date)<b.last),0) as payable,
  coalesce(sum(amount) filter(where type='income' and status='pending' and coalesce(due_date,transaction_date)>=b.first and coalesce(due_date,transaction_date)<b.last),0) as receivable
  from tx cross join bounds b),
months as (select generate_series(b.first-interval '5 months',b.first,interval '1 month')::date as month from bounds b),
history as (select m.month,coalesce(sum(t.amount) filter(where t.type='income'),0) as income,coalesce(sum(t.amount) filter(where t.type='expense'),0) as expense
  from months m left join tx t on t.status='completed' and t.transaction_date>=m.month and t.transaction_date<(m.month+interval '1 month') group by m.month),
categories as (select c.id,c.name,c.color,sum(t.amount) as amount from tx t join public.transaction_categories c on c.id=t.category_id and c.financial_profile_id=t.financial_profile_id cross join bounds b
  where t.type='expense' and t.status='completed' and t.transaction_date>=b.first and t.transaction_date<b.last group by c.id,c.name,c.color),
recent as (select f.* from public.financial_transaction_feed f cross join bounds b where f.financial_profile_id=p_profile and f.transaction_date>=b.first and f.transaction_date<b.last order by f.transaction_date desc,f.created_at desc,f.id limit 8),
upcoming as (select f.* from public.financial_transaction_feed f cross join bounds b where f.financial_profile_id=p_profile and f.status='pending' and coalesce(f.due_date,f.transaction_date)>=b.first and coalesce(f.due_date,f.transaction_date)<b.last order by coalesce(f.due_date,f.transaction_date),f.id limit 8)
select jsonb_build_object(
  'current_balance',(select coalesce(sum(current_balance::numeric),0)::text from public.financial_account_balances where financial_profile_id=p_profile),
  'projected_balance',(select coalesce(sum(projected_balance::numeric),0)::text from public.financial_account_balances where financial_profile_id=p_profile),
  'income',m.income::text,'expense',m.expense::text,'result',(m.income-m.expense)::text,'payable',m.payable::text,'receivable',m.receivable::text,
  'history',(select jsonb_agg(jsonb_build_object('month',month,'income',income::text,'expense',expense::text) order by month) from history),
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'amount',amount::text,'percentage',round(100*amount/nullif(m.expense,0),2)::text) order by amount desc) from categories),'[]'::jsonb),
  'recent',coalesce((select jsonb_agg(to_jsonb(recent)) from recent),'[]'::jsonb),
  'upcoming',coalesce((select jsonb_agg(to_jsonb(upcoming)) from upcoming),'[]'::jsonb)) from metrics m;
$$;

revoke all on function public.materialize_recurring(uuid,date,date),public.finance_transactions(uuid,date,date,text,text,text,text,text,text,integer),public.finance_dashboard(uuid,date) from public,anon;
grant execute on function public.materialize_recurring(uuid,date,date),public.finance_transactions(uuid,date,date,text,text,text,text,text,text,integer),public.finance_dashboard(uuid,date) to authenticated;
commit;
