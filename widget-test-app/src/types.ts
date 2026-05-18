/** Harness-only types (API DTOs live in orbApi.ts). */

export interface LogEntry {
  id: number
  time: string
  method: string
  url: string
  status?: number
  body?: string
  requestBody?: string
  requestHeaders?: Record<string, string>
}

export type TabName = 'widget' | 'orgs' | 'users' | 'patients'
