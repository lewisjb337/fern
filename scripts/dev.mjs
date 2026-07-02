/**
 * Dev launcher: starts Vite renderer, waits for it to be ready,
 * then launches Electron with the dev server URL injected.
 */
import { spawn } from 'child_process'

// Start Vite and capture its stdout to extract the actual port it chose
let viteUrl = null
const viteReady = new Promise((resolve) => {
  const vite = spawn('npx', ['vite'], {
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: true,
  })

  vite.stdout.on('data', (chunk) => {
    const text = chunk.toString()
    process.stdout.write(text)
    if (!viteUrl) {
      // Strip ANSI escape codes before matching
      const plain = text.replace(/\x1b\[[0-9;]*m/g, '')
      const match = plain.match(/Local:\s+(http:\/\/localhost:\d+)/)
      if (match) {
        viteUrl = match[1].trim()
        resolve(vite)
      }
    }
  })
})

// Compile electron main+preload in watch mode
const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.electron.json', '--watch', '--preserveWatchOutput'], {
  stdio: 'inherit',
  shell: true,
})

console.log('Waiting for Vite dev server...')
const vite = await viteReady
console.log(`Vite ready at ${viteUrl}. Starting Electron...`)

// Give tsc a moment to finish initial compile
await new Promise(r => setTimeout(r, 2000))

const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_DEV_SERVER_URL: viteUrl },
})

electron.on('close', () => {
  vite.kill()
  tsc.kill()
  process.exit(0)
})

process.on('SIGINT', () => {
  vite.kill()
  tsc.kill()
  electron.kill()
  process.exit(0)
})
