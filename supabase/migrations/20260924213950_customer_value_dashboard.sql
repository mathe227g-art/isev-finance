-- iSev Finance / Phase 5: customer-value dashboard, subscriptions and imports.
-- Additive migration. Apply once after 202609220004_wealth_cards.sql.
begin;

alter table public.recurring_transactions
  add column is_subscription boolean not null default false,
  add column merchant_name text not null default '' check(char_length(merchant_name)<=100),
  add column service_url text not null default '' check(char_length(service_url)<=500),
  add column renewal_notice_days integer not null default 7 check(renewal_notice_days between 0 and 60);

grant insert(is_subscription,merchant_name,service_url,renewal_notice_days) on public.recurring_transactions to authenticated;

create table public.dashboard_preferences (
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  widget_order text[] not null default array['actions','safe_spend','cashflow','comparison','subscriptions']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(financial_profile_id,user_id),
  check(cardinality(widget_order) between 1 and 5),
  check(widget_order <@ array['actions','safe_spend','cashflow','comparison','subscriptions']::text[])
);
create index dashboard_preferences_user_idx on public.dashboard_preferences(user_id,financial_profile_id);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  file_name text not null check(char_length(btrim(file_name)) between 1 and 180),
  source_format text not null check(source_format in ('csv','ofx')),
  row_count integer not null check(row_count between 1 and 500),
  imported_count integer not null default 0 check(imported_count between 0 and row_count),
  duplicate_count integer not null default 0 check(duplicate_count between 0 and row_count),
  created_at timestamptz not null default now(),
  unique(financial_profile_id,id)
);
create index import_batches_profile_created_idx on public.import_batches(financial_profile_id,created_at desc);

alter table public.transactions
  add column import_batch_id uuid,
  add column import_fingerprint text check(import_fingerprint is null or char_length(import_fingerprint)=32),
  add foreign key(financial_profile_id,import_batch_id) references public.import_batches(financial_profile_id,id) on delete restrict;
create unique index transactions_import_fingerprint_key
  on public.transactions(financial_profile_id,import_fingerprint)
  where import_fingerprint is not null;
create index transactions_import_batch_idx
  on public.transactions(financial_profile_id,import_batch_id)
  where import_batch_id is not null;

alter table public.dashboard_preferences enable row level security;
alter table public.import_batches enable row level security;
revoke all on public.dashboard_preferences,public.import_batches from public,anon,authenticated;
grant select on public.dashboard_preferences,public.import_batches to authenticated;
grant insert(financial_profile_id,user_id,widget_order),update(widget_order) on public.dashboard_preferences to authenticated;
grant insert(financial_profile_id,user_id,file_name,source_format,row_count,imported_count,duplicate_count),update(imported_count,duplicate_count) on public.import_batches to authenticated;
grant insert(import_batch_id,import_fingerprint) on public.transactions to authenticated;

create policy dashboard_preferences_read on public.dashboard_preferences for select to authenticated
  using(user_id=(select auth.uid()) and private.can_access_profile(financial_profile_id));
create policy dashboard_preferences_create on public.dashboard_preferences for insert to authenticated
  with check(user_id=(select auth.uid()) and private.can_access_profile(financial_profile_id));
create policy dashboard_preferences_update on public.dashboard_preferences for update to authenticated
  using(user_id=(select auth.uid()) and private.can_access_profile(financial_profile_id))
  with check(user_id=(select auth.uid()) and private.can_access_profile(financial_profile_id));
create policy import_batches_read on public.import_batches for select to authenticated
  using(private.can_access_profile(financial_profile_id));
create policy import_batches_create on public.import_batches for insert to authenticated
  with check(user_id=(select auth.uid()) and private.can_write_profile(financial_profile_id));
create policy import_batches_update on public.import_batches for update to authenticated
  using(user_id=(select auth.uid()) and private.can_write_profile(financial_profile_id))
  with check(user_id=(select auth.uid()) and private.can_write_profile(financial_profile_id));

create function public.finance_import_transactions(
  p_profile uuid,p_account uuid,p_income_category uuid,p_expense_category uuid,
  p_file_name text,p_format text,p_rows jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  batch uuid; item jsonb; total integer; imported integer:=0; duplicates integer:=0;
  kind text; label text; amount_text text; amount_value numeric(18,2); date_text text; tx_date date;
  category uuid; fingerprint text; affected integer;
begin
  if not private.can_write_profile(p_profile) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Rows must be an array' using errcode='22023'; end if;
  total:=jsonb_array_length(p_rows);
  if total<1 or total>500 then raise exception 'Use between 1 and 500 rows' using errcode='22023'; end if;
  if p_format not in ('csv','ofx') or char_length(btrim(coalesce(p_file_name,''))) not between 1 and 180 then
    raise exception 'Invalid import metadata' using errcode='22023';
  end if;
  if not exists(select 1 from public.accounts where financial_profile_id=p_profile and id=p_account) then
    raise exception 'Invalid account' using errcode='23503';
  end if;
  if p_income_category is not null and not exists(select 1 from public.transaction_categories c where c.financial_profile_id=p_profile and c.id=p_income_category and c.kind='income') then
    raise exception 'Invalid income category' using errcode='23503';
  end if;
  if p_expense_category is not null and not exists(select 1 from public.transaction_categories c where c.financial_profile_id=p_profile and c.id=p_expense_category and c.kind='expense') then
    raise exception 'Invalid expense category' using errcode='23503';
  end if;
  insert into public.import_batches(financial_profile_id,user_id,file_name,source_format,row_count)
  values(p_profile,(select auth.uid()),btrim(p_file_name),p_format,total) returning id into batch;
  for item in select value from jsonb_array_elements(p_rows) loop
    kind:=item->>'type'; label:=btrim(regexp_replace(coalesce(item->>'description',''),'\s+',' ','g'));
    amount_text:=item->>'amount'; date_text:=item->>'date';
    if kind not in ('income','expense') or char_length(label) not between 2 and 160
       or amount_text is null or amount_text !~ '^\d{1,16}(\.\d{1,2})?$'
       or date_text is null or date_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Invalid import row' using errcode='22023';
    end if;
    amount_value:=amount_text::numeric; tx_date:=date_text::date;
    if amount_value<=0 or tx_date>private.finance_today() or tx_date not between date '1900-01-01' and date '2100-12-31' then
      raise exception 'Invalid import value or date' using errcode='22023';
    end if;
    category:=case when kind='income' then p_income_category else p_expense_category end;
    if category is null then raise exception 'Missing category for row type' using errcode='23503'; end if;
    fingerprint:=md5(p_account::text||'|'||tx_date::text||'|'||kind||'|'||amount_value::text||'|'||lower(label));
    insert into public.transactions(financial_profile_id,account_id,category_id,type,description,amount,transaction_date,status,notes,import_batch_id,import_fingerprint)
    values(p_profile,p_account,category,kind,label,amount_value,tx_date,'completed','Importado de '||btrim(p_file_name),batch,fingerprint)
    on conflict(financial_profile_id,import_fingerprint) where import_fingerprint is not null do nothing;
    get diagnostics affected=row_count;
    if affected=1 then imported:=imported+1; else duplicates:=duplicates+1; end if;
  end loop;
  update public.import_batches set imported_count=imported,duplicate_count=duplicates where id=batch and financial_profile_id=p_profile;
  return jsonb_build_object('batch_id',batch,'rows',total,'imported',imported,'duplicates',duplicates);
end;
$$;

create function public.customer_dashboard(p_profile uuid,p_month date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not private.can_access_profile(p_profile) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_month is null or p_month not between date '1900-01-01' and date '2100-12-31' then raise exception 'Invalid month' using errcode='22023'; end if;
  with bounds as (
    select date_trunc('month',p_month)::date first_day,(date_trunc('month',p_month)+interval '1 month')::date next_month,
      (date_trunc('month',p_month)-interval '1 month')::date previous_month,private.finance_today() today
  ), balance as (
    select coalesce(sum(current_balance::numeric),0) value from public.financial_account_balances where financial_profile_id=p_profile
  ), pending30 as (
    select coalesce(sum(amount::numeric) filter(where type='income'),0) income,
      coalesce(sum(amount::numeric) filter(where type='expense'),0) expense
    from public.financial_transaction_feed,bounds
    where financial_profile_id=p_profile and status='pending' and coalesce(due_date,transaction_date) between today and today+30
  ), selected as (
    select coalesce(sum(amount::numeric) filter(where type='income' and status='completed'),0) income,
      coalesce(sum(amount::numeric) filter(where type='expense' and status='completed'),0) expense
    from public.financial_transaction_feed,bounds where financial_profile_id=p_profile and transaction_date>=first_day and transaction_date<next_month
  ), previous as (
    select coalesce(sum(amount::numeric) filter(where type='income' and status='completed'),0) income,
      coalesce(sum(amount::numeric) filter(where type='expense' and status='completed'),0) expense
    from public.financial_transaction_feed,bounds where financial_profile_id=p_profile and transaction_date>=previous_month and transaction_date<first_day
  ), budget as (
    select greatest(coalesce(sum(b.amount),0)-coalesce((select expense from selected),0),0) remaining
    from public.monthly_budgets b,bounds where b.financial_profile_id=p_profile and b.month=first_day
  ), periods as (
    select n,(today+(n*30))::date as end_date from bounds cross join generate_series(1,3) n
  ), cashflow as (
    select n,(select value from balance)+coalesce(sum(case when f.type='income' then f.amount::numeric else -f.amount::numeric end),0) projected
    from periods p left join public.financial_transaction_feed f on f.financial_profile_id=p_profile and f.status='pending'
      and coalesce(f.due_date,f.transaction_date) between (select today from bounds) and p.end_date group by n
  ), action_rows as (
    select 'overdue' kind,'Lançamentos atrasados' title,count(*)::integer count,coalesce(sum(amount::numeric),0) amount,'/app/pendencias' href,1 priority
      from public.financial_transaction_feed,bounds where financial_profile_id=p_profile and display_status='overdue'
    union all
    select 'due_soon','Vencimentos nos próximos 7 dias',count(*)::integer,coalesce(sum(amount::numeric),0),'/app/pendencias',2
      from public.financial_transaction_feed,bounds where financial_profile_id=p_profile and status='pending' and coalesce(due_date,transaction_date) between today and today+7
    union all
    select 'subscriptions','Assinaturas ativas',count(*)::integer,coalesce(sum(case frequency when 'weekly' then amount*52/12 when 'bimonthly' then amount/2 when 'quarterly' then amount/3 when 'semiannual' then amount/6 when 'annual' then amount/12 else amount end),0),'/app/assinaturas',3
      from public.recurring_transactions where financial_profile_id=p_profile and active and is_subscription
  ), subscriptions as (
    select id,description,merchant_name,amount::text,frequency,due_day,service_url,renewal_notice_days
      from public.recurring_transactions where financial_profile_id=p_profile and active and is_subscription order by due_day,description limit 8
  )
  select jsonb_build_object(
    'safe_to_spend',((select value from balance)+(select income from pending30)-(select expense from pending30)-(select remaining from budget))::text,
    'safe_components',jsonb_build_object('balance',(select value::text from balance),'income_30d',(select income::text from pending30),'expense_30d',(select expense::text from pending30),'budget_reserve',(select remaining::text from budget)),
    'cashflow',coalesce((select jsonb_agg(jsonb_build_object('days',n*30,'projected',projected::text) order by n) from cashflow),'[]'::jsonb),
    'comparison',jsonb_build_object('current',jsonb_build_object('income',(select income::text from selected),'expense',(select expense::text from selected)),'previous',jsonb_build_object('income',(select income::text from previous),'expense',(select expense::text from previous))),
    'actions',coalesce((select jsonb_agg(to_jsonb(a)-'priority' order by priority) from action_rows a where count>0),'[]'::jsonb),
    'subscriptions',coalesce((select jsonb_agg(to_jsonb(s)) from subscriptions s),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.finance_import_transactions(uuid,uuid,uuid,uuid,text,text,jsonb),public.customer_dashboard(uuid,date) from public,anon;
grant execute on function public.finance_import_transactions(uuid,uuid,uuid,uuid,text,text,jsonb),public.customer_dashboard(uuid,date) to authenticated;
commit;
