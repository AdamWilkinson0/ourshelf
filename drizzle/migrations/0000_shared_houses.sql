create table public.shelf_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40)
);

create table public.shelf_houses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  revision integer not null default 0,
  kitchen jsonb not null default '{"food":[],"requests":[],"ledger":[]}'::jsonb
);

create table public.shelf_members (
  house_id uuid references public.shelf_houses(id) on delete cascade,
  user_id uuid references public.shelf_profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  primary key (house_id, user_id)
);

create index shelf_members_user on public.shelf_members(user_id);
create unique index shelf_house_owner on public.shelf_members(house_id) where role = 'owner';

create table public.shelf_invites (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  house_id uuid not null references public.shelf_houses(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create unique index shelf_active_invite on public.shelf_invites(house_id) where revoked_at is null;

alter table public.shelf_profiles enable row level security;
alter table public.shelf_houses enable row level security;
alter table public.shelf_members enable row level security;
alter table public.shelf_invites enable row level security;
revoke all on public.shelf_profiles, public.shelf_houses, public.shelf_members, public.shelf_invites
  from public, anon, authenticated;
grant select, insert, update, delete
  on public.shelf_profiles, public.shelf_houses, public.shelf_members, public.shelf_invites
  to service_role;

create function public.shelf_create_house(p_user uuid, p_name text)
returns uuid language plpgsql set search_path = '' as $$
declare new_house uuid;
begin
  insert into public.shelf_houses(name) values (trim(p_name)) returning id into new_house;
  insert into public.shelf_members(house_id, user_id, role) values (new_house, p_user, 'owner');
  return new_house;
end;
$$;

create function public.shelf_change_invite(p_user uuid, p_house uuid, p_hash text)
returns timestamptz language plpgsql set search_path = '' as $$
declare expiry timestamptz;
begin
  perform 1 from public.shelf_houses where id = p_house for update;
  if not exists (
    select 1 from public.shelf_members where house_id = p_house and user_id = p_user and role = 'owner'
  ) then
    raise exception 'Only the house owner can manage invitations' using errcode = '42501';
  end if;
  update public.shelf_invites set revoked_at = now()
    where house_id = p_house and revoked_at is null;
  if p_hash is not null then
    expiry := now() + interval '7 days';
    insert into public.shelf_invites(token_hash, house_id, expires_at) values (p_hash, p_house, expiry);
  end if;
  return expiry;
end;
$$;

create function public.shelf_redeem_invite(p_user uuid, p_hash text)
returns uuid language plpgsql set search_path = '' as $$
declare target_house uuid;
begin
  select house_id into target_house from public.shelf_invites where token_hash = p_hash;
  if target_house is null then return null; end if;
  perform 1 from public.shelf_houses where id = target_house for update;
  if not found then return null; end if;
  if exists (
    select 1 from public.shelf_members where house_id = target_house and user_id = p_user
  ) then return target_house; end if;
  if not exists (
    select 1 from public.shelf_invites
      where token_hash = p_hash and revoked_at is null and expires_at > now()
  ) then return null; end if;
  insert into public.shelf_members(house_id, user_id, role) values (target_house, p_user, 'member')
    on conflict (house_id, user_id) do nothing;
  return target_house;
end;
$$;

revoke execute on function public.shelf_create_house(uuid, text),
  public.shelf_change_invite(uuid, uuid, text), public.shelf_redeem_invite(uuid, text)
  from public, anon, authenticated;
grant execute on function public.shelf_create_house(uuid, text),
  public.shelf_change_invite(uuid, uuid, text), public.shelf_redeem_invite(uuid, text)
  to service_role;