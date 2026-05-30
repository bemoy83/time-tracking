create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_catalog_snapshots (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  schema_version text not null,
  catalog_version text not null,
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.workspace_catalog_snapshots enable row level security;

create policy "members can read workspaces"
  on public.workspaces for select
  using (
    created_by = auth.uid()
    or
    exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = id and m.user_id = auth.uid()
    )
  );

create policy "authenticated users can create own workspace"
  on public.workspaces for insert
  with check (created_by = auth.uid());

create policy "owners can update workspaces"
  on public.workspaces for update
  using (
    exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = id and m.user_id = auth.uid() and m.role = 'owner'
    )
  );

create policy "members can read memberships"
  on public.workspace_memberships for select
  using (user_id = auth.uid());

create policy "workspace creators can add owner membership"
  on public.workspace_memberships for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.created_by = auth.uid()
    )
  );

create policy "members can read catalog snapshots"
  on public.workspace_catalog_snapshots for select
  using (
    exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = public.workspace_catalog_snapshots.workspace_id
        and m.user_id = auth.uid()
    )
  );

create policy "members can write catalog snapshots"
  on public.workspace_catalog_snapshots for insert
  with check (
    updated_by = auth.uid()
    and exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = public.workspace_catalog_snapshots.workspace_id
        and m.user_id = auth.uid()
    )
  );

create policy "members can update catalog snapshots"
  on public.workspace_catalog_snapshots for update
  using (
    exists (
      select 1 from public.workspace_memberships m
      where m.workspace_id = public.workspace_catalog_snapshots.workspace_id
        and m.user_id = auth.uid()
    )
  )
  with check (updated_by = auth.uid());
