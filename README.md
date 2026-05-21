# ORB API v1

**ORB External API – Integration guide for EHR systems**

Document version: 1.0.1 | Last updated: May 2026 — Users: aligned with OpenAPI (`isLocum`, `authorisedSignatory`).

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
- Users - Clinicians using the EHR
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
- [Conventions](#conventions) — JSON, dates, external IDs, common errors
- [Organisations](#organisations) — Create, Update, Delete, Get status, List
- [Users](#users) — Create, Update, List, Delete
- [Patients](#patients) — List, Update, Connect by Email, Connect by Link, Get connection status, Get granted permissions, Remove connection
- [Patient Access](#patient-access) — Request access token
- [Support and API access](#support-and-api-access) — API keys, support, rate limits

### Matters under discussion

<span style="color: red">**Contract with clinics (EHR/ORB organisations):** ORB is required to have a contract with all clinics (organisations) using the integration. How this will be implemented is under discussion—including contract status (e.g. Active/Suspend), storage of the contract in ORB, and the technical approach (e.g. presentation on screen, capture of signature/date, and possible use of an iFrame and API for document submission and storage). Use of the API may be conditional on this setup being in place; details are still being confirmed.
</span>

---

## Authentication

All API communication must use **HTTPS** (TLS 1.2 or higher recommended). Do not send API keys or patient data over unencrypted connections.

All requests must include the following header:

```
X-API-KEY: <your-api-key>
```

### Base URL

The ORB API is available at the following base URLs:

- **Live/Production**: `https://l2-api.orb.example.com/v1` (placeholder - TBC)
- **TEST/Development**: `https://l2-api-test.orb.example.com/v1` (placeholder - TBC)
- **UAT/Sandbox**: `https://l2-api-uat.orb.example.com/v1` (placeholder - TBC)

Access to base URLs will be provided when your API key is issued.

**Route prefixes (implementation):**

- **Organisation** and **User** endpoints: `v1/organisations/{extOrganisationId}`
- **Patient** endpoints: `v1/organisations/{extOrganisationId}/patients`

For example, to create an organisation in the test environment, you would make a POST request to:

```
https://l2-api-test.orb.example.com/v1/organisations/{extOrganisationId}
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
| 500    | Internal server error - an unexpected error occurred on the server               |
| 503    | Service unavailable - the service is temporarily unavailable, please retry later |

For 503, use exponential backoff when retrying.

For other 4xx and 5xx responses, the body may include a JSON object describing the error.

| Property       | Type    | Description                                                                 |
| ----------------- | --------- | ----------------------------------------------------------------------------- |
| errorMessage    | string  | Human-readable error message. Example: "Organisation not found". |
| errorCode       | string? | Optional. Present when the exception is a known ORB API exception; see values below. |

Example response body:

```json
{
  "errorMessage": "Organisation not found",
  "errorCode": "OrganizationNotFound"
}
```

Possible `errorCode` values:

- **ClientNotFound** - The caller client is not registered in ORB or the corresponding governing body record is missing for some reason. 
  Cannot validate API key nor allow further operations from this caller.
- **OrgNotFound** - There is no existing organisation corresponding to the provided id. 
- **OrgLinkNotFound** - User or patient is not linked to the organization corresponding to the provided id. 
- **UserNotFound** - There is no existing user corresponding to the provided id. 
- **PatientNotFound** -  There is no existing patient corresponding to the provided id. 
- **InvalidProperty** - Some request body field holds an invalid value.
- **InvalidParameter** - Some request parameter holds an invalid value.
- **IdNotAvailable** - The id provided is already in use by another entity of the same type.
  For example, client tried to create a new organization using the same id of an existing one. 
- **NameNotAvailable** - The name provided is already in use by another entity of the same type.
  For example, client tried to create a new organization using the same name of an existing one. 
- **EmailNotAvailable** - The email provided is already in use by another entity of the same type.
  For example, client tried to create a new user using the same email of an existing one. 
- **DobMismatch** - There is a DOB mismatch between the patient data in the request and the data of the corresponding patient in ORB.
- **SurnameMismatch** - There is a surname mismatch between the patient data in the request and the data of the corresponding patient in ORB.
- **PatientInvalidStatus** - The operation requested cannot be performed given the current status of the patient. 
- **ResendLimitExceeded** - The client has exceeded the maximum number of requests allowed in a given period of time.
- **GenericError** - The current error does not contain relevant information for the client.
  Often, this is just an internal logic error of the server, and does not require actions on the client side.  

For unexpected or non-API exceptions, `errorCode` may be omitted. 
Clients can use `errorMessage` for display and optionally use `errorCode` for programmatic handling.

---

# Organisations

## Create Organisation

`POST /organisations/{extOrganisationId}`

Creates an Organisation in ORB under the GovBody associated with the API Key.
At creation time, the EHR must also provide details of the authorised user responsible for contract signing.

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
| 409    | Organisation already exists with the same extOrganisationId or organisationName |

---

## Update Organisation

`PATCH /organisations/{extOrganisationId}`

Updates organisation details or suspends / unsuspends the organisation.
Authorised signatory details can also be updated.

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
| 404    | Organisation corresponding to given id or Governing Body corresponding to given API key not found |
| 409    | Organisation Name already exists                         |

---

## Delete Organisation

`DELETE /organisations/{extOrganisationId}`

Delete the organisation and all associated users. This should be used if an organisation asks to
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
| 400 | Deletion failed due to invalid request or validation error |
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

# Users

Users represent Clinicians who are granted access via the integration, these Users do not have general login access to the ORB UI.  This is intended for Clinical Users only, there is no requirement for administrative users to be created.

Each user record includes **`isLocum`** (permanent employee vs temporary locum) and **`authorisedSignatory`** (authorised signatory for the organisational contract). Both are required when creating a user; either may be supplied on update.

---

## Create User

`POST /organisations/{extOrganisationId}/users/{extUserId}`

Creates an ORB user within an ORB organisation, linked to the corresponding external User ID.

This is used to grant a user access to the integration.  User is assumed to be a Clinician – there is no support for Admin / Non-Clinical users.

- For Users we assume the external IDs are unique within an Organisation, and do not change.
- We do not attempt to link or merge users – nor do we identify duplicates based on personal attributes (e.g. FirstName, LastName, ProfessionalRegNumber).
- If the same clinician exists in multiple organisations in the EHR, a separate ORB user must be created for each organisation, even if in EHR they are shared.

The number of Users in existence during a month may be used in billing.   The system logs user creation and deletion and this log is available for billing.

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
| isLocum               | boolean | Yes      | `true` if the user is a temporary locum; `false` if a permanent employee      |
| authorisedSignatory   | boolean | Yes      | `true` if this user is an authorised signatory for the organisational contract |


### Responses


| Status | Meaning                         |
| -------- | --------------------------------- |
| 201    | User created                    |
| 400    | Creation failed due to invalid request or validation error |
| 404    | Organisation not found          |
| 409    | User already exists in this organisation with the same extUserId |

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
| isLocum               | boolean | No       | If supplied, updates whether the user is a locum (`true`) or permanent (`false`) |
| authorisedSignatory   | boolean | No       | If supplied, updates authorised signatory flag for the organisational contract   |

### Responses


| Status | Meaning                             |
| -------- | ------------------------------------- |
| 200    | User updated                        |
| 400    | Invalid request or validation error |
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
| 404    | User or organisation not found |

A successful response (200) returns no response body.

---

# Patients

Patients are linked to organisations via a **connection** resource. ORB registers a couple of statuses and some flags for each patient, to be able to provide relevant information about the patient connection process to the external client:

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
   - This email can be sent once a day, to avoid spamming the patient with too many of these emails.
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
   - This email can be sent once a day, to avoid spamming the patient with too many of these emails.
   - If patient allows any access to their data, patient data access request status is changed to **Reviewed**.
   
   Note that patient can allow data access partially, and their data can still be blocked from GP.

**Rate limits (emails and links)**

- **Data access request:** At most one data access request email (or link) per patient per organisation per 24 hours. If the EHR calls again within that period, no new data access email is sent and no data access link is returned.
- **NHS invitation:** At most one NHS invitation email (or link) per patient per organisation per 24 hours. If the EHR calls again within that period, no new invitation email is sent and no invitation link is returned.

**Guidance for EHR implementers (data access)**

Use the following when building your integration:

- **If the patient has not granted access** (`dataAccessStatus` is not **Reviewed**): You can call the Connect Patient by Email or Connect Patient by Link endpoint once per day; ORB will send (or return a link for) a reminder to the patient. See Rate limits above.
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
| 400    | Invalid pagination parameters (limit > 1000, limit < 1, or offset < 0), or invalid filter value for connectionStatus, dataAccessStatus, patientDataAccessLimited, gpDataAccessLimited, dobMismatch, or surnameMismatch, or invalid combination of these parameters (for example, patientDataAccessLimited or gpDataAccessLimited cannot be set if connectionStatus is not Connected) |
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

### Responses


| Status | Meaning                                             |
| -------- | ----------------------------------------------------- |
| 200    | Patient updated                                     |
| 400    | Update failed due to invalid request or validation error |
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
- If the patient is already connected, it sends a data access request email for the patient to grant organisation access to their NHS (unless access is already granted, or the last data access email was sent less than one day ago).

The EHR may call this endpoint again to send a **reminder** (e.g. if the patient has not yet completed NHS login or granted access). Whether an email is sent is subject to the rate limits in the Patients section above: invitation can be resent when `resend` is true; data access request is sent at most once per patient per organisation per day.

This includes the ID of the requesting Clinician User, so ORB can include this in the email.

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
| 200    | Invite sent                                                                                           |
| 201    | Patient already invited. No invite sent unless `resend` flag is true, but data access request is sent, when applies |
| 400    | Connection failed due to invalid request or validation error |
| 404    | Organisation or requesting clinician not found                                                        |
| 409 | Conflict — external patient ID already in use by another patient, or request body DOB/surname does not match existing ORB patient record (ORB vs request mismatch). Distinct from 422 (NHS→ORB mismatch, see below). |
| 422    | Returned when the patient's connection status is **DataMismatch** (NHS login revealed a mismatch between ORB and NHS data). Response body includes `connectionStatus` **DataMismatch** with `dobMismatch`/`surnameMismatch`. Distinct from 409 (request body does not match ORB, or external patient ID already in use). |
| 429 | The last successful connection request was less than 24 hours ago. |

<span style="color: red">**Under discussion:** Use of 200 vs 201 for these responses is under review (e.g. consistently returning 200 with the response body indicating whether an email was sent or the patient was created, and reserving 201 for the case where the patient resource was created).</span>

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

In all previous cases, if data access request is not sent, or was sent more than one day ago, a data access request link is built and returned too.

Calling this endpoint again allows the EHR to obtain a fresh link to send as a **reminder** to the patient. The data access request link is only returned when one has not been sent in the last 24 hours for this patient and organisation (see **Rate limits** in the Patients section above).

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
| 200    | Patient was not invited yet, or invitation expired. Link for NHS invitation and data access returned.              |
| 201    | Patient already invited. No invite link returned unless `resend` flag is true, but data access request link is returned, when applies |
| 400    | Connection failed due to invalid request or validation error |
| 404    | Organisation or requesting clinician not found                                                                     |
| 409 | Conflict — external patient ID already in use by another patient, or request body DOB/surname does not match existing ORB patient record (ORB vs request mismatch). Distinct from 422 (NHS→ORB mismatch, see below). |
| 422    | Returned when the patient's connection status is **DataMismatch** (NHS login revealed a mismatch between ORB and NHS data). Response body includes `connectionStatus` **DataMismatch** with `dobMismatch`/`surnameMismatch`. Distinct from 409 (request body does not match ORB, or external patient ID already in use). |
| 429  | The last successful connection request was less than 24 hours ago.                          |

<span style="color: red">**Under discussion:** Use of 200 vs 201 for these responses is under review (e.g. consistently returning 200 with the response body indicating whether a link was returned or the patient was created, and reserving 201 for the case where the patient resource was created).</span>

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
| 404    | Patient or organisation not found |

---

## Get Granted Permissions

`GET /organisations/{extOrganisationId}/patients/{extPatientId}/permissions`

Returns the list of data permissions that the patient has granted to this organisation. This endpoint requires that the patient is connected to the organisation (see Get Patient Connection Status).

**Connection Status Requirements:**

- If the patient connection status is `Connected`, this endpoint returns the granted permissions
- If the connection status is `InviteSent` or `DataMismatch`, this endpoint returns `404 Not Found` (no connection established yet)

This can be used by the EHR to determine what data will be available before requesting an access token, or to display permission status to clinicians.

**Note:** The access token request endpoint will automatically validate permissions before issuing a token. This endpoint is informational only.

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

**Behaviour:** This is an **unlink** only. The external patient link (connection) for this organisation is deleted, so the EHR can no longer access this patient for this organisation (e.g. the patient will not appear in List Patients, and token/connection requests for this patient will fail). The patient may still exist in ORB (e.g. linked to other organisations). Only the link record is removed, not necessarily the underlying patient record.

<span style="color: red">**Under discussion:** Behaviour when the patient has no organisations left after the unlink (e.g. whether the underlying patient record is deleted or retained) is still under discussion.</span>

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
| 404    | Patient or organisation not found |
| 500    | Unexpected server error           |

A successful response (200) returns no response body.

---

# Patient Access

The Patient Access API enables secure viewing of NHS patient records within an EHR system via an embedded iFrame widget. The security model ensures that:

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
5. Widget loads in iframe, authenticates using the token, and displays patient data
6. Token expires after 15 minutes, requiring new request for continued access

**Widget Integration:**

The ORB widget is a JavaScript component that must be embedded in the EHR's patient record page. The widget URL and integration details are provided separately in the ORB Widget Integration Guide. The token is passed to the widget via a secure method (typically as a URL parameter or via postMessage API).

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
  - The organisation is not suspended
  - The organisation has access to the patient
  - The patient has granted the necessary permissions
- The returned JWT token is scoped to the specific user, patient, and organisation
- The token has a short expiration time (15 minutes) to limit exposure if intercepted
- The token should be passed to the widget immediately and not stored or logged

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
| 403    | Access denied - user not authorised, organisation suspended, or patient permissions insufficient |
| 404    | Patient, user, or organisation not found                                                         |
| 500    | Internal server error (see Common Errors)                                                        |

---

## Support and API access

- **API keys and base URLs:** Provided when your integration is onboarded. Use the appropriate base URL for your environment (UAT, Test, or Production).
- **Technical support and issues:** For integration support, reporting defects, or questions about this API, contact your ORB integration contact or the support channel provided with your API key.
- **Rate limits:** Any rate limits or throttling that apply will be communicated with your API key or in separate operational guidance.

---
