-- iSev Finance: small-business contacts, accountant access and audit history.
begin;
create table public.business_contacts (
  id uuid primary key default gen_random_uuid(),
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  kind text not null check(kind in ('client','supplier','both')),
  name text not null check(char_length(btrim(name)) between 2 and 120),
  document text not null default '' check(char_length(document)<=30),
  email text not null default '' check(char_length(email)<=254),
  phone text not null default '' check(char_length(phone)<=30),
  notes text not null default '' check(char_length(notes)<=2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(financial_profile_id,id)
);
create index business_contacts_profile_idx on public.business_contacts(financial_profile_id,kind,active,name);

alter table public.transactions add column contact_id uuid,
  add foreign key(financial_profile_id,contact_id) references public.business_contacts(financial_profile_id,id) on delete restrict;
create index transactions_contact_idx on public.transactions(financial_profile_id,contact_id) where contact_id is not null;

create table public.financial_activity_log (
  id bigint generated always as identity primary key,
  financial_profile_id uuid not null references public.financial_profiles(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('insert','update','delete','member_add','member_remove')),
  entity text not null check(char_length(entity) between 2 and 80),
  record_id uuid,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index financial_activity_profile_idx on public.financial_activity_log(financial_profile_id,created_at desc,id desc);
create index financial_activity_actor_idx on public.financial_activity_log(actor_id) where actor_id is not null;

alter table public.business_contacts enable row level security;
alter table public.financial_activity_log enable row level security;
revoke all on public.business_contacts,public.financial_activity_log from public,anon,authenticated;
grant select on public.business_contacts,public.financial_activity_log to authenticated;
grant insert(financial_profile_id,kind,name,document,email,phone,notes),update(kind,name,document,email,phone,notes,active) on public.business_contacts to authenticated;
grant insert(contact_id),update(contact_id) on public.transactions to authenticated;
create policy business_contacts_read on public.business_contacts for select to authenticated using(private.can_access_profile(financial_profile_id));
create policy business_contacts_create on public.business_contacts for insert to authenticated with check(private.can_write_profile(financial_profile_id));
create policy business_contacts_update on public.business_contacts for update to authenticated using(private.can_write_profile(financial_profile_id)) with check(private.can_write_profile(financial_profile_id));
create policy business_contacts_delete on public.business_contacts for delete to authenticated using(private.owns_profile(financial_profile_id));
create policy financial_activity_read on public.financial_activity_log for select to authenticated using(private.can_access_profile(financial_profile_id));

create function private.audit_financial_change() returns trigger language plpgsql security definer set search_path='' as $$
declare payload jsonb; profile uuid; record uuid;
begin
  payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  profile:=(payload->>'financial_profile_id')::uuid;
  record:=nullif(payload->>'id','')::uuid;
  insert into public.financial_activity_log(financial_profile_id,actor_id,action,entity,record_id,summary)
  values(profile,(select auth.uid()),lower(tg_op),tg_table_name,record,
    jsonb_strip_nulls(jsonb_build_object('label',coalesce(payload->>'description',payload->>'name'),'type',coalesce(payload->>'type',payload->>'kind'),'amount',payload->>'amount','status',payload->>'status')));
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_financial_change() from public,anon,authenticated;
create trigger audit_accounts after insert or update or delete on public.accounts for each row execute function private.audit_financial_change();
create trigger audit_categories after insert or update or delete on public.transaction_categories for each row execute function private.audit_financial_change();
create trigger audit_transactions after insert or update or delete on public.transactions for each row execute function private.audit_financial_change();
create trigger audit_recurring after insert or update or delete on public.recurring_transactions for each row execute function private.audit_financial_change();
create trigger audit_budgets after insert or update or delete on public.monthly_budgets for each row execute function private.audit_financial_change();
create trigger audit_cards after insert or update or delete on public.credit_cards for each row execute function private.audit_financial_change();
create trigger audit_purchases after insert or update or delete on public.credit_card_purchases for each row execute function private.audit_financial_change();
create trigger audit_positions after insert or update or delete on public.financial_positions for each row execute function private.audit_financial_change();
create trigger audit_contacts after insert or update or delete on public.business_contacts for each row execute function private.audit_financial_change();

create function public.profile_add_member_by_email(p_profile uuid,p_email text,p_role text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if not private.owns_profile(p_profile) then raise exception 'Owner access required' using errcode='42501'; end if;
  if p_role not in ('viewer','editor') or char_length(btrim(coalesce(p_email,'')))>254 then raise exception 'Invalid member data' using errcode='22023'; end if;
  select id into target from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null;
  if target is null then raise exception 'Confirmed account not found' using errcode='22023'; end if;
  if target=(select owner_id from public.financial_profiles where id=p_profile) then raise exception 'Owner already belongs to profile' using errcode='22023'; end if;
  insert into public.financial_profile_members(financial_profile_id,user_id,role) values(p_profile,target,p_role)
  on conflict(financial_profile_id,user_id) do update set role=excluded.role where public.financial_profile_members.role<>'owner';
  insert into public.financial_activity_log(financial_profile_id,actor_id,action,entity,record_id,summary)
  values(p_profile,(select auth.uid()),'member_add','financial_profile_members',target,jsonb_build_object('role',p_role));
  return target;
end;
$$;
create function public.profile_remove_member(p_profile uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not private.owns_profile(p_profile) then raise exception 'Owner access required' using errcode='42501'; end if;
  if p_user=(select owner_id from public.financial_profiles where id=p_profile) then raise exception 'Owner cannot be removed' using errcode='22023'; end if;
  delete from public.financial_profile_members where financial_profile_id=p_profile and user_id=p_user and role<>'owner';
  if not found then raise exception 'Member not found' using errcode='22023'; end if;
  insert into public.financial_activity_log(financial_profile_id,actor_id,action,entity,record_id)
  values(p_profile,(select auth.uid()),'member_remove','financial_profile_members',p_user);
end;
$$;
create function public.business_receivables(p_profile uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
select coalesce(jsonb_agg(to_jsonb(x) order by x.total::numeric desc),'[]'::jsonb) from (
  select c.id,c.name,count(t.id)::integer items,coalesce(sum(t.amount),0)::text total,min(coalesce(t.due_date,t.transaction_date))::text next_due
  from public.business_contacts c left join public.transactions t on t.financial_profile_id=c.financial_profile_id and t.contact_id=c.id and t.type='income' and t.status='pending'
  where c.financial_profile_id=p_profile and c.kind in ('client','both') and private.can_access_profile(p_profile)
  group by c.id,c.name having count(t.id)>0
) x;
$$;
create function public.profile_team(p_profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not private.owns_profile(p_profile) then raise exception 'Owner access required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'full_name',p.full_name) order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end,p.full_name),'[]'::jsonb) into result
  from public.financial_profile_members m join public.profiles p on p.id=m.user_id where m.financial_profile_id=p_profile;
  return result;
end;
$$;
revoke all on function public.profile_add_member_by_email(uuid,text,text),public.profile_remove_member(uuid,uuid),public.business_receivables(uuid),public.profile_team(uuid) from public,anon;
grant execute on function public.profile_add_member_by_email(uuid,text,text),public.profile_remove_member(uuid,uuid),public.business_receivables(uuid),public.profile_team(uuid) to authenticated;
commit;
