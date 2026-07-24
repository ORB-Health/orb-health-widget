# ORB API v1.0.2

**ORB External API – Integration guide for EHR systems**

Document version: 1.0.2 | Last updated: 23 July 2026 — Organisation contract; organisation branding; `isClinician`; patient link validity. See the ORB External API v1.0.2 Mini Release Notes for changes from v1.0.1.

---

## Overview

ORB has been designed to support integration with other clinical systems, usually EHR systems.

In the typical case, clinicians in patient-facing organisations such as Clinics or Sporting Clubs will be using an EHR system to hold patient records, and they would like access to NHS records on those patients.  Integrating ORB allows this to happen within the EHR.

This document defines the **ORB External API** for EHR integrations.  The API has two main parts:

- Data Model Linkage - the API connects Organisations, Users and Patients from the EHR into ORB
- Data Access - the API allows the EHR system to show specific Patient data when requested by a specific User

### Data Model

The API and ORB work with the following data model:

- Organisations - companies using the EHR which own/run clinics
- Users - People in the EHR linked to ORB via the integration (clinical and non-clinical)
- Patients - Individuals treated by the Clinicians

Note that an Organisation is usually not a clinic - it's the company that owns or runs clinics.

To integrate with ORB, EHR developers must use the API to create ORB data records corresponding to each Organisation, User and Patient - as this is necessary for ORB to work.  The Organisation and User records are lightweight - they contain only the data sent by the EHR, and they aren't made available in the ORB UI.  ORB will not update data held on these records, so there is no need to sync back from Orb, but we do have a ListUsers API to retrieve current users.

Patient records are used to invite the patient to register and share NHS data with the Organisations, and this data is accessible to the patient in the UI.

This API is **organisation‑scoped**: all patient and user operations occur in the context of an Organisation.

This API uses external EHR IDs for Organisations, Users and Patients - internally there is a corresponding ORB ID but these are not published.  This is to avoid the need for EHRs to store an additional ID.

The API assumes that EHR IDs always refer to the same data item, but otherwise tries not to makes assumptions.  In particular, User records are assumed to be independent per Organisation - if a single user works at two organisations, this user has two records in ORB which are not linked.

### Data Access

The second part of the API concerns access to Patient Data.  The ORB API includes a JS Widget that the EHR developer should add to their Patient details page.

When a user wishes to open the widget to view patient data, the EHR must make a server-side request to obtain a short-lived access token linked to that user and that patient.  This is then passed to the widget.

### Table of contents

- [Authentication](#authentication) — API key, base URL, API keys
- [Conventions](#conventions) — JSON, dates, external IDs
- [Common Errors](#common-errors) — HTTP status codes, `errorCode` values
- [Organisations](#organisations) — Create, Update (including suspend/unsuspend), Delete, Get, List, contract status, contract access token, branding
- [Users](#users) — Create, Update, List, Delete (`isClinician`, `isLocum`, `authorisedSignatory`)
- [Patients](#patients) — List, Update, Connect by Email, Connect by Link, Get connection status, Get granted permissions, Remove connection
- [Patient Access](#patient-access) — Request access token ([widget embed guide](../widget-integration.md))
- [Terms and Conditions](#terms-and-conditions) — Clinician widget T&C; Organisation contract
- [Support and API access](#support-and-api-access) — API keys, support, rate limits

---

## Authentication

All API communication must use **HTTPS** (TLS 1.2 or higher recommended). Do not send API keys or patient data over unencrypted connections.

All requests must include the following header:

```
X-API-KEY: <your-api-key>
```

If `X-API-KEY` is absent or blank, the API returns HTTP **401 Unauthorized**, typically with an empty response body (no `errorCode` / `errorMessage` object). If the key is present but not registered for a Governing Body, the response is typically HTTP **404** with `errorCode` **ClientNotFound**. If the key has expired, the response is HTTP **403** with `errorCode` **ApiKeyExpired**.

### Base URL

The ORB API is available at the following base URL:

- `https://api-test-app.orbforhealth.com/v1`

Access to base URLs will be provided when your API key is issued.

**Route prefixes (implementation):**

- **Organisation** and **User** endpoints: `v1/organisations/{extOrganisationId}`
- **Patient** endpoints: `v1/organisations/{extOrganisationId}/patients`

For example, to create an organisation in the test environment, you would make a POST request to:

```
https://api-test-app.orbforhealth.com/v1/organisations/{extOrganisationId}
```

### API Keys

- API Keys are issued by ORB
- Each API Key is linked to **ONLY one External EHR**
  - Within ORB this is called a Governing Body (GovBody)
- A GovBody may contain multiple Organisations
- API Keys **cannot** be linked directly to Organisations

---

## Conventions

- All requests and responses use JSON; requests with a body should use `Content-Type: application/json`
- Dates are ISO‑8601 formatted
- External IDs (`extOrganisationId`, `extUserId`, `extPatientId`) are provided by the EHR and treated as stable
- ORB does **not** expose internal ORB IDs - so EHR does not need to store them
- Deleted records are retained for legal purposes, but are not re-used and are inaccessible

**Key terms**


| Term                 | Meaning                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **GovBody**          | Governing Body; the EHR (or partner) linked to one API key. A GovBody contains many Organisations.                         |
| **External ID**      | `extOrganisationId`, `extUserId`, or `extPatientId` — the identifier from the EHR. ORB does not publish its internal IDs. |
| **ConnectionStatus** | Patient’s NHS login/connection state (e.g. InviteNotSent, InviteSent, Connected, DataMismatch). See Patients section.     |
| **DataAccessStatus** | Whether the patient has been asked to grant access and whether they have granted (RequestNotSent, RequestSent, Reviewed).   |

---

## Common Errors

The following HTTP status codes may be returned by any endpoint in addition to endpoint-specific errors:


| Status | Meaning                                                                          |
| -------- | ---------------------------------------------------------------------------------- |
| 401    | Missing API key — typically empty body (see [Authentication](#authentication)). Unknown key is usually **404** `ClientNotFound`; expired key is **403** `ApiKeyExpired`. |
| 500    | Internal server error - an unexpected error occurred on the server               |
| 503    | Service unavailable - the service is temporarily unavailable, please retry later |

For 503, use exponential backoff when retrying.

For other 4xx and 5xx responses, the body may include a JSON object describing the error.

For **400 Bad Request** when the request cannot be parsed or accepted—for example malformed JSON, a required body field missing, a query or path value in the wrong form (such as `offset=0sd` when an integer is expected), a value outside the permitted set (such as `"sex": "Female1"` when only defined values are accepted), or a property not defined for that operation (such as an unknown field `"newField"` in a **PATCH** or **POST** request body)—and no more specific ORB **`errorCode`** applies, the response always includes **`errorCode`** **`InvalidRequestData`** and a single **`errorMessage`**.

The response contains **only** these two members.

**`errorMessage`** is intended for display. It is either a fixed general sentence or—commonly—a short line naming one query parameter and the rejected value when only that parameter is at fault (see **InvalidRequestData** below). Wording may change in later API versions; use **`errorCode`** for programmatic handling and **do not** parse **`errorMessage`** for business logic.

| Property       | Type    | Description                                                                 |
| ----------------- | --------- | ----------------------------------------------------------------------------- |
| errorMessage    | string  | Human-readable error message. Example: "No organisation found for the given ID". |
| errorCode       | string? | Optional. Present when the exception is a known ORB API exception; see values below. |

Example response body:

```json
{
  "errorMessage": "No organisation found for the given ID",
  "errorCode": "OrgNotFound"
}
```

Possible `errorCode` values:

- **ClientNotFound** - The caller client is not registered in ORB or the corresponding governing body record is missing for some reason. 
  Cannot validate API key nor allow further operations from this caller.
- **OrgNotFound** - There is no existing organisation corresponding to the provided id. 
- **OrgLinkNotFound** - User or patient is not linked to the organisation corresponding to the provided id. 
- **UserNotFound** - There is no existing user corresponding to the provided id. 
- **PatientNotFound** -  There is no existing patient corresponding to the provided id. 
- **InvalidRequestData** — Returned when the request body, query string, or path cannot be parsed or validated successfully, and no more specific ORB **`errorCode`** applies. The response body is always the compact JSON object `{ "errorCode", "errorMessage" }` described under **Common Errors** above. **`errorMessage`** is assigned as follows:

  - **General message** — Used when more than one validation issue is reported for the same request, and in typical cases where the problem lies in the **JSON request body** only—including a value outside a permitted enumeration (for example `"sex": "Female1"` when only defined values are accepted), or a property not defined for that operation (for example an unknown or misspelled field name in a **PATCH** or **POST** body). Request bodies must contain **only** properties listed for that endpoint; extra properties are rejected with **400**, not ignored. In these cases **`errorMessage`** is a single standard sentence; clients must not assume a field-by-field breakdown in the message text.

    ```json
    {
      "errorCode": "InvalidRequestData",
      "errorMessage": "One or more fields contain invalid values. Please verify the input data."
    }
    ```

  - **Per-parameter message (query)** — Typically used when a **single** query (or equivalent) parameter does not match its expected type; **`errorMessage`** may then identify the parameter and the supplied value:

    ```json
    {
      "errorCode": "InvalidRequestData",
      "errorMessage": "The value '0sd' is not valid for Offset."
    }
    ```

  Other isolated query-parameter errors may follow the same pattern. The exact wording of **`errorMessage`** is not guaranteed across API versions; use it for display only and base integration logic on **`errorCode`**.

- **UnsupportedMediaType** - Returned on **Set Organisation Branding** as HTTP **415** when the upload is not an allowed image type (PNG, JPEG, JPG, or SVG), the file content does not match its declared type, or the request is not `multipart/form-data`. Same compact `{ "errorCode", "errorMessage" }` body shape as other errors.

- **InvalidProperty** - Some request body field holds an invalid value (used when the API returns a specific semantic validation outcome rather than the generic **InvalidRequestData** body above).
- **InvalidParameter** - Some request parameter holds an invalid value.
- **IdNotAvailable** - The id provided is already in use by another entity of the same type.
  For example, client tried to create a new organisation using the same id of an existing one. 
- **NameNotAvailable** - The name provided is already in use by another entity of the same type.
  For example, client tried to create a new organisation using the same name of an existing one. 
- **EmailNotAvailable** - The email provided is already in use by another entity of the same type.
  For example, client tried to create a new user using the same email of an existing one. 
- **DobMismatch** - There is a DOB mismatch between the patient data in the request and the data of the corresponding patient in ORB.
- **SurnameMismatch** - There is a surname mismatch between the patient data in the request and the data of the corresponding patient in ORB.
- **PatientInvalidStatus** - The operation requested cannot be performed given the current status of the patient. 
- **ResendLimitExceeded** - The client has exceeded the maximum number of requests allowed in a given period of time (for example invitation or data-access connect calls beyond the per-patient / per-organisation 24-hour limit).
- **PatientDetailsMismatch** - Connect failed because the email already exists in ORB but the request date of birth and/or surname do not match the existing patient record (HTTP **409**). Distinct from **422** `DataMismatch` (NHS→ORB mismatch after NHS login).
- **NonClinicianAccess** - A patient access token was requested for a user with `isClinician: false` (only clinical users may request access tokens).
- **OrgIsSuspended** - The organisation is suspended; protected operations such as contract-access-token and patient access-token are blocked (**403**).
- **ApiDisabled** - The EHR API is disabled for this Governing Body / API key client (**403**).
- **ApiKeyExpired** - The API key has expired (**403**).
- **OrgAlreadyArchived** - The organisation has already been archived/deleted; returned on delete organisation as **400**.
- **OrganisationContractNotSigned** - The organisation has not completed ORB organisation contract signing. Protected EHR API and widget operations for that organisation remain blocked until the contract is signed. See [Organisation contract (clinic)](#organisation-contract-clinic).
- **GenericError** - The current error does not contain relevant information for the client.
  Often, this is just an internal logic error of the server, and does not require actions on the client side.  

For unexpected or non-API exceptions, `errorCode` may be omitted. 
Clients can use `errorMessage` for display and optionally use `errorCode` for programmatic handling.

---

# Organisations

Each EHR organisation must complete the [Organisation contract](#organisation-contract-clinic) before most Users, Patients, and Widget operations are available.

## Create Organisation

`POST /organisations/{extOrganisationId}`

Creates an Organisation in ORB under the GovBody associated with the API Key. Creation is allowed before the organisation contract is signed (required for onboarding).

On create, ORB sets default NHS linking welcome text used on the patient-facing EHR linking page (see [Set Organisation Branding](#set-organisation-branding)):

- Welcome title: `Welcome to ORB`
- Welcome subtitle: `Please login/register with your NHS account to continue.`

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |

### Request Body

```json
{
  "organisationName": "string",
  "address1": "string",
  "address2": "string",
  "address3": "string",
  "address4": "string",
  "postcode": "string",
  "phoneNumber": "string",
  "cqcRegistrationNumber": "string",
  "researchOptOut": boolean
}
```

### Request Body Fields


| Field                 | Type    | Required | Description                                   |
| ----------------------- | --------- | ---------- | ----------------------------------------------- |
| organisationName      | string  | Yes      | Unique Organisation name (case-insensitive)   |
| address1              | string  | Yes      | First line of address                         |
| address2              | string  | Yes      | Second line of address                        |
| address3              | string  | No       | Third line of address                         |
| address4              | string  | No       | Fourth line of address                        |
| postcode              | string  | Yes      | Postcode                                      |
| phoneNumber           | string  | Yes      | Phone number                                  |
| cqcRegistrationNumber | string  | Yes      | CQC registration number                       |
| researchOptOut        | boolean | No       | Research opt-out flag (defaults to false/off) |

Notes:

- extOrganisationId must be unique within the GovBody.
- organisationName must be unique within the GovBody (case-insensitive).

### Responses


| Status | Meaning                                                                         |
| -------- | --------------------------------------------------------------------------------- |
| 201    | Organisation created                                                            |
| 400    | Creation failed due to invalid request or validation error   |
| 404    | No external client found for the provided API key |
| 409    | Organisation already exists with the same extOrganisationId (`IdNotAvailable`) or organisationName (`NameNotAvailable`) |

---

## Update Organisation

`PATCH /organisations/{extOrganisationId}`

Updates organisation details or suspends / unsuspends the organisation. Requires the organisation contract to be signed (`403` **OrganisationContractNotSigned** otherwise).

- If an organisation is suspended it is not considered for billing, and no Users can access data via API.  Patients are unaffected - Patients can still login/register with the Organisation via the ORB UI.
- Organisations cannot be suspended indefinitely.  When suspending, the caller may specify `autoDeleteDays` to set when automatic deletion happens. If not specified this happens in 180 days.
- Organisations can be unsuspended using this feature to restore access for Users accessing data via API, and will again be considered for billing.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |

### Request Body

```json
{
  "organisationName": "string",
  "address1": "string",
  "address2": "string",
  "address3": "string",
  "address4": "string",
  "postcode": "string",
  "phoneNumber": "string",
  "cqcRegistrationNumber": "string",
  "researchOptOut": boolean,
  "suspended": boolean,
  "autoDeleteDays": number
}
```

### Request Body Fields


| Field                 | Type    | Required | Description                                                 |
| ----------------------- | --------- | ---------- | ------------------------------------------------------------- |
| organisationName      | string  | No       | Unique Organisation name (case-insensitive)                 |
| address1              | string  | No       | First line of address                                       |
| address2              | string  | No       | Second line of address                                      |
| address3              | string  | No       | Third line of address                                       |
| address4              | string  | No       | Fourth line of address                                      |
| postcode              | string  | No       | Postcode                                                    |
| phoneNumber           | string  | No       | Phone number                                                |
| cqcRegistrationNumber | string  | No       | CQC registration number                                     |
| researchOptOut        | boolean | No       | Research opt-out flag                                       |
| suspended             | boolean | No       | Suspended flag                                              |
| autoDeleteDays        | number  | No       | Auto-delete after suspension in days (max 180, default 180) |

### Responses


| Status | Meaning                                                  |
| -------- | ---------------------------------------------------------- |
| 200    | Organisation updated                                     |
| 400    | Update failed due to invalid request or validation error |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`) |
| 404    | Organisation corresponding to given id or Governing Body corresponding to given API key not found |
| 409    | Organisation Name already exists                         |

---

## Delete Organisation

`DELETE /organisations/{extOrganisationId}`

Delete the organisation and all associated users. Requires the organisation contract to be signed (`403` **OrganisationContractNotSigned** otherwise). This should be used if an organisation asks to
turn OFF the integration permanently or if it leaves the EHR system.

Once deleted:

- The extOrganisationId is no longer valid for use in any API calls.
- If a patient has no other organisations linked to their profile, they will no longer be able to login.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |

### Responses


| Status | Meaning                |
| -------- | ------------------------ |
| 200    | Organisation deleted   |
| 400 | Deletion failed due to invalid request or validation error (including `OrgAlreadyArchived` if the organisation was already deleted) |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`) |
| 404    | Organisation not found |

A successful response (200) returns no response body.

---

## Get Organisation

`GET /organisations/{extOrganisationId}`

Returns the organisation details for the given external organisation ID when it exists in the Governing Body linked to the API key.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |

### Response Body

A successful response (200) returns the organisation summary:

```json
{
  "extOrganisationId": "string",
  "organisationName": "string",
  "suspended": false,
  "autoDeleteDate": "string"
}
```

### Response Body Fields


| Field                | Type    | Description                                                           |
| ---------------------- | --------- | ----------------------------------------------------------------------- |
| extOrganisationId    | string  | External organisation ID (EHR)                                        |
| organisationName    | string  | Organisation name                                                     |
| suspended           | boolean | Suspension status                                                     |
| autoDeleteDate      | string? | Auto-delete date in YYYY-MM-DD format when suspended; null if not set |

Note: autoDeleteDate is only populated when suspended = true.

### Responses


| Status | Meaning                        |
| -------- | -------------------------------- |
| 200    | Organisation exists in Governing Body |
| 400 | Bad request |
| 404    | Organisation not found         |

---

## List Organisations

`GET /organisations`

Returns a list of organisations under the Governing Body linked to the API key. Includes suspension status and auto-delete date when suspended. Filtering by suspension status is optional.

### Query Parameters


| Name      | Type    | Required | Default | Description                                             |
| ----------- | --------- | ---------- | --------- | --------------------------------------------------------- |
| suspended | boolean | No       | -       | Filter by suspension status. Omit to return all results |

### Response Body

```json
[
  {
    "extOrganisationId": "string",
    "organisationName": "string",
    "suspended": boolean,
    "autoDeleteDate": "string"
  }
]
```

### Response Body Fields


| Field                | Type    | Description                                                           |
| ---------------------- | --------- | ----------------------------------------------------------------------- |
| [].extOrganisationId | string  | External organisation ID (EHR)                                        |
| [].organisationName  | string  | Organisation name                                                     |
| [].suspended         | boolean | Suspension status                                                     |
| [].autoDeleteDate    | string  | Auto-delete date in YYYY-MM-DD format when suspended; null if not set |

Note: autoDeleteDate is only populated when suspended = true.

### Example Requests

Get all organisations:

```
GET /organisations
```

Get only suspended organisations:

```
GET /organisations?suspended=true
```

Get only active (not suspended) organisations:

```
GET /organisations?suspended=false
```

### Responses


| Status | Meaning |
| -------- | --------- |
| 200    | OK      |
| 404 | Governing Body corresponding to given API key not found |

---

## Get Organisation Contract Status

`GET /organisations/{extOrganisationId}/contract-status`

Returns whether the organisation has signed the ORB organisation contract and when. The host uses this to decide whether to show the contract signing iframe and to verify status after signing. Available **before** the contract is signed (not gated).

### Path Parameters

| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |

### Response Body

When not signed:

```json
{
  "extOrganisationId": "org-123",
  "contractSigned": false,
  "contractSignedAt": null
}
```

When signed:

```json
{
  "extOrganisationId": "org-123",
  "contractSigned": true,
  "contractSignedAt": "2026-05-22T10:30:00Z"
}
```

### Response Body Fields

| Field               | Type           | Description                                                                 |
| --------------------- | ---------------- | ----------------------------------------------------------------------------- |
| extOrganisationId   | string         | External organisation ID (EHR); same value as in the path                   |
| contractSigned      | boolean        | `true` after successful organisation-contract signing; `false` until then   |
| contractSignedAt    | string \| null | UTC ISO-8601 timestamp of signing; present only when `contractSigned` is `true`, otherwise `null` |

### Responses

| Status | Meaning |
| -------- | --------- |
| 200    | OK      |
| 401    | Missing API key (empty body). Unknown key typically returns 404 `ClientNotFound` |
| 403    | EHR API disabled for this client |
| 404    | Organisation not found for this API key / client |
| 500    | Unexpected server error |

---

## Request Contract Access Token

`POST /organisations/{extOrganisationId}/contract-access-token`

Generates a short-lived organisation-scoped token used to open the ORB organisation-contract signing iframe. Available **before** the contract is signed (not gated). The token identifies the API-key client and external organisation only (no patient or user claim).

The host must use a valid Governing Body API key and the same `extOrganisationId` that was passed when the organisation was created. ORB validates that the organisation belongs to that client before issuing the token.

### Path Parameters

| Name              | Description                                                                 |
| ------------------- | ----------------------------------------------------------------------------- |
| extOrganisationId | External organisation ID (EHR). Must be the same ID used at Create Organisation under this API key; scopes the contract-signing iframe to that organisation |

### Request Body

None.

### Response Body

```json
{
  "accessToken": "string",
  "expiresIn": 900
}
```

### Response Body Fields

| Field        | Type    | Description                                                                 |
| -------------- | --------- | ----------------------------------------------------------------------------- |
| accessToken  | string  | Short-lived JWT for the organisation-contract signing iframe only (not the patient records widget). Pass into the iframe via `SET_TOKEN` / `openOrbWidget` (see Widget Integration Guide) |
| expiresIn    | integer | Seconds until the token expires from issue time (configured on ORB; typically 900 = 15 minutes). Generate a new token if the iframe session outlives this value |

### JWT Token Claims

The contract JWT contains:

- `clientScopeId` - Internal API-key client identifier
- `extOrganisationId` - The organisation ID
- `tokenScope` - Always `organisation-contract` (distinguishes this token from a patient-records widget token)
- `iat` / `exp` / `aud` / `iss` - As for other ORB widget JWTs

There is no `extUserId` or `extPatientId` claim.

### Responses

| Status | Meaning |
| -------- | --------- |
| 200    | Token issued |
| 401    | Missing API key (empty body). Unknown key typically returns 404 `ClientNotFound` |
| 403    | Organisation suspended, or EHR API disabled for this client |
| 404    | Organisation not found for this API key / client |
| 500    | Unexpected server error |

Embedding, `postMessage`, and the in-iframe signing UI use the **same** `orb-widget.js` helper as NHS records (different URL + this token). See [Organisation contract (clinic)](#organisation-contract-clinic) and the [ORB Widget Integration Guide](../widget-integration.md#organisation-contract-signing) for kickoff examples.

---

## Set Organisation Branding

`POST /organisations/{extOrganisationId}/branding`

Updates the organisation logo and optional welcome title/subtitle shown on the patient-facing NHS linking page (the page patients see when the EHR uses Connect Patient by Email or Connect Patient by Link).

Requires the organisation contract to be signed (`403` **OrganisationContractNotSigned** otherwise).

### Path Parameters

| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |

### Request Body

Send as `multipart/form-data` (this endpoint accepts a file upload, so JSON body is not used).

| Field | Type | Required | Description |
| ------- | ------ | ---------- | ------------- |
| overwriteLogo | boolean | No | Set to `true` to replace the logo (`file`) or clear it (no `file`). If omitted or `false`, the current logo is unchanged. |
| file | binary | No | Logo image — PNG, JPEG, JPG or SVG, max **1 MB**. Uploading a new file replaces the previous logo. |
| patientNHSActivationWelcomeTitle | string | No | Welcome title on the NHS linking page. Only updated if this field is sent. |
| patientNHSActivationWelcomeSubtitle | string | No | Welcome subtitle on the NHS linking page. Only updated if this field is sent. |

You may update welcome text without changing the logo (omit `overwriteLogo`, or set it to `false`).

You may change the logo without sending welcome fields.

### Patient experience

If welcome text has not been customised, patients see the create-organisation defaults (`Welcome to ORB` / `Please login/register with your NHS account to continue.`).

On the linking page the patient sees:

- the organisation logo when one is uploaded, otherwise ORB’s default branding mark;
- the welcome title and subtitle;
- an **NHS Login** button only with the self register option.

### Responses

| Status | Meaning |
| -------- | --------- |
| 204    | Branding updated (no response body) |
| 400    | Invalid request or validation error |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled |
| 404    | Organisation or Governing Body not found |
| 415    | Unsupported media type (`UnsupportedMediaType`) — file not PNG/JPEG/JPG/SVG, content mismatch, or not multipart |

---

# Users

Users represent Clinicians who are granted access via the integration. They do not have general login access to the ORB UI.

EHR systems use the **`isClinician`** flag to distinguish clinical users from non-clinical users (for example administrative staff).

Each user record includes three boolean flags:

- **`isClinician`** — `true` if the user is a clinical user who may access NHS patient data via the integration (widget / access token); `false` for non-clinical users (for example administrative staff).
- **`isLocum`** — `true` if the user is a temporary locum; `false` if a permanent employee.
- **`authorisedSignatory`** — `true` if this user is an authorised signatory for the organisational contract.

All three flags are required when creating a user; any of them may be supplied on update.

User create, update, list, and delete require the organisation contract to be signed (`403` **OrganisationContractNotSigned** otherwise). See [Organisation contract (clinic)](#organisation-contract-clinic).

---

## Create User

`POST /organisations/{extOrganisationId}/users/{extUserId}`

Creates an ORB user within an ORB organisation, linked to the corresponding external User ID.

This is used to grant a user access to the integration. Set **`isClinician`** to `true` for clinical users and `false` for non-clinical users. Only users with **`isClinician: true`** may request patient access tokens (see [Request Access Token](#request-access-token)).

- For Users we assume the external IDs are unique within an Organisation, and do not change.
- We do not attempt to link or merge users – nor do we identify duplicates based on personal attributes (e.g. FirstName, LastName, ProfessionalRegNumber).
- If the same clinician exists in multiple organisations in the EHR, a separate ORB user must be created for each organisation, even if in EHR they are shared.

The number of Users in existence during a month may be used in billing. The system logs user creation and deletion and this log is available for billing.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External Organisation ID (EHR) |
| extUserId         | External User ID (EHR)         |

### Request Body

```json
{
  "firstName": "string",
  "lastName": "string",
  "professionalRegNumber": "string",
  "emailAddress": "string",
  "isClinician": true,
  "isLocum": false,
  "authorisedSignatory": false
}
```

### Request Body Fields


| Field                 | Type    | Required | Description                                                                 |
| ----------------------- | --------- | ---------- | ----------------------------------------------------------------------------- |
| firstName             | string  | Yes      | User's first name                                                           |
| lastName              | string  | Yes      | User's last name                                                            |
| professionalRegNumber | string  | Yes      | Professional registration number                                            |
| emailAddress          | string  | No       | User's email address                                                        |
| isClinician           | boolean | Yes      | `true` if the user is a clinical user; `false` for non-clinical users (e.g. administrative) |
| isLocum               | boolean | Yes      | `true` if the user is a temporary locum; `false` if a permanent employee      |
| authorisedSignatory   | boolean | Yes      | `true` if this user is an authorised signatory for the organisational contract |


### Responses


| Status | Meaning                         |
| -------- | --------------------------------- |
| 201    | User created                    |
| 400    | Creation failed due to invalid request or validation error |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | Organisation not found          |
| 409    | User already exists in this organisation with the same extUserId (`IdNotAvailable`), or email already in use (`EmailNotAvailable`) |

---

## Update User

`PATCH /organisations/{extOrganisationId}/users/{extUserId}`

Updates one or more attributes of an existing user within an organisation.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extUserId         | External user ID (EHR)         |

### Request Body

```json
{
  "firstName": "string",
  "lastName": "string",
  "professionalRegNumber": "string",
  "emailAddress": "string",
  "isClinician": true,
  "isLocum": false,
  "authorisedSignatory": false
}
```

### Request Body Fields


| Field                 | Type    | Required | Description                                                                 |
| ----------------------- | --------- | ---------- | ----------------------------------------------------------------------------- |
| firstName             | string  | No       | User's first name                                                           |
| lastName              | string  | No       | User's last name                                                            |
| professionalRegNumber | string  | No       | Professional registration number                                            |
| emailAddress          | string  | No       | User's email address                                                        |
| isClinician           | boolean | No       | If supplied, updates whether the user is a clinical user (`true`) or non-clinical (`false`) |
| isLocum               | boolean | No       | If supplied, updates whether the user is a locum (`true`) or permanent (`false`) |
| authorisedSignatory   | boolean | No       | If supplied, updates authorised signatory flag for the organisational contract   |

### Responses


| Status | Meaning                             |
| -------- | ------------------------------------- |
| 200    | User updated                        |
| 400    | Invalid request or validation error |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | User or organisation not found      |

---

## List Users

`GET /organisations/{extOrganisationId}/users`

Returns users for the organisation (regardless of whether the organisation is currently suspended). Pagination is optional - if no pagination parameters are provided, all users are returned as an array. If pagination parameters are provided, a paginated response with metadata is returned.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |

### Query Parameters


| Name   | Type    | Required | Default | Description                                                                        |
| -------- | --------- | ---------- | --------- | ------------------------------------------------------------------------------------ |
| limit  | integer | No       | -       | Maximum number of users to return (1-1000). If omitted, all users are returned     |
| offset | integer | No       | 0       | Number of users to skip before returning results. Only used when limit is provided |

### Response Body (No Pagination)

When no pagination parameters are provided, the response is a simple array:

```json
[
  {
    "extUserId": "string",
    "firstName": "string",
    "lastName": "string",
    "professionalRegNumber": "string",
    "emailAddress": "string",
    "isClinician": true,
    "isLocum": false,
    "authorisedSignatory": false
  }
]
```

### Response Body (With Pagination)

When `limit` is provided, the response includes pagination metadata:

```json
{
  "users": [
    {
      "extUserId": "string",
      "firstName": "string",
      "lastName": "string",
      "professionalRegNumber": "string",
      "emailAddress": "string",
      "isClinician": true,
      "isLocum": false,
      "authorisedSignatory": false
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

### Response Body Fields

**When pagination is not used (array response):**


| Field                    | Type   | Description                      |
| :------------------------- | -------- | :--------------------------------- |
| [].extUserId             | string  | External user ID (EHR)                                                      |
| [].firstName             | string  | User's first name                                                           |
| [].lastName              | string  | User's last name                                                            |
| [].professionalRegNumber | string  | Professional registration number                                            |
| [].emailAddress          | string  | User's email address                                                        |
| [].isClinician           | boolean | `true` if clinical user; `false` if non-clinical                            |
| [].isLocum               | boolean | `true` if locum; `false` if permanent employee                              |
| [].authorisedSignatory   | boolean | `true` if authorised signatory for the organisational contract               |

**When pagination is used (object response):**


| Field                         | Type    | Description                               |
| :------------------------------ | --------- | :------------------------------------------ |
| users                         | array   | Array of user objects                     |
| users[].extUserId             | string  | External user ID (EHR)                                       |
| users[].firstName             | string  | User's first name                                            |
| users[].lastName              | string  | User's last name                                             |
| users[].professionalRegNumber | string  | Professional registration number                               |
| users[].emailAddress          | string  | User's email address                                         |
| users[].isClinician           | boolean | `true` if clinical user; `false` if non-clinical               |
| users[].isLocum               | boolean | `true` if locum; `false` if permanent employee               |
| users[].authorisedSignatory   | boolean | `true` if authorised signatory for the organisational contract |
| pagination                    | object  | Pagination metadata                       |
| pagination.total              | integer | Total number of users in the organisation |
| pagination.limit              | integer | Number of users requested per page        |
| pagination.offset             | integer | Number of users skipped                   |
| pagination.hasMore            | boolean | Whether there are more users available    |

### Example Requests

Get all users (no pagination):

```
GET /organisations/ORG123/users
```

Get first 100 users (with pagination):

```
GET /organisations/ORG123/users?limit=100&offset=0
```

Get next 50 users:

```
GET /organisations/ORG123/users?limit=50&offset=100
```

### Responses


| Status | Meaning                                                                |
| -------- | ------------------------------------------------------------------------ |
| 200    | OK                                                                     |
| 400    | Invalid pagination parameters (limit > 1000, limit < 1, or offset < 0) |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | Organisation not found                                                 |

---

## Delete User

`DELETE /organisations/{extOrganisationId}/users/{extUserId}`

Deletes the specified user from the organisation. After deletion, the user will no longer be able to access the integration for this organisation.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extUserId         | External user ID (EHR)         |

### Responses


| Status | Meaning                        |
| -------- | -------------------------------- |
| 200    | User deleted                   |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | User or organisation not found |

A successful response (200) returns no response body.

---

# Patients

Patients are linked to organisations via a **connection** resource. Patient list, update, connection, permissions, and access-token operations for an organisation require the [organisation contract](#organisation-contract-clinic) to be signed (`403` **OrganisationContractNotSigned** otherwise).

ORB registers a couple of statuses and some flags for each patient, to be able to provide relevant information about the patient connection process to the external client:

- **ConnectionStatus**: Describes the process of requesting NHS registration of the patient from the external organisation.
  The valid values are:
  - **InviteNotSent**: Invitation for the patient to log in using NHS credentials is not sent yet.
    Valid only if the patient has never logged in using NHS.
  - **InviteSent**: Invitation for the patient to log in with their NHS credentials has been sent.
    Valid only if the patient has never logged in with the NHS.
  - **InviteExpired**: Invitation for the patient to log in with their NHS credentials has been sent but expired. Valid only if the patient has never logged in with the NHS.
  - **DataMismatch**: Patient tried to log in with their NHS credentials, but there was a mismatch between the data they have in ORB and the data they have in NHS. If this status is set, two other fields provide the client with information about which field contains the mismatch.
    - **DOBMismatch**: This field is true if there is a mismatch in the date of birth.
    - **SurnameMismatch**: This field is true if there is a mismatch in the surname.
  - **Connected**: Patient did a valid NHS registration, and there are no mismatches.
    This only indicates patient has NHS login and there is an external patient linked to it.
    It has nothing to do with permissions to access patient NHS data.
- **DataAccessStatus**: Describes the process of requesting access to the NHS data of the patient from the external organisation.
  Their valid values are:
  - **RequestNotSent**: Request for accessing patient NHS data is not sent yet.
  - **RequestSent**: Request for accessing patient NHS data has been sent.
  - **Reviewed**: The patient granted the organisation access to his NHS data.
    This only indicates the patient allowed access to **some** of their NHS data.
    To know exactly to which data the organisation has access, client must call **Get Granted Permissions** API method.
    Also, patient data can be blocked from GP side or by the patient. If this status is set, two other fields provide this info.
    - **PatientDataAccessLimited**: This field is true if the patient has restricted access to their data partially or totally (e.g. via passport settings).
    - **GpDataAccessLimited**: This field is true if the GP blocked the patient's data partially or totally in any way.
- **Oldest NHS Record**: The date of the oldest record received from NHS for this patient. If this is relatively recent (e.g. one year ago), it may indicate that the GP has restricted how far back access goes. This is returned as `oldestNhsRecordDate` in API responses; it may be null if no data has been received yet or cannot be determined.

**Data priority and overwrite rules (ORB vs EHR data)**

A patient may have data from NHS, from ORB (entered by other organisations), and from the EHR/organisation via the API (name, surname, DOB, postcode, etc.). ORB applies the following rules for all patients, including those already existing in ORB:

- **NHS data** has the highest priority and is always considered most valid.
- **EHR/organisation data** (sent via the API when linking or connecting a patient) has higher priority than ORB-held data for fields where NHS has not provided a value.

When the EHR uses the API to link or connect a patient and supplies data in the request body:

- **Date of birth and surname** (`dateOfBirth`, `lastName`): These are **validated** against existing ORB data, not overwritten. If the values differ from what is already stored (ORB vs request mismatch), the request fails with **409** (conflict). This applies when the patient already exists in ORB (e.g. matched by email). This is distinct from the **NHS→ORB mismatch** (when the patient has tried NHS login and ORB data did not match NHS), which is reported as **422** with a response body containing `connectionStatus` **DataMismatch** (see Connect Patient by Email / by Link and Get Patient Connection Status).
- **All other supplied fields** overwrite ORB data unless NHS has already provided a value for that field (NHS takes precedence). The fields that can be overwritten when supplied by the EHR on Connect Patient by Email or Connect Patient by Link are:
  - `title`
  - `firstName`
  - `sex`
  - `emailAddress`
  - `postcode`

Example: if the EHR supplies a postcode and NHS has not provided one, the EHR postcode overwrites any existing ORB postcode for that patient.

ORB uses the following process when a connection request is made, updating patient statuses each time:

1. First, it checks if the patient already exists in the system, using the email as key. ORB does not support two patients with the same email address; there is at most one patient per email.

   - If the patient does not exist, ORB creates the patient record and the external link record for this organisation, then continues.
   - If the patient exists (email match), it checks if the date of birth and surname sent in the request match the ones of the existing patient (see Data priority above).
   - If they don't match, an error is returned to the EHR and the request fails (409). Surname and DOB are not overwritten in this case.
   - Otherwise, any other supplied fields overwrite ORB data according to the data priority rules above.
   - Patient connection status is changed to **InviteNotSent**.
   
2. Then, it checks if the patient has NHS login.

   - If not, sends an ORB NHS registration email to the user, and waits for the user to click the link and sign up using NHS Login.
   - If the email has been sent before (patient is in **InviteSent** status), and it has not expired yet, a `resend` flag must be included in the body of the request to indicate that client wants to resend the email anyway.
   - This email can be sent at most twice per 24 hours, to avoid spamming the patient with too many of these emails.
   - Patient connection status is changed to **InviteSent**.
   
3. When the patient tries to log in using NHS, ORB compares the surname and DOB held in ORB with the NHS details.

   - If they don't match: ORB overwrites the patient record with the correct surname and DOB from NHS (so the patient can complete NHS login). The **external link** for the organisation that registered this patient is then set to **DataMismatch**, recording which field(s) failed (`dobMismatch`, `surnameMismatch`). So the mismatch is recorded per organisation; the master patient data in ORB is corrected from NHS.
   - If a second organisation later registers the same patient (same email), ORB data now matches NHS, so the request can succeed.
   - If they match, patient connection status is set to **Connected** (step 4).
   
4. If there are no mismatches, patient connection status is changed to **Connected**.

5. Then, it asks the patient to grant NHS access permissions to the requesting Org.

   - An email is sent for this, which redirects to patient passport access page after login.
     After this, patient data access request status is changed to **RequestSent**.
   - If the email has been sent before (patient is in **RequestSent** status), a `resend` flag must be included in the body of the request to indicate that client wants to resend the email anyway.
   - This email can be sent at most twice per 24 hours, to avoid spamming the patient with too many of these emails.
   - If patient allows any access to their data, patient data access request status is changed to **Reviewed**.
   
   Note that patient can allow data access partially, and their data can still be blocked from GP.

**Rate limits (emails and links)**

- **Data access request:** At most two data access request emails (or links) per patient per organisation per 24 hours. If the EHR calls again after that limit has been reached within the period, no new data access email is sent and no data access link is returned.
- **NHS invitation:** At most two NHS invitation emails (or links) per patient per organisation per 24 hours. If the EHR calls again after that limit has been reached within the period, no new invitation email is sent and no invitation link is returned.

**Link validity and renewal**

The two links returned or sent by the connection endpoints have different validity rules:

| Link type | Used when | Validity |
| ----------- | ----------- | ---------- |
| NHS registration / invitation link | The patient has not completed NHS registration | Expires after a system-configurable period (**7 days by default**), counted from when the link is generated. Email and direct-link flows use the same type of token. After expiry, `connectionStatus` becomes **InviteExpired**. |
| Data-access / consent link | The patient has completed NHS registration and needs to review access for the organisation | Does **not** use a timed invitation token and therefore does **not** expire after a fixed number of days. The URL opens the ORB login page; the patient must sign in before they can review access. |

Only one current NHS registration token is retained for a patient. When ORB generates a new registration link, the previous registration link is invalidated immediately and the configured expiry period starts again. To request a replacement while an invitation is still pending, set `resend` to `true`. Generation and sending remain subject to the NHS invitation rate limit above.

The data-access / consent URL is not a time-limited invitation token, so requesting it again does not “renew” an expiry window. Reissuing or resending it is still subject to the data-access request rate limit above.

**Guidance for EHR implementers (data access)**

Use the following when building your integration:

- **If the patient has not granted access** (`dataAccessStatus` is not **Reviewed**): You can call the Connect Patient by Email or Connect Patient by Link endpoint up to twice per 24 hours (per rate limits above); ORB will send (or return a link for) a reminder to the patient while the limit allows. See Rate limits above.
- **If the patient has granted access** (`dataAccessStatus` is **Reviewed**): You must check the detailed return values to see if you have enough access for your use case. Call **Get Granted Permissions** for the list of data sets the patient has granted. If something you need is missing, trigger a request to the patient to grant more (e.g. via the connection endpoint or your own messaging).
- **If `oldestNhsRecordDate` is not very old** (e.g. only one or two years back): Consider informing the patient that they may need to ask their GP to allow access to older records, or use in-app messaging to suggest they check GP restrictions.
- **If `patientDataAccessLimited` is true**: The patient has restricted what data is shared. Consider informing the clinician and the patient may need to grant more access via their passport settings.
- **If `gpDataAccessLimited` is true**: Warn the clinician. They should check whether the data available is sufficient; if not, they can ask the patient to request that the GP provide more access.
- **If the granted permissions (Get Granted Permissions) do not include what you need**: Tell the clinician which data sets (e.g. allergies, medications) the patient has not granted. Allow the clinician to trigger a request to the patient to grant more if needed.

---

## List Patients

`GET /organisations/{extOrganisationId}/patients`

Returns a list of patients for the specified organisation. Pagination is optional - if no pagination parameters are provided, all patients are returned as an array. If pagination parameters are provided, a paginated response with metadata is returned.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External Organisation ID (EHR) |

### Query Parameters


| Name                | Type    | Required | Default | Description                                                                           |
| --------------------- | --------- | ---------- | --------- | --------------------------------------------------------------------------------------- |
| limit               | integer | No       | -       | Maximum number of patients to return (1-1000). If omitted, all patients are returned  |
| offset              | integer | No       | 0       | Number of patients to skip before returning results. Only used when limit is provided |
| connectionStatus    | string  | No       | -       | Filter by connection status (InviteNotSent, InviteSent, InviteExpired, DataMismatch, Connected)                    |
| dataAccessStatus    | string  | No       | -       | Filter by data access request status (RequestNotSent, RequestSent, Reviewed)           |
| patientDataAccessLimited | boolean | No       | -       | When true, filter to patients which have restricted their data (patient-side) |
| gpDataAccessLimited | boolean | No       | -       | When true, filter to patients which have their data blocked from GP side              |
| dobMismatch         | boolean | No       | -       | When true, filter to patients whose date of birth in ORB mismatches the one in NHS    |
| surnameMismatch     | boolean | No       | -       | When true, filter to patients whose surname in ORB mismatches the one in NHS          |
| nhsNumber           | string  | No       | -       | Filter by NHS number from NHS Login in ORB (digits only; spaces/hyphens allowed in the query value) |

### Response Body (No Pagination)

When no pagination parameters are provided, the response is a simple array:

```json
[
  {
    "extPatientId": "string",
    "title": "string",
    "firstName": "string",
    "lastName": "string",
    "dateOfBirth": "string",
    "sex": "string",
    "emailAddress": "string",
    "postcode": "string",
    "connectionStatus": "string",
    "dobMismatch": boolean,
    "surnameMismatch": boolean,
    "patientDataAccessLimited": boolean,
    "gpDataAccessLimited": boolean,
    "dataAccessStatus": "string",
    "nhsNumber": "string",
    "oldestNhsRecordDate": "string",
    "lastInvitationEmailDate": "string",
    "lastAccessRequestEmailDate": "string"
  }
]
```

### Response Body (With Pagination)

When `limit` is provided, the response includes pagination metadata:

```json
{
  "patients": [
    {
      "extPatientId": "string",
      "title": "string",
      "firstName": "string",
      "lastName": "string",
      "dateOfBirth": "string",
      "sex": "string",
      "emailAddress": "string",
      "postcode": "string",
      "connectionStatus": "string",
      "dobMismatch": boolean,
      "surnameMismatch": boolean,
      "patientDataAccessLimited": boolean,
      "gpDataAccessLimited": boolean,
      "dataAccessStatus": "string",
      "nhsNumber": "string",
      "oldestNhsRecordDate": "string",
      "lastInvitationEmailDate": "string",
      "lastAccessRequestEmailDate": "string"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

### Response Body Fields

**When pagination is not used (array response):**


| Field                         | Type    | Description                                                                                    |
| :------------------------------ | --------- | ------------------------------------------------------------------------------------------------ |
| [].extPatientId               | string  | External patient ID (EHR)                                                                      |
| [].title                      | string  | Patient title                                                                                  |
| [].firstName                  | string  | Patient's first name                                                                           |
| [].lastName                   | string  | Patient's last name                                                                            |
| [].dateOfBirth                | string  | Date of birth in YYYY-MM-DD format                                                             |
| [].sex                        | string  | Patient sex (e.g. Male, Female)                                                                |
| [].emailAddress               | string  | Patient email address                                                                          |
| [].postcode                   | string  | Patient postcode                                                                               |
| [].connectionStatus           | string  | Connection status (InviteNotSent, InviteSent, InviteExpired, DataMismatch, Connected)          |
| [].dobMismatch                | boolean | When connectionStatus is DataMismatch: true if date of birth mismatch detected (optional)      |
| [].surnameMismatch            | boolean | When connectionStatus is DataMismatch: true if surname mismatch detected (optional)            |
| [].patientDataAccessLimited | boolean | When applicable: true if the patient has restricted their data partially or totally (optional)     |
| [].gpDataAccessLimited        | boolean | When applicable: true if the GP has blocked the patient's data partially or totally (optional) |
| [].dataAccessStatus           | string  | Data access request status (RequestNotSent, RequestSent, Reviewed) (optional)                   |
| [].nhsNumber                  | string  | NHS number from NHS Login in ORB (read-only; optional; omitted or null if not on record)       |
| [].oldestNhsRecordDate        | string  | Date of oldest NHS record received (ISO-8601); null if none or not determined (optional)       |
| [].lastInvitationEmailDate    | string  | ISO-8601 date of the last NHS registration invitation email sent (optional)                    |
| [].lastAccessRequestEmailDate | string  | ISO-8601 date of the last data access request email sent (optional)                            |

**When pagination is used (object response):**


| Field                                 | Type    | Description                                                                                    |
| :-------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| patients                              | array   | Array of patient objects                                                                       |
| patients[].extPatientId               | string  | External patient ID (EHR)                                                                      |
| patients[].title                      | string  | Patient title                                                                                  |
| patients[].firstName                  | string  | Patient's first name                                                                           |
| patients[].lastName                   | string  | Patient's last name                                                                            |
| patients[].dateOfBirth                | string  | Date of birth in YYYY-MM-DD format                                                             |
| patients[].sex                        | string  | Patient sex (e.g. Male, Female)                                                                |
| patients[].emailAddress               | string  | Patient email address                                                                          |
| patients[].postcode                   | string  | Patient postcode                                                                               |
| patients[].connectionStatus           | string  | Connection status (InviteNotSent, InviteSent, InviteExpired, DataMismatch, Connected)          |
| patients[].dobMismatch                | boolean | When connectionStatus is DataMismatch: true if date of birth mismatch detected (optional)      |
| patients[].surnameMismatch            | boolean | When connectionStatus is DataMismatch: true if surname mismatch detected (optional)            |
| patients[].patientDataAccessLimited | boolean | When applicable: true if the patient has restricted their data partially or totally (optional)      |
| patients[].gpDataAccessLimited        | boolean | When applicable: true if the GP has blocked the patient's data partially or totally (optional) |
| patients[].dataAccessStatus           | string  | Data access request status (RequestNotSent, RequestSent, Reviewed) (optional)                   |
| patients[].nhsNumber                  | string  | NHS number from NHS Login in ORB (read-only; optional; omitted or null if not on record)       |
| patients[].oldestNhsRecordDate        | string  | Date of oldest NHS record received (ISO-8601); null if none or not determined (optional)       |
| patients[].lastInvitationEmailDate    | string  | ISO-8601 date of the last NHS registration invitation email sent (optional)                    |
| patients[].lastAccessRequestEmailDate | string  | ISO-8601 date of the last data access request email sent (optional)                            |
| pagination                            | object  | Pagination metadata                                                                            |
| pagination.total                      | integer | Total number of patients in the organisation                                                   |
| pagination.limit                      | integer | Number of patients requested per page                                                          |
| pagination.offset                     | integer | Number of patients skipped                                                                     |
| pagination.hasMore                    | boolean | Whether there are more patients available                                                      |

### Example Requests (combine filters as needed using AND)

Get all patients (no pagination):

```
GET /organisations/ORG123/patients
```

Get only connected patients:

```
GET /organisations/ORG123/patients?connectionStatus=Connected
```

Get connected patients with patient-restricted data access:

```
GET /organisations/ORG123/patients?connectionStatus=Connected&patientDataAccessLimited=true
```

Get connected patients with blocked GP data access:

```
GET /organisations/ORG123/patients?connectionStatus=Connected&gpDataAccessLimited=true
```

Get connected patients with patient-granted access:

```
GET /organisations/ORG123/patients?connectionStatus=Connected&dataAccessStatus=Reviewed
```

Get patient by NHS number:

```
GET /organisations/ORG123/patients?nhsNumber=9434765919
```

Get patients with date of birth mismatch:

```
GET /organisations/ORG123/patients?connectionStatus=DataMismatch&dobMismatch=true
```

Get patients with surname mismatch:

```
GET /organisations/ORG123/patients?connectionStatus=DataMismatch&surnameMismatch=true
```

Get first 100 patients (with pagination):

```
GET /organisations/ORG123/patients?limit=100&offset=0
```

Get next 50 patients:

```
GET /organisations/ORG123/patients?limit=50&offset=100
```

### Responses


| Status | Meaning                                                                                                                                                                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200    | OK                                                                                                                                                                                                                                                                                                                             |
| 400    | Invalid pagination parameters (limit > 1000, limit < 1, or offset < 0), or invalid filter value for connectionStatus, dataAccessStatus, patientDataAccessLimited, gpDataAccessLimited, dobMismatch, surnameMismatch, or nhsNumber, or invalid combination of these parameters (for example, patientDataAccessLimited or gpDataAccessLimited cannot be set if connectionStatus is not Connected) |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | Organisation not found                                                                                                                                                                                                                                                                                                         |

---

## Update Patient

`PATCH /organisations/{extOrganisationId}/patients/{extPatientId}`

Updates one or more demographic attributes of an existing patient within an organisation. This is typically used when the EHR updates patient details such as contact information or postcode. The same validation and overwrite rules apply as described in **Data priority and overwrite rules (ORB vs EHR data)** (e.g. date of birth and surname are validated, not overwritten).

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extPatientId      | External patient ID (EHR)      |

### Request Body

```json
{
  "title": "string",
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "string",
  "sex": "string",
  "emailAddress": "string",
  "postcode": "string"
}
```

### Request Body Fields


| Field        | Type   | Required | Description                        |
| -------------- | -------- | ---------- | ------------------------------------ |
| title        | string | No       | Patient title                      |
| firstName    | string | No       | Patient's first name               |
| lastName     | string | No       | Patient's last name (surname)      |
| dateOfBirth  | string | No       | Date of birth in YYYY-MM-DD format |
| sex          | string | No       | Patient sex (e.g., Male, Female)   |
| emailAddress | string | No       | Patient email address              |
| postcode     | string | No       | Patient postcode                   |

When updating an existing patient:

- If `dateOfBirth` or `lastName` are supplied, they are validated against existing ORB data. If they do not match, the request fails with a 409 validation error (these fields are not overwritten).
- Any other supplied fields overwrite ORB data according to the **Data priority and overwrite rules (ORB vs EHR data)** (NHS data remains the source of truth where present).

### Response Body (200)

On success, ORB returns the patient's **current demographic fields** as stored after the update (not an empty body). Values may differ from the request where NHS data takes precedence or where `dateOfBirth` / `lastName` were validated but not overwritten.

```json
{
  "title": "Ms",
  "sex": "Male",
  "dateOfBirth": "1933-11-14",
  "firstName": "Simon",
  "lastName": "OLLEY",
  "postcode": "asdas123",
  "emailAddress": "patient@example.com"
}
```

### Response Body Fields (200)


| Field        | Type   | Description                                                        |
| -------------- | -------- | -------------------------------------------------------------------- |
| title        | string | Patient title (e.g. Mr, Ms)                                          |
| sex          | string | Patient sex (e.g. Male, Female)                                      |
| dateOfBirth  | string | Date of birth in YYYY-MM-DD format                                   |
| firstName    | string | Patient's first name                                               |
| lastName     | string | Patient's last name (surname)                                        |
| postcode     | string | Patient postcode                                                     |
| emailAddress | string | Patient email address (may be null in ORB if not set)               |

This response does **not** include `extPatientId`, `connectionStatus`, or other list-only fields (see **List Patients**).

### Responses


| Status | Meaning                                             |
| -------- | ----------------------------------------------------- |
| 200    | Patient updated; response body is current demographics (see above) |
| 400    | Update failed due to invalid request or validation error |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | Patient or organisation not found                   |
| 409   | Conflict — request body DOB/surname does not match existing ORB patient record (ORB vs request mismatch). |
| 500    | Unexpected server error                             |

---

## Connect Patient by Email

`POST /organisations/{extOrganisationId}/patients/{extPatientId}/connection-email`

Sends an email inviting a patient to sign up and grant permission for the organisation to view NHS records.

- If the patient does not exist, ORB creates a new patient record and sends a NHS invitation email.
- If the patient exists but is not connected, ORB sends the invitation email directly (unless resend=false and an invitation is already pending).
  In this case, ORB ensures the patient email, date of birth and surname matches the ones in the request.
  Remaining fields are updated in ORB, using the data passed in the request.
- If the patient is already connected, it sends a data access request email for the patient to grant organisation access to their NHS (unless access is already granted, or the data access request rate limit for the last 24 hours has already been reached).

The EHR may call this endpoint again to send a **reminder** (e.g. if the patient has not yet completed NHS login or granted access). Whether an email is sent is subject to the rate limits in the Patients section above: invitation can be resent when `resend` is true; data access request emails are sent at most twice per patient per organisation per 24 hours.

This includes the ID of the requesting Clinician User, so ORB can include this in the email.

The invitation opens ORB’s patient-facing NHS linking page. Logo and welcome text for that page are configured via [Set Organisation Branding](#set-organisation-branding).

The NHS registration link in the email expires after the configured invitation period (**7 days by default**). Sending a replacement registration email generates a new link, invalidates the previous link, and restarts the expiry period. A data-access / consent email uses a login URL without a separate link expiry.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extPatientId      | External patient ID (EHR)      |

### Request Body

```json
{
  "title": "string",
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "string",
  "sex": "string",
  "emailAddress": "string",
  "postcode": "string",
  "requestingClinicianId": "string",
  "resend": boolean
}
```

### Request Body Fields


| Field                 | Type    | Required | Description                                          |
| ----------------------- | --------- | ---------- | ------------------------------------------------------ |
| title                 | string  | Yes      | Patient title                                        |
| firstName             | string  | Yes      | Patient's first name                                 |
| lastName              | string  | Yes      | Patient's last name                                  |
| dateOfBirth           | string  | Yes      | Date of birth in YYYY-MM-DD format                   |
| sex                   | string  | Yes      | Patient sex (e.g., Male, Female)                     |
| emailAddress          | string  | Yes      | Patient email address                                |
| postcode              | string  | Yes      | Patient postcode                                     |
| requestingClinicianId | string  | Yes      | External user ID of the requesting clinician.        |
| resend                | boolean | No       | True to force resend of the email if already invited |

### Responses


| Status | Meaning                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------- |
| 200    | Invite path — `connectionStatus` is **InviteSent** (invitation email sent, or already invited and invite flow still applies) |
| 201    | Patient is **Connected** (NHS registration complete; a data-access request email may be sent when applicable) |
| 400    | Connection failed due to invalid request or validation error |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | Organisation or requesting clinician not found                                                        |
| 409 | Conflict — external patient ID already in use by another patient, or request body DOB/surname does not match existing ORB patient record (`PatientDetailsMismatch` when email already exists with different demographics). Distinct from 422 (NHS→ORB mismatch, see below). |
| 422    | Returned when the patient's connection status is **DataMismatch** (NHS login revealed a mismatch between ORB and NHS data). Response body includes `connectionStatus` **DataMismatch** with `dobMismatch`/`surnameMismatch`. Distinct from 409 (request body does not match ORB, or external patient ID already in use). |
| 429 | Rate limit exceeded: the maximum number of connection emails allowed per patient per organisation in 24 hours has been reached (`ResendLimitExceeded`) |

Note: HTTP status mapping for **InviteSent** differs from Connect Patient by Link (email returns **200** for InviteSent; link returns **201**). Treat the Responses tables for each endpoint as authoritative.

### Response Body (200 / 201)

On success, the response body returns the current connection and data access status:

```json
{
  "connectionStatus": "string",
  "dobMismatch": false,
  "surnameMismatch": false,
  "patientDataAccessLimited": false,
  "gpDataAccessLimited": false,
  "dataAccessStatus": "string",
  "oldestNhsRecordDate": "string",
  "lastInvitationEmailDate": "string",
  "lastAccessRequestEmailDate": "string"
}
```

### Response Body Fields (200 / 201)


| Field                      | Type    | Description                                                                                    |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| connectionStatus           | string  | Connection status (InviteNotSent, InviteSent, InviteExpired, DataMismatch, Connected)          |
| dobMismatch                | boolean | When connectionStatus is DataMismatch: true if date of birth mismatch detected (optional)      |
| surnameMismatch            | boolean | When connectionStatus is DataMismatch: true if surname mismatch detected (optional)            |
| patientDataAccessLimited  | boolean | When applicable: true if the patient has restricted their data partially or totally (optional)      |
| gpDataAccessLimited        | boolean | When applicable: true if the GP has blocked the patient's data partially or totally (optional) |
| dataAccessStatus           | string  | Data access request status (RequestNotSent, RequestSent, Reviewed) (optional)                   |
| oldestNhsRecordDate        | string  | Date of oldest NHS record received (ISO-8601); null if none or not determined (optional)       |
| lastInvitationEmailDate    | string  | ISO-8601 date of the last NHS registration invitation email sent (optional)                    |
| lastAccessRequestEmailDate | string  | ISO-8601 date of the last data access request email sent (optional)                            |

### Error Response Body (422)

When a validation error occurs (422 status), the response body looks the same as the success response, with `connectionStatus` **DataMismatch** and `dobMismatch` / `surnameMismatch` indicating which validation failed:

```json
{
  "connectionStatus": "DataMismatch",
  "dobMismatch": true,
  "surnameMismatch": false,
  "patientDataAccessLimited": false,
  "gpDataAccessLimited": false,
  "dataAccessStatus": "string",
  "oldestNhsRecordDate": "string",
  "lastInvitationEmailDate": "string",
  "lastAccessRequestEmailDate": "string"
}
```

### Error Response Body Fields (422)


| Field                      | Type    | Description                                                    |
| ---------------------------- | --------- | ---------------------------------------------------------------- |
| connectionStatus           | string  | DataMismatch (validation error)                                |
| dobMismatch                | boolean | true if date of birth mismatch detected                        |
| surnameMismatch            | boolean | true if surname mismatch detected                              |
| patientDataAccessLimited  | boolean | Optional; when applicable, true if patient has restricted their data                           |
| gpDataAccessLimited        | boolean | Optional; when applicable, true if GP has blocked patient data |
| dataAccessStatus           | string  | Optional; RequestNotSent, RequestSent, or Reviewed              |
| oldestNhsRecordDate        | string  | Optional; ISO-8601 date                                        |
| lastInvitationEmailDate    | string  | Optional; ISO-8601 date                                        |
| lastAccessRequestEmailDate | string  | Optional; ISO-8601 date                                        |

In case of any other error, a body with a single `errorMessage` property is returned, describing the error in a human-readable format.

---

## Connect Patient by Link

`POST /organisations/{extOrganisationId}/patients/{extPatientId}/connection-link`

Returns an invitation link, which can be sent to a patient as part of a link request.

- If the patient does not exist, ORB creates a new patient record, a NHS invitation link is built and returned.
- If the patient exists but is not connected, a NHS invitation link is built and returned.
  In this case, ORB ensures the patient email, date of birth and surname matches the ones in the request.
  Remaining fields are updated in ORB, using the data passed in the request.
- If the patient is already connected, it is indicated with response code 201 and no link for NHS invitation is returned.

In all previous cases, if a data access request link can still be issued under the rate limits, a data access request link is built and returned too.

Calling this endpoint again allows the EHR to obtain a fresh link to send as a **reminder** to the patient. Invitation and data access request links are only returned while the respective limits in the last 24 hours for this patient and organisation have not been exceeded (see **Rate limits** in the Patients section above).

The returned invitation link opens ORB’s patient-facing NHS linking page. Logo and welcome text for that page are configured via [Set Organisation Branding](#set-organisation-branding).

An NHS registration link expires after the configured invitation period (**7 days by default**). Generating a replacement invalidates the previous registration link and restarts the expiry period. A returned data-access / consent link opens the ORB login page and does **not** expire after a fixed number of days (it is not a timed invitation token); the patient must sign in before reviewing access.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extPatientId      | External patient ID (EHR)      |

### Request Body

```json
{
  "title": "string",
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "string",
  "sex": "string",
  "emailAddress": "string",
  "postcode": "string",
  "requestingClinicianId": "string",
  "resend": boolean
}
```

### Request Body Fields


| Field                 | Type   | Required | Description                                  |
| ----------------------- | -------- | ---------- | ---------------------------------------------- |
| title                 | string | Yes      | Patient title                                |
| firstName             | string | Yes      | Patient's first name                         |
| lastName              | string | Yes      | Patient's last name                          |
| dateOfBirth           | string | Yes      | Date of birth in YYYY-MM-DD format           |
| sex                   | string | Yes      | Patient sex (e.g. Male, Female)              |
| emailAddress          | string | Yes      | Patient email address                        |
| postcode              | string | Yes      | Patient postcode                             |
| requestingClinicianId | string | Yes      | External user ID of the requesting clinician |

### Response Body

```json
{
  "invitationLink": "string",
  "dataAccessRequestLink": "string",
  "connectionStatus": "string",
  "dobMismatch": false,
  "surnameMismatch": false,
  "patientDataAccessLimited": false,
  "gpDataAccessLimited": false,
  "dataAccessStatus": "string",
  "oldestNhsRecordDate": "string",
  "lastInvitationEmailDate": "string",
  "lastAccessRequestEmailDate": "string"
}
```

### Response Body Fields


| Field                      | Type    | Description                                                                                    |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| invitationLink             | string  | URL to the patient invitation that can be shared or displayed                                  |
| dataAccessRequestLink      | string  | URL for the patient to grant data access to the organisation                                   |
| connectionStatus           | string  | Connection status (InviteNotSent, InviteSent, InviteExpired, DataMismatch, Connected)          |
| dobMismatch                | boolean | When connectionStatus is DataMismatch: true if date of birth mismatch detected (optional)      |
| surnameMismatch            | boolean | When connectionStatus is DataMismatch: true if surname mismatch detected (optional)            |
| patientDataAccessLimited  | boolean | When applicable: true if the patient has restricted their data partially or totally (optional)      |
| gpDataAccessLimited        | boolean | When applicable: true if the GP has blocked the patient's data partially or totally (optional) |
| dataAccessStatus           | string  | Data access request status (RequestNotSent, RequestSent, Reviewed) (optional)                   |
| oldestNhsRecordDate        | string  | Date of oldest NHS record received (ISO-8601); null if none or not determined (optional)       |
| lastInvitationEmailDate    | string  | ISO-8601 date of the last NHS registration invitation email sent (optional)                    |
| lastAccessRequestEmailDate | string  | ISO-8601 date of the last data access request email sent (optional)                            |

### Responses


| Status | Meaning                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| 200    | `connectionStatus` is **InviteNotSent** or **InviteExpired** — NHS invitation and/or data-access links returned when applicable |
| 201    | `connectionStatus` is **InviteSent** or **Connected** — no new invite link unless `resend` is true; data-access link returned when applicable |
| 400    | Connection failed due to invalid request or validation error |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | Organisation or requesting clinician not found                                                                     |
| 409 | Conflict — external patient ID already in use by another patient, or request body DOB/surname does not match existing ORB patient record (`PatientDetailsMismatch` when email already exists with different demographics). Distinct from 422 (NHS→ORB mismatch, see below). |
| 422    | Returned when the patient's connection status is **DataMismatch** (NHS login revealed a mismatch between ORB and NHS data). Response body includes `connectionStatus` **DataMismatch** with `dobMismatch`/`surnameMismatch`. Distinct from 409 (request body does not match ORB, or external patient ID already in use). |
| 429  | Rate limit exceeded: the maximum number of connection links allowed per patient per organisation in 24 hours has been reached (`ResendLimitExceeded`) |

### Error Response Body (422)

When a validation error occurs (422 status), the response body looks the same as the success response, with `connectionStatus` **DataMismatch** and `dobMismatch` / `surnameMismatch` indicating which validation failed:

```json
{
  "invitationLink": "string",
  "dataAccessRequestLink": "string",
  "connectionStatus": "DataMismatch",
  "dobMismatch": true,
  "surnameMismatch": false,
  "patientDataAccessLimited": false,
  "gpDataAccessLimited": false,
  "dataAccessStatus": "string",
  "oldestNhsRecordDate": "string",
  "lastInvitationEmailDate": "string",
  "lastAccessRequestEmailDate": "string"
}
```

### Error Response Body Fields (422)


| Field                      | Type    | Description                                                    |
| ---------------------------- | --------- | ---------------------------------------------------------------- |
| invitationLink             | string  | May be null or empty                                           |
| dataAccessRequestLink      | string  | May be null or empty                                           |
| connectionStatus           | string  | DataMismatch (validation error)                                |
| dobMismatch                | boolean | true if date of birth mismatch detected                        |
| surnameMismatch            | boolean | true if surname mismatch detected                              |
| patientDataAccessLimited  | boolean | Optional; when applicable, true if patient has restricted their data                             |
| gpDataAccessLimited        | boolean | Optional; when applicable, true if GP has blocked patient data |
| dataAccessStatus           | string  | Optional; RequestNotSent, RequestSent, or Reviewed              |
| oldestNhsRecordDate        | string  | Optional; ISO-8601 date                                        |
| lastInvitationEmailDate    | string  | Optional; ISO-8601 date                                        |
| lastAccessRequestEmailDate | string  | Optional; ISO-8601 date                                        |

In case of any other error, a body with a single `errorMessage` property is returned, describing the error in a human-readable format.

---

## Get Patient Connection Status

`GET /organisations/{extOrganisationId}/patients/{extPatientId}/connection`

Returns the connection status and access levels for the patient. The response body uses the shape below.

The response may include **`nhsNumber`**: the patient's NHS number from ORB's NHS Login record (verified via NHS Login). This field is **read-only** for the EHR — it is not supplied on connect or update requests. `nhsNumber` is **omitted or null** when the patient has no NHS Login on record. The same read-only field (and an optional `nhsNumber` query filter) is also available on [List Patients](#list-patients).

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extPatientId      | External patient ID (EHR)      |

### Response Body

```json
{
  "connectionStatus": "string",
  "dobMismatch": boolean,
  "surnameMismatch": boolean,
  "patientDataAccessLimited": boolean,
  "gpDataAccessLimited": boolean,
  "dataAccessStatus": "string",
  "nhsNumber": "string",
  "oldestNhsRecordDate": "string",
  "lastInvitationEmailDate": "string",
  "lastAccessRequestEmailDate": "string"
}
```

When `connectionStatus` is **DataMismatch**, `dobMismatch` and `surnameMismatch` indicate which validation failed.

### Response Body Fields


| Field                      | Type    | Description                                                                                    |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| connectionStatus           | string  | Connection status (see Possible Status Values below)                                                 |
| dobMismatch                | boolean | When connectionStatus is DataMismatch: true if date of birth mismatch detected (optional)      |
| surnameMismatch            | boolean | When connectionStatus is DataMismatch: true if surname mismatch detected (optional)                   |
| patientDataAccessLimited  | boolean | When applicable: true if the patient has restricted their data partially or totally (optional)      |
| gpDataAccessLimited        | boolean | When applicable: true if the GP has blocked the patient's data partially or totally (optional) |
| dataAccessStatus           | string  | Data access request status (RequestNotSent, RequestSent, Reviewed) (optional)                          |
| nhsNumber                  | string  | NHS number from NHS Login in ORB (read-only; optional; omitted or null if not on record)       |
| oldestNhsRecordDate        | string  | Date of oldest NHS record received (ISO-8601); null if none or not determined (optional)       |
| lastInvitationEmailDate    | string  | ISO-8601 date of the last NHS registration invitation email sent (optional)                    |
| lastAccessRequestEmailDate | string  | ISO-8601 date of the last data access request email sent (optional)                            |

### Possible Status Values (connectionStatus)


| Status        | Description                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------- |
| InviteNotSent | Invitation for the patient to log in using NHS credentials is not sent yet                    |
| InviteSent    | Invite has been sent to the patient                                                           |
| InviteExpired | Invitation has been sent but expired                                                          |
| DataMismatch  | Validation error (date of birth and/or surname mismatch); see dobMismatch and surnameMismatch |
| Connected     | Patient is connected to the organisation                                                      |

### Responses


| Status | Meaning                           |
| -------- | ----------------------------------- |
| 200    | OK                                |
| 400 | Bad request |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | Patient or organisation not found |

---

## Get Granted Permissions

`GET /organisations/{extOrganisationId}/patients/{extPatientId}/permissions`

Returns the list of data permissions that the patient has granted to this organisation. This endpoint requires that the patient is connected to the organisation (see Get Patient Connection Status).

**Connection Status Requirements:**

- If the patient connection status is `Connected`, this endpoint returns the granted permissions
- If the connection status is `InviteSent` or `DataMismatch`, this endpoint returns `404 Not Found` (no connection established yet)

This can be used by the EHR to determine what data will be available before requesting an access token, or to display permission status to clinicians.

**Note:** Issuing an access token checks that the patient is **Connected** and that organisation/patient data access is not limited. It does **not** check individual dataset grants (for example Allergies or Documents); those are enforced inside the widget when NHS record data is fetched. This permissions endpoint is informational for the EHR.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extPatientId      | External patient ID (EHR)      |

### Response Body

```json
[
  "Allergies",
  "Medication History",
  "Immunisations",
  "Problems",
  "Documents",
  "Consultation History",
  "TestResults"
]
```

### Response Body Fields


| Field | Type            | Description                                      |
| ------- | ----------------- | -------------------------------------------------- |
| [ ]   | array of string | Array of permission names granted to the patient |

### Possible Permission Values

- Allergies
- Medication History
- Immunisations
- Problems
- TestResults
- Documents
- Consultation History

### Responses


| Status | Meaning                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------- |
| 200    | OK - Returns array of permissions                                                                   |
| 400 | Bad request |
| 403    | Organisation not authorised to view this patient                                                    |
| 404    | Patient or organisation not found, or patient connection not established (InviteSent, DataMismatch) |

---

## Remove Patient Connection

`DELETE /organisations/{extOrganisationId}/patients/{extPatientId}/connection`

Removes the link between the patient and the organisation. Use this when a patient leaves a clinic; doing so is treated as an implied retraction of the organisation’s permission to view that patient’s records. Whether to call this API is for the EHR or organisation to decide.

**Behaviour:** This is an **unlink** only for the organisation in the request:

- The EHR connection for this organisation is removed, so the patient no longer appears in List Patients for that organisation, and token/connection/status/permissions calls for this patient and organisation fail.
- The patient-to-organisation link for that organisation is also removed, so the patient can no longer access that organisation.
- The underlying patient account, PatientLogin, and NHS record data are **retained**. Other organisation links for the same patient are untouched.
- If the patient still has one or more other organisations, they can continue to log in and use those organisations.
- If this was the patient’s **last** organisation, they cannot log in until they are linked to at least one organisation again. The patient account and any completed NHS registration are kept (not deleted).
- If the same patient is connected again later, ORB treats them as an **existing patient** (matched by email, with DOB/surname validation). If the patient **already has NHS login**, re-connect returns a data-access / data-share link rather than a new NHS invitation. If NHS registration was never completed, reconnect follows the normal invitation flow.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extPatientId      | External patient ID (EHR)      |

### Responses


| Status | Meaning                           |
| -------- | ----------------------------------- |
| 200    | Connection removed                |
| 400 | Deletion failed due to invalid request or validation error |
| 403    | Organisation contract not signed (`OrganisationContractNotSigned`), or EHR API disabled (`ApiDisabled`) |
| 404    | Patient or organisation not found |
| 500    | Unexpected server error           |

A successful response (200) returns no response body.

---

# Patient Access

The Patient Access API enables secure viewing of NHS patient records within an EHR system via an embedded iFrame widget. Issuing a patient access token requires the [organisation contract](#organisation-contract-clinic) to be signed (`403` **OrganisationContractNotSigned** otherwise). The security model ensures that:

1. **Server-side token generation**: Tokens are only issued to authenticated EHR backend systems, never directly to browsers
2. **User identification**: Each token request identifies the specific clinician requesting access
3. **Authorisation checks**: ORB validates that the user, organisation, and patient relationships are valid and authorised
4. **Short-lived tokens**: Tokens expire in 15 minutes to limit exposure
5. **Scoped access**: Tokens are bound to specific user-patient-organisation combinations
6. **Audit trail**: All token requests are logged for compliance and security monitoring

**Typical Flow:**

1. Clinician clicks "View NHS Records" button in EHR patient record page
2. EHR backend makes server-side API call to request access token (including clinician's extUserId)
3. ORB validates authorisation and returns JWT token
4. EHR backend passes token to frontend JavaScript widget
5. Widget loads in iframe and authenticates using the token
6. If the clinician has not yet accepted Terms and Conditions (T&C) for this organisation, the widget shows the T&C screen; after acceptance, NHS data can be viewed
7. Widget displays patient data. Token expires after 15 minutes, requiring a new access-token request for continued access

**Widget Integration:**

Embedding uses **`orb-widget.js`** (same script as the organisation-contract screen; different URL + token). Token handling and kickoff examples are in the [ORB Widget Integration Guide](../widget-integration.md). Pass the token via `postMessage` (recommended). Do not call `/access-token` from the browser.

Clinician acceptance of the widget Terms and Conditions is required before NHS data is displayed. See [Terms and Conditions](#terms-and-conditions).

**Important Security Considerations:**

- Tokens must never be logged, stored in browser storage, or exposed in URLs visible to users
- The EHR backend should validate that the requesting user has permission to view the patient before requesting a token
- If a token expires while a user is viewing data, the widget will handle re-authentication automatically
- Suspended organisations (and therefore suspended users) cannot request access tokens

## Request Access Token

`POST /organisations/{extOrganisationId}/patients/{extPatientId}/access-token`

Returns a short‑lived JWT used to access patient data via the ORB widget (iframe).

**Security Model:**

- The EHR must make this request server-side (never from the browser) when a clinician clicks to view patient data
- The request must include the `extUserId` of the clinician requesting access
- ORB validates that:
  - The user exists and belongs to the specified organisation
  - The user has **`isClinician: true`** (non-clinical users cannot request access tokens)
  - The organisation is not suspended
  - The organisation has access to the patient
  - The patient is **Connected** and organisation/patient data access is not limited
- The returned JWT token is scoped to the specific user, patient, and organisation
- The token has a short expiration time (15 minutes) to limit exposure if intercepted
- The token should be passed to the widget immediately and not stored or logged

Issuing an access token does **not** mean the clinician has accepted widget T&C. Token issuance only establishes that the EHR backend is allowed to open the widget for that user, patient, and organisation. T&C are enforced when the widget loads and before NHS data is returned from widget APIs — see [Terms and Conditions](#terms-and-conditions).

Requesting an access token is recorded as clinician access to that patient for the organisation. ORB uses this (together with patient access) for data access review and retention policies.

### Path Parameters


| Name              | Description                    |
| ------------------- | -------------------------------- |
| extOrganisationId | External organisation ID (EHR) |
| extPatientId      | External patient ID (EHR)      |

### Request Body

```json
{
  "extUserId": "string"
}
```

### Request Body Fields


| Field     | Type   | Required | Description                                   |
| ----------- | -------- | ---------- | ----------------------------------------------- |
| extUserId | string | Yes      | External user ID (EHR) of the requesting user |

### Response Body

```json
{
  "accessToken": "string",
  "expiresIn": 900
}
```

### Response Body Fields


| Field       | Type   | Description                                                                     |
| ------------- | -------- | --------------------------------------------------------------------------------- |
| accessToken | string | Short-lived JWT token for accessing patient data (expires in expiresIn seconds) |
| expiresIn   | number | Token expiration time in seconds (typically 900 = 15 minutes)                   |

### JWT Token Claims

The JWT token contains the following claims:

- `clientScopeId` - Internal API-key client identifier
- `extOrganisationId` - The organisation ID
- `extUserId` - The clinician user ID who requested access
- `extPatientId` - The patient ID
- `iat` - Issued at timestamp
- `exp` - Expiration timestamp
- `aud` - Audience (e.g., "orb-widget")
- `iss` - Issuer (e.g., "orb-api")

### Responses


| Status | Meaning                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------- |
| 200    | Token issued successfully                                                                        |
| 400    | Invalid request (missing extUserId)                                                              |
| 403    | Access denied — `NonClinicianAccess` (`isClinician: false`); `OrgIsSuspended`; `PatientInvalidStatus` (patient not Connected, or patient/GP data access limited); `OrganisationContractNotSigned`; or `ApiDisabled` / `ApiKeyExpired` |
| 404    | Patient, user, or organisation not found                                                         |
| 500    | Internal server error (see Common Errors)                                                        |

---

# Terms and Conditions

ORB requires agreement acceptance in more than one place. This section describes those agreements. They are separate processes and must not be confused.

| Agreement | Who accepts |
| ----------- | ------------- |
| [Clinician widget T&C](#clinician-terms-and-conditions-widget) | Each clinician user, per organisation |
| [Organisation contract (clinic)](#organisation-contract-clinic) | Authorised organisation representative (host-controlled) |

## Clinician Terms and Conditions (widget)

Before NHS patient data is shown in the embedded widget, each **clinician user** must accept ORB Clinician Terms and Conditions (**T&C**) for the **organisation** they are acting in.

This is the **clinician widget T&C** only (tick-box acceptance inside the **same** clinician patient-records widget iframe used for NHS data). It is **not** the organisation-level clinic contract, and it does **not** require a separate iframe.

### Agreement type and scope

| Item | Behaviour |
| -------- | ------------ |
| Mechanism | Simplified tick-box (checkbox) acceptance inside the ORB-hosted widget UI |
| Scope | Acceptance is recorded **per clinician user per organisation** |
| Multi-org clinicians | If the same clinician works in multiple organisations in the EHR, they must accept T&C **separately for each** ORB organisation |
| T&C content | System-defined wording hosted on ORB as an editable Static Page, so ORB can update the text without an EHR release |
| Patients | Clinician widget T&C does **not** apply to patients |

### Trigger and mandatory acceptance

- The agreement is presented when the clinician first opens / uses the widget for that organisation (after a valid access token has been passed into the iframe).
- Acceptance is **mandatory**: the clinician cannot reject the terms and continue. NHS record data and related widget data APIs remain blocked until acceptance is completed.
- **Re-acceptance:** once accepted for a given user–organisation pair, the clinician is **not** required to re-accept T&Cs for the same organisation.

### What ORB records

On acceptance, ORB records that the clinician approved the T&Cs for that user–organisation pair (including when it was accepted), for audit and compliance. Until acceptance is completed, the widget shows the T&C screen and widget data requests return `403` with `errorCode` **TermsNotAccepted**.

### Hosting and context

- The clinician T&C screen is shown **inside the same clinician patient-records widget iframe** already used for NHS data (the host does not implement a separate T&C iframe or External API accept/query endpoints).
- T&C wording is **hosted by ORB** and rendered in that iframe.
- Clinician and organisation context for acceptance comes from the **patient access token** already passed into the widget (scoped user, organisation, patient).
- A PDF of the current T&C wording can be downloaded from within the widget session.

### Enforcement vs access token

| Step | Clinician T&C status |
| -------- | ------------ |
| EHR calls `POST .../access-token` | Clinician T&C **not** checked (organisation contract **is** required — see [Organisation contract](#organisation-contract-clinic)) |
| Widget loads and clinician uses medical-record views | Clinician T&C **enforced**; UI shows T&C screen if not yet accepted; data APIs blocked until accept |

**EHR integrators:** No extra integration is required for clinician T&C beyond embedding the existing patient-records widget and passing the access token. Acceptance and enforcement are handled **inside that widget**. The **ORB External API** does not expose endpoints to accept clinician T&C or to query acceptance status. See also the [ORB Widget Integration Guide](../widget-integration.md).

## Organisation contract (clinic)

Each EHR organisation must complete a separate **organisation-level** ORB contract signing flow before clinicians can access patient NHS data and before most External API operations for that organisation are available.

This uses a **different ORB page / iframe URL** from the clinician NHS-records screen, but the **same** embed script (`orb-widget.js` / `openOrbWidget`). Only the path (`/medical-record-embedded/organisation-contract/sign`) and token (`contract-access-token`) change. Kickoff example: [Widget Integration Guide — Organisation contract signing](../widget-integration.md#organisation-contract-signing).

The signing UI is hosted by ORB. Contract content, signing logic, audit logging, PDF generation, and download links are handled on the ORB side.

The host controls **when** and **for which organisation** the contract iframe is shown, and **which user** sees the launch button.

- The host should show the contract flow only to the intended authorised organisation representative.
- Name and email submitted in the iframe are recorded as supplied (they may be pre-filled via `SET_SIGNATORY` and edited by the signatory).

Until the organisation contract is signed:

- **Clinician access to patient NHS data is blocked** (`POST .../access-token` and widget patient-data use return **403** **OrganisationContractNotSigned**).
- **Most External API operations are blocked** (Users, Patients, branding, update/delete organisation, and related calls). Only organisation create/get/list and the contract-status / contract-access-token helpers below are available for onboarding.

### Scope

| Item | Behaviour |
| -------- | ------------ |
| Scope | Acceptance is recorded **per organisation** |
| Multi-org users | If the same person is linked to multiple organisations, each organisation must sign separately |
| Content | Contract wording is hosted by ORB and shown inside the contract iframe |
| Re-signing | One signature per organisation; once signed, `contract-status` reports `contractSigned: true`. A further accept attempt inside the contract iframe returns **409** (`OrganisationContractAlreadySigned`) |

### Host flow (summary)

1. Create the organisation (`POST /organisations/{extOrganisationId}`) if it does not exist yet.
2. Optionally poll `GET /organisations/{extOrganisationId}/contract-status`.
3. When ready, call `POST /organisations/{extOrganisationId}/contract-access-token` to generate a contract iframe token.
4. Open the ORB contract page with **`orb-widget.js`** (same helper as NHS records) at path `/medical-record-embedded/organisation-contract/sign`, and pass the token via `postMessage` `SET_TOKEN`. Optionally send `SET_SIGNATORY` with `{ first_name, last_name, email }` to pre-fill the form.
5. Signatory reviews the contract, enters full name and email, ticks acceptance, and submits **inside the iframe**. The host does **not** call a separate External API endpoint to record the signature — ORB handles acceptance within the contract iframe.
6. On success, the iframe posts `CONTRACT_SIGNED` with `{ signedContractUrl }`, shows confirmation, and a **Download Signed Contract** button (opens the signed PDF via a login-free shared link). A signed PDF is also emailed to the address submitted.
7. Host may poll contract-status again or listen for `CONTRACT_SIGNED` / `orb-widget-contract-signed`.

Details of embedding and `postMessage` (including a kickoff code sample) are in the [ORB Widget Integration Guide](../widget-integration.md#organisation-contract-signing).

### After signing

ORB records the signatory name and email, signing time, and a downloadable signed PDF **stored by ORB** (also emailed to the signatory). Download from the confirmation screen uses a login-free link.

### Allowed before the contract is signed

Until the contract is signed, these are the only organisation/contract onboarding operations available. All other External API and clinician patient-data access remains blocked (see below).

| Method | Path | Notes |
| -------- | ------ | ------- |
| POST | `/organisations/{extOrganisationId}` | Create organisation (onboarding) |
| GET | `/organisations` | List organisations |
| GET | `/organisations/{extOrganisationId}` | Get organisation |
| GET | `/organisations/{extOrganisationId}/contract-status` | Poll signing status |
| POST | `/organisations/{extOrganisationId}/contract-access-token` | Generate contract iframe token |

### Blocked until the contract is signed

Until `contractSigned` is true, protected External API and widget operations for that organisation return **403** with `errorCode` **OrganisationContractNotSigned** (see [Common Errors](#common-errors)). This includes **all clinician access to patient NHS data** via access token / widget.

| Method | Path |
| -------- | ------ |
| PATCH | `/organisations/{extOrganisationId}` |
| DELETE | `/organisations/{extOrganisationId}` |
| POST | `/organisations/{extOrganisationId}/branding` |
| GET | `/organisations/{extOrganisationId}/users` |
| POST | `/organisations/{extOrganisationId}/users/{extUserId}` |
| PATCH | `/organisations/{extOrganisationId}/users/{extUserId}` |
| DELETE | `/organisations/{extOrganisationId}/users/{extUserId}` |
| GET | `/organisations/{extOrganisationId}/patients` |
| PATCH | `/organisations/{extOrganisationId}/patients/{extPatientId}` |
| POST | `/organisations/{extOrganisationId}/patients/{extPatientId}/connection-email` |
| POST | `/organisations/{extOrganisationId}/patients/{extPatientId}/connection-link` |
| GET | `/organisations/{extOrganisationId}/patients/{extPatientId}/connection` |
| DELETE | `/organisations/{extOrganisationId}/patients/{extPatientId}/connection` |
| GET | `/organisations/{extOrganisationId}/patients/{extPatientId}/permissions` |
| POST | `/organisations/{extOrganisationId}/patients/{extPatientId}/access-token` |
| — | Widget NHS patient-data APIs (after a patient access token is used in the iframe) |

There is no separate External API “create patient” endpoint; patient onboarding uses the connection and related patient endpoints above, which are blocked until the contract is signed.

---

# Support and API access

- **API keys and base URLs:** Provided when your integration is onboarded. Use the appropriate base URL for your environment (UAT, Test, or Production).
- **Technical support and issues:** For integration support, reporting defects, or questions about this API, contact your ORB integration contact or the support channel provided with your API key.
- **Rate limits:** Any rate limits or throttling that apply will be communicated with your API key or in separate operational guidance.

---
