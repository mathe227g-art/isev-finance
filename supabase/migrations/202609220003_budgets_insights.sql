-- Phase 3: review and apply manually AFTER Phase 2. Do not reapply older migrations.
begin;

-- Explicit classification: legacy rows default to variable, never inferred from recurrence.
alter table public.transactions add column expense_kind text not null default 'variable' check(expense_kind in ('fixed','variable'));
alter table public.recurring_transactions add column expense_kind text not null default 'variable' check(expense_kind in ('fixed','variable'));
grant insert(expense_kind),update(expense_kind) on public.transactions,public.recurring_transactions to authenticated;
create function private.classify_occurrence() returns trigger language plpgsql set search_path='' as $$
begin
  if new.recurring_transaction_id is not null then
    select r.expense_kind into new.expense_kind from public.recurring_transactions r
      where r.id=new.recurring_transaction_id and r.financial_profile_id=new.financial_profile_id;
  end if;
  return new;
end;
$$;
revoke all on function private.classify_occurrence() from public,anon,authenticated;
create trigger transactions_classify before insert on public.transactions for each row execute function private.classify_occurrence();

create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  category_id uuid not null,
  category_kind text not null default 'expense' check(category_kind='expense'),
  month date not null check(month between date '1900-01-01' and date '2100-12-01' and extract(day from month)=1),
  amount numeric(18,2) not null check(amount>0 and amount<=9999999999999999.99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(financial_profile_id,category_id,month),
  foreign key(financial_profile_id,category_id,category_kind) references public.transaction_categories(financial_profile_id,id,kind) on delete restrict on update restrict
);
create index budgets_profile_month_idx on public.monthly_budgets(financial_profile_id,month);
create trigger budgets_updated before update on public.monthly_budgets for each row execute function private.touch_updated_at();
alter table public.monthly_budgets enable row level security;
revoke all on public.monthly_budgets from public,anon,authenticated;
grant select,delete on public.monthly_budgets to authenticated;
grant insert(financial_profile_id,category_id,month,amount),update(amount) on public.monthly_budgets to authenticated;
create policy budgets_read on public.monthly_budgets for select to authenticated using(private.can_access_profile(financial_profile_id));
create policy budgets_create on public.monthly_budgets for insert to authenticated with check(private.can_write_profile(financial_profile_id));
create policy budgets_update on public.monthly_budgets for update to authenticated using(private.can_write_profile(financial_profile_id)) with check(private.can_write_profile(financial_profile_id));
create policy budgets_delete on public.monthly_budgets for delete to authenticated using(private.owns_profile(financial_profile_id));

create or replace view public.financial_transaction_feed with(security_invoker=true) as
select t.id,t.financial_profile_id,t.account_id,t.destination_account_id,t.category_id,t.type,t.description,t.amount::text,
  t.transaction_date,t.due_date,t.status,t.notes,t.recurring_transaction_id,t.occurrence_date,t.created_at,
  case when t.status='pending' and coalesce(t.due_date,t.transaction_date)<private.finance_today() then 'overdue' else t.status end as display_status,
  t.expense_kind,
  a.name as account_name,d.name as destination_name,c.name as category_name,c.color as category_color,c.icon as category_icon
from public.transactions t join public.accounts a on a.id=t.account_id and a.financial_profile_id=t.financial_profile_id
left join public.accounts d on d.id=t.destination_account_id and d.financial_profile_id=t.financial_profile_id
left join public.transaction_categories c on c.id=t.category_id and c.financial_profile_id=t.financial_profile_id;
create or replace view public.financial_recurring_feed with(security_invoker=true) as
select id,financial_profile_id,account_id,category_id,type,description,amount::text,frequency,due_day,start_date,end_date,notes,active,created_at,updated_at,expense_kind from public.recurring_transactions;

create or replace view public.financial_account_balances with(security_invoker=true) as
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
  (a.opening_balance+coalesce(t.projected,0))::text as projected_balance,true as phase_three_ready
from public.accounts a left join totals t on t.account_id=a.id and t.financial_profile_id=a.financial_profile_id;


-- One request, SQL NUMERIC aggregates. The existing Phase 2 dashboard contract is retained.
create function public.finance_insights(p_profile uuid,p_month date,p_window text default 'month') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare first_day date; last_day date; endpoint date; chart_from date; chart_to date; monthly boolean; base jsonb; result jsonb;
begin
  if not private.can_access_profile(p_profile) then raise exception 'Access denied' using errcode='42501'; end if;
  if p_month is null or p_month<date '1900-01-01' or p_month>date '2100-12-31' or p_window is null or p_window not in ('7d','month','3m','6m','year') then
    raise exception 'Invalid period' using errcode='22023';
  end if;
  first_day:=date_trunc('month',p_month)::date;
  last_day:=(first_day+interval '1 month'-interval '1 day')::date;
  endpoint:=case when date_trunc('month',private.finance_today())::date=first_day then private.finance_today() else last_day end;
  chart_to:=case when p_window='7d' then endpoint when p_window='year' then (date_trunc('year',p_month)+interval '1 year'-interval '1 day')::date else last_day end;
  chart_from:=case p_window when '7d' then endpoint-6 when '3m' then (first_day-interval '2 months')::date when '6m' then (first_day-interval '5 months')::date when 'year' then date_trunc('year',p_month)::date else first_day end;
  monthly:=p_window in ('3m','6m','year');
  base:=public.finance_dashboard(p_profile,first_day);
  with tx as materialized (select * from public.transactions where financial_profile_id=p_profile),
  settled as (select * from tx where status='completed' and transaction_date between first_day and last_day),
  spent as (select category_id,sum(amount) actual from settled where type='expense' group by category_id),
  budgets as (select * from public.monthly_budgets where financial_profile_id=p_profile and month=first_day),
  category_rows as (
    select c.id category_id,c.name,c.color,b.id,coalesce(b.amount,0) planned,coalesce(s.actual,0) actual,
      coalesce(b.amount,0)-coalesce(s.actual,0) remaining,round(100*coalesce(s.actual,0)/nullif(b.amount,0),2) percentage,
      case when b.id is null then 'unplanned' when s.actual>b.amount then 'exceeded' when s.actual=b.amount then 'reached' when s.actual>=b.amount*0.8 then 'near' else 'normal' end state
    from public.transaction_categories c left join budgets b on b.category_id=c.id left join spent s on s.category_id=c.id
    where c.financial_profile_id=p_profile and c.kind='expense' and (b.id is not null or s.category_id is not null)
  ), totals as (select coalesce(sum(planned),0) planned,coalesce(sum(actual),0) actual,count(id) configured from category_rows),
  kinds as (select k.kind,coalesce(sum(s.amount),0) amount,count(s.id) count from (values('fixed'),('variable')) k(kind)
    left join settled s on s.type='expense' and s.expense_kind=k.kind group by k.kind),
  daily as (select d.day::date as day,
    coalesce(sum(s.amount) filter(where s.type='income'),0) income,coalesce(sum(s.amount) filter(where s.type='expense'),0) expense
    from generate_series(first_day,last_day,interval '1 day') d(day) left join settled s on s.transaction_date=d.day::date group by d.day),
  accumulated as (select day,sum(income) over(order by day) income,sum(expense) over(order by day) expense from daily),
  buckets as (select d::date as day from generate_series(chart_from,chart_to,case when monthly then interval '1 month' else interval '1 day' end) d),
  movement as (select b.day,coalesce(sum(t.amount) filter(where t.type='income'),0) income,coalesce(sum(t.amount) filter(where t.type='expense'),0) expense
    from buckets b left join tx t on t.status='completed' and t.transaction_date>=b.day and t.transaction_date<b.day+(case when monthly then interval '1 month' else interval '1 day' end) group by b.day),
  future as (select * from public.financial_transaction_feed where financial_profile_id=p_profile and status='pending' and coalesce(due_date,transaction_date)>=private.finance_today()),
  pay as (select * from future where type='expense' order by coalesce(due_date,transaction_date),id limit 5),
  receive as (select * from future where type='income' order by coalesce(due_date,transaction_date),id limit 5)
  select jsonb_build_object(
    'budget',jsonb_build_object('planned',z.planned::text,'actual',z.actual::text,'remaining',(z.planned-z.actual)::text,'percentage',round(100*z.actual/nullif(z.planned,0),2)::text,'configured',z.configured,
      'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'category_id',category_id,'name',name,'color',color,'planned',planned::text,'actual',actual::text,'remaining',remaining::text,'percentage',percentage::text,'state',state) order by name) from category_rows),'[]'::jsonb)),
    'kinds',(select jsonb_agg(jsonb_build_object('kind',kind,'amount',amount::text,'count',count,'percentage',coalesce(round(100*amount/nullif(z.actual,0),2),0)::text) order by kind) from kinds),
    'daily',(select jsonb_agg(jsonb_build_object('date',day,'income',income::text,'expense',expense::text) order by day) from accumulated),
    'movement',(select jsonb_agg(jsonb_build_object('date',day,'income',income::text,'expense',expense::text) order by day) from movement),
    'chart_from',chart_from,'chart_to',chart_to,'monthly',monthly,
    'next_pay',coalesce((select jsonb_agg(to_jsonb(pay)) from pay),'[]'::jsonb),
    'next_receive',coalesce((select jsonb_agg(to_jsonb(receive)) from receive),'[]'::jsonb),
    'due_week',(select coalesce(sum(amount::numeric),0)::text from future where type='expense' and coalesce(due_date,transaction_date)<private.finance_today()+7),
    'overdue',(select coalesce(sum(amount),0)::text from tx where type='expense' and status='pending' and coalesce(due_date,transaction_date)<private.finance_today()),
    'month_forecast',((base->>'current_balance')::numeric+(base->>'receivable')::numeric-(base->>'payable')::numeric)::text,
    'today',private.finance_today()) into result from totals z;
  return base || result;
end;
$$;
revoke all on function public.finance_insights(uuid,date,text) from public,anon;
grant execute on function public.finance_insights(uuid,date,text) to authenticated;

-- Dedicated due-date listing avoids confusing transaction dates with bill due dates.
create function public.finance_due(p_profile uuid,p_type text,p_from date,p_to date,p_page integer default 1) returns jsonb
language sql stable security invoker set search_path='' as $$
with filtered as (select * from public.financial_transaction_feed where financial_profile_id=p_profile and type=p_type and status='pending' and coalesce(due_date,transaction_date) between p_from and p_to),
page as (select * from filtered order by coalesce(due_date,transaction_date),id limit 30 offset (greatest(1,least(p_page,100000))-1)*30)
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from filtered));
$$;
revoke all on function public.finance_due(uuid,text,date,date,integer) from public,anon;
grant execute on function public.finance_due(uuid,text,date,date,integer) to authenticated;
commit;
