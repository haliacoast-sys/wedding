/**
 * writeGuard.ts — "지금 이 화면이 쓰는 중인가?" 를 세는 카운터.
 *
 * 낙관적 업데이트는 캐시를 먼저 고쳐 놓고 서버 응답을 기다린다. 그 사이 Realtime
 * 이벤트가 도착해 캐시를 서버 상태로 덮어쓰면, 방금 누른 체크가 눈앞에서 도로 풀린다.
 * 상대가 만든 변경이든 내 변경이 되돌아온 메아리든 결과는 같다.
 *
 * 그래서 쓰기가 진행 중인 동안에는 Realtime 이 캐시를 건드리지 않게 막고,
 * "어느 쿼리에 밀린 변경이 있었다"는 사실만 기록해 뒀다가 쓰기가 전부 끝난 뒤
 * 그 쿼리들만 한 번 무효화한다.
 *
 * 체크리스트에도 같은 구조의 파일이 있지만 일부러 공유하지 않는다.
 * 카운터를 공유하면 체크리스트에서 쓰는 동안 당일 화면의 Realtime 이 멈추고,
 * 그 반대도 마찬가지다. 서로 무관한 두 화면이 서로를 막을 이유가 없다.
 *
 * useIsMutating() 을 쓰지 않는 이유:
 *   그 값은 리렌더를 거쳐야 갱신되므로 onMutate 와 실제 반영 사이에 틈이 생긴다.
 *   여기서는 onMutate 첫 줄에서 동기적으로 올리고 onSettled 에서 내려 틈이 없다.
 *   React 상태가 아니라 조율용 카운터라 모듈 스코프가 맞다.
 */

type Listener = () => void

let inFlight = 0
const settledListeners = new Set<Listener>()

export const hasLocalWrites = (): boolean => inFlight > 0

export const beginLocalWrite = (): void => {
  inFlight += 1
}

export const endLocalWrite = (): void => {
  inFlight = Math.max(0, inFlight - 1)
  if (inFlight === 0) {
    for (const listener of settledListeners) listener()
  }
}

/** 진행 중인 쓰기가 0이 되는 순간마다 호출된다. 반환값은 구독 해제 함수. */
export const onLocalWritesSettled = (listener: Listener): (() => void) => {
  settledListeners.add(listener)
  return () => {
    settledListeners.delete(listener)
  }
}
