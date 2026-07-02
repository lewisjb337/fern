import React from 'react'

export interface OpenTab {
  path: string
  name: string
  isDirty: boolean
}

interface TabBarProps {
  tabs: OpenTab[]
  activeTabPath: string | null
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

export function TabBar({ tabs, activeTabPath, onSelect, onClose }: TabBarProps) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const active = tab.path === activeTabPath
        return (
          <div
            key={tab.path}
            className={`tab ${active ? 'tab--active' : ''}`}
            title={tab.path}
            onClick={() => onSelect(tab.path)}
            onMouseDown={(e) => {
              // Middle-click closes
              if (e.button === 1) {
                e.preventDefault()
                onClose(tab.path)
              }
            }}
          >
            <span className="tab-name">{tab.name}</span>
            <button
              className={`tab-close ${tab.isDirty ? 'tab-close--dirty' : ''}`}
              title="Close"
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.path)
              }}
            >
              <span className="tab-close-x">×</span>
              {tab.isDirty && <span className="tab-dirty-dot" />}
            </button>
          </div>
        )
      })}

      <style>{`
        .tab-bar {
          display: flex;
          align-items: stretch;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border);
          overflow-x: auto;
          overflow-y: hidden;
          flex-shrink: 0;
          height: 36px;
          scrollbar-width: none;
        }
        .tab-bar::-webkit-scrollbar { display: none; }
        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 8px 0 14px;
          max-width: 200px;
          min-width: 0;
          border-right: 1px solid var(--border);
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 13px;
          color: var(--text-secondary);
          background: transparent;
          user-select: none;
          flex-shrink: 0;
          position: relative;
        }
        .tab:hover { background: var(--bg-hover); }
        .tab--active {
          background: var(--bg-app);
          color: var(--text-primary);
        }
        .tab--active::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: -1px;
          height: 2px;
          background: var(--accent);
        }
        .tab-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tab-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          flex-shrink: 0;
          position: relative;
        }
        .tab-close:hover { background: var(--border-strong); color: var(--text-primary); }
        .tab-close-x {
          font-size: 15px;
          line-height: 1;
        }
        /* When dirty, hide the × and show the dot — unless hovered */
        .tab-close--dirty .tab-close-x { display: none; }
        .tab-close--dirty:hover .tab-close-x { display: inline; }
        .tab-close--dirty:hover .tab-dirty-dot { display: none; }
        .tab-dirty-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
        }
      `}</style>
    </div>
  )
}
