// Shared inline-style helpers for the test-harness UI. Kept intentionally
// minimal — plain inline styles instead of a CSS framework so the generated
// bundle stays small (currently ~60 KB gzipped).
import type { CSSProperties } from 'react'

export const inputStyle: CSSProperties = {
  padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4,
  fontSize: 14, width: '100%', boxSizing: 'border-box'
}

export const btnStyle: CSSProperties = {
  padding: '8px 16px', border: '1px solid #ccc', borderRadius: 6,
  cursor: 'pointer', fontSize: 14, background: '#fff'
}

export const btnPrimary: CSSProperties = {
  background: '#F5450A', color: '#fff', borderColor: '#F5450A'
}

export const btnDanger: CSSProperties = {
  color: '#c00', borderColor: '#c00'
}
