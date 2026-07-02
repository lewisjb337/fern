import React, { useEffect, useRef, useMemo } from 'react'
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ScatterController,
  LineController,
  BarController,
  PieController,
  DoughnutController,
  RadarController,
} from 'chart.js'

Chart.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
  RadialLinearScale, Title, Tooltip, Legend, Filler,
  ScatterController, LineController, BarController, PieController, DoughnutController, RadarController,
)

const PALETTE = [
  '#1A5C43', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
  '#10B981', '#F97316', '#EC4899', '#06B6D4', '#84CC16',
]

interface ParsedChart {
  type: string
  title?: string
  labels?: string[]
  datasets: { label?: string; data: number[]; color?: string }[]
}

function parseArray(s: string): string[] {
  const inner = s.replace(/^\[|\]$/g, '').trim()
  if (!inner) return []
  return inner.split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
}

function applyDatasetField(ds: { label?: string; data: number[]; color?: string }, key: string, val: string) {
  if (key === 'label') ds.label = val.trim().replace(/^['"]|['"]$/g, '')
  else if (key === 'data') ds.data = parseArray(val.trim()).map(Number)
  else if (key === 'color') ds.color = val.trim().replace(/^['"]|['"]$/g, '')
}

export function parseChartSpec(raw: string): ParsedChart | null {
  try {
    const lines = raw.trim().split('\n')
    const result: ParsedChart = { type: 'bar', datasets: [] }
    let inDatasets = false
    let currentDataset: { label?: string; data: number[]; color?: string } | null = null

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()
      const trimmed = line.trimStart()
      const indent = line.length - trimmed.length

      if (indent >= 2 && inDatasets) {
        if (!currentDataset) currentDataset = { data: [] }
        if (trimmed.startsWith('- ')) {
          if (currentDataset.data.length > 0) result.datasets.push(currentDataset)
          currentDataset = { data: [] }
          const rest = trimmed.slice(2)
          const kv = rest.match(/^(\w+):\s*(.+)/)
          if (kv) applyDatasetField(currentDataset, kv[1], kv[2])
        } else {
          const kv = trimmed.match(/^(\w+):\s*(.+)/)
          if (kv) applyDatasetField(currentDataset, kv[1], kv[2])
        }
        continue
      }

      inDatasets = false
      if (currentDataset) { result.datasets.push(currentDataset); currentDataset = null }

      const kv = trimmed.match(/^(\w+):\s*(.*)/)
      if (!kv) continue
      const [, key, val] = kv
      if (key === 'type') result.type = val.trim()
      else if (key === 'title') result.title = val.trim()
      else if (key === 'labels') result.labels = parseArray(val.trim())
      else if (key === 'datasets') { inDatasets = true }
      else if (key === 'data') {
        result.datasets = [{ data: parseArray(val.trim()).map(Number) }]
      }
    }
    if (currentDataset) result.datasets.push(currentDataset)
    if (result.datasets.length === 0) return null
    return result
  } catch {
    return null
  }
}

export function buildOptions(spec: ParsedChart, isDark: boolean) {
  const textColor = isDark ? '#9B9A97' : '#6B6B6B'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const chartType = spec.type === 'area' ? 'line' : spec.type

  const datasets = spec.datasets.map((ds, i) => {
    const color = ds.color ?? PALETTE[i % PALETTE.length]
    const isPie = spec.type === 'pie' || spec.type === 'doughnut'
    const isArea = spec.type === 'area'
    return {
      label: ds.label ?? `Series ${i + 1}`,
      data: ds.data,
      backgroundColor: isPie
        ? ds.data.map((_, j) => PALETTE[j % PALETTE.length] + 'CC')
        : isArea ? color + '33' : color + 'CC',
      borderColor: isPie ? PALETTE : color,
      borderWidth: 2,
      fill: isArea,
      tension: 0.35,
      pointRadius: spec.type === 'scatter' ? 5 : 3,
      pointHoverRadius: 6,
    }
  })

  const labels = spec.labels ?? spec.datasets[0]?.data.map((_, i) => String(i + 1)) ?? []

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 300 },
    plugins: {
      legend: {
        display: datasets.length > 1 || spec.type === 'pie' || spec.type === 'doughnut',
        labels: { color: textColor, font: { family: 'Inter, sans-serif', size: 12 as const }, padding: 16, boxWidth: 12 },
      },
      title: spec.title
        ? { display: true, text: spec.title, color: textColor, font: { family: 'Inter, sans-serif', size: 14 as const, weight: 'bold' as const }, padding: { bottom: 16 } }
        : { display: false },
      tooltip: {
        backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
        titleColor: isDark ? '#E9E9E7' : '#37352F',
        bodyColor: isDark ? '#9B9A97' : '#6B6B6B',
        borderColor: isDark ? '#3D3D3D' : '#E9E9E7',
        borderWidth: 1,
        cornerRadius: 6,
        padding: 10,
      },
    },
    scales: chartType === 'pie' || chartType === 'doughnut' ? {} :
      chartType === 'radar' ? {
        r: {
          ticks: { display: false },
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: { color: textColor, font: { family: 'Inter, sans-serif', size: 12 as const } },
        },
      } : {
        x: { ticks: { color: textColor, font: { family: 'Inter, sans-serif', size: 11 as const } }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, font: { family: 'Inter, sans-serif', size: 11 as const } }, grid: { color: gridColor }, beginAtZero: true },
      },
  }

  return { labels, datasets, options, chartType }
}

// Imperative render for PreviewPane's DOM-replacement flow (same as mermaid pattern)
export function renderChartToElement(container: HTMLElement, code: string, isDark: boolean): () => void {
  const spec = parseChartSpec(code)
  if (!spec) {
    container.innerHTML = `<div class="chart-error"><span>Invalid chart spec</span><pre style="white-space:pre-wrap;font-size:11px;margin:8px 0 0;">${code}</pre></div>`
    return () => {}
  }

  const { labels, datasets, options, chartType } = buildOptions(spec, isDark)
  const wrapper = document.createElement('div')
  wrapper.className = 'chart-block-wrapper'
  const canvas = document.createElement('canvas')
  wrapper.appendChild(canvas)
  container.replaceChildren(wrapper)

  const instance = new Chart(canvas, {
    type: chartType as 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter',
    data: { labels, datasets },
    options,
  })

  return () => instance.destroy()
}

// React component — used if chart blocks are wired as proper React segments in future
export function ChartBlock({ code, isDark = false }: { code: string; isDark?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const instanceRef = useRef<Chart | null>(null)
  const spec = useMemo(() => parseChartSpec(code), [code])

  useEffect(() => {
    if (!canvasRef.current || !spec) return
    instanceRef.current?.destroy()
    const { labels, datasets, options, chartType } = buildOptions(spec, isDark)
    instanceRef.current = new Chart(canvasRef.current, {
      type: chartType as 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter',
      data: { labels, datasets },
      options,
    })
    return () => { instanceRef.current?.destroy(); instanceRef.current = null }
  }, [spec, isDark])

  if (!spec) {
    return (
      <div className="chart-error">
        <span>Invalid chart spec — check the YAML format</span>
        <pre>{code}</pre>
      </div>
    )
  }

  return <div className="chart-block-wrapper"><canvas ref={canvasRef} /></div>
}
