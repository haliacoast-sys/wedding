/**
 * StateViews.tsx — 목록이 그려지지 않는 모든 경우의 화면.
 *
 * 가장 중요한 건 ZeroRowState 다. 지금 이 표는 실제로 0행이고, 사용자가 이 화면에서
 * 처음 보게 될 것도 이 화면이다. 그래서 두 가지를 동시에 해야 한다.
 *
 *   (1) 0행의 원인을 가른다.
 *       · 정말 아직 아무도 안 넣었다
 *       · RLS 가 전부 잘라냈다 (로그인 계정이 members 에 없음)
 *       둘 다 PostgREST 는 200 + 빈 배열을 준다. 에러가 없으니 화면만 봐서는 구분이 안 된다.
 *       is_member() 를 직접 물어야만 갈린다.
 *
 *   (2) 권한이 정상이라면 "무엇을 하면 되는지"를 말한다.
 *       "하객이 없습니다" 한 줄로 끝내면 사용자는 200명을 어떻게 넣어야 하는지 모른 채
 *       화면을 닫는다. 엑셀에서 복사해 붙여넣는 길이 있다는 걸 여기서 알려야 한다.
 */
import type { ReactNode } from 'react'
import { describeError } from './guestsApi'
import type { FailureInfo } from './guestsApi'

const ErrorDetails = ({ info }: { info: FailureInfo }) => (
  <dl className="gs-errbox">
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

export const LoadingList = ({ rows = 5 }: { rows?: number }) => (
  <div className="gs-list" aria-busy="true" aria-label="불러오는 중">
    {Array.from({ length: rows }, (_, i) => (
      <div className="gs-skel" key={i} />
    ))}
  </div>
)

export const ErrorState = ({
  error,
  onRetry,
  what,
}: {
  error: unknown
  onRetry: () => void
  what: string
}) => {
  const info = describeError(error)
  const isAuthish = info.code === '42501' || info.code === 'PGRST301' || info.code === '401'
  const isMissingRelation = info.code === '42P01'
  return (
    <div className="gs-card gs-state">
      <h3>{what}을(를) 불러오지 못했습니다</h3>
      <p>
        {isMissingRelation
          ? 'DB 에 guests 테이블이 없습니다. 하객 스키마 마이그레이션(20260817000001_excel_schema.sql)이 아직 적용되지 않은 상태로 보입니다.'
          : isAuthish
            ? '권한이 거부됐습니다. 로그인 세션이 만료됐거나 이 계정이 members 에 없습니다.'
            : '네트워크 또는 서버 응답에 문제가 있습니다.'}
      </p>
      <ErrorDetails info={info} />
      <div className="gs-state__actions">
        <button type="button" className="gs-btn gs-btn--primary" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    </div>
  )
}

export type ProbeState = 'checking' | 'member' | 'not-member' | 'unknown'

const RlsHelp = () => (
  <>
    <div className="gs-callout gs-callout--crit">
      <b>권한 문제입니다.</b> <code>is_member()</code> 가 <code>false</code> 를 반환했습니다.
      지금 로그인한 계정이 <code>public.members</code> 에 없어서 RLS 가 모든 행을 잘라내고
      있습니다. 하객이 없는 게 아니라 보이지 않는 것입니다.
    </div>
    <p>확인할 순서:</p>
    <ul>
      <li>
        <code>public.allowed_emails</code> 에 이 계정이 있는지. 값은{' '}
        <code>&lt;아이디&gt;@wedding.local</code> 형식이어야 합니다.
      </li>
      <li>
        화이트리스트에 <b>나중에</b> 추가한 경우. 가입 트리거는 가입 시점에만 돌기 때문에
        이미 만들어진 계정은 목록에 추가해도 자동으로 <code>members</code> 에 들어가지 않습니다.
      </li>
      <li>다른 아이디로 로그인하지 않았는지.</li>
    </ul>
  </>
)

/**
 * 첫 인상. 권한이 정상일 때는 설명을 최소로 줄이고 '지금 누를 것' 두 개만 남긴다.
 * 200명을 한 명씩 넣는 길밖에 없다고 오해하면 이 화면은 그대로 버려진다.
 */
export const ZeroRowState = ({
  probe,
  probeError,
  onRetry,
  onBulk,
  quickAdd,
}: {
  probe: ProbeState
  probeError: unknown
  onRetry: () => void
  onBulk: () => void
  /** 빠른 추가 입력줄. 권한이 정상일 때만 그린다. */
  quickAdd?: ReactNode
}) => (
  <div className="gs-card gs-state">
    {probe === 'checking' && (
      <>
        <h3>하객 명단이 비어 있습니다</h3>
        <p>
          조회는 성공했고 에러도 없었는데 돌아온 행이 0개입니다. 아직 안 넣은 것인지 권한 때문에
          안 보이는 것인지 <code>is_member()</code> 로 확인하는 중입니다…
        </p>
      </>
    )}

    {probe === 'not-member' && (
      <>
        <h3>하객 명단이 비어 있습니다</h3>
        <RlsHelp />
      </>
    )}

    {probe === 'member' && (
      <>
        <h3>여기에 하객 명단을 만듭니다</h3>
        <p>
          이름만 있으면 한 줄이 만들어집니다. 측·관계·연락처·축의금은 나중에 아무 때나
          채우면 됩니다. <b>축의금과 식사 인원이 쌓이면 예상 수지와 보증인원 대비 현황이
          자동으로 계산</b>됩니다.
        </p>
        {quickAdd}
        <div className="gs-callout">
          <b>엑셀·카톡에 이미 목록이 있다면</b> 한 명씩 칠 필요가 없습니다. 이름을 통째로
          복사해 붙여넣으면 한 번에 들어갑니다.
        </div>
        <div className="gs-state__actions">
          <button type="button" className="gs-btn gs-btn--primary" onClick={onBulk}>
            여러 명 한 번에 추가
          </button>
        </div>
      </>
    )}

    {probe === 'unknown' && (
      <>
        <h3>하객 명단이 비어 있습니다</h3>
        <div className="gs-callout gs-callout--warn">
          <b>원인을 확정하지 못했습니다.</b> <code>is_member()</code> 호출 자체가 실패했습니다.
          RLS 미등록과 '아직 아무도 안 넣음'이 모두 후보로 남습니다.
        </div>
        {probeError !== null && probeError !== undefined && (
          <ErrorDetails info={describeError(probeError)} />
        )}
        {quickAdd}
        <div className="gs-state__actions">
          <button type="button" className="gs-btn" onClick={onRetry}>
            다시 확인
          </button>
          <button type="button" className="gs-btn gs-btn--primary" onClick={onBulk}>
            여러 명 한 번에 추가
          </button>
        </div>
      </>
    )}
  </div>
)

/** 명단은 있는데 필터·검색이 전부 걸러낸 경우. 0행 안내(권한 얘기)와 섞이면 안 된다. */
export const NoMatchState = ({ total, onClear }: { total: number; onClear: () => void }) => (
  <div className="gs-card gs-state">
    <h3>조건에 맞는 하객이 없습니다</h3>
    <p>
      명단에는 {total}명이 있지만 지금 걸린 필터·검색을 통과한 사람이 없습니다.
    </p>
    <div className="gs-state__actions">
      <button type="button" className="gs-btn gs-btn--primary" onClick={onClear}>
        필터 모두 해제
      </button>
    </div>
  </div>
)

/** 쓰기 실패 알림. 하단에는 고정 네비게이션이 깔리므로 상단에 띄운다. */
export const WriteToast = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
  <div className="gs-toast" role="alert">
    <span>저장하지 못했습니다 — {message}</span>
    <button type="button" onClick={onDismiss}>
      닫기
    </button>
  </div>
)
