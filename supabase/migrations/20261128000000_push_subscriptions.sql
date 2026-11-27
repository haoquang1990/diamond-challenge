-- Story 057: web push. Where to send notifications for an account (one row per browser).
--
-- * Owner-only: an account reads and deletes its own rows; nobody writes the table directly.
-- * `register_push_subscription` stores this browser for the caller. A browser endpoint is
--   unique, so when the same browser signs in as another account the row moves to that account.
-- * Only Edge Functions (service role) read other accounts' rows, to send a push.
-- * `cheers.notified_at`: set by notify-cheer, so one cheer is pushed at most once.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) <= 2048),
  p256dh text not null check (length(p256dh) between 1 and 512),
  auth text not null check (length(auth) between 1 and 512),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "owners read their push subscriptions" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owners delete their push subscriptions" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update on public.push_subscriptions from anon, authenticated;

create function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;

create function public.unregister_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

revoke execute on function public.register_push_subscription(text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;
revoke execute on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.unregister_push_subscription(text) to authenticated;

alter table public.cheers add column notified_at timestamptz;
