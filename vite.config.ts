import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

// 빌드마다 다른 표시. 화면은 이 값과 배포된 version.json을 비교해 새 버전을 알린다(src/update.ts)
function buildId() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return String(Date.now())
  }
}

const id = buildId()

// GitHub Pages에서는 https://cooperkang.github.io/squash/ 아래에서 열린다
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/squash/' : '/',
  define: { __BUILD_ID__: JSON.stringify(id) },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id }) })
      },
    },
  ],
}))
