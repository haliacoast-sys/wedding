-- day_of_config 를 Realtime publication 에 추가한다.
--
-- 20260809000005 의 8절이 day_of_events / day_of_items / day_of_roles 만 추가하고
-- day_of_config 를 빠뜨렸다. 하필 이 테이블이 가장 전파가 중요하다 —
-- ceremony_at 한 값이 바뀌면 day_of_schedule 뷰를 통해 진행표 26개 항목의 시각이
-- 전부 움직이기 때문이다. 한쪽이 예식 시간을 12:10 으로 고쳤는데 상대 화면은
-- 12:30 그대로면, 당일 서로 다른 시각표를 보고 움직이게 된다.
--
-- 한 행짜리 테이블이라 publication 추가 비용은 사실상 없다.

alter publication supabase_realtime add table public.day_of_config;

-- UPDATE 이벤트에서 변경 전 값을 받으려면 replica identity 가 full 이어야 한다.
alter table public.day_of_config replica identity full;
