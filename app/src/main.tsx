import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 결혼 준비 데이터는 초 단위로 변하지 않는다. 실시간 갱신은 각 화면의
      // Realtime 구독이 담당하므로 짧은 staleTime 으로 불필요한 요청을 만들 이유가 없다.
      staleTime: 60_000,
      // 다만 Realtime 웹소켓이 끊긴 것을 클라이언트는 즉시 알지 못한다.
      // 화면에 돌아왔을 때 한 번 맞춰보는 것이 유일한 안전망이라 켜 둔다.
      // (둘이 각자 폰으로 쓰는 앱이라 상대의 변경을 놓치는 게 가장 나쁘다.)
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root 를 찾을 수 없습니다. app/index.html 을 확인하세요.')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
