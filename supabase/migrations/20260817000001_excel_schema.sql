-- 엑셀(결혼준비_최종본.xlsx) 구조를 반영한 스키마 확장 (2026-08-17)
--
-- 사용자가 실제로 채워 넣은 엑셀에는 이 앱에 없던 개념이 세 가지 있다.
--
--   ① 예산 ≠ 계약금액 ≠ 실지출
--      기존에는 estimate(견적)와 actual(실지출) 둘뿐이었다. 실제로는 그 사이에
--      "계약금액"이 있다. 예산은 잡아둔 돈, 계약금액은 업체와 확정한 금액,
--      실지출은 지금까지 실제로 나간 돈이다. 셋이 다 다르고, 특히
--      "미지급 잔금 = 계약금액 − 실지출"이 앞으로 낼 돈이라 가장 중요하다.
--
--   ② 결제 원장
--      계약금·중도금·잔금이 여러 번 나뉘어 나간다. 누가 언제 얼마를 어떤 수단으로
--      냈는지 한 줄씩 쌓아야 한다. budget_items 의 actual 한 칸으로는 표현이 안 된다.
--      엑셀은 이걸 <결제내역> 시트로 분리하고 대분류+항목으로 자동 합산한다.
--
--   ③ 하객 명단 · 축의금
--      축의금이 예식 비용의 주 재원인데 앱에 아예 없었다. 명단·참석여부·식사인원·
--      축의금을 관리해야 보증인원 통보(D-2주)와 당일 정산이 가능하다.
--
-- 예식일은 2027-09-04(토) 11:00 으로 확정됐다. 다른 날짜·시간은 더 이상 고려하지 않는다.

-- ────────────────────────────────────────────────
-- 1. budget_items 확장
-- ────────────────────────────────────────────────

alter table public.budget_items
  add column if not exists contracted   bigint,
  add column if not exists vendor_name  text,
  add column if not exists vendor_contact text,
  add column if not exists due_on       date,
  add column if not exists deal_status  text,
  add column if not exists owner        public.assignee,
  add column if not exists sort_order   double precision not null default 0;

comment on column public.budget_items.contracted is
  '업체와 확정한 계약금액. 예산(estimate)은 잡아둔 돈이고 이쪽이 실제로 물린 금액이다. '
  '미지급 잔금 = contracted − 실지출 합계.';
comment on column public.budget_items.deal_status is
  '미정 · 견적중 · 가계약 · 계약완료 · 결제완료 · 취소';
comment on column public.budget_items.vendor_contact is
  '담당자 이름·전화·주소·계좌 등. vendors 테이블과 별개로 엑셀처럼 인라인으로도 적을 수 있게 둔다.';

-- ────────────────────────────────────────────────
-- 2. 결제 원장
-- ────────────────────────────────────────────────

create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  paid_on        date not null,
  -- 예산 항목과 연결한다. 항목이 지워져도 결제 기록은 남아야 하므로 set null.
  budget_item_id uuid references public.budget_items(id) on delete set null,
  -- 연결이 끊겨도 무엇에 쓴 돈인지 남도록 분류를 함께 적어 둔다(엑셀의 대분류+항목).
  category       text,
  item_label     text,
  -- 계약금 / 중도금 / 잔금 처럼 이 결제가 무엇인지.
  description    text,
  amount         bigint not null,
  method         text,
  payer          text,
  has_receipt    boolean not null default false,
  memo           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index payments_paid_on_idx  on public.payments (paid_on desc);
create index payments_item_idx     on public.payments (budget_item_id);

comment on table public.payments is
  '실제로 돈이 나간 건을 한 줄씩 기록하는 원장. budget_items.actual 은 이 표의 합계로 본다.';

-- ────────────────────────────────────────────────
-- 3. 하객 · 축의금
-- ────────────────────────────────────────────────

create type public.attendance as enum ('미정', '참석', '불참');
create type public.invite_state as enum ('미전달', '전달완료', '모바일');

create table public.guests (
  id          uuid primary key default gen_random_uuid(),
  side        public.wedding_side not null default '공통',
  relation    text,
  name        text not null,
  contact     text,
  invitation  public.invite_state not null default '미전달',
  attending   public.attendance not null default '미정',
  -- 참석 인원과 식사 인원은 다르다. 아이가 오면 참석엔 세고 식대는 안 나갈 수 있다.
  head_count  int not null default 1,
  meal_count  int not null default 1,
  gift_amount bigint,
  thanks      text,
  memo        text,
  sort_order  double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index guests_side_idx      on public.guests (side);
create index guests_attending_idx on public.guests (attending);

-- ────────────────────────────────────────────────
-- 4. 설정값을 day_of_config 로 통합
--    별도 설정 테이블을 만들지 않는다. 이미 한 행짜리 기준 테이블이 있고,
--    보증인원도 여기 있어서 1인 식대·목표예산이 함께 있는 편이 자연스럽다.
-- ────────────────────────────────────────────────

alter table public.day_of_config
  add column if not exists meal_unit_price bigint,
  add column if not exists target_budget   bigint,
  add column if not exists expected_guests int;

update public.day_of_config
   set meal_unit_price = 58000,
       expected_guests = 200
 where id = 1;

comment on column public.day_of_config.meal_unit_price is
  '1인 식대. 계약서상 단가. 하객 시트의 예상 식대 계산에 쓴다.';

-- ────────────────────────────────────────────────
-- 5. 트리거 · RLS · Realtime — 기존 규칙 그대로
-- ────────────────────────────────────────────────

create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();
create trigger guests_touch   before update on public.guests
  for each row execute function public.touch_updated_at();

alter table public.payments enable row level security;
alter table public.guests   enable row level security;

create policy payments_all on public.payments
  for all using (public.is_member()) with check (public.is_member());
create policy guests_all on public.guests
  for all using (public.is_member()) with check (public.is_member());

alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.guests;

alter table public.payments replica identity full;
alter table public.guests   replica identity full;

-- ────────────────────────────────────────────────
-- 6. 실지출 자동 합산 뷰
--    엑셀은 SUMIFS 로 대분류+항목이 같은 결제를 합산한다.
--    여기서는 budget_item_id 로 연결하므로 오타로 합산이 깨질 일이 없다.
-- ────────────────────────────────────────────────

create view public.budget_rollup
with (security_invoker = true) as
  select
    b.*,
    coalesce(p.paid_sum, 0)                            as paid_sum,
    coalesce(b.contracted, 0) - coalesce(p.paid_sum, 0) as unpaid,
    p.payment_count
  from public.budget_items b
  left join (
    select budget_item_id, sum(amount) as paid_sum, count(*) as payment_count
      from public.payments
     where budget_item_id is not null
     group by budget_item_id
  ) p on p.budget_item_id = b.id;

comment on view public.budget_rollup is
  '예산 항목에 결제 원장 합계를 붙인 뷰. paid_sum = 실지출, unpaid = 계약금액 − 실지출.';
