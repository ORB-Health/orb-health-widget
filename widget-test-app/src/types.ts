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

export type TabName = 'widget' | 'orgs' | 'users' | 'patients' | 'contract'

/** Returned by GET /organisations/{id}/contract-status. */
export interface OrgContractStatus {
  extOrganisationId: string
  contractSigned: boolean
  contractSignedAt: string | null
}
