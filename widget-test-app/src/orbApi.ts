/**
 * ORB External API client.
 *
 * This file is the single source of truth for the ORB API surface. Every HTTP
 * endpoint the external API exposes lives here as a named, typed function.
 *
 * Usage:
 *
 *   const orb = createOrbApi({
 *     baseUrl: 'https://api.orbforhealth.com/v1',
 *     apiKey:  'your-api-key',
 *   })
 *
 *   const { ok, data } = await orb.listOrganisations()
 *
 * Every call returns a plain { ok, status, data } triple. `ok` is true for
 * 2xx responses; on non-2xx, `data` contains whatever the server returned
 * (usually a problem-details object) so you can inspect it yourself rather
 * than having an exception thrown at you.
 *
 * Auth: every request sends an `X-API-KEY` header.
 *
 * For widget / iframe integration, see widgetIntegration.ts - it uses
 * requestAccessToken() from this file.
 */

import type { OrgContractStatus } from './types'

// ============================================================================
// Enums
// ============================================================================

export type ConnectionStatus =
  | 'InviteNotSent'
  | 'InviteSent'
  | 'InviteExpired'
  | 'DataMismatch'
  | 'Connected'

export type DataAccessStatus =
  | 'RequestNotSent'
  | 'RequestSent'
  | 'Reviewed'

export type PatientPermission =
  | 'Allergies'
  | 'Medication History'
  | 'Immunisations'
  | 'Problems'
  | 'TestResults'
  | 'Documents'
  | 'Consultation History'

// ============================================================================
// Entity types (returned by the API)
// ============================================================================

/** Mirrors OrganisationSummary: only these four fields ever come back. */
export interface OrgItem {
  extOrganisationId: string
  organisationName: string
  suspended: boolean
  autoDeleteDate?: string | null
}

export interface UserItem {
  extUserId: string
  firstName: string
  lastName: string
  professionalRegNumber: string
  emailAddress?: string
  isClinician: boolean
  isLocum: boolean
  authorisedSignatory: boolean
}

/** Mirrors PatientSummary (which extends PatientBaseResponse server-side). */
export interface PatientItem {
  extPatientId: string
  title?: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  sex?: string
  emailAddress?: string
  postcode?: string
  nhsNumber?: string
  connectionStatus: ConnectionStatus
  dataAccessStatus?: DataAccessStatus
  dobMismatch?: boolean
  surnameMismatch?: boolean
  gpDataAccessLimited?: boolean
  patientDataAccessLimited?: boolean
  oldestNhsRecordDate?: string | null
  lastInvitationEmailDate?: string | null
  lastAccessRequestEmailDate?: string | null
}

/** Returned by getPatientConnection and connection-email. */
export interface PatientConnectionStatus {
  connectionStatus: ConnectionStatus
  dataAccessStatus?: DataAccessStatus
  dobMismatch?: boolean
  surnameMismatch?: boolean
  gpDataAccessLimited?: boolean
  patientDataAccessLimited?: boolean
  oldestNhsRecordDate?: string | null
  lastInvitationEmailDate?: string | null
  lastAccessRequestEmailDate?: string | null
  nhsNumber?: string
}

/** Returned by connection-link. Extends PatientConnectionStatus with two link fields. */
export interface ConnectPatientByLinkResponse extends PatientConnectionStatus {
  invitationLink?: string | null
  dataAccessRequestLink?: string | null
}

export interface PaginationInfo {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface PaginatedPatientsResponse {
  patients: PatientItem[]
  pagination: PaginationInfo
}

export interface PaginatedUsersResponse {
  users: UserItem[]
  pagination: PaginationInfo
}

export interface AccessTokenResponse {
  accessToken: string
  /** Seconds until the token expires. */
  expiresIn: number
}

// ============================================================================
// Request types
// ============================================================================

export interface CreateOrganisationRequest {
  organisationName: string
  address1?: string
  address2?: string
  address3?: string
  address4?: string
  postcode?: string
  phoneNumber?: string
  cqcRegistrationNumber?: string
  researchOptOut?: boolean
}

export interface UpdateOrganisationRequest {
  organisationName?: string
  address1?: string
  address2?: string
  address3?: string
  address4?: string
  postcode?: string
  phoneNumber?: string
  cqcRegistrationNumber?: string
  researchOptOut?: boolean
  suspended?: boolean
  /** Only honoured when suspending. Defaults to 180 days server-side. */
  autoDeleteDays?: number
}

/** Branding multipart body. Omit `file` to clear the existing logo. */
export interface SetOrganisationBrandingRequest {
  file?: File
  patientNHSActivationWelcomeTitle?: string
  patientNHSActivationWelcomeSubtitle?: string
}

export interface CreateUserRequest {
  firstName: string
  lastName: string
  professionalRegNumber: string
  emailAddress?: string
  isClinician: boolean
  isLocum: boolean
  authorisedSignatory: boolean
}

export interface UpdateUserRequest {
  firstName?: string
  lastName?: string
  professionalRegNumber?: string
  emailAddress?: string
  isClinician?: boolean
  isLocum?: boolean
  authorisedSignatory?: boolean
}

export interface UpdatePatientRequest {
  title?: string
  firstName?: string
  /** Validated against ORB, not overwritten. 409 on mismatch. */
  lastName?: string
  /** YYYY-MM-DD. Validated against ORB, not overwritten. 409 on mismatch. */
  dateOfBirth?: string
  sex?: 'Male' | 'Female' | 'NotApplicable'
  emailAddress?: string
  postcode?: string
}

export interface ConnectPatientRequest {
  title?: string
  firstName: string
  /** Must match the NHS record - checked after NHS Login, not on this call. */
  lastName: string
  /** YYYY-MM-DD. Must match the NHS record. */
  dateOfBirth: string
  sex?: 'Male' | 'Female' | 'NotApplicable'
  emailAddress?: string
  postcode?: string
  requestingClinicianId: string
  /** If true, resend the invite even if one was already sent. */
  resend?: boolean
}

export interface ListPatientsQuery {
  /** Maps to API ?connectionStatus=... (was ?status=...; that name was silently dropped). */
  connectionStatus?: ConnectionStatus
  /** Only valid when connectionStatus = Connected. */
  dataAccessStatus?: DataAccessStatus
  /** Only valid when connectionStatus = DataMismatch. */
  dobMismatch?: boolean
  /** Only valid when connectionStatus = DataMismatch. */
  surnameMismatch?: boolean
  /** Only valid when connectionStatus = Connected. */
  gpDataAccessLimited?: boolean
  /** Only valid when connectionStatus = Connected. */
  patientDataAccessLimited?: boolean
  /** Exact match against the NHS Login record. Digits only; spaces and hyphens are ignored server-side. */
  nhsNumber?: string
  limit?: number
  offset?: number
}

// ============================================================================
// Client factory
// ============================================================================

export interface ApiResult<T> {
  /** True for 2xx responses. */
  ok: boolean
  status: number
  /** Parsed JSON response body, or raw text if not JSON, or null on empty body. */
  data: T | null
}

export interface RequestLog {
  method: string
  path: string
  status: number
  requestHeaders: Record<string, string>
  requestBody?: string
  responseBody?: string
  error?: string
}

export interface OrbApiConfig {
  /** e.g. "https://api.orbforhealth.com/v1". Trailing slash is trimmed. */
  baseUrl: string
  /** Sent as X-API-KEY on every request. */
  apiKey: string
  /**
   * Optional hook called once per request (on response or on network error).
   * Useful for debugging / logging in a test harness.
   */
  onRequest?: (log: RequestLog) => void
}

export type OrbApi = ReturnType<typeof createOrbApi>

export function createOrbApi(config: OrbApiConfig) {
  const base = config.baseUrl.replace(/\/+$/, '')

  async function request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {
      'X-API-KEY': config.apiKey,
      'Content-Type': 'application/json',
    }
    const requestBody = body !== undefined ? JSON.stringify(body) : undefined

    let res: Response
    try {
      res = await fetch(base + path, { method, headers, body: requestBody })
    } catch (e) {
      config.onRequest?.({
        method, path, status: 0,
        requestHeaders: headers, requestBody,
        error: String(e),
      })
      throw e
    }

    const text = await res.text()
    let parsed: unknown = null
    if (text) {
      try { parsed = JSON.parse(text) } catch { parsed = text }
    }

    config.onRequest?.({
      method, path, status: res.status,
      requestHeaders: headers, requestBody,
      responseBody: text,
    })

    return { ok: res.ok, status: res.status, data: parsed as T | null }
  }

  /**
   * Multipart variant. Browser sets the Content-Type (including boundary)
   * automatically when we pass a FormData body, so we must NOT include a
   * Content-Type header here.
   */
  async function requestForm<T = unknown>(
    method: string,
    path: string,
    form: FormData
  ): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {
      'X-API-KEY': config.apiKey,
    }
    // For the log panel, summarise the parts rather than the raw binary.
    const summary: string[] = []
    form.forEach((v, k) => {
      summary.push(v instanceof File ? `${k}=<File ${v.name} ${v.size}B ${v.type}>` : `${k}=${v}`)
    })
    const requestBody = `[multipart] ${summary.join(' ; ')}`

    let res: Response
    try {
      res = await fetch(base + path, { method, headers, body: form })
    } catch (e) {
      config.onRequest?.({
        method, path, status: 0,
        requestHeaders: headers, requestBody,
        error: String(e),
      })
      throw e
    }

    const text = await res.text()
    let parsed: unknown = null
    if (text) {
      try { parsed = JSON.parse(text) } catch { parsed = text }
    }

    config.onRequest?.({
      method, path, status: res.status,
      requestHeaders: headers, requestBody,
      responseBody: text,
    })

    return { ok: res.ok, status: res.status, data: parsed as T | null }
  }

  return {
    // ------------------------------------------------------------------
    // Organisations
    // ------------------------------------------------------------------

    /** GET /organisations - list all organisations the API key can see. */
    listOrganisations: () =>
      request<OrgItem[]>('GET', '/organisations'),

    /** GET /organisations?suspended=true|false - filter by suspension status. */
    listOrganisationsBySuspended: (suspended: boolean) =>
      request<OrgItem[]>('GET', `/organisations?suspended=${suspended}`),

    /**
     * GET /organisations/{id}
     *
     * Note: per spec, only `organisationName`, `suspended`, and
     * `autoDeleteDate` come back. Address / phone / CQC / researchOptOut
     * are write-only.
     */
    getOrganisation: (extOrganisationId: string) =>
      request<OrgItem>('GET', `/organisations/${extOrganisationId}`),

    /** POST /organisations/{id} - create a new organisation. */
    createOrganisation: (
      extOrganisationId: string,
      data: CreateOrganisationRequest
    ) => request<void>('POST', `/organisations/${extOrganisationId}`, data),

    /**
     * PATCH /organisations/{id} - partial update. Only fields present in
     * `data` are modified. Also used to suspend/unsuspend by setting
     * `suspended: true | false`.
     */
    updateOrganisation: (
      extOrganisationId: string,
      data: UpdateOrganisationRequest
    ) => request<void>('PATCH', `/organisations/${extOrganisationId}`, data),

    /**
     * DELETE /organisations/{id}
     *
     * Archives the organisation in ORB rather than hard-deleting rows.
     */
    deleteOrganisation: (extOrganisationId: string) =>
      request<void>('DELETE', `/organisations/${extOrganisationId}`),

    /**
     * POST /organisations/{id}/branding - multipart upload.
     *
     * Send a `file` to set / replace the logo (PNG / JPEG / JPG / SVG, <=1MB);
     * omit `file` (send an empty multipart body) to remove the existing logo.
     * The two welcome-text fields are optional and only updated when included.
     */
    setOrganisationBranding: (
      extOrganisationId: string,
      data: SetOrganisationBrandingRequest
    ) => {
      const form = new FormData()
      if (data.file) form.append('file', data.file, data.file.name)
      if (data.patientNHSActivationWelcomeTitle !== undefined)
        form.append('patientNHSActivationWelcomeTitle', data.patientNHSActivationWelcomeTitle)
      if (data.patientNHSActivationWelcomeSubtitle !== undefined)
        form.append('patientNHSActivationWelcomeSubtitle', data.patientNHSActivationWelcomeSubtitle)
      return requestForm<void>('POST', `/organisations/${extOrganisationId}/branding`, form)
    },

    /**
     * POST /organisations/{orgId}/contract-access-token
     *
     * Mints a short-lived JWT scoped to the organisation (no patient) for
     * embedding the contract-signing widget iframe. Authenticated with the
     * X-API-KEY header like every other call - the JWT is only for the iframe.
     */
    requestContractAccessToken: (extOrganisationId: string) =>
      request<AccessTokenResponse>(
        'POST',
        `/organisations/${extOrganisationId}/contract-access-token`
      ),

    /**
     * GET /organisations/{orgId}/contract-status
     *
     * Reports whether the organisation's contract has been signed, and when.
     * The signing itself happens inside the widget iframe, not via this API.
     */
    getOrganisationContractStatus: (extOrganisationId: string) =>
      request<OrgContractStatus>(
        'GET',
        `/organisations/${extOrganisationId}/contract-status`
      ),

    // ------------------------------------------------------------------
    // Users (clinicians) under an organisation
    // ------------------------------------------------------------------

    /** GET /organisations/{orgId}/users */
    listUsers: (extOrganisationId: string) =>
      request<UserItem[]>('GET', `/organisations/${extOrganisationId}/users`),

    /**
     * GET /organisations/{orgId}/users?limit={n}&offset={n} - paginated.
     * Backend wraps the result in { users, pagination } when limit is set.
     */
    listUsersPaginated: (
      extOrganisationId: string,
      limit: number,
      offset: number
    ) =>
      request<PaginatedUsersResponse>(
        'GET',
        `/organisations/${extOrganisationId}/users?limit=${limit}&offset=${offset}`
      ),

    /** POST /organisations/{orgId}/users/{userId} - create user. */
    createUser: (
      extOrganisationId: string,
      extUserId: string,
      data: CreateUserRequest
    ) =>
      request<void>(
        'POST',
        `/organisations/${extOrganisationId}/users/${extUserId}`,
        data
      ),

    /** PATCH /organisations/{orgId}/users/{userId} - partial update. */
    updateUser: (
      extOrganisationId: string,
      extUserId: string,
      data: UpdateUserRequest
    ) =>
      request<void>(
        'PATCH',
        `/organisations/${extOrganisationId}/users/${extUserId}`,
        data
      ),

    /**
     * DELETE /organisations/{orgId}/users/{userId}
     *
     * Archives the external user / ORB user link rather than hard-deleting it.
     */
    deleteUser: (extOrganisationId: string, extUserId: string) =>
      request<void>(
        'DELETE',
        `/organisations/${extOrganisationId}/users/${extUserId}`
      ),

    // ------------------------------------------------------------------
    // Patients
    // ------------------------------------------------------------------

    /**
     * GET /organisations/{orgId}/patients - list patients.
     *
     * Without `limit`, returns PatientItem[]. With `limit`, returns
     * { patients, pagination }. We expose a union; consumers narrow on
     * Array.isArray.
     */
    listPatients: (
      extOrganisationId: string,
      query?: ListPatientsQuery
    ) => {
      const params = new URLSearchParams()
      if (query?.connectionStatus) params.append('connectionStatus', query.connectionStatus)
      if (query?.dataAccessStatus) params.append('dataAccessStatus', query.dataAccessStatus)
      if (query?.dobMismatch !== undefined) params.append('dobMismatch', String(query.dobMismatch))
      if (query?.surnameMismatch !== undefined) params.append('surnameMismatch', String(query.surnameMismatch))
      if (query?.gpDataAccessLimited !== undefined) params.append('gpDataAccessLimited', String(query.gpDataAccessLimited))
      if (query?.patientDataAccessLimited !== undefined) params.append('patientDataAccessLimited', String(query.patientDataAccessLimited))
      if (query?.nhsNumber) params.append('nhsNumber', query.nhsNumber)
      if (query?.limit !== undefined) params.append('limit', String(query.limit))
      if (query?.offset !== undefined) params.append('offset', String(query.offset))
      const qs = params.toString()
      return request<PatientItem[] | PaginatedPatientsResponse>(
        'GET',
        `/organisations/${extOrganisationId}/patients${qs ? '?' + qs : ''}`
      )
    },

    /**
     * PATCH /organisations/{orgId}/patients/{patientId} - partial patient update.
     * Returns the updated PatientSummary. 409 if supplied dateOfBirth or
     * lastName does not match the existing ORB record.
     */
    updatePatient: (
      extOrganisationId: string,
      extPatientId: string,
      data: UpdatePatientRequest
    ) =>
      request<PatientItem>(
        'PATCH',
        `/organisations/${extOrganisationId}/patients/${extPatientId}`,
        data
      ),

    /**
     * POST /organisations/{orgId}/patients/{patientId}/connection-email
     *
     * Sends the patient an NHS-Login invitation email.
     *
     * There are two mismatch paths to be aware of:
     * - For an existing matched ORB patient, this POST can fail immediately
     *   with 409 if surname / DOB do not match that patient.
     * - For the NHS-login flow itself, mismatch against NHS data is detected
     *   later, after the patient follows the link and completes NHS Login.
     *
     * A repeat call with `resend: true` regenerates and re-sends the link.
     */
    sendConnectionEmail: (
      extOrganisationId: string,
      extPatientId: string,
      data: ConnectPatientRequest
    ) =>
      request<PatientConnectionStatus>(
        'POST',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/connection-email`,
        data
      ),

    /**
     * POST /organisations/{orgId}/patients/{patientId}/connection-link
     *
     * Returns one or both patient-facing links you can present yourself
     * instead of emailing: an NHS registration invitation link and, when
     * relevant, a data-access-request link.
     *
     * As with `connection-email`, this POST can also fail immediately with
     * 409 for existing-patient surname / DOB mismatches.
     */
    createConnectionLink: (
      extOrganisationId: string,
      extPatientId: string,
      data: ConnectPatientRequest
    ) =>
      request<ConnectPatientByLinkResponse>(
        'POST',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/connection-link`,
        data
      ),

    /** GET /organisations/{orgId}/patients/{patientId}/connection */
    getPatientConnection: (extOrganisationId: string, extPatientId: string) =>
      request<PatientConnectionStatus>(
        'GET',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/connection`
      ),

    /** DELETE /organisations/{orgId}/patients/{patientId}/connection */
    deletePatientConnection: (extOrganisationId: string, extPatientId: string) =>
      request<void>(
        'DELETE',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/connection`
      ),

    /** GET /organisations/{orgId}/patients/{patientId}/permissions */
    getPatientPermissions: (extOrganisationId: string, extPatientId: string) =>
      request<PatientPermission[]>(
        'GET',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/permissions`
      ),

    // ------------------------------------------------------------------
    // Access token (for embedding the NHS records widget as an iframe)
    // ------------------------------------------------------------------

    /**
     * POST /organisations/{orgId}/patients/{patientId}/access-token
     *
     * Exchanges your API key for a short-lived JWT bound to a specific
     * (org, user, patient) triple. Pass the returned JWT to the widget
     * iframe (see widgetIntegration.ts).
     */
    requestAccessToken: (
      extOrganisationId: string,
      extPatientId: string,
      extUserId: string
    ) =>
      request<AccessTokenResponse>(
        'POST',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/access-token`,
        { extUserId }
      ),

    // ------------------------------------------------------------------
    // Escape hatch: raw call for experimentation / unlisted endpoints.
    // ------------------------------------------------------------------

    raw: <T = unknown>(method: string, path: string, body?: unknown) =>
      request<T>(method, path, body),
  }
}
