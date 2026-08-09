import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages가 haliacoast-sys.github.io/wedding/app/ 아래로 서빙하므로
// 에셋 경로를 그 하위로 맞춰야 한다. 루트(/)로 두면 404가 난다.
export default defineConfig({
  plugins: [react()],
  base: '/wedding/app/',
})
