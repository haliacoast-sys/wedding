/**
 * StateViews.tsx — 로딩 · 에러 · 빈 상태.
 *
 * 빈 상태를 특히 조심해서 나눴다. "0행 + 에러 없음" 은 두 가지 완전히 다른 상황이
 * 똑같이 보인다: 아직 아무것도 안 넣은 것과, RLS 화이트리스트에 없어서 전부 잘린 것.
 * 후자는 화면상 아무 문제가 없어 보이므로 그냥 두면 몇 시간을 헤맨다.
 * 그래서 is_member() 를 직접 물어보고 결과가 false 면 그 사실을 그대로 알려 준다.
 */
import { describeError } from './budgetApi'
import type { FailureInfo } from './budgetApi'

export const LoadingView = () => (
  <div className="bd-skel" aria-live="polite" aria-busy="true">
    <span className="bd-sr">예산 항목을 불러오는 중입니다</span>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="bd-skel__row" />
    ))}
  </div>
)

export type ErrorViewProps = {
  error: unknown
  onRetry: () => void
}

const rlsHint = (info: FailureInfo): boolean =>
  info.code === '42501' || /row-level security|permission denied/i.test(info.message)

export const ErrorView = ({ error, onRetry }: ErrorViewProps) => {
  const info = describeError(error)
  return (
    <section className="bd-card bd-state bd-state--err" role="alert">
      <h3 className="bd-state__title">예산을 불러오지 못했습니다</h3>
      <p className="bd-state__body">{info.message}</p>
      {info.code && <p className="bd-state__meta">코드 {info.code}</p>}
      {rlsHint(info) && (
        <p className="bd-state__body">
          권한 오류입니다. 이 계정이 allowed_emails 화이트리스트에 등록돼 있는지 확인해 주세요.
        </p>
      )}
      <button type="button" className="bd-btn bd-btn--primary" onClick={onRetry}>
        다시 시도
      </button>
    </section>
  )
}

export type EmptyViewProps = {
  /** is_member() 결과. undefined 면 아직 확인 중. */
  isMember: boolean | undefined
}

export const EmptyView = ({ isMember }: EmptyViewProps) => {
  if (isMember === false) {
    return (
      <section className="bd-card bd-state bd-state--err">
        <h3 className="bd-state__title">데이터가 보이지 않습니다</h3>
        <p className="bd-state__body">
          로그인은 됐지만 이 계정이 <b>members 에 등록돼 있지 않습니다.</b> RLS 정책이 모든 행을
          걸러내고 있어서, 항목을 추가해도 저장되지 않습니다.
        </p>
        <p className="bd-state__body">
          Supabase 대시보드에서 <code>allowed_emails</code> 에 이 계정의 이메일을 넣고 다시
          로그인하면 <code>handle_new_user</code> 트리거가 자동으로 등록합니다.
        </p>
      </section>
    )
  }

  return (
    <section className="bd-card bd-state">
      <h3 className="bd-state__title">아직 적은 항목이 없습니다</h3>
      <p className="bd-state__body">
        위의 <b>항목 추가</b> 를 눌러 시작하세요. 홀 대관료·식대처럼 금액이 큰 것부터 넣으면
        전체 그림이 빨리 잡힙니다.
      </p>
      <p className="bd-state__body bd-state__meta">
        견적만 먼저 넣고, 결제한 뒤에 실제 지출과 결제일을 채우면 초과·절감이 자동으로 계산됩니다.
      </p>
    </section>
  )
}
