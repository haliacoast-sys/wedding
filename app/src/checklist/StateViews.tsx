/**
 * StateViews.tsx — 목록이 그려지지 않는 모든 경우의 화면.
 *
 * 가장 중요한 건 ZeroRowState 다.
 * 조회가 성공했는데 0행인 상황은 원인이 둘로 갈린다.
 *   (a) 정말 데이터가 없다 — 시드 미투입, 또는 전부 삭제
 *   (b) RLS 가 전부 잘라냈다 — 로그인 계정이 members 에 없음
 * 둘 다 PostgREST 는 200 + 빈 배열을 준다. 에러가 없으니 화면만 봐서는 구분이 안 된다.
 * 그래서 is_member() 를 직접 호출해 어느 쪽인지 확정한 뒤 서로 다른 안내를 낸다.
 * "데이터가 없습니다" 한 줄로 끝내면 권한 문제일 때 영원히 원인을 못 찾는다.
 */
import { describeError } from './tasksApi'
import type { FailureInfo } from './tasksApi'

const ErrorDetails = ({ info }: { info: FailureInfo }) => (
  <dl className="ck-errbox">
    <dt>메시지</dt>
    <dd>{info.message}</dd>
    {info.code && (
      <>
        <dt>코드</dt>
        <dd>
          <code>{info.code}</code>
        </dd>
      </>
    )}
    {info.details && (
      <>
        <dt>상세</dt>
        <dd>{info.details}</dd>
      </>
    )}
    {info.hint && (
      <>
        <dt>힌트</dt>
        <dd>{info.hint}</dd>
      </>
    )}
  </dl>
)

export const LoadingList = () => (
  <div className="ck-list" aria-busy="true" aria-label="불러오는 중">
    <div className="ck-skel" />
    <div className="ck-skel" />
    <div className="ck-skel" />
    <div className="ck-skel" />
  </div>
)

export const ErrorState = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => {
  const info = describeError(error)
  const isAuthish = info.code === '42501' || info.code === 'PGRST301' || info.code === '401'
  return (
    <div className="ck-card ck-state">
      <h3>목록을 불러오지 못했습니다</h3>
      <p>
        {isAuthish
          ? '권한이 거부됐습니다. 로그인 세션이 만료됐거나 이 계정이 members 에 없습니다.'
          : '네트워크 또는 서버 응답에 문제가 있습니다.'}
      </p>
      <ErrorDetails info={info} />
      <div className="ck-state__actions">
        <button type="button" className="ck-btn ck-btn--primary" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    </div>
  )
}

export type ProbeState = 'checking' | 'member' | 'not-member' | 'unknown'

export const ZeroRowState = ({
  probe,
  probeError,
  onRetry,
  onAdd,
}: {
  probe: ProbeState
  probeError: unknown
  onRetry: () => void
  onAdd: () => void
}) => (
  <div className="ck-card ck-state">
    <h3>항목이 하나도 없습니다</h3>
    <p>
      조회 자체는 성공했고 에러도 없었습니다. 그런데 돌아온 행이 0개입니다. 이 상태는
      원인이 두 가지라서, 어느 쪽인지 <code>is_member()</code> 로 확인했습니다.
    </p>

    {probe === 'checking' && <p>권한을 확인하는 중입니다…</p>}

    {probe === 'not-member' && (
      <>
        <div className="ck-callout ck-callout--crit">
          <b>권한 문제입니다.</b> <code>is_member()</code> 가 <code>false</code> 를
          반환했습니다. 지금 로그인한 계정이 <code>public.members</code> 에 없어서 RLS 가
          <code>tasks</code> 의 모든 행을 잘라내고 있습니다. 데이터가 없는 게 아니라
          보이지 않는 것입니다.
        </div>
        <p>확인할 순서:</p>
        <ul>
          <li>
            <code>public.allowed_emails</code> 에 이 계정이 있는지. 값은
            <code>&lt;아이디&gt;@wedding.local</code> 형식이어야 합니다
            (<code>supabase/migrations/20260809000003_username_login.sql</code>).
          </li>
          <li>
            화이트리스트에 <b>나중에</b> 추가한 경우. <code>handle_new_user</code> 트리거는
            가입 시점에만 돌기 때문에, 이미 만들어진 계정은 목록에 추가해도 자동으로
            <code>members</code> 에 들어가지 않습니다. 해당 행을 직접 넣거나 계정을 다시
            만들어야 합니다.
          </li>
          <li>다른 아이디로 로그인하지 않았는지.</li>
        </ul>
      </>
    )}

    {probe === 'member' && (
      <>
        <div className="ck-callout">
          <b>권한은 정상입니다.</b> <code>is_member()</code> 가 <code>true</code> 를
          반환했습니다. 즉 RLS 는 통과했고, <code>tasks</code> 테이블이 실제로 비어 있습니다.
        </div>
        <p>
          초기 체크리스트 시드가 아직 안 들어갔거나 전부 삭제된 상태입니다. 아래에서 첫
          항목을 직접 추가할 수 있습니다.
        </p>
        <div className="ck-state__actions">
          <button type="button" className="ck-btn ck-btn--primary" onClick={onAdd}>
            첫 항목 추가
          </button>
        </div>
      </>
    )}

    {probe === 'unknown' && (
      <>
        <div className="ck-callout ck-callout--warn">
          <b>원인을 확정하지 못했습니다.</b> <code>is_member()</code> 호출 자체가
          실패했습니다. 아래 두 가지가 모두 후보로 남습니다.
        </div>
        <ul>
          <li>RLS 화이트리스트 미등록 — 권한이 없어 모든 행이 잘림</li>
          <li>시드 미투입 — 테이블이 실제로 비어 있음</li>
        </ul>
        {probeError !== null && probeError !== undefined && (
          <ErrorDetails info={describeError(probeError)} />
        )}
        <div className="ck-state__actions">
          <button type="button" className="ck-btn" onClick={onRetry}>
            다시 확인
          </button>
          <button type="button" className="ck-btn ck-btn--primary" onClick={onAdd}>
            항목 추가해 보기
          </button>
        </div>
      </>
    )}
  </div>
)

export const FilteredEmptyState = ({ onReset }: { onReset: () => void }) => (
  <div className="ck-card ck-state">
    <h3>조건에 맞는 항목이 없습니다</h3>
    <p>
      데이터는 있지만 지금 걸어 둔 필터가 전부 걸러냈습니다. 완료 항목을 숨겨 둔 상태일
      수도 있습니다.
    </p>
    <div className="ck-state__actions">
      <button type="button" className="ck-btn ck-btn--primary" onClick={onReset}>
        필터 초기화
      </button>
    </div>
  </div>
)
