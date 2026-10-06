-- Documents (photos, pièces) + abonnements push + stockage privé
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users,
  owner_id uuid not null, name text not null, path text not null,
  created_at timestamptz default now()
);
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users,
  endpoint text unique not null, p256dh text not null, auth text not null
);
alter table documents enable row level security;
alter table push_subscriptions enable row level security;
create policy "own rows" on documents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('docs', 'docs', false);
create policy "own files" on storage.objects for all
  using (bucket_id = 'docs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Envoi quotidien à 13h UTC (≈ 8h-9h à Port-au-Prince). Remplacer PROJECT_REF et SERVICE_ROLE_KEY.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('daily-reminders', '0 13 * * *', $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer SERVICE_ROLE_KEY'))
$$);
