-- 결혼 준비 체크리스트 — 초기 스키마
-- 사용자는 이주호·송지영 2명. 모든 접근은 allowed_emails 화이트리스트로 통제한다.

-- ────────────────────────────────────────────────
-- 1. 접근 통제
-- ────────────────────────────────────────────────

-- 로그인이 허용된 이메일. 여기에 없는 사람은 가입해도 members에 들어가지 못하고,
-- 따라서 아래 모든 RLS 정책에서 전부 거부된다.
create table public.allowed_emails (
  email        text primary key,
  display_name text not null
);

-- 실제 가입이 완료된 사용자. auth.users와 1:1.
create table public.members (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- 최초 로그인 시 화이트리스트에 있으면 자동으로 members에 등록.
-- 화이트리스트에 없으면 아무 일도 일어나지 않는다(= 데이터가 하나도 안 보임).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.members (id, display_name)
  select new.id, a.display_name
    from public.allowed_emails a
   where lower(a.email) = lower(new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS 정책이 매번 호출하는 헬퍼. members를 직접 참조하면 재귀가 되므로 security definer.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where id = auth.uid());
$$;

-- ────────────────────────────────────────────────
-- 2. 도메인 타입
-- ────────────────────────────────────────────────

create type public.task_status as enum ('todo', 'doing', 'done', 'hold');
create type public.assignee    as enum ('주호', '지영', '같이');

-- ────────────────────────────────────────────────
-- 3. 본체
-- ────────────────────────────────────────────────

create table public.vendors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text,
  contact    text,
  url        text,
  memo       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  note       text,
  category   text not null,
  due_date   date,
  assignee   public.assignee,
  status     public.task_status not null default 'todo',
  vendor_id  uuid references public.vendors(id) on delete set null,
  -- 정수 대신 실수를 쓰면 두 항목 사이에 끼워 넣을 때 전체 재번호매김이 필요 없다.
  sort_order double precision not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_items (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  category   text,
  -- 금액은 원 단위 정수. 부동소수를 쓰면 합계에서 오차가 난다.
  estimate   bigint,
  actual     bigint,
  paid_at    date,
  vendor_id  uuid references public.vendors(id) on delete set null,
  memo       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_status_idx   on public.tasks (status);
create index tasks_due_date_idx on public.tasks (due_date);
create index tasks_category_idx on public.tasks (category);
create index budget_vendor_idx  on public.budget_items (vendor_id);

-- ────────────────────────────────────────────────
-- 4. 트리거
-- ────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger vendors_touch      before update on public.vendors
  for each row execute function public.touch_updated_at();
create trigger tasks_touch        before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger budget_items_touch before update on public.budget_items
  for each row execute function public.touch_updated_at();

-- 상태가 done으로 바뀌는 순간 완료 시각을 자동 기록하고, 되돌리면 지운다.
create or replace function public.sync_done_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.done_at := now();
  elsif new.status <> 'done' then
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_done_at before insert or update on public.tasks
  for each row execute function public.sync_done_at();

-- ────────────────────────────────────────────────
-- 5. RLS — 두 사람만 읽고 쓴다
-- ────────────────────────────────────────────────

alter table public.allowed_emails enable row level security;
alter table public.members        enable row level security;
alter table public.vendors        enable row level security;
alter table public.tasks          enable row level security;
alter table public.budget_items   enable row level security;

-- 화이트리스트는 조회만 가능. 수정은 service_role(대시보드/CLI)만.
create policy allowed_emails_read on public.allowed_emails
  for select using (public.is_member());

create policy members_read on public.members
  for select using (public.is_member());

-- 나머지 3개 테이블은 멤버에게 전권. 둘이 대등하게 편집한다.
create policy vendors_all on public.vendors
  for all using (public.is_member()) with check (public.is_member());

create policy tasks_all on public.tasks
  for all using (public.is_member()) with check (public.is_member());

create policy budget_items_all on public.budget_items
  for all using (public.is_member()) with check (public.is_member());

-- ────────────────────────────────────────────────
-- 6. Realtime — 한쪽이 체크하면 상대 화면에 즉시 반영
-- ────────────────────────────────────────────────

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.budget_items;
alter publication supabase_realtime add table public.vendors;

-- UPDATE/DELETE 이벤트에서 변경 전 행을 받으려면 replica identity가 full이어야 한다.
alter table public.tasks        replica identity full;
alter table public.budget_items replica identity full;
alter table public.vendors      replica identity full;
