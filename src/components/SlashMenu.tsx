import React, { useEffect, useRef } from 'react'

export interface SlashItem {
  id: string
  label: string
  description: string
  icon: string
  template: string
  cursorAt: number
  group: string
}

// cursorAt = offset from start of template where cursor lands after insert
export const SLASH_ITEMS: SlashItem[] = [
  // ── Text blocks ──────────────────────────────────────────────────────────
  { group: 'Text',    id: 'h1',       label: 'Heading 1',      description: 'Large section heading',        icon: 'H1',  template: '# ',                                                              cursorAt: 2  },
  { group: 'Text',    id: 'h2',       label: 'Heading 2',      description: 'Medium section heading',       icon: 'H2',  template: '## ',                                                             cursorAt: 3  },
  { group: 'Text',    id: 'h3',       label: 'Heading 3',      description: 'Small section heading',        icon: 'H3',  template: '### ',                                                            cursorAt: 4  },
  { group: 'Text',    id: 'bullet',   label: 'Bullet List',    description: 'Unordered list',               icon: '•',   template: '- ',                                                              cursorAt: 2  },
  { group: 'Text',    id: 'numbered', label: 'Numbered List',  description: 'Ordered list',                 icon: '1.',  template: '1. ',                                                             cursorAt: 3  },
  { group: 'Text',    id: 'todo',     label: 'To-do List',     description: 'Checkbox task list',           icon: '☐',   template: '- [ ] ',                                                          cursorAt: 6  },
  { group: 'Text',    id: 'quote',    label: 'Quote',          description: 'Block quote',                  icon: '❝',   template: '> ',                                                              cursorAt: 2  },
  { group: 'Text',    id: 'divider',  label: 'Divider',        description: 'Horizontal separator',         icon: '—',   template: '---\n',                                                           cursorAt: 4  },
  { group: 'Text',    id: 'table',    label: 'Table',          description: '3-column table template',      icon: '⊞',   template: '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n', cursorAt: 2 },
  { group: 'Text',    id: 'bold',     label: 'Bold',           description: 'Bold text',                    icon: 'B',   template: '**bold text**',                                                   cursorAt: 2  },
  { group: 'Text',    id: 'italic',   label: 'Italic',         description: 'Italic text',                  icon: 'I',   template: '*italic text*',                                                   cursorAt: 1  },
  { group: 'Text',    id: 'link',     label: 'Link',           description: 'Hyperlink',                    icon: '↗',   template: '[link text](url)',                                                cursorAt: 1  },
  { group: 'Text',    id: 'image',    label: 'Image',          description: 'Embed image from URL',         icon: '🖼',   template: '![alt text](url)',                                                cursorAt: 2  },

  // ── Text colours ─────────────────────────────────────────────────────────
  { group: 'Color',   id: 'c-muted',   label: 'Muted',          description: 'De-emphasised grey text',      icon: 'Aa',  template: '<span class="c-muted">muted text</span>',                          cursorAt: 20 },
  { group: 'Color',   id: 'c-red',     label: 'Red',            description: 'Red text',                     icon: 'Aa',  template: '<span class="c-red">red text</span>',                              cursorAt: 18 },
  { group: 'Color',   id: 'c-orange',  label: 'Orange',         description: 'Orange text',                  icon: 'Aa',  template: '<span class="c-orange">orange text</span>',                        cursorAt: 21 },
  { group: 'Color',   id: 'c-yellow',  label: 'Yellow',         description: 'Yellow/amber text',            icon: 'Aa',  template: '<span class="c-yellow">yellow text</span>',                        cursorAt: 21 },
  { group: 'Color',   id: 'c-green',   label: 'Green',          description: 'Green text',                   icon: 'Aa',  template: '<span class="c-green">green text</span>',                          cursorAt: 20 },
  { group: 'Color',   id: 'c-blue',    label: 'Blue',           description: 'Blue text',                    icon: 'Aa',  template: '<span class="c-blue">blue text</span>',                            cursorAt: 19 },
  { group: 'Color',   id: 'c-purple',  label: 'Purple',         description: 'Purple text',                  icon: 'Aa',  template: '<span class="c-purple">purple text</span>',                        cursorAt: 21 },

  // ── HTTP / API requests ──────────────────────────────────────────────────
  { group: 'API',      id: 'http-get',  label: 'GET Request',    description: 'HTTP GET request',             icon: 'GET', template: '```http run\nGET https://api.example.com/endpoint\nAccept: application/json\n```', cursorAt: 12 },
  { group: 'API',      id: 'http-post', label: 'POST Request',   description: 'HTTP POST with JSON body',     icon: 'POST',template: '```http run\nPOST https://api.example.com/endpoint\nContent-Type: application/json\nAccept: application/json\n\n{\n  \n}\n```', cursorAt: 13 },
  { group: 'API',      id: 'http-put',  label: 'PUT Request',    description: 'HTTP PUT to update a resource',icon: 'PUT', template: '```http run\nPUT https://api.example.com/endpoint/1\nContent-Type: application/json\n\n{\n  \n}\n```', cursorAt: 12 },
  { group: 'API',      id: 'http-del',  label: 'DELETE Request', description: 'HTTP DELETE a resource',       icon: 'DEL', template: '```http run\nDELETE https://api.example.com/endpoint/1\nAuthorization: Bearer your-token\n```', cursorAt: 15 },
  { group: 'API',      id: 'http-auth', label: 'Authenticated',  description: 'GET with bearer auth header',  icon: '🔑',  template: '```http run\nGET https://api.example.com/me\nAuthorization: Bearer your-token-here\nAccept: application/json\n```', cursorAt: 12 },

  // ── Runnable code blocks ─────────────────────────────────────────────────
  { group: 'Run',     id: 'bash',     label: 'Bash',           description: 'Run a shell script',           icon: '$_',  template: '```bash run\n\n```',                                              cursorAt: 11 },
  { group: 'Run',     id: 'pwsh',     label: 'PowerShell',     description: 'Run a PowerShell script',      icon: 'PS',  template: '```powershell run\n\n```',                                        cursorAt: 17 },
  { group: 'Run',     id: 'node',     label: 'Node.js',        description: 'Run JavaScript with Node',     icon: 'JS',  template: '```node run\n\n```',                                              cursorAt: 11 },
  { group: 'Run',     id: 'ts',       label: 'TypeScript',     description: 'Run TypeScript via ts-node',   icon: 'TS',  template: '```typescript run\n\n```',                                        cursorAt: 16 },
  { group: 'Run',     id: 'python',   label: 'Python',         description: 'Run a Python script',          icon: 'Py',  template: '```python3 run\n\n```',                                           cursorAt: 14 },
  { group: 'Run',     id: 'ruby',     label: 'Ruby',           description: 'Run a Ruby script',            icon: 'Rb',  template: '```ruby run\n\n```',                                              cursorAt: 12 },
  { group: 'Run',     id: 'go-run',   label: 'Go',             description: 'Run a Go program',             icon: 'Go',  template: '```go run\npackage main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hello")\n}\n```', cursorAt: 9 },
  { group: 'Run',     id: 'deno',     label: 'Deno',           description: 'Run TypeScript with Deno',     icon: 'De',  template: '```deno run\n\n```',                                              cursorAt: 11 },
  { group: 'Run',     id: 'php',      label: 'PHP',            description: 'Run a PHP script',             icon: 'PHP', template: '```php run\n<?php\n\n',                                           cursorAt: 12 },
  { group: 'Run',     id: 'rust-run', label: 'Rust',           description: 'Compile and run Rust code',    icon: 'Rs',  template: '```rust run\nfn main() {\n    println!("hello");\n}\n```',        cursorAt: 10 },
  { group: 'Run',     id: 'run-hidden', label: 'Hidden block',  description: 'Runs but invisible in preview', icon: '👁', template: '```bash run hidden\n\n```', cursorAt: 19 },

  // ── Embeds ───────────────────────────────────────────────────────────────
  { group: 'Embed',    id: 'embed-file',   label: 'File embed',      description: 'Embed a workspace file as code',    icon: '📄',  template: '{{file: }}',                                                      cursorAt: 8  },
  { group: 'Embed',    id: 'embed-csv',    label: 'CSV embed',       description: 'Embed a CSV file as a table',       icon: '📊',  template: '{{csv: }}',                                                       cursorAt: 7  },
  { group: 'Embed',    id: 'embed-api',    label: 'API embed',       description: 'Fetch and display a live API',      icon: '🌐',  template: '{{api: GET }}',                                                   cursorAt: 11 },
  { group: 'Embed',    id: 'embed-issues', label: 'Issues embed',    description: 'Show GitHub issues from this repo', icon: '🐙',  template: '{{issues: open}}',                                                cursorAt: 10 },
  { group: 'Embed',    id: 'embed-env',    label: 'Env variable',    description: 'Show a masked .env variable',       icon: '🔑',  template: '{{env: }}',                                                       cursorAt: 7  },

  // ── Charts ───────────────────────────────────────────────────────────────
  { group: 'Chart', id: 'chart-bar',      label: 'Bar Chart',      description: 'Vertical bar chart',              icon: '▊',   template: '```chart\ntype: bar\ntitle: My Chart\nlabels: [Jan, Feb, Mar, Apr, May, Jun]\ndatasets:\n  - label: Series 1\n    data: [12, 19, 8, 15, 22, 30]\n```\n', cursorAt: 8 },
  { group: 'Chart', id: 'chart-line',     label: 'Line Chart',     description: 'Line graph over time',             icon: '📈',   template: '```chart\ntype: line\ntitle: Trend\nlabels: [Jan, Feb, Mar, Apr, May, Jun]\ndatasets:\n  - label: Value\n    data: [10, 25, 18, 32, 28, 40]\n```\n', cursorAt: 8 },
  { group: 'Chart', id: 'chart-area',     label: 'Area Chart',     description: 'Filled area chart',                icon: '⛰',   template: '```chart\ntype: area\ntitle: Volume\nlabels: [Jan, Feb, Mar, Apr, May, Jun]\ndatasets:\n  - label: Volume\n    data: [8, 14, 11, 20, 17, 26]\n```\n', cursorAt: 8 },
  { group: 'Chart', id: 'chart-pie',      label: 'Pie Chart',      description: 'Pie / proportion chart',           icon: '🥧',   template: '```chart\ntype: pie\ntitle: Distribution\nlabels: [Category A, Category B, Category C, Category D]\ndata: [40, 25, 20, 15]\n```\n', cursorAt: 8 },
  { group: 'Chart', id: 'chart-doughnut', label: 'Doughnut Chart', description: 'Doughnut proportion chart',        icon: '⭕',   template: '```chart\ntype: doughnut\ntitle: Breakdown\nlabels: [Alpha, Beta, Gamma, Delta]\ndata: [35, 30, 20, 15]\n```\n', cursorAt: 8 },
  { group: 'Chart', id: 'chart-radar',    label: 'Radar Chart',    description: 'Spider / radar comparison',        icon: '🕸',   template: '```chart\ntype: radar\ntitle: Skills\nlabels: [Speed, Power, Range, Accuracy, Stamina]\ndatasets:\n  - label: Team A\n    data: [80, 65, 70, 90, 75]\n  - label: Team B\n    data: [60, 85, 55, 70, 80]\n```\n', cursorAt: 8 },
  { group: 'Chart', id: 'chart-scatter',  label: 'Scatter Plot',   description: 'X/Y scatter chart',               icon: '⋱',   template: '```chart\ntype: scatter\ntitle: Scatter\nlabels: [1, 2, 3, 4, 5, 6, 7, 8]\ndatasets:\n  - label: Points\n    data: [3, 7, 2, 9, 4, 8, 1, 6]\n```\n', cursorAt: 8 },
  { group: 'Chart', id: 'chart-multi',    label: 'Multi-series',   description: 'Bar chart with multiple series',  icon: '📊',   template: '```chart\ntype: bar\ntitle: Comparison\nlabels: [Q1, Q2, Q3, Q4]\ndatasets:\n  - label: 2023\n    data: [80, 95, 72, 110]\n  - label: 2024\n    data: [90, 105, 88, 130]\n```\n', cursorAt: 8 },

  // ── Diagrams (Mermaid) ────────────────────────────────────────────────────
  { group: 'Diagram', id: 'diag-flow',     label: 'Flowchart',      description: 'Mermaid flowchart',               icon: '⬡',   template: '```mermaid\nflowchart TD\n    A[Start] --> B{Decision?}\n    B -- Yes --> C[Action A]\n    B -- No --> D[Action B]\n    C --> E[End]\n    D --> E\n```\n', cursorAt: 12 },
  { group: 'Diagram', id: 'diag-seq',      label: 'Sequence',       description: 'Mermaid sequence diagram',        icon: '↔',   template: '```mermaid\nsequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello Bob\n    B-->>A: Hi Alice!\n    A->>B: How are you?\n    B-->>A: Great, thanks!\n```\n', cursorAt: 12 },
  { group: 'Diagram', id: 'diag-er',       label: 'ER Diagram',     description: 'Entity-relationship diagram',     icon: '⊞',   template: '```mermaid\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER {\n        string name\n        string email\n    }\n    ORDER {\n        int id\n        date created\n    }\n```\n', cursorAt: 12 },
  { group: 'Diagram', id: 'diag-gantt',    label: 'Gantt Chart',    description: 'Project timeline / Gantt chart',  icon: '📅',   template: '```mermaid\ngantt\n    title Project Timeline\n    dateFormat YYYY-MM-DD\n    section Phase 1\n        Task A    :a1, 2024-01-01, 7d\n        Task B    :after a1, 5d\n    section Phase 2\n        Task C    :2024-01-10, 4d\n        Task D    :2024-01-14, 6d\n```\n', cursorAt: 12 },
  { group: 'Diagram', id: 'diag-class',    label: 'Class Diagram',  description: 'UML class diagram',               icon: '⬜',   template: '```mermaid\nclassDiagram\n    class Animal {\n        +String name\n        +int age\n        +makeSound() void\n    }\n    class Dog {\n        +fetch() void\n    }\n    Animal <|-- Dog\n```\n', cursorAt: 12 },
  { group: 'Diagram', id: 'diag-mindmap',  label: 'Mind Map',       description: 'Mermaid mind map',                icon: '🧠',   template: '```mermaid\nmindmap\n  root((Main Topic))\n    Branch A\n      Idea 1\n      Idea 2\n    Branch B\n      Idea 3\n      Idea 4\n    Branch C\n      Idea 5\n```\n', cursorAt: 12 },
  { group: 'Diagram', id: 'diag-pie',      label: 'Pie (Mermaid)',  description: 'Simple Mermaid pie chart',        icon: '🥮',   template: '```mermaid\npie title Distribution\n    "Category A" : 40\n    "Category B" : 30\n    "Category C" : 20\n    "Category D" : 10\n```\n', cursorAt: 12 },

  // ── Static code blocks ───────────────────────────────────────────────────
  { group: 'Code',    id: 'js-s',     label: 'JavaScript',     description: 'JavaScript snippet',           icon: 'js',  template: '```javascript\n\n```',                                            cursorAt: 14 },
  { group: 'Code',    id: 'ts-s',     label: 'TypeScript',     description: 'TypeScript snippet',           icon: 'ts',  template: '```typescript\n\n```',                                            cursorAt: 14 },
  { group: 'Code',    id: 'py-s',     label: 'Python',         description: 'Python snippet',               icon: 'py',  template: '```python\n\n```',                                                cursorAt: 10 },
  { group: 'Code',    id: 'html',     label: 'HTML',           description: 'HTML markup',                  icon: 'HT',  template: '```html\n\n```',                                                  cursorAt: 8  },
  { group: 'Code',    id: 'css',      label: 'CSS',            description: 'CSS styles',                   icon: 'CS',  template: '```css\n\n```',                                                   cursorAt: 7  },
  { group: 'Code',    id: 'json',     label: 'JSON',           description: 'JSON data',                    icon: '{}',  template: '```json\n{\n  \n}\n```',                                          cursorAt: 10 },
  { group: 'Code',    id: 'yaml',     label: 'YAML',           description: 'YAML config',                  icon: 'YM',  template: '```yaml\n\n```',                                                  cursorAt: 8  },
  { group: 'Code',    id: 'sql',      label: 'SQL',            description: 'SQL query',                    icon: 'SQL', template: '```sql\nSELECT *\nFROM table\nWHERE condition;\n```',              cursorAt: 6  },
  { group: 'Code',    id: 'graphql',  label: 'GraphQL',        description: 'GraphQL query',                icon: 'GQL', template: '```graphql\nquery {\n  \n}\n```',                                 cursorAt: 11 },
  { group: 'Code',    id: 'docker',   label: 'Dockerfile',     description: 'Docker build file',            icon: 'Dk',  template: '```dockerfile\nFROM node:20-alpine\n\n```',                       cursorAt: 14 },
  { group: 'Code',    id: 'sh-s',     label: 'Shell',          description: 'Shell script snippet',         icon: 'sh',  template: '```sh\n\n```',                                                    cursorAt: 6  },
  { group: 'Code',    id: 'go-s',     label: 'Go',             description: 'Go code snippet',              icon: 'go',  template: '```go\n\n```',                                                    cursorAt: 6  },
  { group: 'Code',    id: 'rust-s',   label: 'Rust',           description: 'Rust code snippet',            icon: 'rs',  template: '```rust\n\n```',                                                  cursorAt: 8  },
  { group: 'Code',    id: 'toml',     label: 'TOML',           description: 'TOML config',                  icon: 'TM',  template: '```toml\n\n```',                                                  cursorAt: 8  },
  { group: 'Code',    id: 'xml',      label: 'XML',            description: 'XML markup',                   icon: 'XML', template: '```xml\n\n```',                                                   cursorAt: 7  },
  { group: 'Code',    id: 'plain',    label: 'Code Block',     description: 'Plain code block',             icon: '<>',  template: '```\n\n```',                                                      cursorAt: 4  },
]

export function filterItems(query: string): SlashItem[] {
  if (!query) return SLASH_ITEMS
  const q = query.toLowerCase()
  return SLASH_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
  )
}

function groupItems(items: SlashItem[]): { group: string; items: SlashItem[] }[] {
  const map = new Map<string, SlashItem[]>()
  for (const item of items) {
    if (!map.has(item.group)) map.set(item.group, [])
    map.get(item.group)!.push(item)
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
}

interface SlashMenuProps {
  query: string
  coords: { left: number; bottom: number }
  selectedIndex: number
  onSelect: (item: SlashItem) => void
  onChangeIndex: (i: number) => void
}

export function SlashMenu({ query, coords, selectedIndex, onSelect, onChangeIndex }: SlashMenuProps) {
  const filtered = filterItems(query)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (filtered.length === 0) return null

  const groups = groupItems(filtered)

  // Clamp position so menu never overflows the viewport
  const menuW = 280
  const menuMaxH = 420
  const safeLeft = Math.min(coords.left, window.innerWidth - menuW - 8)
  const spaceBelow = window.innerHeight - coords.bottom - 8
  const spaceAbove = coords.bottom - 8
  const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow
  const posStyle: React.CSSProperties = openAbove
    ? { bottom: window.innerHeight - coords.bottom + 6, maxHeight: Math.min(menuMaxH, spaceAbove - 4) }
    : { top: coords.bottom + 6, maxHeight: Math.min(menuMaxH, spaceBelow - 4) }

  // Build a flat index map for selectedIndex (which is global across groups)
  let globalIdx = 0

  return (
    <div
      className="slash-menu"
      ref={menuRef}
      style={{ position: 'fixed', left: safeLeft, ...posStyle, zIndex: 9999 }}
    >
      {query && <div className="slash-menu-query">/{query}</div>}
      {groups.map(({ group, items }) => (
        <div key={group} className="slash-group">
          <div className="slash-group-label">{group}</div>
          {items.map((item) => {
            const idx = globalIdx++
            return (
              <button
                key={item.id}
                data-idx={idx}
                className={`slash-item ${idx === selectedIndex ? 'active' : ''}`}
                onMouseEnter={() => onChangeIndex(idx)}
                onMouseDown={(e) => { e.preventDefault(); onSelect(item) }}
              >
                <span className={`slash-item-icon ${item.group === 'Color' ? `slash-icon-${item.id}` : ''}`}>{item.icon}</span>
                <span className="slash-item-body">
                  <span className="slash-item-label">{item.label}</span>
                  <span className="slash-item-desc">{item.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      ))}

      <style>{`
        .slash-menu {
          background: var(--bg-app);
          border: 1px solid var(--border-strong);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.08);
          padding: 4px;
          width: 280px;
          max-height: 420px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .slash-menu-query {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-muted);
          padding: 4px 8px 2px;
          letter-spacing: 0.04em;
        }
        .slash-group { padding: 4px 0 2px; }
        .slash-group-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-muted);
          padding: 4px 10px 2px;
        }
        .slash-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 5px 8px;
          border-radius: 6px;
          background: transparent;
          text-align: left;
          width: 100%;
          transition: background 0.06s;
          cursor: pointer;
        }
        .slash-item.active { background: var(--bg-selected); }
        .slash-item-icon {
          width: 28px;
          height: 28px;
          border-radius: 5px;
          background: var(--bg-hover);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          color: var(--text-secondary);
          flex-shrink: 0;
          font-family: var(--font-mono);
          letter-spacing: -0.03em;
        }
        .slash-item-body {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .slash-item-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          line-height: 1.3;
        }
        .slash-item-desc {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.3;
        }
        /* Colour swatch icons */
        .slash-icon-c-muted  { background: var(--bg-hover); color: var(--text-muted) !important; }
        .slash-icon-c-red    { background: var(--color-red-bg); color: var(--color-red) !important; border-color: var(--border) !important; }
        .slash-icon-c-orange { background: var(--color-amber-bg); color: var(--color-amber) !important; border-color: var(--border) !important; }
        .slash-icon-c-yellow { background: #FEFAE8; color: #8A7020 !important; border-color: var(--border) !important; }
        .slash-icon-c-green  { background: var(--accent-bg); color: var(--accent) !important; border-color: var(--border) !important; }
        .slash-icon-c-blue   { background: var(--color-blue-bg); color: var(--color-blue) !important; border-color: var(--border) !important; }
        .slash-icon-c-purple { background: #F4EEFA; color: #6040A0 !important; border-color: var(--border) !important; }
      `}</style>
    </div>
  )
}
