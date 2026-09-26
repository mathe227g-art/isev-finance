-- Enables explicit, owner-confirmed deletion flows. Review before applying.
begin;

create or replace function private.audit_financial_change() returns trigger language plpgsql security definer set search_path='' as $$
declare payload jsonb; profile uuid; record uuid;
begin
  payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  profile:=(payload->>'financial_profile_id')::uuid;
  record:=nullif(payload->>'id','')::uuid;
  -- Profile cascades run after the parent is gone; there is no audit scope left to retain.
  if not exists(select 1 from public.financial_profiles where id=profile) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  insert into public.financial_activity_log(financial_profile_id,actor_id,action,entity,record_id,summary)
  values(profile,(select auth.uid()),lower(tg_op),tg_table_name,record,
    jsonb_strip_nulls(jsonb_build_object('label',coalesce(payload->>'description',payload->>'name'),'type',coalesce(payload->>'type',payload->>'kind'),'amount',payload->>'amount','status',payload->>'status')));
  return case when tg_op='DELETE' then old else new end;
end;
$$;

alter table public.credit_card_installments drop constraint if exists credit_card_installments_financial_profile_id_purchase_id_card_id_fkey;
alter table public.credit_card_installments add constraint credit_card_installments_purchase_fkey foreign key(financial_profile_id,purchase_id,card_id) references public.credit_card_purchases(financial_profile_id,id,card_id) on delete cascade;
alter table public.credit_card_installments drop constraint if exists credit_card_installments_financial_profile_id_invoice_id_card_id_fkey;
alter table public.credit_card_installments add constraint credit_card_installments_invoice_fkey foreign key(financial_profile_id,invoice_id,card_id) references public.credit_card_invoices(financial_profile_id,id,card_id) on delete cascade;

alter table public.cash_settlements drop constraint if exists cash_settlements_financial_profile_id_invoice_id_fkey;
alter table public.cash_settlements add constraint cash_settlements_invoice_fkey foreign key(financial_profile_id,invoice_id) references public.credit_card_invoices(financial_profile_id,id) on delete cascade;
alter table public.cash_settlements drop constraint if exists cash_settlements_financial_profile_id_position_movement_id_fkey;
alter table public.cash_settlements add constraint cash_settlements_position_movement_fkey foreign key(financial_profile_id,position_movement_id) references public.position_movements(financial_profile_id,id) on delete cascade;

alter table public.credit_card_purchases drop constraint if exists credit_card_purchases_financial_profile_id_card_id_fkey;
alter table public.credit_card_purchases add constraint credit_card_purchases_card_fkey foreign key(financial_profile_id,card_id) references public.credit_cards(financial_profile_id,id) on delete cascade;
alter table public.credit_card_invoices drop constraint if exists credit_card_invoices_financial_profile_id_card_id_fkey;
alter table public.credit_card_invoices add constraint credit_card_invoices_card_fkey foreign key(financial_profile_id,card_id) references public.credit_cards(financial_profile_id,id) on delete cascade;
alter table public.position_movements drop constraint if exists position_movements_financial_profile_id_position_id_fkey;
alter table public.position_movements add constraint position_movements_position_fkey foreign key(financial_profile_id,position_id) references public.financial_positions(financial_profile_id,id) on delete cascade;

alter table public.credit_cards drop constraint if exists credit_cards_financial_profile_id_fkey;
alter table public.credit_cards add constraint credit_cards_profile_fkey foreign key(financial_profile_id) references public.financial_profiles(id) on delete cascade;
alter table public.financial_positions drop constraint if exists financial_positions_financial_profile_id_fkey;
alter table public.financial_positions add constraint financial_positions_profile_fkey foreign key(financial_profile_id) references public.financial_profiles(id) on delete cascade;
alter table public.net_worth_items drop constraint if exists net_worth_items_financial_profile_id_fkey;
alter table public.net_worth_items add constraint net_worth_items_profile_fkey foreign key(financial_profile_id) references public.financial_profiles(id) on delete cascade;
alter table public.net_worth_snapshots drop constraint if exists net_worth_snapshots_financial_profile_id_fkey;
alter table public.net_worth_snapshots add constraint net_worth_snapshots_profile_fkey foreign key(financial_profile_id) references public.financial_profiles(id) on delete cascade;

alter table public.transactions drop constraint if exists transactions_financial_profile_id_import_batch_id_fkey;
alter table public.transactions add constraint transactions_import_batch_fkey foreign key(financial_profile_id,import_batch_id) references public.import_batches(financial_profile_id,id) on delete set null;
alter table public.import_batches drop constraint if exists import_batches_user_id_fkey;
alter table public.import_batches add constraint import_batches_user_fkey foreign key(user_id) references auth.users(id) on delete cascade;

create or replace function public.wealth_delete(p_profile uuid,p_entity text,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.financial_profiles where id=p_profile and owner_id=(select auth.uid())) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if p_entity='card' then
    delete from public.credit_cards where financial_profile_id=p_profile and id=p_id;
  elsif p_entity='position' then
    delete from public.financial_positions where financial_profile_id=p_profile and id=p_id;
  else
    raise exception 'Invalid entity' using errcode='22023';
  end if;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
end;
$$;
revoke all on function public.wealth_delete(uuid,text,uuid) from public,anon;
grant execute on function public.wealth_delete(uuid,text,uuid) to authenticated;

commit;
