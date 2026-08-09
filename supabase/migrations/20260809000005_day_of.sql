-- ════════════════════════════════════════════════════════════
-- 본식 당일 운영
--
-- tasks 와 역할이 다르다.
--   tasks        = "언제까지 끝낼 일"      → due_date(날짜) 기준
--   day_of_*     = "그날 몇 시에 누가 무엇" → 예식 시작 기준 분(分) 단위
--
-- ── 왜 절대 시각이 아니라 상대 분(offset_min)인가 ────────────────
-- 예식 시간이 아직 확정이 아니다. wedding.html 정리 기준으로
--   · 계약서 원본은 11:00, 12:30은 "변경 예정"으로 홀 서면 동의가 남아 있다
--   · 홀 슬롯이 70분 간격이라 실제로는 12:10일 가능성도 있다
-- 진행표를 '12:30', '13:40' 같은 절대 시각으로 박아두면 시간이 한 번 바뀔 때
-- 30여 개 행을 전부 손으로 고쳐야 하고, 반드시 몇 개를 빠뜨린다.
-- 그래서 각 항목은 예식 시작 기준 상대 분으로만 저장하고,
-- 기준 시각은 day_of_config 단 한 행에 둔다. 시간이 바뀌면 그 한 행만 고치면 된다.
-- 실제 시각은 day_of_schedule 뷰가 계산해서 보여준다.
--
-- ── 계약상 제약 (wedding.html) ──────────────────────────────
--   · 홀 사용시간 토요일 70분
--   · 연회 이용은 예식 30분 전부터 총 2시간 30분  → offset -30 ~ +120
--   · 12:30 기준 식사 시작 약 13:40              → offset +70
--   · 원판 촬영 앨범 3권 필수, 외부 촬영 불가     → 홀 70분 안에 끝내야 함
--   · 헬퍼비(180,000원)는 계약에서 제외 → 헬퍼를 직접 섭외해야 한다
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────
-- 1. 기준 시각 (한 행만 존재)
-- ────────────────────────────────────────────────

create table public.day_of_config (
  -- id를 1로 고정해 두 행이 생기는 것을 물리적으로 막는다.
  -- 행이 여러 개면 아래 day_of_schedule 뷰가 항목마다 곱해져서 조용히 망가진다.
  id             smallint primary key default 1 check (id = 1),
  ceremony_at    timestamptz not null,
  hall           text,
  guarantee_count int,
  -- 연회 이용 가능 구간도 예식 기준 상대 분으로. 계약이 "예식 30분 전부터 2시간 30분"이라
  -- 예식 시간이 바뀌면 이 구간도 통째로 따라 움직인다.
  banquet_from_offset_min int not null default -30,
  banquet_to_offset_min   int not null default 120,
  note           text,
  updated_at     timestamptz not null default now()
);

-- ────────────────────────────────────────────────
-- 2. 역할 분담
--    당일 진행은 신랑신부 둘로 안 된다. 사회·축가·접수·안내는 남이 맡는다.
--    그래서 tasks.assignee(주호/지영/같이) enum으로는 표현할 수 없고 별도 테이블이 필요하다.
-- ────────────────────────────────────────────────

create type public.wedding_side as enum ('신랑', '신부', '공통');

create table public.day_of_roles (
  id          uuid primary key default gen_random_uuid(),
  role        text not null,
  side        public.wedding_side not null default '공통',
  -- 아직 안 정해진 자리가 대부분이다. null = 미정.
  person_name text,
  contact     text,
  -- 사례비. 원 단위 정수(부동소수 금지). 당일 현금 봉투로 나가는 돈이라 미리 세어둬야 한다.
  fee         bigint,
  confirmed   boolean not null default false,
  note        text,
  sort_order  double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────
-- 3. 진행표
-- ────────────────────────────────────────────────

create type public.day_of_phase as enum ('준비', '접수', '예식', '촬영', '연회', '마무리');

create table public.day_of_events (
  id           uuid primary key default gen_random_uuid(),
  phase        public.day_of_phase not null,
  -- 예식 시작(=0) 기준 분. 음수는 예식 전.
  offset_min   int not null,
  duration_min int,
  title        text not null,
  location     text,
  -- 이 순서를 책임지는 사람. 미정이면 null.
  role_id      uuid references public.day_of_roles(id) on delete set null,
  note         text,
  -- 당일 현장에서 진행 상황을 체크한다. tasks와 같은 enum을 재사용.
  status       public.task_status not null default 'todo',
  sort_order   double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ────────────────────────────────────────────────
-- 4. 당일 준비물
--    "챙겼나?"만 확인하면 되므로 tasks의 4단계 status는 과하다. boolean 하나면 충분.
-- ────────────────────────────────────────────────

create table public.day_of_items (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  category   text not null,
  owner      public.assignee,
  packed     boolean not null default false,
  note       text,
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index day_of_events_offset_idx on public.day_of_events (offset_min);
create index day_of_events_phase_idx  on public.day_of_events (phase);
create index day_of_items_category_idx on public.day_of_items (category);

-- ────────────────────────────────────────────────
-- 5. 실제 시각 계산 뷰
--    앱은 offset을 직접 환산하지 말고 이 뷰를 읽는다.
--    클라이언트마다 계산하면 예식 시간 변경 시 반영 누락이 생긴다.
-- ────────────────────────────────────────────────

-- security_invoker = true 가 없으면 뷰가 소유자 권한으로 돌아 RLS를 우회한다.
-- 즉 로그인하지 않은 사람에게도 진행표가 통째로 보이게 된다. 반드시 필요하다.
create view public.day_of_schedule
with (security_invoker = true) as
  select
    e.id,
    e.phase,
    e.offset_min,
    e.duration_min,
    e.title,
    e.location,
    e.role_id,
    r.role        as role_name,
    r.person_name as role_person,
    e.note,
    e.status,
    e.sort_order,
    c.ceremony_at + make_interval(mins => e.offset_min) as starts_at,
    c.ceremony_at + make_interval(mins => e.offset_min + coalesce(e.duration_min, 0)) as ends_at
  from public.day_of_events e
  cross join public.day_of_config c
  left join public.day_of_roles r on r.id = e.role_id
  where c.id = 1;

-- ────────────────────────────────────────────────
-- 6. 트리거 — 기존 touch_updated_at 재사용
-- ────────────────────────────────────────────────

create trigger day_of_config_touch before update on public.day_of_config
  for each row execute function public.touch_updated_at();
create trigger day_of_roles_touch  before update on public.day_of_roles
  for each row execute function public.touch_updated_at();
create trigger day_of_events_touch before update on public.day_of_events
  for each row execute function public.touch_updated_at();
create trigger day_of_items_touch  before update on public.day_of_items
  for each row execute function public.touch_updated_at();

-- ────────────────────────────────────────────────
-- 7. RLS — 기존과 동일하게 화이트리스트 멤버 전권
-- ────────────────────────────────────────────────

alter table public.day_of_config enable row level security;
alter table public.day_of_roles  enable row level security;
alter table public.day_of_events enable row level security;
alter table public.day_of_items  enable row level security;

create policy day_of_config_all on public.day_of_config
  for all using (public.is_member()) with check (public.is_member());
create policy day_of_roles_all on public.day_of_roles
  for all using (public.is_member()) with check (public.is_member());
create policy day_of_events_all on public.day_of_events
  for all using (public.is_member()) with check (public.is_member());
create policy day_of_items_all on public.day_of_items
  for all using (public.is_member()) with check (public.is_member());

-- ────────────────────────────────────────────────
-- 8. Realtime — 당일 현장에서 둘이 각자 폰으로 체크한다.
--    이 테이블들이야말로 실시간 동기화가 가장 중요하다.
-- ────────────────────────────────────────────────

alter publication supabase_realtime add table public.day_of_events;
alter publication supabase_realtime add table public.day_of_items;
alter publication supabase_realtime add table public.day_of_roles;

alter table public.day_of_events replica identity full;
alter table public.day_of_items  replica identity full;
alter table public.day_of_roles  replica identity full;

-- ════════════════════════════════════════════════════════════
-- 9. 시드
--    재실행 안전: 각 테이블이 비어 있을 때만 넣는다.
-- ════════════════════════════════════════════════════════════

insert into public.day_of_config (id, ceremony_at, hall, guarantee_count, note)
select 1,
       '2027-09-04 12:30+09'::timestamptz,
       'CA웨딩컨벤션 2F 루체홀 (충남 아산시 배방읍 희망로 100)',
       200,
       '예식 시간 미확정. 계약서 원본은 11:00이며 12:30은 홀 서면 동의 대기 중. '
       '홀 슬롯이 70분 간격이라 12:10로 확정될 수도 있다. '
       '확정되면 이 행의 ceremony_at 만 고치면 진행표 전체가 따라 움직인다.'
where not exists (select 1 from public.day_of_config);

-- ── 역할 ──
insert into public.day_of_roles (role, side, person_name, fee, note, sort_order)
select * from (values
  ('사회자',            '신랑'::public.wedding_side, null, 300000::bigint, '친구에게 부탁하는 경우가 많다. 사례비는 현금 봉투로 당일 전달. 대본은 2주 전까지 공유.', 100.0),
  ('주례',              '공통'::public.wedding_side, null, 500000::bigint, '주례 없는 예식으로 갈지 먼저 결정할 것. 생략하면 이 행을 지우고 양가 아버지 인사말로 대체한다.', 200.0),
  ('축가',              '공통'::public.wedding_side, null, 300000::bigint, '곡 선정 후 홀 음향 담당에게 반주 파일 사전 전달. 리허설 가능 여부 확인.', 300.0),
  ('접수 · 신랑측',     '신랑'::public.wedding_side, null, 100000::bigint, '2명 권장. 축의금과 방명록을 함께 맡는다. 돈을 다루는 자리라 반드시 믿을 사람으로.', 400.0),
  ('접수 · 신부측',     '신부'::public.wedding_side, null, 100000::bigint, '2명 권장. 신랑측과 접수대를 분리한다.', 500.0),
  ('축의금 관리',       '공통'::public.wedding_side, null, null,           '접수와 분리하는 편이 안전하다. 예식 중 금고나 차량에 보관하고 당일 정산까지 책임질 사람.', 600.0),
  ('안내 · 에스코트',   '공통'::public.wedding_side, null, null,           '주차 안내와 홀 입구 안내. 하객 200명 규모면 최소 2명.', 700.0),
  ('부케 받을 사람',    '신부'::public.wedding_side, null, null,           '6개월 내 결혼 예정자 관습이 있으나 요즘은 자유롭게 정한다. 미리 확답을 받아둘 것.', 800.0),
  ('헬퍼',              '신부'::public.wedding_side, null, 180000::bigint, '★ 계약에서 헬퍼비(180,000원)가 제외됐으므로 직접 섭외해야 한다. 드레스 관리와 신부 동선을 맡는 필수 인력.', 900.0),
  ('혼주 · 신랑 부모',  '신랑'::public.wedding_side, null, null,           '화촉점화, 양가 인사, 하객 응대.', 1000.0),
  ('혼주 · 신부 부모',  '신부'::public.wedding_side, null, null,           '화촉점화, 양가 인사, 하객 응대.', 1100.0)
) as v(role, side, person_name, fee, note, sort_order)
where not exists (select 1 from public.day_of_roles);

-- ── 진행표 ──
-- offset 0 = 예식 시작. 연회 구간(-30 ~ +120)과 홀 사용 70분 제약에 맞췄다.
insert into public.day_of_events (phase, offset_min, duration_min, title, location, note, sort_order)
select * from (values
  ('준비'::public.day_of_phase,   -240,  90, '신부 헤어·메이크업',            '스튜디오/샵',   '가장 오래 걸린다. 샵 예약 시 예식 시간 기준 역산으로 잡을 것.', 100.0),
  ('준비'::public.day_of_phase,   -180,  40, '신랑 준비 · 예복 착용',         '스튜디오/샵',   null, 200.0),
  ('준비'::public.day_of_phase,   -140,  30, '예식장 이동',                   null,            '드레스 부피 때문에 차량이 별도로 필요할 수 있다. 헬퍼 동승 여부 확인.', 300.0),
  ('준비'::public.day_of_phase,    -90,  30, '예식장 도착 · 신부대기실 세팅',  '2F 신부대기실', '계약에 신부대기실·브라이덜샤워 포함.', 400.0),
  ('준비'::public.day_of_phase,    -60,  30, '본식 스냅 · 신부대기실 촬영',    '2F 신부대기실', null, 500.0),
  ('접수'::public.day_of_phase,    -45,  15, '접수대 세팅 · 축의금함 · 방명록', '홀 입구',      '봉투, 펜, 명단, 잔돈까지. 접수 담당에게 미리 위치를 알려둘 것.', 600.0),
  ('접수'::public.day_of_phase,    -30,  30, '연회장 오픈 · 하객 접수 시작',   '2F 루체홀',    '★ 계약상 연회 이용 시작 시점(예식 30분 전).', 700.0),
  ('접수'::public.day_of_phase,    -10,  10, '하객 착석 안내 · 혼주 대기',     '2F 루체홀',    null, 800.0),
  ('예식'::public.day_of_phase,      0,   2, '개식 선언',                     '2F 루체홀',    '★ 예식 시작. 이 시점이 offset 0 이다.', 900.0),
  ('예식'::public.day_of_phase,      2,   3, '화촉 점화 (양가 어머니)',        '2F 루체홀',    null, 1000.0),
  ('예식'::public.day_of_phase,      5,   2, '신랑 입장',                     '2F 루체홀',    null, 1100.0),
  ('예식'::public.day_of_phase,      7,   5, '신부 입장',                     '2F 루체홀',    '아버지 손을 잡고 입장할지, 함께 입장할지 미리 정할 것.', 1200.0),
  ('예식'::public.day_of_phase,     12,   5, '혼인 서약 · 성혼 선언',          '2F 루체홀',    '서약문을 직접 쓸 거면 2주 전까지 준비.', 1300.0),
  ('예식'::public.day_of_phase,     17,  10, '주례사 또는 양가 대표 인사',      '2F 루체홀',    '주례 생략 시 아버지 인사말 또는 두 사람의 편지 낭독으로 대체.', 1400.0),
  ('예식'::public.day_of_phase,     27,   6, '축가',                          '2F 루체홀',    '반주 파일을 홀 음향에 사전 전달했는지 당일 아침 재확인.', 1500.0),
  ('예식'::public.day_of_phase,     33,   4, '양가 부모님께 인사',             '2F 루체홀',    null, 1600.0),
  ('예식'::public.day_of_phase,     37,   3, '신랑신부 행진 · 부케 전달',      '2F 루체홀',    null, 1700.0),
  ('촬영'::public.day_of_phase,     42,  10, '원판 촬영 — 양가 가족',          '2F 루체홀',    '★ 계약상 필수(앨범 3권), 외부 촬영 불가. 가족을 미리 모아둬야 시간이 안 밀린다.', 1800.0),
  ('촬영'::public.day_of_phase,     52,  10, '원판 촬영 — 친구 · 직장',        '2F 루체홀',    null, 1900.0),
  ('촬영'::public.day_of_phase,     62,   8, '폐백 (진행하는 경우)',           '폐백실',       '생략하는 추세다. 진행하면 한복·폐백 음식 비용이 별도로 든다.', 2000.0),
  ('연회'::public.day_of_phase,     70,  50, '식사 시작',                     '2F 루체홀',    '★ 홀 사용 70분이 끝나는 시점. 12:30 예식 기준 약 13:40.', 2100.0),
  ('연회'::public.day_of_phase,    120,  10, '연회 종료 · 하객 배웅',          '2F 루체홀',    '★ 계약상 연회 이용 종료(예식 30분 전부터 2시간 30분).', 2200.0),
  ('마무리'::public.day_of_phase,  130,  20, '축의금 정산 · 인계',             null,           '접수 담당에게서 넘겨받아 그 자리에서 함께 확인. 명단과 대조.', 2300.0),
  ('마무리'::public.day_of_phase,  150,  20, '사례비 봉투 전달',               null,           '사회자 · 축가 · 헬퍼 · 접수. 봉투는 전날 미리 준비해 이름을 적어둘 것.', 2400.0),
  ('마무리'::public.day_of_phase,  170,  20, '짐 정리 · 예복 반납 확인',       null,           '대여품 반납 기한과 방법을 계약 시 확인해 둘 것.', 2500.0),
  ('마무리'::public.day_of_phase,  190,  30, '신혼여행 출발 준비',             null,           '당일 출발이면 공항 이동 시간을 여기서부터 역산할 것.', 2600.0)
) as v(phase, offset_min, duration_min, title, location, note, sort_order)
where not exists (select 1 from public.day_of_events);

-- ── 당일 준비물 ──
insert into public.day_of_items (label, category, owner, note, sort_order)
select * from (values
  ('예복 · 셔츠 · 넥타이',   '신랑', '주호'::public.assignee, null, 100.0),
  ('구두 · 양말 · 커프스',   '신랑', '주호'::public.assignee, '양말은 여분까지. 새 구두면 미리 길들일 것.', 200.0),
  ('웨딩드레스 (샵 이동)',   '신부', '지영'::public.assignee, '샵에서 직접 가져오는지 예식장으로 배송되는지 확인.', 300.0),
  ('신부 속옷 · 구두',       '신부', '지영'::public.assignee, '드레스 라인에 맞는 속옷을 가봉 때 확인해 둘 것.', 400.0),
  ('액세서리 · 베일',        '신부', '지영'::public.assignee, null, 500.0),
  ('메이크업 수정 키트',     '신부', '지영'::public.assignee, '립·파우더·기름종이. 예식 후 촬영이 길어 반드시 필요하다.', 600.0),
  ('결혼반지',               '공통', '같이'::public.assignee, '★ 가장 많이 잊는 물건. 전날 밤 가방에 넣고 아침에 한 번 더 확인.', 700.0),
  ('신분증 (양쪽)',          '공통', '같이'::public.assignee, null, 800.0),
  ('축의금함 · 방명록 · 펜',  '공통', '같이'::public.assignee, '홀에서 제공하는지 먼저 확인. 없으면 직접 준비.', 900.0),
  ('사례비 현금 봉투',       '공통', '같이'::public.assignee, '★ 사회자·축가·헬퍼·접수. 전날 이름 적어 준비. 당일 은행은 못 간다.', 1000.0),
  ('접수용 잔돈',            '공통', '같이'::public.assignee, null, 1100.0),
  ('보조배터리 · 충전기',    '공통', '같이'::public.assignee, '하루 종일 연락과 사진으로 배터리가 순식간에 닳는다.', 1200.0),
  ('비상약 · 반짇고리 · 물티슈', '공통', '같이'::public.assignee, '드레스나 예복이 터지는 사고가 실제로 있다. 안전핀 포함.', 1300.0),
  ('간단한 요기거리 · 빨대',  '공통', '같이'::public.assignee, '식사 시작이 13:40이라 신부는 그때까지 거의 못 먹는다. 립 안 지워지게 빨대.', 1400.0),
  ('혼주 한복 · 코사지',     '혼주', null,                    '양가 각각. 미리 전달해 당일 챙기시게 할 것.', 1500.0),
  ('혼인신고서',             '서류', '같이'::public.assignee, '증인 2명의 서명이 필요하다. 예식 당일 하객에게 받아두면 편하다.', 1600.0),
  ('가족관계증명서',         '서류', '같이'::public.assignee, '혼인신고용. 양쪽 모두 필요.', 1700.0)
) as v(label, category, owner, note, sort_order)
where not exists (select 1 from public.day_of_items);

comment on table public.day_of_config is
  '본식 당일 기준 시각. 항상 한 행만 존재한다(id=1 고정). '
  '예식 시간이 바뀌면 ceremony_at 만 고치면 day_of_events 전체가 따라 움직인다.';
comment on table public.day_of_events is
  '당일 진행표. offset_min 은 예식 시작 기준 상대 분이며 음수는 예식 전. '
  '실제 시각은 day_of_schedule 뷰에서 계산한다.';
