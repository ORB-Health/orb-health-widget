# ORB NHS Records Widget - Integration Guide for External Developers


## 1. Overview

The ORB widget renders a patient's NHS GP records (problems, consultations, medications, allergies, immunisations, investigations, documents) inside a floating window hosted by your web application.

### Architecture overview

The integration splits **server-side authorisation** from **client-side presentation**:

1. **EHR back-end (server)** — When a clinician opens NHS records for a patient, your server calls the ORB External API (`POST .../access-token`) with your API key and the `(organisation, clinician, patient)` identifiers. ORB validates the relationship and returns a **short-lived JWT** (default **15 minutes**).

2. **EHR front-end (browser)** — The patient chart page loads **`orb-widget.js`**, which embeds a floating **iframe** pointing at ORB-hosted widget UI.

3. **Widget iframe** — The host page passes the JWT to the iframe (via `postMessage`; see section 4). The widget uses that token to call ORB **directly** for NHS record data and renders it inside the iframe. The host application does not proxy clinical content.

**Security boundary:** Only the JWT reaches the browser; the **API key never does**. The token is scoped to one organisation, one clinician, and one patient. When it nears expiry, the widget requests a replacement from your back-end (section 5).

**Components in scope:**

| File / endpoint | Purpose |
| --- | --- |
| `orb-widget.js` | Embed script (exposes the `window.OrbWidget` class) |
| `POST .../access-token` | Server-to-server token mint |

---

## 2. Test harness

The test harness is a small React application that exposes every ORB API endpoint as a clickable form and provides a one-click widget launcher. It is the recommended starting point for verifying an API key and observing the widget end to end.

### 2.1 Prerequisites

- Node.js 18 or newer
- An ORB API key (issued by ORB)

### 2.2 Installation

From the harness folder (`tools/widget-test-app` in the ORB repository):

```bash
npm install
npm run dev
```

The harness is then served at <http://localhost:5173> under the title **ORB API Test Harness**.

### 2.3 Configuration

Two fields:

**ORB Server URL**
The root URL of the ORB instance. Defaults to `https://apitest-api.orbforhealth.com`. The harness appends `/v1` for API requests and `/medical-record-embedded` for the widget URL.

**API Key**
The `X-API-KEY` value issued by ORB.

Both values are persisted in `localStorage`.

A hosted copy of the harness is available at <https://apitest-orb-api-harness.orbforhealth.com> for use without a local install.

### 2.4 Opening the widget

1. Once the API Key is set, the harness auto-loads organisations and the **Context** section becomes available.
2. In the Context section, select:
   - Organisation
   - User (Clinician)
   - Patient
   - Only patients with connection status `Connected` can be opened in the widget. Otherwise the patient must follow the NHS connection link and complete the linking process first.
3. Switch to the **Widget** tab.
4. Click **View NHS Records**.

The widget opens in the bottom-right of the page. The right-hand panel records every API call and response for inspection.

### 2.5 Harness internals

When **View NHS Records** is clicked, the harness:

1. POSTs to `/v1/organisations/{orgId}/patients/{patientId}/access-token` with body `{ "extUserId": "<userId>" }` and header `X-API-KEY`.
2. Receives `{ accessToken, expiresIn }`.
3. Calls `openOrbWidget({ token, widgetBaseUrl, apiOrigin, patient })`, which:
   - Builds the iframe URL: `{widgetBaseUrl}?apiBase={apiOrigin}&parentOrigin={your origin}`
   - Creates the floating window and iframe.
   - Sends `postMessage({ type: 'SET_TOKEN', token })` once the iframe loads.
   - Sends `postMessage({ type: 'SET_PATIENT', patient })` to set the patient context.

Canonical source files:

| File | Contents |
| --- | --- |
| `src/orbApi.ts` | Every ORB API endpoint, typed |
| `src/widgetIntegration.ts` | Widget open and token-refresh wiring |
| `src/App.tsx` | End-to-end integration (see `viewNhsRecords`) |

---

## 3. Runtime behaviour

When open, the widget:

- Displays the patient name in the title bar (or **NHS Records** when no patient is set).
- Provides a close button in the top right.
- Is draggable by its header.
- Exposes bottom navigation: Problems, Consultations, Medications, Allergies, Immunisations, Investigations, Documents.
- Calls the ORB API directly using the supplied JWT. The host page does not observe this traffic.

Host-page runtime methods on the returned widget instance (see section 4 for examples):

| Method | Purpose |
| --- | --- |
| `widget.open(patient)` | Opens the window or switches to a new patient |
| `widget.setPatient(patient)` | Changes the patient while the widget is open |
| `widget.refreshToken(token)` | Provides a new JWT to the running iframe |
| `widget.setToken(token)` | Stores a new JWT for the next open (does not propagate to an already-open iframe; use `refreshToken` for that) |
| `widget.close()` | Closes the window (the message listener remains attached) |
| `widget.destroy()` | Closes the window and removes the message listener |

**Clinician terms-and-conditions gate:** the first time a clinician opens the widget, the iframe routes to a Terms and Conditions screen. Once accepted, subsequent opens go straight to the records.

---

## 4. Embedding the widget

Two components are required: a server-side token mint and a client-side embed.

### 4.1 Server side: requesting a token

For the patient under view, the back-end calls:

```http
POST {ORB_API}/v1/organisations/{extOrganisationId}/patients/{extPatientId}/access-token
X-API-KEY: <your-api-key>
Content-Type: application/json

{ "extUserId": "<the clinician's external user id>" }
```

Response (200):

```json
{
  "accessToken": "<JWT>",
  "expiresIn": 900
}
```

- `expiresIn` is in seconds; the default is 15 minutes.
- **`/access-token` must never be called from the browser.** The API key must remain server-side. The harness calls it client-side only because it is a development tool.
- Common error responses:
  - `403` if the organisation is suspended, the patient is not Connected, the patient or organisation has data access limited, or the API key is expired or disabled.
  - `404` if any of organisation, user or patient is unknown.
- For the full list of endpoints, request and response bodies, status codes and error shapes, see the ORB API spec supplied alongside this guide (`Orb API V1.0.1.md` / `ORB API V1.0.1 - Swagger.html`).

### 4.2 Client side: loading orb-widget.js

Include `orb-widget.js` on any page that may host the widget (typically the patient details page). The script is served alongside the widget itself; either copy it into your own static assets or load it from ORB.

```html
<script src="/orb-widget.js"></script>
```

The script defines `window.OrbWidget`.

There are no peer dependencies. The file is a self-contained IIFE (~16 KB unminified) with no React or jQuery requirement.

### 4.3 Client side: opening the widget

Minimal plain-JS example:

```js
// 1) Obtain a token from the host back-end (which in turn calls ORB).
const { accessToken } = await fetch('/your-backend/orb-token', {
    method: 'POST',
    body: JSON.stringify({ patientId, userId }),
}).then(r => r.json());

// 2) Build the iframe URL, specifying the ORB API origin.
const widgetBaseUrl = 'https://apitest-api.orbforhealth.com/medical-record-embedded';
const apiOrigin     = 'https://apitest-api.orbforhealth.com';
const iframeUrl     = `${widgetBaseUrl}?apiBase=${encodeURIComponent(apiOrigin)}`;

// 3) Construct the widget.
const widget = new OrbWidget({
    token:     accessToken,
    baseUrl:   iframeUrl,
    position:  'bottom-right',  // top-left, top-right, bottom-left, bottom-right
    draggable: true,
});

// 4) Open it for a patient.
widget.open({
    ehr_patient_id: patientId,    // host EHR patient id (matches extPatientId)
    first_name:     'Jane',
    last_name:      'Doe',
    dob:            '1980-04-12', // optional, used for display
});
```

This completes the client integration.

On React/TypeScript projects, `src/widgetIntegration.ts` and the `requestAccessToken` function in `src/orbApi.ts` provide a typed wrapper around the same calls and can serve as a starting point.

### 4.4 Client side: switching patient

```js
widget.setPatient({
    ehr_patient_id: newPatientId,
    first_name: 'John', last_name: 'Smith', dob: '1975-08-01',
});
```

The access token is bound to a single patient via its `extPatientId` JWT claim, so the existing token will not authorise calls for the new patient. Two orderings are valid:

- **Proactive:** mint a new token for the new patient and call `widget.refreshToken(newToken)` before (or just after) `setPatient`. No failed calls occur.
- **Reactive:** call `setPatient` only. The first widget API call for the new patient returns 401; the iframe then requests a refresh, which surfaces on the host as `orb-widget-token-refresh` with `event.detail.patient` set to the new patient. Provided the host handler mints a token based on `event.detail.patient` (see section 5.2), the call is retried automatically.

### 4.5 Client side: closing

```js
widget.close();    // hide and tear down the iframe; can be re-opened
widget.destroy();  // close and remove the postMessage listener
```

---

## 5. Token refresh

Tokens expire (default 15 minutes). The widget does not log the user out; instead it requests a replacement token from the host page.

### 5.1 Inside the iframe

- A refresh is scheduled 60 seconds before the JWT's `exp` claim.
- On any 401 from the ORB API, a refresh is requested and the in-flight call waits up to 10 seconds for a new token before failing.
- Refresh requests are debounced to one per second.

When a refresh is required, the iframe posts:

```js
{ type: 'REFRESH_TOKEN' }
```

to its parent window. `orb-widget.js` receives this message and re-emits it as a custom DOM event on the host window:

- Event name: `orb-widget-token-refresh`
- `event.detail`: `{ patient: <last patient supplied> }`

### 5.2 Host-side handler

Listen for the event, mint a token for the patient carried in `event.detail`, and pass it to the widget:

```js
window.addEventListener('orb-widget-token-refresh', async (event) => {
    const patient = event.detail.patient;

    const { accessToken } = await fetch('/your-backend/orb-token', {
        method: 'POST',
        body: JSON.stringify({ patientId: patient.ehr_patient_id, userId }),
    }).then(r => r.json());

    widget.refreshToken(accessToken);
});
```

Reading the patient from `event.detail` (rather than a closed-over `patientId` variable) ensures the handler also covers patient switches initiated via `setPatient`. The iframe retries the failed request automatically once `SET_TOKEN` is received.

### 5.3 Constraints

- Refreshed tokens must target the patient currently shown in the widget (carried in `event.detail.patient`). The ORB API rejects widget calls whose route patient ID does not match the JWT's `extPatientId` claim.
- Tokens must not be cached across users or patients on the back-end.
- The `/orb-token` endpoint should respond in under one second (the widget waits a maximum of ten).
- If the back-end fails to mint a replacement token (for example, the patient has just been suspended), no action is required; the widget surfaces the resulting 401 rather than retrying indefinitely.

---

## 6. Troubleshooting

### 401 from widget API calls

- The token has expired or was minted for a different patient. Issue a new one.

### 401 from /access-token

- The `X-API-KEY` header is missing.

### 403 from /access-token

- Patient is not Connected (status `InviteNotSent` / `InviteSent` / `InviteExpired` / `DataMismatch`). Issue an invite first, either from the test harness **Patients** tab or via the `connection-email` / `connection-link` endpoints (see the ORB API spec referenced in section 4.1).
- Patient has data access limited (`gpDataAccessLimited` or `patientDataAccessLimited`).
- Organisation is suspended.
- API key is expired or disabled.

### 404 from /access-token

- The API key is not recognised by ORB.
- `extOrganisationId`, `extUserId` or `extPatientId` is unknown to ORB. Ensure the records exist (POST users / patients first).

---

## 7. API reference

### OrbWidget constructor options

```ts
{
  token:     string         // JWT from /access-token (required)
  baseUrl:   string         // <widgetBaseUrl>?apiBase=<apiOrigin> (required)
  position?: string         // 'bottom-right' (default), top-left, etc.
  draggable?: boolean       // default true
  target?:   HTMLElement    // default document.body
}
```

### OrbWidget methods

| Method | Purpose |
| --- | --- |
| `open(patient?)` | Show the widget; updates patient if already open |
| `close()` | Hide and tear down the DOM |
| `setPatient(patient)` | Change patient (open or closed) |
| `refreshToken(newToken)` | Provide a new JWT to the running iframe |
| `setToken(newToken)` | Store a new JWT for the next open (no live push) |
| `destroy()` | Close and remove the window message listener |

### Patient object

```ts
{
  ehr_patient_id: string    // must equal extPatientId in the JWT
  first_name:     string
  last_name:      string
  dob?:           string    // YYYY-MM-DD (optional, used for display)
  nhs_number?:    string    // optional
  sex?:           string    // optional
}
```

### postMessage protocol (reference; abstracted by `orb-widget.js`)

**Host -> iframe:**

```js
{ type: 'SET_TOKEN',   token: '<JWT>' }
{ type: 'SET_PATIENT', patient: { ehr_patient_id, first_name, ... } }
```

**Iframe -> host:**

```js
{ type: 'READY' }                              // iframe app has bootstrapped
{ type: 'REFRESH_TOKEN' }                      // host should mint a new JWT
{ type: 'CLOSE' }                              // user closed the widget from inside
{ type: 'NAVIGATE', data: { url: '<path>' } }  // internal navigation
```

### DOM event raised by `orb-widget.js`

```
'orb-widget-token-refresh'
    event.detail.patient = the last patient supplied
```

---

## 8. Source files

Canonical files in the harness (`tools/widget-test-app`):

| File | Description |
| --- | --- |
| `public/orb-widget.js` | The embed script (~430 lines) |
| `src/widgetIntegration.ts` | Typed wrapper around `OrbWidget` with the `attachTokenRefreshListener` function; a JSDoc minimal example sits at the top of the file |
| `src/orbApi.ts` | Every ORB API endpoint, typed; see `requestAccessToken()` |
| `src/App.tsx` | End-to-end integration (token request, widget open, logging); see `viewNhsRecords` |

---