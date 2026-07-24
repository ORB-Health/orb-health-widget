/**
 * Typed wrapper around `window.OrbWidget` from `public/orb-widget.js`.
 *
 * ORB provides two iframe-based screens:
 *
 * 1. NHS patient records
 * 2. Organisation contract signing
 *
 * Both screens use this helper and the same `orb-widget.js` script.
 *
 * To initialise a screen, provide:
 * - the relevant screen URL as `widgetBaseUrl`;
 * - the ORB API origin as `apiOrigin` (appended as `?apiBase=...` on the iframe URL); and
 * - a short-lived access token generated for that screen.
 *
 * The access token must be created securely on your backend using the API key.
 * Do not call the token endpoints directly from the browser in production.
 *
 *   NHS records (IM1)
 *     URL:   {origin}/medical-record-embedded
 *     Token: orb.requestAccessToken(org, patient, user)  // POST .../access-token
 *     Open:  openOrbWidget({ token, widgetBaseUrl, apiOrigin, patient })
 *     See:   App.tsx viewNhsRecords
 *
 *   Organisation contract
 *     URL:   {origin}/medical-record-embedded/organisation-contract/sign
 *     Token: orb.requestContractAccessToken(org)         // POST .../contract-access-token
 *     Open:  openOrbWidget({ token, widgetBaseUrl, apiOrigin, patient: null, signatory?, title? })
 *     See:   App.tsx openContractWidget
 *
 * Full embed notes: guides/orb-api/widget-integration.md
 *
 * Lifecycle (NHS records)
 * ---------
 * 1. Request a short-lived JWT via requestAccessToken(org, patient, user).
 * 2. Open with that JWT and the patient's EHR details.
 * 3. On token refresh, the iframe raises a window event; mint again and call
 *    refreshToken(). attachTokenRefreshListener() wires that up.
 *
 * Minimal example (NHS records):
 *
 *   const orb = createOrbApi({ baseUrl, apiKey })
 *
 *   const { data } = await orb.requestAccessToken(orgId, patientId, userId)
 *   if (!data) return
 *
 *   const widget = openOrbWidget({
 *     token:         data.accessToken,
 *     widgetBaseUrl: 'https://api.orbforhealth.com/medical-record-embedded',
 *     apiOrigin:     'https://api.orbforhealth.com',
 *     patient:       { ehr_patient_id: patientId, first_name: 'Jane', last_name: 'Doe' },
 *   })
 *
 *   // 3. Keep the token fresh
 *   const detach = attachTokenRefreshListener(async () => {
 *     const r = await orb.requestAccessToken(orgId, patientId, userId)
 *     if (r.data) widget.refreshToken(r.data.accessToken)
 *   })
 *
 *   // Later: widget.close(); detach()
 */

export interface OrbWidgetPatient {
  ehr_patient_id: string
  nhs_number?: string
  first_name: string
  last_name: string
  dob?: string
  sex?: string
}

export interface OrbWidgetSignatory {
  first_name?: string
  last_name?: string
  email?: string
}

export interface OpenOrbWidgetOptions {
  /** The JWT from POST .../access-token (NHS records) or .../contract-access-token (contract). */
  token: string
  /**
   * Base URL of the ORB page to embed. Selects the screen:
   * - NHS records: ".../medical-record-embedded"
   * - Contract:    ".../medical-record-embedded/organisation-contract/sign"
   */
  widgetBaseUrl: string
  /**
   * Origin of the ORB API server (e.g. "https://api.orbforhealth.com"). The
   * iframe sends all widget API calls (IM1, widget/v1, episode medical-record
   * consultation history) to this origin, so it must match wherever the ORB
   * API is hosted - not the host page or the widget iframe origin. Usually
   * derived from your API base URL.
   */
  apiOrigin: string
  /**
   * Patient to display. Optional: the organisation contract-signing widget is
   * org-scoped and opens with no patient.
   */
  patient?: OrbWidgetPatient | null
  /**
   * Contract-signing widget only: the person expected to sign. Sent to the
   * iframe via SET_SIGNATORY right after SET_TOKEN; the widget renders the
   * name/email into the displayed contract text and pre-fills the signature
   * form. Display-only - the user can still edit the fields before signing.
   */
  signatory?: OrbWidgetSignatory | null
  /** Header title shown on the floating window (default "NHS Records"). */
  title?: string
  /** Iframe corner (default "bottom-right"). */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** Allow user to drag the widget by its header. */
  draggable?: boolean
}

/**
 * Opens the widget iframe and returns the underlying `OrbWidget` instance
 * so callers can drive it (setPatient, refreshToken, close, destroy).
 */
export function openOrbWidget(opts: OpenOrbWidgetOptions): OrbWidget {
  const sep = opts.widgetBaseUrl.includes('?') ? '&' : '?'
  const iframeUrl = `${opts.widgetBaseUrl}${sep}apiBase=${encodeURIComponent(opts.apiOrigin)}`

  const widget = new OrbWidget({
    token: opts.token,
    baseUrl: iframeUrl,
    title: opts.title,
    position: opts.position ?? 'bottom-right',
    draggable: opts.draggable ?? true,
    signatory: opts.signatory ?? null,
  })
  widget.open(opts.patient ?? undefined)
  return widget
}

/**
 * The widget dispatches this event on `window` when it wants the host app
 * to refresh its JWT. Listen for it, fetch a fresh token, and pass it back
 * to the widget via `refreshToken()`.
 */
export const WIDGET_TOKEN_REFRESH_EVENT = 'orb-widget-token-refresh'

/**
 * Wires up the token-refresh handshake. Returns a detach function to
 * remove the listener on cleanup (e.g. React useEffect return value).
 */
export function attachTokenRefreshListener(
  onRefresh: () => void | Promise<void>
): () => void {
  const handler = () => { void onRefresh() }
  window.addEventListener(WIDGET_TOKEN_REFRESH_EVENT, handler)
  return () => window.removeEventListener(WIDGET_TOKEN_REFRESH_EVENT, handler)
}

/**
 * The contract-signing widget dispatches this event on `window` once the
 * organisation contract has been signed inside the iframe. The detail carries
 * the URL of the stored signed-contract document.
 */
export const WIDGET_CONTRACT_SIGNED_EVENT = 'orb-widget-contract-signed'

/**
 * Wires up the contract-signed notification. `onSigned` receives the signed
 * contract URL (when the iframe supplied one). Returns a detach function to
 * remove the listener on cleanup (e.g. React useEffect return value).
 */
export function attachContractSignedListener(
  onSigned: (signedContractUrl: string | undefined) => void
): () => void {
  const handler = (e: Event) => { onSigned((e as CustomEvent).detail?.signedContractUrl) }
  window.addEventListener(WIDGET_CONTRACT_SIGNED_EVENT, handler)
  return () => window.removeEventListener(WIDGET_CONTRACT_SIGNED_EVENT, handler)
}

/**
 * Decodes the `payload` segment of a JWT without verifying the signature.
 * Handy for reading claims like `exp` / `extPatientId` client-side. Do NOT
 * use this to make auth decisions - the server verifies for real.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}
