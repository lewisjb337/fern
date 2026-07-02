import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { BrowserWindow } from 'electron'

interface RunResult {
  exitCode: number | null
  duration: number
}

const runningProcesses = new Map<number, ChildProcess>()

function getRuntimeCommand(runtime: string): { cmd: string; args: (code: string, tmpFile: string) => string[] } {
  switch (runtime.toLowerCase()) {
    case 'bash':
    case 'sh':
      return { cmd: process.platform === 'win32' ? 'bash' : '/bin/bash', args: (code) => ['-c', code] }
    case 'javascript':
    case 'js':
      return { cmd: 'node', args: (_, tmpFile) => [tmpFile] }
    case 'python':
    case 'python3':
      return { cmd: process.platform === 'win32' ? 'python' : 'python3', args: (_, tmpFile) => [tmpFile] }
    default:
      return { cmd: process.platform === 'win32' ? 'bash' : '/bin/bash', args: (code) => ['-c', code] }
  }
}

function needsTempFile(runtime: string): boolean {
  const r = runtime.toLowerCase()
  return r === 'javascript' || r === 'js' || r === 'python' || r === 'python3'
}

export async function runBlock(
  win: BrowserWindow,
  blockId: string,
  code: string,
  runtime: string,
  cwd: string,
  sessionEnv: Record<string, string>
): Promise<RunResult> {
  const start = Date.now()
  const { cmd, args } = getRuntimeCommand(runtime)

  let tmpFile: string | null = null

  if (needsTempFile(runtime)) {
    const ext = runtime.toLowerCase().startsWith('python') ? '.py' : '.js'
    tmpFile = path.join(os.tmpdir(), `fern-block-${Date.now()}${ext}`)
    fs.writeFileSync(tmpFile, code, 'utf8')
  }

  const cmdArgs = args(code, tmpFile ?? '')
  const mergedEnv = { ...process.env, ...sessionEnv } as Record<string, string>

  const child = spawn(cmd, cmdArgs, {
    cwd,
    env: mergedEnv,
    shell: false,
  })

  if (child.pid) {
    runningProcesses.set(child.pid, child)
  }

  const pid = child.pid ?? -1

  child.stdout.on('data', (data: Buffer) => {
    win.webContents.send('block-output', {
      blockId,
      pid,
      chunk: data.toString(),
      stream: 'stdout' as const,
    })
  })

  child.stderr.on('data', (data: Buffer) => {
    win.webContents.send('block-output', {
      blockId,
      pid,
      chunk: data.toString(),
      stream: 'stderr' as const,
    })
  })

  return new Promise((resolve) => {
    child.on('close', (exitCode) => {
      if (child.pid) {
        runningProcesses.delete(child.pid)
      }
      if (tmpFile) {
        try {
          fs.unlinkSync(tmpFile)
        } catch {
          // ignore cleanup errors
        }
      }
      resolve({ exitCode, duration: Date.now() - start })
    })

    child.on('error', (err) => {
      win.webContents.send('block-output', {
        blockId,
        pid,
        chunk: `Error: ${err.message}\n`,
        stream: 'stderr' as const,
      })
      if (child.pid) {
        runningProcesses.delete(child.pid)
      }
      resolve({ exitCode: 1, duration: Date.now() - start })
    })
  })
}

export function stopBlock(pid: number): void {
  const child = runningProcesses.get(pid)
  if (child) {
    child.kill('SIGTERM')
    runningProcesses.delete(pid)
  }
}
