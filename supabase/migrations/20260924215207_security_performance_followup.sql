-- Phase 5 follow-up from Supabase Security and Performance Advisors.
begin;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public,anon,authenticated';
  end if;
end $$;
create index import_batches_user_idx on public.import_batches(user_id);
commit;
