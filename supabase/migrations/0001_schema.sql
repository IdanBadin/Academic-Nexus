-- Academic Nexus - core schema, roles, RLS, indexes, realtime, signup trigger.
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------------
do $$
begin
  create type app_role as enum ('student', 'expert', 'admin');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id)
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role app_role not null,
  bio text,
  avatar_url text,
  subjects text[],
  is_verified boolean default false,
  is_suspended boolean default false,
  created_at timestamptz default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid references profiles(id) on delete cascade,
  subject text not null,
  level text not null,
  format text not null check (format in ('lesson','review','exam_prep','project')),
  description text,
  price numeric not null,
  duration_min integer not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  expert_id uuid references profiles(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  student_id uuid references profiles(id),
  expert_id uuid references profiles(id),
  slot_datetime timestamptz not null,
  status text not null default 'requested' check (status in ('requested','accepted','declined','confirmed','in_progress','completed','canceled','failed')),
  student_note text,
  price numeric not null,
  created_at timestamptz default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  stripe_ref text,
  created_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) unique,
  student_id uuid references profiles(id),
  expert_id uuid references profiles(id),
  rating integer not null check (rating between 1 and 5),
  text text,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  sender_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

create table if not exists event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  role app_role,
  event_type text not null,
  entity text,
  status text,
  message text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 3. Role helper functions
--    has_role MUST be security definer: policies on user_roles would otherwise
--    recurse into themselves when another table's policy reads user_roles.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin'::app_role);
$$;

-- ---------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------
alter table user_roles  enable row level security;
alter table profiles    enable row level security;
alter table listings    enable row level security;
alter table availability enable row level security;
alter table bookings    enable row level security;
alter table payments    enable row level security;
alter table reviews     enable row level security;
alter table messages    enable row level security;
alter table event_logs  enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_select_authenticated on profiles;
create policy profiles_select_authenticated
  on profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists profiles_update_admin on profiles;
create policy profiles_update_admin
  on profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- user_roles -----------------------------------------------------------------
drop policy if exists user_roles_select_own on user_roles;
create policy user_roles_select_own
  on user_roles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_roles_select_admin on user_roles;
create policy user_roles_select_admin
  on user_roles for select
  to authenticated
  using (public.is_admin());

drop policy if exists user_roles_insert_own on user_roles;
create policy user_roles_insert_own
  on user_roles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- listings -------------------------------------------------------------------
drop policy if exists listings_select on listings;
create policy listings_select
  on listings for select
  to authenticated
  using (is_active = true or expert_id = auth.uid() or public.is_admin());

drop policy if exists listings_insert_own on listings;
create policy listings_insert_own
  on listings for insert
  to authenticated
  with check (expert_id = auth.uid());

drop policy if exists listings_update_own on listings;
create policy listings_update_own
  on listings for update
  to authenticated
  using (expert_id = auth.uid())
  with check (expert_id = auth.uid());

drop policy if exists listings_delete_own on listings;
create policy listings_delete_own
  on listings for delete
  to authenticated
  using (expert_id = auth.uid());

-- availability ---------------------------------------------------------------
drop policy if exists availability_select on availability;
create policy availability_select
  on availability for select
  to authenticated
  using (true);

drop policy if exists availability_insert_own on availability;
create policy availability_insert_own
  on availability for insert
  to authenticated
  with check (expert_id = auth.uid());

drop policy if exists availability_update_own on availability;
create policy availability_update_own
  on availability for update
  to authenticated
  using (expert_id = auth.uid())
  with check (expert_id = auth.uid());

drop policy if exists availability_delete_own on availability;
create policy availability_delete_own
  on availability for delete
  to authenticated
  using (expert_id = auth.uid());

-- bookings -------------------------------------------------------------------
drop policy if exists bookings_select_party on bookings;
create policy bookings_select_party
  on bookings for select
  to authenticated
  using (student_id = auth.uid() or expert_id = auth.uid() or public.is_admin());

drop policy if exists bookings_insert_student on bookings;
create policy bookings_insert_student
  on bookings for insert
  to authenticated
  with check (student_id = auth.uid());

drop policy if exists bookings_update_party on bookings;
create policy bookings_update_party
  on bookings for update
  to authenticated
  using (student_id = auth.uid() or expert_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or expert_id = auth.uid() or public.is_admin());

-- payments -------------------------------------------------------------------
drop policy if exists payments_select_party on payments;
create policy payments_select_party
  on payments for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from bookings b
      where b.id = payments.booking_id
        and (b.student_id = auth.uid() or b.expert_id = auth.uid())
    )
  );

drop policy if exists payments_insert_party on payments;
create policy payments_insert_party
  on payments for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from bookings b
      where b.id = booking_id
        and (b.student_id = auth.uid() or b.expert_id = auth.uid())
    )
  );

drop policy if exists payments_update_party on payments;
create policy payments_update_party
  on payments for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from bookings b
      where b.id = payments.booking_id
        and (b.student_id = auth.uid() or b.expert_id = auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from bookings b
      where b.id = booking_id
        and (b.student_id = auth.uid() or b.expert_id = auth.uid())
    )
  );

-- reviews --------------------------------------------------------------------
drop policy if exists reviews_select_authenticated on reviews;
create policy reviews_select_authenticated
  on reviews for select
  to authenticated
  using (true);

drop policy if exists reviews_insert_student on reviews;
create policy reviews_insert_student
  on reviews for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from bookings b
      where b.id = booking_id
        and b.student_id = auth.uid()
        and b.status = 'completed'
    )
  );

drop policy if exists reviews_update_own on reviews;
create policy reviews_update_own
  on reviews for update
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- messages -------------------------------------------------------------------
drop policy if exists messages_select_party on messages;
create policy messages_select_party
  on messages for select
  to authenticated
  using (
    exists (
      select 1 from bookings b
      where b.id = messages.booking_id
        and (b.student_id = auth.uid() or b.expert_id = auth.uid())
    )
  );

drop policy if exists messages_insert_party on messages;
create policy messages_insert_party
  on messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from bookings b
      where b.id = booking_id
        and (b.student_id = auth.uid() or b.expert_id = auth.uid())
    )
  );

-- event_logs -----------------------------------------------------------------
drop policy if exists event_logs_insert_own on event_logs;
create policy event_logs_insert_own
  on event_logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists event_logs_select_own on event_logs;
create policy event_logs_select_own
  on event_logs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists event_logs_select_admin on event_logs;
create policy event_logs_select_admin
  on event_logs for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_user_roles_user_id      on user_roles(user_id);
create index if not exists idx_listings_expert_id      on listings(expert_id);
create index if not exists idx_listings_subject        on listings(subject);
create index if not exists idx_listings_is_active      on listings(is_active);
create index if not exists idx_availability_expert_id  on availability(expert_id);
create index if not exists idx_bookings_listing_id     on bookings(listing_id);
create index if not exists idx_bookings_student_id     on bookings(student_id);
create index if not exists idx_bookings_expert_id      on bookings(expert_id);
create index if not exists idx_bookings_status         on bookings(status);
create index if not exists idx_bookings_slot_datetime  on bookings(slot_datetime);
create index if not exists idx_payments_booking_id     on payments(booking_id);
create index if not exists idx_reviews_booking_id      on reviews(booking_id);
create index if not exists idx_reviews_student_id      on reviews(student_id);
create index if not exists idx_reviews_expert_id       on reviews(expert_id);
create index if not exists idx_messages_booking_id     on messages(booking_id);
create index if not exists idx_messages_sender_id      on messages(sender_id);
create index if not exists idx_messages_booking_created on messages(booking_id, created_at);
create index if not exists idx_event_logs_user_id      on event_logs(user_id);
create index if not exists idx_event_logs_created_at   on event_logs(created_at desc);
create index if not exists idx_event_logs_event_type   on event_logs(event_type);

-- ---------------------------------------------------------------------------
-- 6. Realtime on messages
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Signup trigger
--    Creates profiles + user_roles rows straight from auth metadata, so signup
--    works even when the client side insert is blocked by RLS.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
begin
  begin
    v_role := coalesce(new.raw_user_meta_data ->> 'role', 'student')::app_role;
  exception
    when others then
      v_role := 'student'::app_role;
  end;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_role
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, v_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
