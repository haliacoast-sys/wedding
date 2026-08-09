/**
 * StateViews.tsx — 목록이 그려지지 않는 모든 경우의 화면.
 *
 * 가장 중요한 건 ZeroRowState 다.
 * 조회가 성공했는데 0행인 상황은 원인이 갈린다.
 *   (a) 정말 데이터가 없다 — 시드 미투입, 또는 전부 삭제
 *   (b) RLS 가 전부 잘라냈다 — 로그인 계정이 members 에 없음
 *   (c) 진행표 한정 — day_of_config 에 기준 시각 행이 없다
 * 셋 다 PostgREST 는 200 + 빈 배열을 준다. 에러가 없으니 화면만 봐서는 구분이 안 된다.
 * 그래서 is_member() 를 직접 물어 (a)/(b) 를 가르고, 진행표에서는 (c) 를 따로 짚는다.
 *
 * (c) 를 굳이 분리하는 이유: day_of_schedule 뷰는 day_of_config 와 cross join 한다.
 * config 가 0행이면 곱셈 결과가 0행이라, 진행표 항목이 30개 있어도 화면은 텅 빈다.
 * "항목이 없습니다" 한 줄로 끝내면 영원히 원인을 못 찾는다.
 */
import type { ReactNode } from 'react'
import { describeError } from './dayofApi'
import type { FailureInfo } from './dayofApi'

const ErrorDetails = ({ info }: { info: FailureInfo }) => (
  <dl className="dof-errbox">
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

export const LoadingList = ({ rows = 4 }: { rows?: number }) => (
  <div className="dof-list" aria-busy="true" aria-label="불러오는 중">
    {Array.from({ length: rows }, (_, i) => (
      <div className="dof-skel" key={i} />
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
    <div className="dof-card dof-state">
      <h3>{what}을(를) 불러오지 못했습니다</h3>
      <p>
        {isMissingRelation
          ? 'DB 에 해당 테이블/뷰가 없습니다. day_of 마이그레이션(20260809000005_day_of.sql)이 아직 적용되지 않은 상태로 보입니다.'
          : isAuthish
            ? '권한이 거부됐습니다. 로그인 세션이 만료됐거나 이 계정이 members 에 없습니다.'
            : '네트워크 또는 서버 응답에 문제가 있습니다.'}
      </p>
      <ErrorDetails info={info} />
      <div className="dof-state__actions">
        <button type="button" className="dof-btn dof-btn--primary" onClick={onRetry}>
          다시 시도
        </button>
      </div>
    </div>
  )
}

export type ProbeState = 'checking' | 'member' | 'not-member' | 'unknown'

export const ZeroRowState = ({
  what,
  probe,
  probeError,
  onRetry,
  onAdd,
  addLabel,
  extra,
}: {
  what: string
  probe: ProbeState
  probeError: unknown
  onRetry: () => void
  onAdd?: () => void
  addLabel?: string
  /** 진행표의 config 0행 안내처럼 화면마다 다른 힌트. */
  extra?: ReactNode
}) => (
  <div className="dof-card dof-state">
    <h3>{what}이(가) 하나도 없습니다</h3>
    <p>
      조회 자체는 성공했고 에러도 없었습니다. 그런데 돌아온 행이 0개입니다. 원인이 여러
      가지라서 <code>is_member()</code> 로 권한부터 확인했습니다.
    </p>

    {probe === 'checking' && <p>권한을 확인하는 중입니다…</p>}

    {probe === 'not-member' && (
      <>
        <div className="dof-callout dof-callout--crit">
          <b>권한 문제입니다.</b> <code>is_member()</code> 가 <code>false</code> 를 반환했습니다.
          지금 로그인한 계정이 <code>public.members</code> 에 없어서 RLS 가 모든 행을 잘라내고
          있습니다. 데이터가 없는 게 아니라 보이지 않는 것입니다.
        </div>
        <p>확인할 순서:</p>
        <ul>
          <li>
            <code>public.allowed_emails</code> 에 이 계정이 있는지. 값은{' '}
            <code>&lt;아이디&gt;@wedding.local</code> 형식이어야 합니다.
          </li>
          <li>
            화이트리스트에 <b>나중에</b> 추가한 경우. 가입 트리거는 가입 시점에만 돌기 때문에
            이미 만들어진 계정은 목록에 추가해도 자동으로 <code>members</code> 에 들어가지
            않습니다.
          </li>
          <li>다른 아이디로 로그인하지 않았는지.</li>
        </ul>
      </>
    )}

    {probe === 'member' && (
      <>
        <div className="dof-callout">
          <b>권한은 정상입니다.</b> <code>is_member()</code> 가 <code>true</code> 를 반환했습니다.
          즉 RLS 는 통과했습니다.
        </div>
        {extra}
        {onAdd && (
          <div className="dof-state__actions">
            <button type="button" className="dof-btn dof-btn--primary" onClick={onAdd}>
              {addLabel ?? '첫 항목 추가'}
            </button>
          </div>
        )}
      </>
    )}

    {probe === 'unknown' && (
      <>
        <div className="dof-callout dof-callout--warn">
          <b>원인을 확정하지 못했습니다.</b> <code>is_member()</code> 호출 자체가 실패했습니다.
          RLS 미등록과 시드 미투입이 모두 후보로 남습니다.
        </div>
        {extra}
        {probeError !== null && probeError !== undefined && (
          <ErrorDetails info={describeError(probeError)} />
        )}
        <div className="dof-state__actions">
          <button type="button" className="dof-btn" onClick={onRetry}>
            다시 확인
          </button>
          {onAdd && (
            <button type="button" className="dof-btn dof-btn--primary" onClick={onAdd}>
              {addLabel ?? '항목 추가해 보기'}
            </button>
          )}
        </div>
      </>
    )}
  </div>
)

/** 쓰기 실패 알림. 하단에는 고정 네비게이션이 깔리므로 상단에 띄운다. */
export const WriteToast = ({ message, onDismiss }: { message: string; onDismiss: () => void }) => (
  <div className="dof-toast" role="alert">
    <span>저장하지 못했습니다 — {message}</span>
    <button type="button" onClick={onDismiss}>
      닫기
    </button>
  </div>
)
