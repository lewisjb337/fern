import React, { useState, useMemo } from 'react'

interface CsvTableProps {
  csv: string
}

const MAX_ROWS = 50

export function CsvTable({ csv }: CsvTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null)
  const [showAll, setShowAll] = useState(false)

  const { headers, rows } = useMemo(() => {
    const lines = csv.trim().split('\n').map((l) => l.split(',').map((c) => c.trim()))
    const headers = lines[0] ?? []
    const rows = lines.slice(1)
    return { headers, rows }
  }, [csv])

  function handleHeaderClick(i: number) {
    if (sortCol !== i) { setSortCol(i); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    setSortCol(null); setSortDir(null)
  }

  const sorted = useMemo(() => {
    if (sortCol === null || sortDir === null) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? ''
      const bv = b[sortCol] ?? ''
      const an = Number(av); const bn = Number(bv)
      const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortCol, sortDir])

  const displayed = showAll ? sorted : sorted.slice(0, MAX_ROWS)

  return (
    <div className="csv-table-wrap">
      <div className="csv-table-scroll">
        <table className="csv-table">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} onClick={() => handleHeaderClick(i)} className="csv-th">
                  {h}
                  {sortCol === i && <span className="csv-sort">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, ri) => (
              <tr key={ri}>
                {headers.map((_, ci) => (
                  <td key={ci} className="csv-td">{row[ci] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > MAX_ROWS && (
        <button className="csv-show-all" onClick={() => setShowAll((s) => !s)}>
          {showAll ? `Show first ${MAX_ROWS} rows` : `Show all ${sorted.length} rows`}
        </button>
      )}
      <style>{`
        .csv-table-wrap {
          background: var(--bg-app);
          overflow: hidden;
        }
        .csv-table-scroll { overflow-x: auto; }
        .csv-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .csv-th {
          background: var(--bg-hover);
          padding: 6px 10px;
          text-align: left;
          font-weight: 600;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-strong);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .csv-th:hover { background: var(--bg-selected); }
        .csv-sort { color: var(--accent); }
        .csv-td {
          padding: 5px 10px;
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
          white-space: nowrap;
        }
        .csv-show-all {
          display: block;
          width: 100%;
          padding: 6px;
          font-size: 11px;
          color: var(--accent);
          background: var(--bg-hover);
          border-top: 1px solid var(--border);
          text-align: center;
        }
        .csv-show-all:hover { background: var(--bg-selected); }
      `}</style>
    </div>
  )
}
