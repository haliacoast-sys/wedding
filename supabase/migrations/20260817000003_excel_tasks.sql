-- 체크리스트를 엑셀(결혼준비_최종본.xlsx <체크리스트> 시트) 기준으로 교체 (2026-08-17)
--
-- 여태 DB 에 들어 있던 83건은 계약서와 일반적인 준비 순서를 보고 추정으로 만든 것이라
-- 실제 진행 상황과 어긋나 있었다. 사용자가 직접 채운 엑셀 65건이 진실의 원천이므로
-- 기존 행을 전부 지우고 그대로 다시 넣는다. 엑셀에 없는 항목은 하나도 추가하지 않는다.
--
-- 예식일은 2027-09-04(토) 11:00 확정.
--
-- ────────────────────────────────────────────────
-- 판단 ① phase 를 컬럼으로 추가한다
-- ────────────────────────────────────────────────
-- 엑셀 체크리스트의 뼈대는 "언제 할 일인가"다. D-12개월부터 결혼식 이후까지 15단계로
-- 묶여 있고, 사용자는 그 묶음 단위로 목록을 읽는다. 이 앱의 tasks 에는 due_date 밖에
-- 없어서 phase 를 버리면 "D-2주에 할 일" 같은 덩어리가 사라지고 날짜만 흩어진 평면
-- 목록이 된다. 특히 한 단계 안의 항목들은 due_date 가 전부 같은 날(권장 시점)이라
-- 날짜만으로는 어느 단계인지 되살릴 수 없다 — 정보가 실제로 소실된다.
--
-- 그래서 phase 를 text 컬럼으로 남긴다. enum 이 아니라 text 인 이유는 단계 이름이
-- 화면에 그대로 찍히는 표시용 문자열이고, 나중에 사용자가 단계를 늘리거나 이름을
-- 바꿀 때 enum 은 마이그레이션 없이는 못 바꾸기 때문이다.
--
-- nullable 로 둔다. 앱의 buildTaskInsert 가 phase 를 보내지 않으므로 not null 이면
-- 새 할 일 추가가 그 자리에서 깨진다. 사용자가 앱에서 직접 만든 항목은 단계 없이
-- 살아도 된다.
--
-- 단계 순서(D-12개월 → … → 결혼식 이후)는 별도 컬럼으로 두지 않았다. 아래 insert 가
-- 엑셀 No 순서 그대로 sort_order 를 100 간격으로 매기고, 엑셀이 이미 단계 순으로
-- 정렬돼 있어서 sort_order 오름차순이 곧 단계 순서다. 문자열 정렬로는 'D-1개월' 이
-- 'D-12개월' 보다 앞서는 등 순서가 깨지므로, 화면에서 단계별로 묶을 때는 반드시
-- sort_order 기준으로 처음 등장하는 순서를 쓸 것.

alter table public.tasks
  add column if not exists phase text;

comment on column public.tasks.phase is
  '엑셀 체크리스트의 시기 구분. D-12개월 · D-9개월 · D-8개월 · D-6개월 · D-5개월 · '
  'D-4개월 · D-3개월 · D-2개월 · D-1개월 · D-3주 · D-2주 · D-1주 · D-1일 · '
  '결혼식 당일 · 결혼식 이후. 표시용 문자열이라 enum 이 아니다. '
  '단계 순서는 sort_order 오름차순에서 처음 등장하는 순서로 얻는다.';

create index if not exists tasks_phase_idx on public.tasks (phase);

-- ────────────────────────────────────────────────
-- 교체
-- ────────────────────────────────────────────────
-- delete 후 insert 라 두 번 돌려도 중복되지 않는다.
-- tasks 를 참조하는 외래키는 없으므로 지워도 다른 표가 깨지지 않는다.
-- 앱에서 이미 손댄 항목이 있었다면 여기서 함께 날아가지만, 지금 DB 의 83건은
-- 전부 추정 시드라 보존할 가치가 없다.

delete from public.tasks;

-- 값 매핑
--   due_date  목표일(target_on)이 있으면 그것, 없으면 권장 시점(recommended_on).
--             엑셀이 "목표일을 비워두면 권장 시점이 기준"이라고 명시한다.
--             65건 중 목표일이 채워진 건 한복 정계약(2026-09-30) 하나뿐이고,
--             그건 권장 시점(2026-12-08)보다 앞선다 — 할인 마감이 먼저라서다.
--   status    미시작→todo · 진행중→doing · 완료→done · 보류→hold
--   assignee  신랑→주호 · 신부→지영 · 공동→같이 (빈 값 없음)
--   note      엑셀 memo 에서 [복원] 같은 생성 흔적을 걷어내고 계좌·기한·조건만 남겼다.
--   sort_order 엑셀 No × 100. 사이에 끼워 넣을 자리를 남긴다.
--
-- created_by 는 넣지 않는다 (auth.users FK — 시드 시점에 주인이 없다).
-- vendor_id 도 넣지 않는다. 업체 연결은 앱에서 한다.

insert into public.tasks (title, note, category, phase, due_date, assignee, status, sort_order)
values
  -- D-12개월 (5건)
  ('양가 상견례 일정 잡기', null, '기타', 'D-12개월', '2026-09-04', '같이'::public.assignee, 'todo'::public.task_status, 100),
  ('결혼 예산 총액 · 분담 비율 협의', null, '기타', 'D-12개월', '2026-09-04', '같이'::public.assignee, 'todo'::public.task_status, 200),
  ('예식 형태 · 규모 결정 (예상 하객수 산정)', '보증인원 200명 확정', '예식장', 'D-12개월', '2026-09-04', '같이'::public.assignee, 'done'::public.task_status, 300),
  ('예식일 · 예식 시간 후보 결정', '예식일 2027-09-04(토) 11:00 확정', '예식장', 'D-12개월', '2026-09-04', '같이'::public.assignee, 'done'::public.task_status, 400),
  ('예식장 후보 리스트업 및 투어', '예식장 계약 완료', '예식장', 'D-12개월', '2026-09-04', '같이'::public.assignee, 'done'::public.task_status, 500),
  -- D-9개월 (4건)
  ('예식장 계약 및 계약금 납부', '계약 완료. 계약금 1,000,000원 납부', '예식장', 'D-9개월', '2026-12-08', '같이'::public.assignee, 'done'::public.task_status, 600),
  ('웨딩플래너 상담 · 계약', '웨딩플래너 수수료 계약 완료', '스드메', 'D-9개월', '2026-12-08', '같이'::public.assignee, 'done'::public.task_status, 700),
  ('스드메 업체 비교 및 계약', '스드메 8개 항목 모두 계약 완료', '스드메', 'D-9개월', '2026-12-08', '같이'::public.assignee, 'done'::public.task_status, 800),
  ('한복 정계약 전환 — 5만원 추가 입금 (더퀸한복)', '2026-09-30까지 5만원 추가 입금 시 60만 → 55만 (미전환 시 60만). 입금처: 신한 110-213-478758 윤화순. 현재 가계약 상태(5만원 입금) — 정계약 전환이 남았다.', '한복', 'D-9개월', '2026-09-30', '같이'::public.assignee, 'doing'::public.task_status, 900),
  -- D-8개월 (4건)
  ('예물 · 예단 범위 양가 협의', '예물(반지) 가계약 상태', '예물·예단', 'D-8개월', '2027-01-07', '같이'::public.assignee, 'doing'::public.task_status, 1000),
  ('웨딩촬영 컨셉 · 일정 확정', null, '스드메', 'D-8개월', '2027-01-07', '같이'::public.assignee, 'todo'::public.task_status, 1100),
  ('REGALO 예복 방문 · 채촌 (스튜디오 촬영 2개월 전)', '스튜디오 촬영일 기준 최소 2개월 전 방문 필요. 촬영일이 확정되면 마감일을 그날로 직접 고칠 것.', '예복', 'D-8개월', '2027-01-07', '주호'::public.assignee, 'todo'::public.task_status, 1200),
  ('REGALO 네이버 방문자 리뷰 작성 → 맞춤셔츠 증정', '정계약 혜택 — 네이버 방문자 리뷰 1회 작성 시 테일러드 맞춤셔츠 증정', '예복', 'D-8개월', '2027-01-07', '주호'::public.assignee, 'todo'::public.task_status, 1300),
  -- D-6개월 (3건)
  ('본식 스냅 · 영상 업체 계약', '본식 영상만 계약 완료. 본식 스냅은 아직 미정', '본식스냅·영상', 'D-6개월', '2027-03-08', '같이'::public.assignee, 'doing'::public.task_status, 1400),
  ('혼주 한복 준비 (양가)', '한복 가계약 상태 (양가 어머니 포함)', '한복', 'D-6개월', '2027-03-08', '같이'::public.assignee, 'doing'::public.task_status, 1500),
  ('신부 드레스 1차 피팅', null, '스드메', 'D-6개월', '2027-03-08', '지영'::public.assignee, 'todo'::public.task_status, 1600),
  -- D-5개월 (3건)
  ('웨딩촬영 진행', null, '스드메', 'D-5개월', '2027-04-07', '같이'::public.assignee, 'todo'::public.task_status, 1700),
  ('신랑 예복 맞춤 · 가봉', null, '예복', 'D-5개월', '2027-04-07', '주호'::public.assignee, 'todo'::public.task_status, 1800),
  ('피부 관리 · 체형 관리 시작', '피부 관리 90,000원 지출 발생', '미용·건강', 'D-5개월', '2027-04-07', '같이'::public.assignee, 'doing'::public.task_status, 1900),
  -- D-4개월 (4건)
  ('촬영 원본 셀렉 및 앨범 제작 의뢰', null, '스드메', 'D-4개월', '2027-05-07', '같이'::public.assignee, 'todo'::public.task_status, 2000),
  ('청첩장 시안 선택', '종이 청첩장 계약 완료 (예식장 CA 옵션 예정). 모바일 청첩장 포함', '청첩장·답례품', 'D-4개월', '2027-05-07', '같이'::public.assignee, 'doing'::public.task_status, 2100),
  ('하객 명단 1차 작성 (양가 취합)', null, '청첩장·답례품', 'D-4개월', '2027-05-07', '같이'::public.assignee, 'todo'::public.task_status, 2200),
  ('예물 구매 (반지 · 시계 등)', '백작 예약금 10만원(2026-08-09) · PELLO 가계약금 1만원(2026-08-15). 업체 최종 선택이 남았다.', '예물·예단', 'D-4개월', '2027-05-07', '같이'::public.assignee, 'doing'::public.task_status, 2300),
  -- D-3개월 (4건)
  ('청첩장 문구 확정 · 인쇄 주문', null, '청첩장·답례품', 'D-3개월', '2027-06-06', '같이'::public.assignee, 'todo'::public.task_status, 2400),
  ('모바일 청첩장 제작', null, '청첩장·답례품', 'D-3개월', '2027-06-06', '같이'::public.assignee, 'todo'::public.task_status, 2500),
  ('예단 · 이바지 일정 협의', null, '예물·예단', 'D-3개월', '2027-06-06', '같이'::public.assignee, 'todo'::public.task_status, 2600),
  ('축가 · 사회자 · 주례 섭외', '축가만 계약 완료. 사회자·주례는 미정', '예식 부대비용', 'D-3개월', '2027-06-06', '같이'::public.assignee, 'doing'::public.task_status, 2700),
  -- D-2개월 (6건)
  ('청첩장 발송 시작 (직장 · 지인)', null, '청첩장·답례품', 'D-2개월', '2027-07-06', '같이'::public.assignee, 'todo'::public.task_status, 2800),
  ('하객 명단 최종 정리', null, '청첩장·답례품', 'D-2개월', '2027-07-06', '같이'::public.assignee, 'todo'::public.task_status, 2900),
  ('답례품 주문', null, '청첩장·답례품', 'D-2개월', '2027-07-06', '같이'::public.assignee, 'todo'::public.task_status, 3000),
  ('예식 진행 순서 (큐시트) 초안 작성', null, '예식장', 'D-2개월', '2027-07-06', '같이'::public.assignee, 'todo'::public.task_status, 3100),
  ('신부 드레스 2차 피팅', null, '스드메', 'D-2개월', '2027-07-06', '지영'::public.assignee, 'todo'::public.task_status, 3200),
  ('REGALO 혼주 예복 가족 방문 (본식 1~2개월 전)', '혼주 포함 가족 방문 — 본식 기준 1~2개월 전', '예복', 'D-2개월', '2027-07-06', '같이'::public.assignee, 'todo'::public.task_status, 3300),
  -- D-1개월 (5건)
  ('예식장 최종 미팅 (식순 · 좌석 · 메뉴)', null, '예식장', 'D-1개월', '2027-08-05', '같이'::public.assignee, 'todo'::public.task_status, 3400),
  ('예식장 중도금 · 잔금 일정 확인', null, '예식장', 'D-1개월', '2027-08-05', '같이'::public.assignee, 'todo'::public.task_status, 3500),
  ('혼인신고 필요 서류 확인 · 발급', null, '서류·행정', 'D-1개월', '2027-08-05', '같이'::public.assignee, 'todo'::public.task_status, 3600),
  ('헤어 · 메이크업 리허설 예약', null, '스드메', 'D-1개월', '2027-08-05', '지영'::public.assignee, 'todo'::public.task_status, 3700),
  ('한복 잔금 납부 (더퀸한복)', '입금처: 신한은행 110-213-478758 윤화순. 잔금 = 총액 − 기납부액', '한복', 'D-1개월', '2027-08-05', '같이'::public.assignee, 'todo'::public.task_status, 3800),
  -- D-3주 (2건)
  ('접수 · 축의금 담당자 지정 (양가)', null, '예식 부대비용', 'D-3주', '2027-08-14', '같이'::public.assignee, 'todo'::public.task_status, 3900),
  ('부케 · 꽃장식 최종 확정', null, '스드메', 'D-3주', '2027-08-14', '지영'::public.assignee, 'todo'::public.task_status, 4000),
  -- D-2주 (4건)
  ('하객 참석 여부 최종 확인', null, '청첩장·답례품', 'D-2주', '2027-08-21', '같이'::public.assignee, 'todo'::public.task_status, 4100),
  ('예식장에 보증인원 통보', null, '예식장', 'D-2주', '2027-08-21', '같이'::public.assignee, 'todo'::public.task_status, 4200),
  ('헤어 · 메이크업 리허설', null, '스드메', 'D-2주', '2027-08-21', '지영'::public.assignee, 'todo'::public.task_status, 4300),
  ('웨딩밴드(반지) 수령 · 사이즈 확인', null, '예물·예단', 'D-2주', '2027-08-21', '같이'::public.assignee, 'todo'::public.task_status, 4400),
  -- D-1주 (6건)
  ('예식 당일 동선 · 시간표 공유', null, '예식장', 'D-1주', '2027-08-28', '같이'::public.assignee, 'todo'::public.task_status, 4500),
  ('본식 가방 (비상용품) 준비', null, '기타', 'D-1주', '2027-08-28', '지영'::public.assignee, 'todo'::public.task_status, 4600),
  ('축의금 봉투 · 방명록 · 필기구 준비', null, '예식 부대비용', 'D-1주', '2027-08-28', '같이'::public.assignee, 'todo'::public.task_status, 4700),
  ('예식장 잔금 납부', null, '예식장', 'D-1주', '2027-08-28', '같이'::public.assignee, 'todo'::public.task_status, 4800),
  ('양가 부모님께 최종 일정 안내', null, '기타', 'D-1주', '2027-08-28', '같이'::public.assignee, 'todo'::public.task_status, 4900),
  ('REGALO 예복 잔금 납부 · 최종 착장 확인', '잔금 = 35만 − 정계약금 10만. 조끼·구두 대여 여부도 이때 최종 확정', '예복', 'D-1주', '2027-08-28', '주호'::public.assignee, 'todo'::public.task_status, 5000),
  -- D-1일 (3건)
  ('소지품 · 준비물 최종 점검', null, '기타', 'D-1일', '2027-09-03', '같이'::public.assignee, 'todo'::public.task_status, 5100),
  ('예복 · 드레스 · 구두 준비 확인', null, '예복', 'D-1일', '2027-09-03', '같이'::public.assignee, 'todo'::public.task_status, 5200),
  ('충분한 수면 · 컨디션 관리', null, '미용·건강', 'D-1일', '2027-09-03', '같이'::public.assignee, 'todo'::public.task_status, 5300),
  -- 결혼식 당일 (5건)
  ('신부대기실 물품 세팅', null, '예식장', '결혼식 당일', '2027-09-04', '지영'::public.assignee, 'todo'::public.task_status, 5400),
  ('축의금 접수 · 중간 정산', null, '예식 부대비용', '결혼식 당일', '2027-09-04', '같이'::public.assignee, 'todo'::public.task_status, 5500),
  ('답례품 배부 확인', null, '청첩장·답례품', '결혼식 당일', '2027-09-04', '같이'::public.assignee, 'todo'::public.task_status, 5600),
  ('본식 원본 사진 수령 방법 확인', null, '본식스냅·영상', '결혼식 당일', '2027-09-04', '같이'::public.assignee, 'todo'::public.task_status, 5700),
  ('폐백 · 2부 진행 확인', null, '예식장', '결혼식 당일', '2027-09-04', '같이'::public.assignee, 'todo'::public.task_status, 5800),
  -- 결혼식 이후 (7건)
  ('혼인신고', null, '서류·행정', '결혼식 이후', '2027-09-18', '같이'::public.assignee, 'todo'::public.task_status, 5900),
  ('축의금 정산 및 명단 정리', null, '기타', '결혼식 이후', '2027-09-18', '같이'::public.assignee, 'todo'::public.task_status, 6000),
  ('양가 · 하객 감사 인사', null, '기타', '결혼식 이후', '2027-09-18', '같이'::public.assignee, 'todo'::public.task_status, 6100),
  ('본식 스냅 · 영상 셀렉', null, '본식스냅·영상', '결혼식 이후', '2027-09-18', '같이'::public.assignee, 'todo'::public.task_status, 6200),
  ('앨범 제작 진행 상황 확인', null, '스드메', '결혼식 이후', '2027-09-18', '같이'::public.assignee, 'todo'::public.task_status, 6300),
  ('명의 변경 (주소 · 보험 · 금융)', null, '서류·행정', '결혼식 이후', '2027-09-18', '같이'::public.assignee, 'todo'::public.task_status, 6400),
  ('최종 예산 정산 (예산 vs 실지출)', null, '기타', '결혼식 이후', '2027-09-18', '같이'::public.assignee, 'todo'::public.task_status, 6500);

-- ────────────────────────────────────────────────
-- 판단 ② done_at — 트리거가 넣은 값을 그대로 둔다
-- ────────────────────────────────────────────────
-- public.sync_done_at 트리거는 insert 에도 걸려 있다. insert 시점에는 old 가 없어서
-- (old.status is distinct from 'done') 이 참이 되므로, status 를 done 으로 넣는
-- 6건은 done_at 이 자동으로 now() = 이 마이그레이션을 적용한 순간으로 채워진다.
--
-- 엑셀의 완료일(done_on) 열은 65건 전부 비어 있다. 사용자가 채우지 않았다.
-- 그러니 덮어쓸 진짜 날짜가 없다. 결제 원장에 예식장 계약금 2026-08-09 같은 날짜가
-- 있지만 그건 "돈이 나간 날"이지 "이 할 일을 끝낸 날"이 아니고, 체크리스트 시트에
-- 없는 값을 다른 시트에서 끌어와 채우면 사용자가 적지 않은 날짜를 앱이 지어내는 셈이
-- 된다. 그래서 done_at 은 트리거가 준 값(= 엑셀을 DB 에 반영한 시각)을 그대로 둔다.
-- "완료로 기록된 시각"이라는 뜻으로는 정확하다. 실제 완료일과는 다를 수 있다.
--
-- 나중에 진짜 완료일을 알게 되면 update 로 정정하면 된다. status 가 done 인 채로
-- done_at 만 바꾸는 update 는 트리거가 건드리지 않는다 — 첫 분기는
-- (old.status is distinct from 'done') 가 거짓이라 안 타고, elsif 도
-- new.status <> 'done' 이 거짓이라 안 탄다. 즉 아래 형태가 그대로 통한다.
--
--   update public.tasks
--      set done_at = '2026-08-09'::date
--    where title = '예식장 계약 및 계약금 납부';
--
-- 반대로 insert 단계에서 done_at 을 직접 넣는 건 통하지 않는다. before insert 트리거가
-- new.done_at 을 now() 로 덮어써 버린다. 정정은 반드시 insert 이후 update 로 해야 한다.

-- ────────────────────────────────────────────────
-- 대조 (적용 후 눈으로 확인할 것)
-- ────────────────────────────────────────────────
--   select count(*) from public.tasks;                   -- 65
--   select status, count(*) from public.tasks
--    group by status;                                     -- todo 51 · doing 8 · done 6 · hold 0
--   select phase, count(*) from public.tasks
--    group by phase order by min(sort_order);             -- 15단계, 5·4·4·3·3·4·4·6·5·2·4·6·3·5·7
--   select count(*) from public.tasks where phase is null;-- 0
--   select count(*) from public.tasks where due_date is null; -- 0
