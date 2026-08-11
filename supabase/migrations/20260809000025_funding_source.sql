-- 자금 출처 구분 (2026-08-09)
--
-- 결혼 비용은 "얼마 드는가"보다 "언제 우리 돈이 나가는가"가 더 급한 문제다.
--   · 웨딩홀에 내는 돈(잔금·패키지·초과 식대)은 예식 당일 축의금으로 정산한다.
--   · 외부 업체(스튜디오·스냅·청첩장·신혼집·혼수 등)는 예식 전에 우리 현금이 먼저 나간다.
--
-- 총액만 보면 2천만원이지만, 그 대부분은 축의금으로 메워지는 돈이라
-- 실제로 미리 마련해야 하는 현금과는 전혀 다르다. 이 둘을 섞어 보면
-- 필요한 현금을 과대평가해 불필요하게 불안해지거나, 반대로 예식 전 지출 시점에
-- 현금이 모자라는 사고가 난다.

create type public.funding_source as enum ('선지출', '축의금');

alter table public.budget_items
  add column if not exists funding public.funding_source not null default '선지출';

comment on column public.budget_items.funding is
  '이 돈이 어디서 나가는가. 선지출 = 예식 전에 우리 현금으로 먼저 낸다. '
  '축의금 = 예식 당일 축의금으로 정산한다(주로 웨딩홀 직접 청구분).';

-- ── 웨딩홀 직접 청구분은 축의금으로 충당한다 ──
-- 계약금은 이미 우리 돈으로 냈으므로 여기 포함하지 않는다.
update public.budget_items
   set funding = '축의금'
 where label in (
   '홀 잔금',
   '웨딩 패키지 (홀 진행)',
   '하객 200명 초과분 식대 (당일 정산)'
 );

-- 나머지는 기본값 '선지출' 그대로 둔다.
-- 홀 계약금도 선지출이다 — 2026-08-09 에 이미 우리 돈으로 납부했다.

create index budget_items_funding_idx on public.budget_items (funding);
