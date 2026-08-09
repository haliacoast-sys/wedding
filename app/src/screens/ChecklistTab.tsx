/**
 * 체크리스트 탭의 지연 로딩 진입점.
 *
 * 두 가지를 한 곳에 묶기 위해 존재한다.
 *  1. ChecklistApp 이 아니라 ChecklistScreen 을 쓴다 — ChecklistApp 은 자체 D-day
 *     헤더와 로그아웃을 그리는데, 셸이 이미 그 역할을 하므로 헤더가 두 번 나온다.
 *  2. checklist.css 는 ChecklistApp.tsx 만 import 한다. ChecklistScreen 만 쓰면
 *     스타일이 통째로 빠지므로 여기서 함께 가져온다. 그래야 이 CSS 가 메인 번들이
 *     아니라 체크리스트 청크에 실린다.
 */
import { ChecklistScreen } from '../checklist/ChecklistScreen'
import '../checklist/checklist.css'

export default ChecklistScreen
