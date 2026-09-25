-- iSev Finance Phase 4. REVIEW AND APPLY MANUALLY after phases 1-3.
begin;
create table public.credit_cards (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null references public.financial_profiles(id) on delete restrict,
 name text not null check(length(btrim(name)) between 2 and 80),institution text not null default '' check(length(institution)<=100),brand text not null default '' check(length(brand)<=40),
 last_four text not null default '' check(last_four='' or last_four ~ '^[0-9]{4}$'),credit_limit numeric(18,2) not null check(credit_limit>0 and credit_limit<=9999999999999999.99),
 closing_day integer not null check(closing_day between 1 and 31),due_day integer not null check(due_day between 1 and 31),payment_account_id uuid not null,
 color text not null default '#087DF0' check(color ~ '^#[0-9a-fA-F]{6}$'),active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(financial_profile_id,id),
 foreign key(financial_profile_id,payment_account_id) references public.accounts(financial_profile_id,id) on delete restrict
);
create table public.credit_card_invoices (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null,card_id uuid not null,month date not null check(extract(day from month)=1),
 closes_on date not null,due_on date not null check(due_on>closes_on),paid_on date,created_at timestamptz not null default now(),
 unique(financial_profile_id,id),unique(financial_profile_id,card_id,month),unique(financial_profile_id,id,card_id),
 foreign key(financial_profile_id,card_id) references public.credit_cards(financial_profile_id,id) on delete restrict
);
create table public.credit_card_purchases (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null,card_id uuid not null,category_id uuid not null,category_kind text not null default 'expense' check(category_kind='expense'),
 description text not null check(length(btrim(description)) between 2 and 160),amount numeric(18,2) not null check(amount>0 and amount<=9999999999999999.99),
 purchase_date date not null check(purchase_date between date '1900-01-01' and date '2100-12-31'),installment_count integer not null check(installment_count between 1 and 60),
 expense_kind text not null default 'variable' check(expense_kind in ('fixed','variable')),notes text not null default '' check(length(notes)<=2000),cancelled_at timestamptz,
 request_id uuid not null,created_at timestamptz not null default now(),unique(financial_profile_id,id),unique(financial_profile_id,request_id),unique(financial_profile_id,id,card_id),
 foreign key(financial_profile_id,card_id) references public.credit_cards(financial_profile_id,id) on delete restrict,
 foreign key(financial_profile_id,category_id,category_kind) references public.transaction_categories(financial_profile_id,id,kind) on delete restrict
);
create table public.credit_card_installments (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null,card_id uuid not null,purchase_id uuid not null,invoice_id uuid not null,
 number integer not null check(number between 1 and 60),amount numeric(18,2) not null check(amount>0 and amount<=9999999999999999.99),
 created_at timestamptz not null default now(),unique(purchase_id,number),
 foreign key(financial_profile_id,purchase_id,card_id) references public.credit_card_purchases(financial_profile_id,id,card_id) on delete restrict,
 foreign key(financial_profile_id,invoice_id,card_id) references public.credit_card_invoices(financial_profile_id,id,card_id) on delete restrict
);
-- Goals, reserve and investments share a segregated position/movement model, not three copies of a ledger.
create table public.financial_positions (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null references public.financial_profiles(id) on delete restrict,
 kind text not null check(kind in ('goal','reserve','investment')),name text not null check(length(btrim(name)) between 2 and 100),
 description text not null default '' check(length(description)<=2000),institution text not null default '' check(length(institution)<=100),ticker text not null default '' check(length(ticker)<=30),
 investment_type text check(investment_type in ('treasury','cdb','lci','lca','savings','fund','stock','reit','etf','crypto','pension','other')),
 target_amount numeric(18,2) check(target_amount>0 and target_amount<=9999999999999999.99),target_date date check(target_date between date '1900-01-01' and date '2100-12-31'),
 essential_cost numeric(18,2) check(essential_cost>0 and essential_cost<=9999999999999999.99),target_months integer check(target_months between 1 and 120),
 status text not null default 'active' check(status in ('active','completed','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(financial_profile_id,id),
 check((kind='goal' and target_amount is not null and investment_type is null and essential_cost is null and target_months is null)
 or(kind='reserve' and essential_cost is not null and target_months is not null and target_amount is null and investment_type is null and status='active')
 or(kind='investment' and investment_type is not null and target_amount is null and essential_cost is null and target_months is null and status<>'completed'))
);
create unique index one_reserve_per_profile on public.financial_positions(financial_profile_id) where kind='reserve';
create table public.position_movements (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null,position_id uuid not null,
 kind text not null check(kind in ('deposit','withdrawal','yield','dividend','valuation')),
 amount numeric(18,2) not null check(amount>=0 and amount<=9999999999999999.99),delta numeric(18,2) not null check(delta between -9999999999999999.99 and 9999999999999999.99),
 movement_date date not null check(movement_date between date '1900-01-01' and date '2100-12-31'),notes text not null default '' check(length(notes)<=2000),
 request_id uuid not null,created_at timestamptz not null default now(),unique(financial_profile_id,id),unique(financial_profile_id,request_id),
 foreign key(financial_profile_id,position_id) references public.financial_positions(financial_profile_id,id) on delete restrict
);
create table public.cash_settlements (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null,account_id uuid not null,invoice_id uuid,position_movement_id uuid,
 delta numeric(18,2) not null check(delta<>0 and delta between -9999999999999999.99 and 9999999999999999.99),settled_on date not null,created_at timestamptz not null default now(),
 check((invoice_id is null)<>(position_movement_id is null)),unique(invoice_id),unique(position_movement_id),
 foreign key(financial_profile_id,account_id) references public.accounts(financial_profile_id,id) on delete restrict,
 foreign key(financial_profile_id,invoice_id) references public.credit_card_invoices(financial_profile_id,id) on delete restrict,
 foreign key(financial_profile_id,position_movement_id) references public.position_movements(financial_profile_id,id) on delete restrict
);
create table public.net_worth_items (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null references public.financial_profiles(id) on delete restrict,
 kind text not null check(kind in ('asset','liability')),name text not null check(length(btrim(name)) between 2 and 100),
 category text not null check(category in ('property','vehicle','business','valuable','cash','other','financing','loan','debt')),
 amount numeric(18,2) not null check(amount>=0 and amount<=9999999999999999.99),notes text not null default '' check(length(notes)<=2000),active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((kind='asset' and category in ('property','vehicle','business','valuable','cash','other')) or(kind='liability' and category in ('financing','loan','debt','other')))
);
create table public.net_worth_snapshots (
 id uuid primary key default gen_random_uuid(),financial_profile_id uuid not null references public.financial_profiles(id) on delete restrict,
 snapshot_date date not null,assets numeric not null,liabilities numeric not null,net_worth numeric not null,
 created_at timestamptz not null default now(),unique(financial_profile_id,snapshot_date),check(net_worth=assets-liabilities)
);
create index cards_profile_idx on public.credit_cards(financial_profile_id);
create index invoices_profile_due_idx on public.credit_card_invoices(financial_profile_id,due_on);
create index purchases_profile_date_idx on public.credit_card_purchases(financial_profile_id,purchase_date);
create index installments_invoice_idx on public.credit_card_installments(financial_profile_id,invoice_id);
create index installments_purchase_idx on public.credit_card_installments(financial_profile_id,purchase_id);
create index positions_profile_idx on public.financial_positions(financial_profile_id,kind);
create index movements_position_date_idx on public.position_movements(financial_profile_id,position_id,movement_date,created_at);
create index settlements_account_idx on public.cash_settlements(financial_profile_id,account_id);
create index items_profile_idx on public.net_worth_items(financial_profile_id,kind);
-- Deny direct writes: balances and schedules can only change via authorized atomic RPCs below.
do $$ declare t text;begin
 foreach t in array array['credit_cards','credit_card_invoices','credit_card_purchases','credit_card_installments','financial_positions','position_movements','cash_settlements','net_worth_items','net_worth_snapshots'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy scoped_read on public.%I for select to authenticated using(private.can_access_profile(financial_profile_id))',t);
 end loop;
 foreach t in array array['credit_cards','financial_positions','net_worth_items'] loop
 execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch_updated_at()',t);
 end loop;
end $$;

create function private.wealth_guard(p_profile uuid,p_owner boolean default false) returns void language plpgsql set search_path='' as $$
begin
 if auth.uid() is null or not private.can_write_profile(p_profile) or (p_owner and not private.owns_profile(p_profile)) then raise exception 'Access denied' using errcode='42501';end if;
 -- Serialize every Phase 4 mutation per profile, including limits, cancellations and withdrawals.
 perform 1 from public.financial_profiles where id=p_profile for update;
end;$$;
create function private.wealth_day(p_month date,p_day integer) returns date language sql immutable set search_path='' as $$
 select least(date_trunc('month',p_month)::date+p_day-1,(date_trunc('month',p_month)+interval '1 month'-interval '1 day')::date);
$$;
create function private.wealth_money(p_amount numeric,p_zero boolean default false) returns void language plpgsql set search_path='' as $$
begin
 if p_amount is null or p_amount<0 or (not p_zero and p_amount=0) or p_amount>9999999999999999.99 or p_amount<>round(p_amount,2) then raise exception 'Invalid money' using errcode='23514';end if;
end;$$;
revoke all on function private.wealth_guard(uuid,boolean),private.wealth_day(date,integer),private.wealth_money(numeric,boolean) from public,anon,authenticated;

create view public.card_invoice_totals with(security_invoker=true) as
select v.id,v.financial_profile_id,v.card_id,v.month,v.closes_on,v.due_on,v.paid_on,
 coalesce(sum(i.amount) filter(where p.cancelled_at is null),0)::text as total,
 case when v.paid_on is not null then 'paid' when v.due_on<private.finance_today() then 'overdue' when v.closes_on<private.finance_today() then 'closed' else 'open' end as status
from public.credit_card_invoices v left join public.credit_card_installments i on i.invoice_id=v.id and i.financial_profile_id=v.financial_profile_id
left join public.credit_card_purchases p on p.id=i.purchase_id and p.financial_profile_id=i.financial_profile_id group by v.id;
create view public.position_balances with(security_invoker=true) as
with sums as(select financial_profile_id,position_id,coalesce(sum(delta),0) current_value,
 coalesce(sum(amount) filter(where kind='deposit'),0) deposited,coalesce(sum(amount) filter(where kind='withdrawal'),0) withdrawn
 from public.position_movements group by financial_profile_id,position_id)
select p.id,p.financial_profile_id,p.kind,p.name,p.description,p.institution,p.ticker,p.investment_type,p.target_amount::text,p.target_date,p.essential_cost::text,p.target_months,p.status,p.created_at,
 coalesce(s.current_value,0)::text as current_value,coalesce(s.deposited,0)::text as deposited,coalesce(s.withdrawn,0)::text as withdrawn,
 (coalesce(s.current_value,0)+coalesce(s.withdrawn,0)-coalesce(s.deposited,0))::text as result,
 round(100*(coalesce(s.current_value,0)+coalesce(s.withdrawn,0)-coalesce(s.deposited,0))/nullif(s.deposited,0),2)::text as return_percentage,
 (case when p.kind='reserve' then p.essential_cost*p.target_months else p.target_amount end)::text as target,
 round(100*coalesce(s.current_value,0)/nullif(case when p.kind='reserve' then p.essential_cost*p.target_months else p.target_amount end,0),2)::text as progress,
 greatest(0,coalesce(case when p.kind='reserve' then p.essential_cost*p.target_months else p.target_amount end,0)-coalesce(s.current_value,0))::text as remaining,
 round(coalesce(s.current_value,0)/nullif(p.essential_cost,0),2)::text as months_covered
from public.financial_positions p left join sums s on s.position_id=p.id and s.financial_profile_id=p.financial_profile_id;
revoke all on public.card_invoice_totals,public.position_balances from public,anon,authenticated;
grant select on public.card_invoice_totals,public.position_balances to authenticated;

create function public.wealth_save(p_profile uuid,p_entity text,p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;old_card public.credit_cards;old_position public.financial_positions;balance numeric;used numeric;kind text;v_status text;
begin
 perform private.wealth_guard(p_profile,coalesce(p_data->>'active'='false' or p_data->>'status'='archived',false));
 if p_entity='card' then
  perform private.wealth_money((p_data->>'credit_limit')::numeric);
  if p_id is not null then
   select * into old_card from public.credit_cards where id=p_id and financial_profile_id=p_profile;
   if not found then raise exception 'Record not found' using errcode='42501';end if;
   if (old_card.closing_day<>(p_data->>'closing_day')::integer or old_card.due_day<>(p_data->>'due_day')::integer) and exists(select 1 from public.credit_card_purchases where card_id=p_id) then raise exception 'Cycle with history is immutable' using errcode='23514';end if;
   select coalesce(sum(total::numeric),0) into used from public.card_invoice_totals where card_id=p_id and paid_on is null;
   if (p_data->>'credit_limit')::numeric<used then raise exception 'Limit below committed amount' using errcode='23514';end if;
   update public.credit_cards set name=p_data->>'name',institution=p_data->>'institution',brand=p_data->>'brand',last_four=p_data->>'last_four',credit_limit=(p_data->>'credit_limit')::numeric,closing_day=(p_data->>'closing_day')::integer,due_day=(p_data->>'due_day')::integer,payment_account_id=(p_data->>'payment_account_id')::uuid,color=p_data->>'color',active=(p_data->>'active')::boolean where id=p_id returning id into result;
  else
   insert into public.credit_cards(financial_profile_id,name,institution,brand,last_four,credit_limit,closing_day,due_day,payment_account_id,color)
   values(p_profile,p_data->>'name',p_data->>'institution',p_data->>'brand',p_data->>'last_four',(p_data->>'credit_limit')::numeric,(p_data->>'closing_day')::integer,(p_data->>'due_day')::integer,(p_data->>'payment_account_id')::uuid,p_data->>'color') returning id into result;
  end if;
 elsif p_entity='position' then
  kind:=p_data->>'kind';v_status:=coalesce(p_data->>'status','active');
  if kind='goal' then perform private.wealth_money((p_data->>'target_amount')::numeric);end if;
  if kind='reserve' then perform private.wealth_money((p_data->>'essential_cost')::numeric);end if;
  if p_id is not null then
   select * into old_position from public.financial_positions where id=p_id and financial_profile_id=p_profile;
   if not found or old_position.kind<>kind then raise exception 'Record not found' using errcode='42501';end if;
   select current_value::numeric into balance from public.position_balances where id=p_id;
   if v_status='archived' and balance<>0 then raise exception 'Withdraw balance before archiving' using errcode='23514';end if;
   if v_status='completed' and balance<(p_data->>'target_amount')::numeric then raise exception 'Goal target not reached' using errcode='23514';end if;
   update public.financial_positions set name=p_data->>'name',description=p_data->>'description',institution=p_data->>'institution',ticker=p_data->>'ticker',investment_type=nullif(p_data->>'investment_type',''),target_amount=nullif(p_data->>'target_amount','')::numeric,target_date=nullif(p_data->>'target_date','')::date,essential_cost=nullif(p_data->>'essential_cost','')::numeric,target_months=nullif(p_data->>'target_months','')::integer,status=v_status where id=p_id returning id into result;
  else
   if v_status<>'active' then raise exception 'New positions must be active' using errcode='23514';end if;
   insert into public.financial_positions(financial_profile_id,kind,name,description,institution,ticker,investment_type,target_amount,target_date,essential_cost,target_months)
   values(p_profile,kind,p_data->>'name',p_data->>'description',p_data->>'institution',p_data->>'ticker',nullif(p_data->>'investment_type',''),nullif(p_data->>'target_amount','')::numeric,nullif(p_data->>'target_date','')::date,nullif(p_data->>'essential_cost','')::numeric,nullif(p_data->>'target_months','')::integer) returning id into result;
  end if;
 elsif p_entity='item' then
  perform private.wealth_money((p_data->>'amount')::numeric,true);
  if p_id is not null then
   update public.net_worth_items set name=p_data->>'name',kind=p_data->>'kind',category=p_data->>'category',amount=(p_data->>'amount')::numeric,notes=p_data->>'notes',active=(p_data->>'active')::boolean where id=p_id and financial_profile_id=p_profile returning id into result;
   if not found then raise exception 'Record not found' using errcode='42501';end if;
  else
   insert into public.net_worth_items(financial_profile_id,name,kind,category,amount,notes) values(p_profile,p_data->>'name',p_data->>'kind',p_data->>'category',(p_data->>'amount')::numeric,p_data->>'notes') returning id into result;
  end if;
 else raise exception 'Invalid entity' using errcode='23514';end if;
 return result;
end;$$;

create function public.wealth_purchase(p_profile uuid,p_card uuid,p_category uuid,p_description text,p_amount numeric,p_date date,p_count integer,p_kind text,p_notes text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.credit_cards;result uuid;v_month date;closing date;due date;invoice uuid;used numeric;total_cents numeric;base_cents numeric;remainder integer;n integer;
begin
 perform private.wealth_guard(p_profile);perform private.wealth_money(p_amount);
 select id into result from public.credit_card_purchases where financial_profile_id=p_profile and request_id=p_request;
 if found then return result;end if;
 select * into c from public.credit_cards where id=p_card and financial_profile_id=p_profile and active;
 if not found then raise exception 'Card not available' using errcode='42501';end if;
 if p_date is null or p_date>private.finance_today() or p_count is null or p_count not between 1 and 60 or p_amount*100<p_count then raise exception 'Invalid purchase date or installments' using errcode='23514';end if;
 select coalesce(sum(total::numeric),0) into used from public.card_invoice_totals where card_id=p_card and paid_on is null;
 if used+p_amount>c.credit_limit then raise exception 'Insufficient card limit' using errcode='23514';end if;
 v_month:=date_trunc('month',p_date)::date;
 if p_date>private.wealth_day(v_month,c.closing_day) then v_month:=(v_month+interval '1 month')::date;end if;
 insert into public.credit_card_purchases(financial_profile_id,card_id,category_id,description,amount,purchase_date,installment_count,expense_kind,notes,request_id)
 values(p_profile,p_card,p_category,p_description,p_amount,p_date,p_count,p_kind,p_notes,p_request) returning id into result;
 total_cents:=p_amount*100;base_cents:=floor(total_cents/p_count);remainder:=mod(total_cents,p_count)::integer;
 for n in 1..p_count loop
  closing:=private.wealth_day(v_month,c.closing_day);due:=private.wealth_day(v_month,c.due_day);
  if due<=closing then due:=private.wealth_day((v_month+interval '1 month')::date,c.due_day);end if;
  insert into public.credit_card_invoices(financial_profile_id,card_id,month,closes_on,due_on) values(p_profile,p_card,v_month,closing,due) on conflict(financial_profile_id,card_id,month) do nothing;
  select id into invoice from public.credit_card_invoices where financial_profile_id=p_profile and card_id=p_card and credit_card_invoices.month=v_month and paid_on is null;
  if not found then raise exception 'Invoice already paid' using errcode='23514';end if;
  insert into public.credit_card_installments(financial_profile_id,card_id,purchase_id,invoice_id,number,amount) values(p_profile,p_card,result,invoice,n,(base_cents+case when n<=remainder then 1 else 0 end)/100);
  v_month:=(v_month+interval '1 month')::date;
 end loop;
 return result;
end;$$;
create function public.wealth_cancel_purchase(p_profile uuid,p_purchase uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.wealth_guard(p_profile,true);
 if exists(select 1 from public.credit_card_installments i join public.credit_card_invoices v on v.id=i.invoice_id where i.financial_profile_id=p_profile and i.purchase_id=p_purchase and v.paid_on is not null) then raise exception 'Paid installments cannot be cancelled' using errcode='23514';end if;
 update public.credit_card_purchases set cancelled_at=coalesce(cancelled_at,now()) where id=p_purchase and financial_profile_id=p_profile;
 if not found then raise exception 'Record not found' using errcode='42501';end if;
end;$$;
create function public.wealth_pay_invoice(p_profile uuid,p_invoice uuid,p_account uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$
declare v public.credit_card_invoices;total numeric;
begin
 perform private.wealth_guard(p_profile,true);
 select * into v from public.credit_card_invoices where id=p_invoice and financial_profile_id=p_profile;
 if not found then raise exception 'Record not found' using errcode='42501';end if;
 if v.paid_on is not null then return;end if;
 if p_date is null or p_date>private.finance_today() or p_date<=v.closes_on then raise exception 'Pay only after closing, with no future date' using errcode='23514';end if;
 select sum(i.amount) into total from public.credit_card_installments i join public.credit_card_purchases p on p.id=i.purchase_id where i.invoice_id=p_invoice and p.cancelled_at is null;
 if coalesce(total,0)<=0 then raise exception 'Invoice has no balance' using errcode='23514';end if;
 insert into public.cash_settlements(financial_profile_id,account_id,invoice_id,delta,settled_on) values(p_profile,p_account,p_invoice,-total,p_date);
 update public.credit_card_invoices set paid_on=p_date where id=p_invoice;
end;$$;
create function public.wealth_move(p_profile uuid,p_position uuid,p_kind text,p_amount numeric,p_account uuid,p_date date,p_notes text,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.financial_positions;balance numeric;delta numeric;result uuid;
begin
 perform private.wealth_guard(p_profile);perform private.wealth_money(p_amount,p_kind='valuation');
 select id into result from public.position_movements where financial_profile_id=p_profile and request_id=p_request;if found then return result;end if;
 select * into p from public.financial_positions where id=p_position and financial_profile_id=p_profile and status<>'archived';
 if not found then raise exception 'Position not available' using errcode='42501';end if;
 if p_kind is null or p_kind not in ('deposit','withdrawal','yield','dividend','valuation') or (p.kind<>'investment' and p_kind not in ('deposit','withdrawal')) then raise exception 'Invalid movement type' using errcode='23514';end if;
 if p_date is null or p_date>private.finance_today() or exists(select 1 from public.position_movements where position_id=p_position and movement_date>p_date) then raise exception 'Movement must follow history and cannot be future' using errcode='23514';end if;
 if (p_kind in ('deposit','withdrawal'))<>(p_account is not null) then raise exception 'Invalid account for movement' using errcode='23514';end if;
 select current_value::numeric into balance from public.position_balances where id=p_position;
 delta:=case p_kind when 'withdrawal' then -p_amount when 'valuation' then p_amount-balance else p_amount end;
 if balance+delta<0 then raise exception 'Insufficient position balance' using errcode='23514';end if;
 insert into public.position_movements(financial_profile_id,position_id,kind,amount,delta,movement_date,notes,request_id) values(p_profile,p_position,p_kind,p_amount,delta,p_date,p_notes,p_request) returning id into result;
 if p_kind in ('deposit','withdrawal') then insert into public.cash_settlements(financial_profile_id,account_id,position_movement_id,delta,settled_on) values(p_profile,p_account,result,-delta,p_date);end if;
 if p.kind='goal' and p.status='completed' and balance+delta<p.target_amount then update public.financial_positions set status='active' where id=p_position;end if;
 return result;
end;$$;

-- All account effects are centralized here: consumer transactions and non-consumption settlements.
create or replace view public.financial_account_balances with(security_invoker=true) as
with effects as (
 select financial_profile_id,account_id,status,case when type='income' then amount else -amount end delta from public.transactions where status<>'cancelled'
 union all select financial_profile_id,destination_account_id,status,amount from public.transactions where type='transfer' and status<>'cancelled'
 union all select financial_profile_id,account_id,'completed',delta from public.cash_settlements
),totals as(select financial_profile_id,account_id,coalesce(sum(delta) filter(where status='completed'),0) settled,coalesce(sum(delta),0) projected from effects group by financial_profile_id,account_id)
select a.id,a.financial_profile_id,a.name,a.institution,a.kind,a.currency,a.opening_balance::text,
 (a.opening_balance+coalesce(t.settled,0))::text current_balance,(a.opening_balance+coalesce(t.projected,0))::text projected_balance,true as phase_three_ready,true as phase_four_ready
from public.accounts a left join totals t on t.account_id=a.id and t.financial_profile_id=a.financial_profile_id;
-- Purchases recognized ONCE, at purchase date. Invoice payments never enter this reporting source.
create view public.financial_reporting_transactions with(security_invoker=true) as
select id,financial_profile_id,account_id,destination_account_id,category_id,type,description,amount,transaction_date,due_date,status,notes,recurring_transaction_id,occurrence_date,created_at,expense_kind,'account'::text source,null::uuid card_id
from public.transactions
union all
select id,financial_profile_id,null::uuid,null::uuid,category_id,'expense',description,amount,purchase_date,null::date,case when cancelled_at is null then 'completed' else 'cancelled' end,notes,null::uuid,null::date,created_at,expense_kind,'card',card_id
from public.credit_card_purchases;
create or replace view public.financial_transaction_feed with(security_invoker=true) as
select t.id,t.financial_profile_id,t.account_id,t.destination_account_id,t.category_id,t.type,t.description,t.amount::text,
 t.transaction_date,t.due_date,t.status,t.notes,t.recurring_transaction_id,t.occurrence_date,t.created_at,
 case when t.status='pending' and coalesce(t.due_date,t.transaction_date)<private.finance_today() then 'overdue' else t.status end display_status,t.expense_kind,
 coalesce(a.name,cc.name) account_name,d.name destination_name,c.name category_name,c.color category_color,c.icon category_icon,t.source,t.card_id
from public.financial_reporting_transactions t
left join public.accounts a on a.id=t.account_id and a.financial_profile_id=t.financial_profile_id
left join public.accounts d on d.id=t.destination_account_id and d.financial_profile_id=t.financial_profile_id
left join public.credit_cards cc on cc.id=t.card_id and cc.financial_profile_id=t.financial_profile_id
left join public.transaction_categories c on c.id=t.category_id and c.financial_profile_id=t.financial_profile_id;
create view public.card_summaries with(security_invoker=true) as
select c.id,c.financial_profile_id,c.name,c.institution,c.brand,c.last_four,c.credit_limit::text,c.closing_day,c.due_day,c.payment_account_id,c.color,c.active,
 coalesce(t.used,0)::text used,(c.credit_limit-coalesce(t.used,0))::text available,round(100*coalesce(t.used,0)/c.credit_limit,2)::text utilization,
 next_invoice.id as current_invoice_id,next_invoice.month as current_month,coalesce(next_invoice.total,'0') current_total,next_invoice.due_on,next_invoice.status as invoice_status
from public.credit_cards c
left join(select card_id,sum(total::numeric) used from public.card_invoice_totals where paid_on is null group by card_id)t on t.card_id=c.id
left join lateral(select * from public.card_invoice_totals v where v.card_id=c.id and v.paid_on is null and v.total::numeric>0 order by v.due_on limit 1)next_invoice on true;
create view public.net_worth_totals with(security_invoker=true) as
with a as(select financial_profile_id,sum(greatest(current_balance::numeric,0)) cash,sum(greatest(-current_balance::numeric,0)) overdraft from public.financial_account_balances group by financial_profile_id),
p as(select financial_profile_id,sum(current_value::numeric) positions,sum(current_value::numeric) filter(where kind='investment') investments,sum(current_value::numeric) filter(where kind='goal') goals,sum(current_value::numeric) filter(where kind='reserve') reserves from public.position_balances group by financial_profile_id),
i as(select financial_profile_id,sum(amount) filter(where kind='asset') goods,sum(amount) filter(where kind='liability') debts from public.net_worth_items where active group by financial_profile_id),
c as(select financial_profile_id,sum(total::numeric) card_debt from public.card_invoice_totals where paid_on is null group by financial_profile_id)
select f.id financial_profile_id,coalesce(a.cash,0)::text accounts,coalesce(a.overdraft,0)::text overdraft,coalesce(p.investments,0)::text investments,coalesce(p.goals,0)::text goals,coalesce(p.reserves,0)::text reserves,coalesce(i.goods,0)::text goods,coalesce(i.debts,0)::text manual_debts,coalesce(c.card_debt,0)::text card_debt,
 (coalesce(a.cash,0)+coalesce(p.positions,0)+coalesce(i.goods,0))::text assets,
 (coalesce(a.overdraft,0)+coalesce(i.debts,0)+coalesce(c.card_debt,0))::text liabilities,
 (coalesce(a.cash,0)+coalesce(p.positions,0)+coalesce(i.goods,0)-coalesce(a.overdraft,0)-coalesce(i.debts,0)-coalesce(c.card_debt,0))::text net_worth
from public.financial_profiles f left join a on a.financial_profile_id=f.id left join p on p.financial_profile_id=f.id left join i on i.financial_profile_id=f.id left join c on c.financial_profile_id=f.id;
revoke all on public.financial_reporting_transactions,public.card_summaries,public.net_worth_totals from public,anon,authenticated;
grant select on public.financial_reporting_transactions,public.card_summaries,public.net_worth_totals to authenticated;

create function public.wealth_snapshot(p_profile uuid) returns void language plpgsql security definer set search_path='' as $$
declare t record;begin
 perform private.wealth_guard(p_profile);
 select * into t from public.net_worth_totals where financial_profile_id=p_profile;
 insert into public.net_worth_snapshots(financial_profile_id,snapshot_date,assets,liabilities,net_worth) values(p_profile,private.finance_today(),t.assets::numeric,t.liabilities::numeric,t.net_worth::numeric)
 on conflict(financial_profile_id,snapshot_date) do update set assets=excluded.assets,liabilities=excluded.liabilities,net_worth=excluded.net_worth,created_at=now();
end;$$;
create function public.wealth_overview(p_profile uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_output jsonb;begin
 if not private.can_access_profile(p_profile) then raise exception 'Access denied' using errcode='42501';end if;
 with positions as materialized(select * from public.position_balances where financial_profile_id=p_profile),
 investment_totals as(select coalesce(sum(deposited::numeric),0) deposited,coalesce(sum(withdrawn::numeric),0) withdrawn,coalesce(sum(current_value::numeric),0) current_value,coalesce(sum(result::numeric),0) result from positions where kind='investment'),
 history_days as(select m.movement_date,sum(m.delta) delta from public.position_movements m join public.financial_positions p on p.id=m.position_id and p.financial_profile_id=m.financial_profile_id where m.financial_profile_id=p_profile and p.kind='investment' group by m.movement_date),
 history as(select movement_date,sum(delta) over(order by movement_date) value from history_days)
 select jsonb_build_object(
 'cards',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.card_summaries c where financial_profile_id=p_profile),'[]'::jsonb),
 'positions',coalesce((select jsonb_agg(to_jsonb(p) order by created_at) from positions p),'[]'::jsonb),
 'net_worth',(select to_jsonb(n) from public.net_worth_totals n where financial_profile_id=p_profile),
 'items',coalesce((select jsonb_agg(to_jsonb(i)||jsonb_build_object('amount',amount::text) order by created_at) from public.net_worth_items i where financial_profile_id=p_profile),'[]'::jsonb),
 'snapshots',coalesce((select jsonb_agg(jsonb_build_object('date',snapshot_date,'value',net_worth::text) order by snapshot_date) from public.net_worth_snapshots where financial_profile_id=p_profile),'[]'::jsonb),
 'investment',jsonb_build_object('deposited',t.deposited::text,'withdrawn',t.withdrawn::text,'current_value',t.current_value::text,'result',t.result::text,'percentage',round(100*t.result/nullif(t.deposited,0),2)::text),
 'allocation',coalesce((select jsonb_agg(to_jsonb(x)) from(select investment_type as name,sum(current_value::numeric)::text value from positions where kind='investment' and current_value::numeric>0 group by investment_type)x),'[]'::jsonb),
 'investment_history',coalesce((select jsonb_agg(jsonb_build_object('date',movement_date,'value',value::text) order by movement_date) from history),'[]'::jsonb),
 'invoices_due',coalesce((select jsonb_agg(to_jsonb(v) order by due_on) from public.card_invoice_totals v where financial_profile_id=p_profile and paid_on is null and total::numeric>0 and due_on<private.finance_today()+7),'[]'::jsonb),
 'today',private.finance_today()) into v_output from investment_totals t;
 return v_output;
end;$$;
create function public.wealth_card_detail(p_profile uuid,p_card uuid,p_month date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare c public.credit_cards;v jsonb;m date;closing date;due date;begin
 if not private.can_access_profile(p_profile) then raise exception 'Access denied' using errcode='42501';end if;
 select * into c from public.credit_cards where id=p_card and financial_profile_id=p_profile;if not found then return null;end if;
 m:=date_trunc('month',p_month)::date;if m is null or m<date '1900-01-01' or m>date '2100-12-01' then raise exception 'Invalid month' using errcode='23514';end if;
 closing:=private.wealth_day(m,c.closing_day);due:=private.wealth_day(m,c.due_day);if due<=closing then due:=private.wealth_day((m+interval '1 month')::date,c.due_day);end if;
 select to_jsonb(i)||jsonb_build_object('payment_account_name',(select a.name from public.cash_settlements s join public.accounts a on a.id=s.account_id and a.financial_profile_id=s.financial_profile_id where s.invoice_id=i.id and s.financial_profile_id=p_profile)) into v from public.card_invoice_totals i where financial_profile_id=p_profile and card_id=p_card and month=m;
 return jsonb_build_object('card',(select to_jsonb(s) from public.card_summaries s where id=p_card),
 'invoice',coalesce(v,jsonb_build_object('id',null,'month',m,'closes_on',closing,'due_on',due,'total','0','paid_on',null,'status',case when due<private.finance_today() then 'closed' when closing<private.finance_today() then 'closed' else 'open' end)),
 'installments',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'purchase_id',p.id,'description',p.description,'category_name',cat.name,'purchase_date',p.purchase_date,'amount',i.amount::text,'purchase_total',p.amount::text,'number',i.number,'count',p.installment_count,'cancelled',p.cancelled_at is not null,'notes',p.notes) order by p.purchase_date,i.number)
 from public.credit_card_installments i join public.credit_card_purchases p on p.id=i.purchase_id and p.financial_profile_id=i.financial_profile_id join public.credit_card_invoices inv on inv.id=i.invoice_id join public.transaction_categories cat on cat.id=p.category_id where i.financial_profile_id=p_profile and i.card_id=p_card and inv.month=m),'[]'::jsonb));
end;$$;
create function public.wealth_history(p_profile uuid,p_position uuid,p_page integer default 1) returns jsonb language sql stable security invoker set search_path='' as $$
with rows as (select m.id,m.kind,m.amount::text,m.delta::text,m.movement_date,m.notes,m.created_at,a.name account_name from public.position_movements m left join public.cash_settlements s on s.position_movement_id=m.id and s.financial_profile_id=m.financial_profile_id left join public.accounts a on a.id=s.account_id where m.financial_profile_id=p_profile and m.position_id=p_position),
page as(select * from rows order by movement_date desc,created_at desc,id limit 30 offset (greatest(1,least(p_page,100000))-1)*30)
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from rows));$$;
grant execute on function private.wealth_day(date,integer) to authenticated;
-- Explicit RPC allowlist. No direct write grants exist on the new financial ledger tables.
revoke all on function public.wealth_save(uuid,text,uuid,jsonb),public.wealth_purchase(uuid,uuid,uuid,text,numeric,date,integer,text,text,uuid),public.wealth_cancel_purchase(uuid,uuid),public.wealth_pay_invoice(uuid,uuid,uuid,date),public.wealth_move(uuid,uuid,text,numeric,uuid,date,text,uuid),public.wealth_snapshot(uuid),public.wealth_overview(uuid),public.wealth_card_detail(uuid,uuid,date),public.wealth_history(uuid,uuid,integer) from public,anon;
grant execute on function public.wealth_save(uuid,text,uuid,jsonb),public.wealth_purchase(uuid,uuid,uuid,text,numeric,date,integer,text,text,uuid),public.wealth_cancel_purchase(uuid,uuid),public.wealth_pay_invoice(uuid,uuid,uuid,date),public.wealth_move(uuid,uuid,text,numeric,uuid,date,text,uuid),public.wealth_snapshot(uuid),public.wealth_overview(uuid),public.wealth_card_detail(uuid,uuid,date),public.wealth_history(uuid,uuid,integer) to authenticated;
create or replace function public.finance_dashboard(p_profile uuid,p_month date) returns jsonb
language sql stable security invoker set search_path='' as $$
with bounds as (select date_trunc('month',p_month)::date as first,(date_trunc('month',p_month)+interval '1 month')::date as last),
tx as (select t.* from public.financial_reporting_transactions t where financial_profile_id=p_profile),
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
  'income',m.income::text,'expense',m.expense::text,'result',(m.income-m.expense)::text,'payable',(m.payable+coalesce((select sum(total::numeric) from public.card_invoice_totals v cross join bounds b where v.financial_profile_id=p_profile and v.paid_on is null and v.due_on>=b.first and v.due_on<b.last),0))::text,'receivable',m.receivable::text,
  'history',(select jsonb_agg(jsonb_build_object('month',month,'income',income::text,'expense',expense::text) order by month) from history),
  'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'color',color,'amount',amount::text,'percentage',round(100*amount/nullif(m.expense,0),2)::text) order by amount desc) from categories),'[]'::jsonb),
  'recent',coalesce((select jsonb_agg(to_jsonb(recent)) from recent),'[]'::jsonb),
  'upcoming',coalesce((select jsonb_agg(to_jsonb(upcoming)) from upcoming),'[]'::jsonb)) from metrics m;
$$;


create or replace function public.finance_insights(p_profile uuid,p_month date,p_window text default 'month') returns jsonb
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
  with tx as materialized (select * from public.financial_reporting_transactions where financial_profile_id=p_profile),
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

commit;
