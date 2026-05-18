# ORB NHS Records Widget

The ORB Widget is an embeddable floating window that allows EHR systems to display NHS patient records inline within their existing interface. It communicates with the ORB platform via JWT authentication and postMessage.

---

## Overview

Integration has two parts:

1. **User provisioning** — creating the EHR's users and patients via the ORB API (covered separately)
2. **Widget installation** — embedding the widget script and wiring up a button to open it (covered here)

---

## Quick Start

### 1. Add the Widget Script

Include the ORB widget script in your page. Replace `YOUR_ORB_INSTANCE` with the URL provided to you.

```html
<script src="https://YOUR_ORB_INSTANCE/orb-widget.js"></script>
```

### 2. Request an Access Token

Before opening the widget, your backend must obtain a short-lived access token scoped to the selected organisation, user, and patient. This is a server-side call to the ORB API — **never expose your API credentials on the client**.

```javascript
// Example: call your own backend endpoint which proxies the ORB token request
async function getOrbAccessToken(orgId, userId, patientId) {
  const response = await fetch('/api/orb/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, userId, patientId })
  });

  if (!response.ok) throw new Error('Token request failed');
  return response.json(); // { accessToken, expiresIn }
}
```

### 3. Open the Widget

```html
<button onclick="openNhsRecords()">View NHS Records</button>

<script>
  // Keep a reference to the widget instance so it can be reused
  var orbWidget = null;

  async function openNhsRecords() {
    // These values come from your EHR's current context
    var orgId     = 'your-org-id';
    var userId    = 'your-user-id';
    var patientId = 'your-patient-id';

    var patient = {
      ehr_patient_id: patientId,
      first_name: 'Jane',
      last_name: 'Smith',
      dob: '1980-06-15'
    };

    // Obtain a fresh token from your backend
    var tokenData = await getOrbAccessToken(orgId, userId, patientId);

    var widgetBaseUrl = 'https://YOUR_ORB_INSTANCE/app/orb/embedlogin';
    var apiOrigin     = 'https://YOUR_ORB_INSTANCE';

    if (!orbWidget) {
      // First open — create the instance
      orbWidget = new OrbWidget({
        token:      tokenData.accessToken,
        baseUrl:    widgetBaseUrl,
        apiOrigin:  apiOrigin,
        position:   'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
        draggable:  true
      });
      orbWidget.open(patient);
    } else {
      // Subsequent opens — update the token and patient
      orbWidget.setToken(tokenData.accessToken);
      orbWidget.open(patient);
    }
  }
</script>
```

---

## Token Refresh

JWT tokens are short-lived. The widget will fire a `orb-widget-token-refresh` event on `window` when it needs a new one. Listen for this event and supply a fresh token:

```javascript
window.addEventListener('orb-widget-token-refresh', async function (event) {
  var patient = event.detail.patient;

  var tokenData = await getOrbAccessToken(
    'your-org-id',
    'your-user-id',
    patient.ehr_patient_id
  );

  if (orbWidget) {
    orbWidget.refreshToken(tokenData.accessToken);
  }
});
```

---

## API Reference

### `new OrbWidget(options)`

Creates a new widget instance. Does not open the window — call `.open()` to display it.

| Option | Type | Default | Description |
|---|---|---|---|
| `token` | `string` | — | JWT access token *(required)* |
| `baseUrl` | `string` | — | Base URL of the ORB embed login page *(required)* |
| `position` | `string` | `'bottom-right'` | Initial position: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `draggable` | `boolean` | `true` | Whether the window can be dragged |

---

### Methods

#### `.open(patient?)`

Opens the widget window. Pass a patient object to set or update the current patient.

```javascript
orbWidget.open({
  ehr_patient_id: 'P12345',
  first_name: 'Jane',
  last_name: 'Smith',
  dob: '1980-06-15'
});
```

#### `.close()`

Closes and removes the widget window from the DOM.

```javascript
orbWidget.close();
```

#### `.setToken(token)`

Updates the stored token without sending it to the iframe immediately. Use `refreshToken` if the widget is already open.

```javascript
orbWidget.setToken('new-jwt-token');
```

#### `.refreshToken(token)`

Updates the token and immediately forwards it to the open iframe.

```javascript
orbWidget.refreshToken('new-jwt-token');
```

#### `.setPatient(patient)`

Updates the current patient and notifies the iframe.

```javascript
orbWidget.setPatient({
  ehr_patient_id: 'P99999',
  first_name: 'John',
  last_name: 'Doe',
  dob: '1975-03-22'
});
```

#### `.destroy()`

Closes the widget and removes all event listeners. Call this if the host page is being torn down.

```javascript
orbWidget.destroy();
```

---

## Patient Object

| Field | Type | Description |
|---|---|---|
| `ehr_patient_id` | `string` | Patient identifier in your EHR system |
| `first_name` | `string` | Patient first name (displayed in widget header) |
| `last_name` | `string` | Patient last name (displayed in widget header) |
| `dob` | `string` | Date of birth (ISO 8601: `YYYY-MM-DD`) |

---

## Security Notes

- Tokens must be requested **server-side**. Do not call the ORB token API directly from the browser.
- The widget validates `postMessage` origin against `baseUrl`. Ensure `baseUrl` matches exactly.
- Tokens are scoped per organisation, user, and patient — request a new token when switching patients.
