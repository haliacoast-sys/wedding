-- 이메일 대신 아이디로 로그인한다.
--
-- Supabase Auth는 식별자로 이메일(또는 전화번호)을 요구하므로, 앱이 사용자가 입력한
-- 아이디 뒤에 고정 도메인을 붙여 signInWithPassword에 넘긴다.  juho → juho@wedding.local
--
-- 실제로 메일이 나가지 않으므로(enable_confirmations = false) 존재하지 않는 도메인이어도
-- 무방하다. 2026-08-09에 admin API로 probe@wedding.local 생성·삭제하여 수용을 확인했다.
--
-- 대가: 이메일이 실재하지 않으므로 '비밀번호 찾기' 메일을 보낼 수 없다.
--       분실 시 admin API 또는 대시보드에서 직접 재설정해야 한다.

delete from public.allowed_emails where email = 'halia.coast@gmail.com';

insert into public.allowed_emails (email, display_name) values
  ('juho@wedding.local',    '주호'),
  ('jiyoung@wedding.local', '지영')
on conflict (email) do update set display_name = excluded.display_name;

comment on table public.allowed_emails is
  '로그인 허용 목록. 값은 <아이디>@wedding.local 형식의 합성 주소이며 실재하는 메일함이 아니다. '
  '여기 없는 사람은 가입해도 members에 등록되지 않아 모든 테이블이 0행으로 보인다.';
