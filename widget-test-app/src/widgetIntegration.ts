/**
 * Widget (iframe) integration helper.
 *
 * This file documents how to embed the ORB NHS records widget as an
 * iframe in your own application. It wraps the global `OrbWidget` class
 * that's loaded from orb-widget.js.
 *
 * Lifecycle
 * ---------
 * 1. Request a short-lived JWT from the API for a given (org, user,
 *    patient) triple - see orbApi.requestAccessToken().
 * 2. Open the widget with the JWT and the patient's EHR details.
 * 3. When the widget needs a fresh JWT it dispatches a `window` event;
 *    you fetch a new token and hand it back via `refreshToken()`.
 *    `attachTokenRefreshListener()` below does this.
 *
 * Minimal example:
 *
 *   const orb = createOrbApi({ baseUrl, apiKey })
 *
 *   // 1. Get a token
 *   const { data } = await orb.requestAccessToken(orgId, patientId, userId)
 *   if (!data) return
 *
 *   // 2. Open the widget
 *   const widget = openOrbWidget({
 *     token:        data.accessToken,
 *     widgetBaseUrl: 'https://api.orbforhealth.com/medical-record-embedded',
 *     apiOrigin:    'https://api.orbforhealth.com',
 *     patient:      { ehr_patient_id: patientId, first_name: 'Jane', last_name: 'Doe' },
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

export interface OpenOrbWidgetOptions {
  /** The JWT returned from POST .../access-token. */
  token: string
  /**
   * Base URL of the embeddable widget page, e.g.
   * "https://api.orbforhealth.com/medical-record-embedded".
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
  /** Patient to display. */
  patient: OrbWidgetPatient
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
    position: opts.position ?? 'bottom-right',
    draggable: opts.draggable ?? true,
  })
  widget.open(opts.patient)
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
