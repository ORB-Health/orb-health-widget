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

// ============================================================================
// Entity types (returned by the API)
// ============================================================================

export interface OrgItem {
  extOrganisationId: string
  organisationName: string
  suspended: boolean
  autoDeleteDate?: string | null
  address1?: string
  address2?: string
  address3?: string
  address4?: string
  postcode?: string
  phoneNumber?: string
  cqcRegistrationNumber?: string
  researchOptOut?: boolean
  authorisedSignatoryName?: string
  authorisedSignatoryEmail?: string
}

export interface UserItem {
  extUserId: string
  firstName: string
  lastName: string
  professionalRegNumber?: string
  emailAddress?: string
  isLocum?: boolean
  authorisedSignatory?: boolean
}

export interface PatientItem {
  extPatientId: string
  title?: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  dob?: string
  sex?: string
  emailAddress?: string
  postcode?: string
  connectionStatus?: string
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
  authorisedSignatoryName?: string
  authorisedSignatoryEmail?: string
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
  authorisedSignatoryName?: string
  authorisedSignatoryEmail?: string
  suspended?: boolean
  /** Only honoured when suspending. Defaults to 180 days server-side. */
  autoDeleteDays?: number
}

export interface CreateUserRequest {
  firstName: string
  lastName: string
  professionalRegNumber?: string
  emailAddress?: string
  isLocum?: boolean
  authorisedSignatory?: boolean
}

export interface UpdateUserRequest {
  firstName?: string
  lastName?: string
  professionalRegNumber?: string
  emailAddress?: string
  isLocum?: boolean
  authorisedSignatory?: boolean
}

export interface UpdatePatientRequest {
  title?: string
  firstName?: string
  lastName?: string
  /** YYYY-MM-DD. Must match the NHS record. */
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
}

export interface SendConnectionEmailRequest extends ConnectPatientRequest {
  /** If true, resend the invite email even if one was already sent. */
  resend?: boolean
}

export type ConnectionStatusFilter =
  | 'InviteNotSent'
  | 'InviteSent'
  | 'InviteExpired'
  | 'DataMismatch'
  | 'Connected'

export type DataAccessStatusFilter =
  | 'RequestNotSent'
  | 'RequestSent'
  | 'Reviewed'

export interface ListPatientsQuery {
  /** Maps to API ?connectionStatus=... (was ?status=...; that name was silently dropped). */
  connectionStatus?: ConnectionStatusFilter
  /** Only valid when connectionStatus = Connected. */
  dataAccessStatus?: DataAccessStatusFilter
  /** Only valid when connectionStatus = DataMismatch. */
  dobMismatch?: boolean
  /** Only valid when connectionStatus = DataMismatch. */
  surnameMismatch?: boolean
  /** Only valid when connectionStatus = Connected. */
  gpDataAccessLimited?: boolean
  /** Only valid when connectionStatus = Connected. */
  patientDataAccessLimited?: boolean
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

    // ------------------------------------------------------------------
    // Users (clinicians) under an organisation
    // ------------------------------------------------------------------

    /** GET /organisations/{orgId}/users */
    listUsers: (extOrganisationId: string) =>
      request<UserItem[]>('GET', `/organisations/${extOrganisationId}/users`),

    /** GET /organisations/{orgId}/users?limit={n}&offset={n} - paginated. */
    listUsersPaginated: (
      extOrganisationId: string,
      limit: number,
      offset: number
    ) =>
      request<UserItem[]>(
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
     * Optional `status`, `limit`, `offset` query params.
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
      if (query?.limit !== undefined) params.append('limit', String(query.limit))
      if (query?.offset !== undefined) params.append('offset', String(query.offset))
      const qs = params.toString()
      return request<PatientItem[]>(
        'GET',
        `/organisations/${extOrganisationId}/patients${qs ? '?' + qs : ''}`
      )
    },

    /** PATCH /organisations/{orgId}/patients/{patientId} - partial patient update. */
    updatePatient: (
      extOrganisationId: string,
      extPatientId: string,
      data: UpdatePatientRequest
    ) =>
      request<unknown>(
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
      data: SendConnectionEmailRequest
    ) =>
      request<void>(
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
      request<unknown>(
        'POST',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/connection-link`,
        data
      ),

    /** GET /organisations/{orgId}/patients/{patientId}/connection */
    getPatientConnection: (extOrganisationId: string, extPatientId: string) =>
      request<unknown>(
        'GET',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/connection`
      ),

    /**
     * DELETE /organisations/{orgId}/patients/{patientId}/connection
     * (Not used in V1 per spec - present for completeness.)
     */
    deletePatientConnection: (extOrganisationId: string, extPatientId: string) =>
      request<void>(
        'DELETE',
        `/organisations/${extOrganisationId}/patients/${extPatientId}/connection`
      ),

    /** GET /organisations/{orgId}/patients/{patientId}/permissions */
    getPatientPermissions: (extOrganisationId: string, extPatientId: string) =>
      request<unknown>(
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
