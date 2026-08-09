-- 로그인이 허용된 이메일. 여기 없는 사람은 가입해도 데이터가 한 줄도 보이지 않는다.
--
-- 주의: 이 값은 Supabase Auth가 받는 이메일과 정확히 일치해야 한다.
--       GitHub OAuth로 로그인하면 GitHub의 primary email이 넘어온다.

insert into public.allowed_emails (email, display_name) values
  ('halia.coast@gmail.com', '주호')
on conflict (email) do update set display_name = excluded.display_name;

-- TODO: 송지영님 이메일 확보 후 아래 주석을 풀고 새 마이그레이션으로 추가할 것.
--       (이 파일을 수정하지 말 것 — 이미 적용된 마이그레이션은 다시 실행되지 않는다.)
-- insert into public.allowed_emails (email, display_name) values
--   ('여기에_지영님_이메일', '지영')
-- on conflict (email) do update set display_name = excluded.display_name;
