import { useState, useRef, useEffect, ReactNode, CSSProperties } from 'react'
import { usePersistedState } from './storage'
import { inputStyle, btnStyle } from './styles'
import type { LogEntry } from './types'

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Section({ title, children, style, className }: {
  title: string; children: ReactNode; style?: CSSProperties; className?: string
}) {
  return (
    <fieldset className={className} style={{ marginBottom: 16, padding: 16, border: '1px solid #ddd', borderRadius: 8, ...style }}>
      <legend style={{ fontWeight: 600, padding: '0 6px' }}>{title}</legend>
      {children}
    </fieldset>
  )
}

export function Grid2({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 12px', alignItems: 'center' }}>
      {children}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label style={{ fontSize: 13, color: '#444' }}>{children}</label>
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '8px 12px', background: '#f0f7ff', border: '1px solid #cfe3ff',
      borderRadius: 6, fontSize: 12, color: '#234', marginBottom: 12, lineHeight: 1.5
    }}>
      {children}
    </div>
  )
}

// Spin animation lives in App's global <style> block (.orb-spin).
export function Spinner({ size = 14, style }: { size?: number; style?: CSSProperties }) {
  return (
    <span
      className="orb-spin"
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block', width: size, height: size, boxSizing: 'border-box',
        border: '2px solid #e0e0e0', borderTopColor: '#F5450A', borderRadius: '50%',
        ...style
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px',
        border: 'none',
        background: active ? '#F5450A' : 'transparent',
        color: active ? '#fff' : '#333',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        borderRadius: '8px 8px 0 0',
        borderBottom: active ? '2px solid #F5450A' : '2px solid transparent',
        marginBottom: -2
      }}>
      {children}
    </button>
  )
}

export function SubTabs<T extends string>({ value, onChange, tabs }: {
  value: T
  onChange: (t: T) => void
  tabs: { key: T; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {tabs.map(t => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '6px 14px',
              border: '1px solid #ccc',
              background: active ? '#333' : '#fff',
              color: active ? '#fff' : '#333',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              borderRadius: 6
            }}>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export function MiniTab({ active, onClick, disabled, children }: {
  active: boolean; onClick: () => void; disabled?: boolean; children: ReactNode
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      disabled={disabled}
      style={{
        padding: '3px 10px',
        fontSize: 11,
        border: '1px solid ' + (active ? '#F5450A' : '#ccc'),
        background: active ? '#F5450A' : '#fff',
        color: disabled ? '#aaa' : active ? '#fff' : '#333',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 600 : 400
      }}>
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Badges (hover tooltips explaining API contract subtleties)
// ---------------------------------------------------------------------------

export function FromServer() {
  return (
    <span title="Pre-filled from the server response" style={{
      fontSize: 10, background: '#e6f4ea', color: '#137333', padding: '1px 5px',
      borderRadius: 3, marginLeft: 6, fontWeight: 500
    }}>from server</span>
  )
}

export function NotReturned() {
  return (
    <span title="Not returned by GET per spec - you must type the new value to change it" style={{
      fontSize: 10, background: '#fef4e5', color: '#8a6d00', padding: '1px 5px',
      borderRadius: 3, marginLeft: 6, fontWeight: 500
    }}>not returned</span>
  )
}

const mustMatchBadgeStyle: CSSProperties = {
  fontSize: 10, background: '#fdecea', color: '#a61b1b', padding: '1px 5px',
  borderRadius: 3, marginLeft: 6, fontWeight: 500, cursor: 'help'
}

export function MustMatchSurname() {
  return (
    <span style={mustMatchBadgeStyle}
      title={
        "Must match the NHS record.\n\n" +
        "This POST can fail immediately with 409 if it resolves to an existing ORB patient whose surname does not match.\n\n" +
        "Separately, NHS-data matching happens later when the patient follows the invite / link and completes NHS Login.\n\n" +
        "Comparison is case-insensitive + Unicode-normalized (trim, collapse spaces, unify apostrophes ' ` ´ ʼ, unify dashes – — ‐, NBSP→space).\n\n" +
        "Mismatch consequences:\n" +
        "• Patient sees an error page and is NOT signed in (NhsNoMatchException)\n" +
        "• ExternalClientPatient.ConnectionStatus becomes DataMismatch with SurnameMismatch=true (visible via GET /connection)"
      }>
      must match NHS
    </span>
  )
}

export function MustMatchDob() {
  return (
    <span style={mustMatchBadgeStyle}
      title={
        "Must match the NHS record exactly (date-only, time ignored).\n\n" +
        "This POST can fail immediately with 409 if it resolves to an existing ORB patient whose DOB does not match.\n\n" +
        "Separately, NHS-data matching happens later when the patient follows the invite / link and completes NHS Login.\n\n" +
        "Mismatch consequences:\n" +
        "• Patient sees an error page and is NOT signed in (NhsNoMatchException)\n" +
        "• ExternalClientPatient.ConnectionStatus becomes DataMismatch with DateOfBirthMismatch=true (visible via GET /connection)"
      }>
      must match NHS
    </span>
  )
}

// ---------------------------------------------------------------------------
// Input with localStorage-backed history dropdown
// ---------------------------------------------------------------------------

export function InputWithHistory({
  value, onChange, historyKey, placeholder, maxItems = 5
}: {
  value: string
  onChange: (v: string) => void
  historyKey: string
  placeholder?: string
  maxItems?: number
}) {
  const [history, setHistory] = usePersistedState<string[]>(historyKey, [])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const commit = (v: string) => {
    const trimmed = v.trim()
    if (!trimmed) return
    setHistory(prev => {
      const withoutDupe = prev.filter(x => x !== trimmed)
      return [trimmed, ...withoutDupe].slice(0, maxItems)
    })
  }

  const pickItem = (v: string) => {
    onChange(v)
    commit(v)
    setOpen(false)
  }

  const remove = (v: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setHistory(prev => prev.filter(x => x !== v))
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', gap: 4 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => commit(value)}
        placeholder={placeholder}
        style={{ ...inputStyle, flex: 1 }}
      />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={history.length ? 'Show history' : 'No history yet'}
        disabled={history.length === 0}
        style={{
          ...btnStyle,
          padding: '0 10px',
          opacity: history.length === 0 ? 0.4 : 1,
          cursor: history.length === 0 ? 'default' : 'pointer'
        }}>
        ▼
      </button>
      {open && history.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2,
          background: '#fff', border: '1px solid #ccc', borderRadius: 4,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 20, maxHeight: 200, overflowY: 'auto'
        }}>
          {history.map(h => (
            <div
              key={h}
              onClick={() => pickItem(h)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px', cursor: 'pointer', fontSize: 13,
                borderBottom: '1px solid #f0f0f0',
                background: h === value ? '#f0f7ff' : 'transparent'
              }}
              onMouseEnter={e => { if (h !== value) (e.currentTarget as HTMLDivElement).style.background = '#f7f7f7' }}
              onMouseLeave={e => { if (h !== value) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }} title={h}>
                {h}
              </span>
              <button
                type="button"
                onClick={e => remove(h, e)}
                title="Remove"
                style={{
                  border: 'none', background: 'transparent', color: '#999',
                  cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 4px'
                }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log / response display
// ---------------------------------------------------------------------------

type DetailView = 'response' | 'reqBody' | 'reqHeaders'

function formatHeaders(h: Record<string, string>): string {
  return Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n')
}

function formatBody(body: string | undefined): string {
  if (!body) return ''
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export function LogDetailTabs({ entry, maxHeight = 300 }: { entry: LogEntry; maxHeight?: number }) {
  const [view, setView] = useState<DetailView>('response')
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)
  const hasReqBody = !!entry.requestBody
  const hasReqHeaders = !!entry.requestHeaders

  const content = view === 'response'
    ? formatBody(entry.body) || '(empty body)'
    : view === 'reqBody'
      ? (hasReqBody ? formatBody(entry.requestBody) : '(no request body)')
      : (hasReqHeaders ? formatHeaders(entry.requestHeaders!) : '(no request headers)')

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
  }, [])

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      // Fallback for non-secure contexts where the Clipboard API isn't available.
      const ta = document.createElement('textarea')
      ta.value = content
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <MiniTab active={view === 'response'} onClick={() => setView('response')}>Response</MiniTab>
        <MiniTab active={view === 'reqBody'} onClick={() => setView('reqBody')} disabled={!hasReqBody}>Request Body</MiniTab>
        <MiniTab active={view === 'reqHeaders'} onClick={() => setView('reqHeaders')} disabled={!hasReqHeaders}>Headers</MiniTab>
      </div>
      <div className="orb-copy-wrap" style={{ position: 'relative' }}>
        <pre className="orb-scroll" style={{
          margin: 0, padding: 12, paddingRight: 36, background: '#f9f9f9', borderRadius: 4,
          fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight, overflow: 'auto'
        }}>
          {content}
        </pre>
        <button
          type="button"
          onClick={copy}
          title={copied ? 'Copied' : 'Copy to clipboard'}
          aria-label="Copy to clipboard"
          className={'orb-copy-btn' + (copied ? ' is-copied' : '')}
          style={{
            position: 'absolute', top: 6, right: 12,
            width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', borderRadius: 3,
            cursor: 'pointer', padding: 0,
            color: copied ? '#137333' : '#888'
          }}
          onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.background = '#ececec' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export function LastResponsePanel({ entry }: { entry: LogEntry }) {
  const statusColor = entry.status === undefined
    ? '#999'
    : entry.status >= 200 && entry.status < 300 ? '#0a0' : '#c00'
  return (
    <Section title="Last Response" className="orb-last-response">
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        <span style={{ color: '#999' }}>{entry.time}</span>{' '}
        <span style={{ color: '#07c', fontWeight: 600 }}>{entry.method}</span>{' '}
        <span style={{ fontFamily: 'monospace' }}>{entry.url}</span>{' '}
        {entry.status !== undefined && (
          <span className="orb-status-pop" style={{ color: statusColor, fontWeight: 600 }}>[{entry.status}]</span>
        )}
      </div>
      <LogDetailTabs entry={entry} maxHeight={320} />
    </Section>
  )
}
