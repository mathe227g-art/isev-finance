-- Makes permanent deletion independent from legacy foreign-key actions.
begin;

create or replace function public.wealth_delete(p_profile uuid,p_entity text,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(
    select 1
    from public.financial_profiles
    where id=p_profile and owner_id=(select auth.uid())
  ) then
    raise exception 'Access denied' using errcode='42501';
  end if;

  if p_entity='card' then
    if not exists(
      select 1 from public.credit_cards
      where financial_profile_id=p_profile and id=p_id
    ) then
      raise exception 'Record not found' using errcode='P0002';
    end if;

    -- Some production databases still have the original RESTRICT constraints.
    -- Delete the complete card graph explicitly before deleting the card.
    delete from public.cash_settlements
    where financial_profile_id=p_profile
      and invoice_id in (
        select id from public.credit_card_invoices
        where financial_profile_id=p_profile and card_id=p_id
      );
    delete from public.credit_card_installments
    where financial_profile_id=p_profile and card_id=p_id;
    delete from public.credit_card_purchases
    where financial_profile_id=p_profile and card_id=p_id;
    delete from public.credit_card_invoices
    where financial_profile_id=p_profile and card_id=p_id;
    delete from public.credit_cards
    where financial_profile_id=p_profile and id=p_id;
  elsif p_entity='position' then
    delete from public.financial_positions
    where financial_profile_id=p_profile and id=p_id;
    if not found then
      raise exception 'Record not found' using errcode='P0002';
    end if;
  else
    raise exception 'Invalid entity' using errcode='22023';
  end if;
end;
$$;

revoke all on function public.wealth_delete(uuid,text,uuid) from public,anon;
grant execute on function public.wealth_delete(uuid,text,uuid) to authenticated;

commit;
