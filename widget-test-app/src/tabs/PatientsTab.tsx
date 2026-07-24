import { useState, useRef, useEffect } from 'react'
import type { OrbApi, PatientItem, ListPatientsQuery } from '../orbApi'
import { usePersistedState } from '../storage'
import { stripEmpty, normalizeDob } from '../helpers'
import { randomPatientData } from '../random'
import { Section, Grid2, Label, Hint, SubTabs, FromServer, MustMatchSurname, MustMatchDob } from '../ui'
import { inputStyle, btnStyle, btnPrimary, btnDanger } from '../styles'

type SexValue = 'Male' | 'Female' | 'NotApplicable'

export function PatientsTab(props: {
  orb: OrbApi
  selectedOrg: string
  selectedUser: string
  selectedPatient: string
  patients: PatientItem[]
  onRefreshPatients: () => void
  onChanged: () => void
}) {
  const [sub, setSub] = usePersistedState<'connect' | 'update' | 'status' | 'list'>('patientSubTab', 'connect')
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<number | null>(null)

  const showFlash = (msg: string) => {
    setFlash(msg)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 4000)
  }

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
  }, [])

  if (!props.selectedOrg) {
    return (
      <div style={{ padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
        Select an organisation in the Context section first.
      </div>
    )
  }

  return (
    <>
      {flash && (
        <div style={{
          padding: '10px 14px', background: '#fff4cc', border: '1px solid #f5c518',
          borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#6b5200'
        }}>
          {flash}
        </div>
      )}

      <SubTabs value={sub} onChange={setSub} tabs={[
        { key: 'connect', label: 'Connect' },
        { key: 'update', label: 'Update' },
        { key: 'status', label: 'Status / Permissions' },
        { key: 'list', label: 'List' }
      ]} />

      {sub === 'connect' && (
        <PatientConnectForm
          orb={props.orb}
          org={props.selectedOrg}
          selectedUser={props.selectedUser}
          selectedPatient={props.selectedPatient}
          showFlash={showFlash}
          onChanged={props.onChanged}
        />
      )}
      {sub === 'update' && (
        <PatientUpdateForm
          orb={props.orb}
          org={props.selectedOrg}
          patients={props.patients}
          selectedPatient={props.selectedPatient}
          onRefresh={props.onRefreshPatients}
          onChanged={props.onChanged}
        />
      )}
      {sub === 'status' && (
        <PatientStatusPanel
          orb={props.orb}
          org={props.selectedOrg}
          selectedPatient={props.selectedPatient}
          showFlash={showFlash}
          onChanged={props.onChanged}
        />
      )}
      {sub === 'list' && (
        <PatientListPanel orb={props.orb} org={props.selectedOrg} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Connect (create + invite)
// ---------------------------------------------------------------------------

function PatientConnectForm(props: {
  orb: OrbApi
  org: string
  selectedUser: string
  selectedPatient: string
  showFlash: (msg: string) => void
  onChanged: () => void
}) {
  const [patId, setPatId] = useState('')
  const [title, setTitle] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [sex, setSex] = useState<SexValue>('Male')
  const [email, setEmail] = useState('')
  const [postcode, setPostcode] = useState('')
  const [resend, setResend] = useState(false)

  const randomize = () => {
    const r = randomPatientData()
    setPatId(r.id); setTitle(r.title)
    setFirstName(r.firstName); setLastName(r.lastName)
    setDob(r.dob); setSex(r.sex === 'Male' ? 'Male' : 'Female')
    setEmail(r.email); setPostcode(r.postcode)
  }

  const clear = () => {
    setPatId(''); setTitle(''); setFirstName(''); setLastName('')
    setDob(''); setSex('Male'); setEmail(''); setPostcode('')
  }

  const body = () => stripEmpty({
    title, firstName, lastName,
    dateOfBirth: normalizeDob(dob), sex,
    emailAddress: email, postcode,
    requestingClinicianId: props.selectedUser,
    ...(resend ? { resend: true } : {}),
  })

  const connectEmail = async () => {
    if (!props.selectedUser) return props.showFlash('Select a user (clinician) in Context first')
    if (!patId) return props.showFlash('Enter a patient ID in the form (or click Randomize)')
    await props.orb.sendConnectionEmail(props.org, patId,
      body() as Parameters<OrbApi['sendConnectionEmail']>[2])
    props.onChanged()
  }

  const connectLink = async () => {
    if (!props.selectedUser) return props.showFlash('Select a user (clinician) in Context first')
    if (!patId) return props.showFlash('Enter a patient ID in the form (or click Randomize)')
    await props.orb.createConnectionLink(props.org, patId,
      body() as Parameters<OrbApi['createConnectionLink']>[2])
    props.onChanged()
  }

  return (
    <Section title="Connect Patient (Email or Link)">
      <Grid2>
        <Label>extOrganisationId</Label>
        <input value={props.org} disabled style={{ ...inputStyle, background: '#f5f5f5' }} />
        <Label>extPatientId</Label>
        <input value={patId} onChange={e => setPatId(e.target.value)} style={inputStyle}
          placeholder={props.selectedPatient ? `(selected: ${props.selectedPatient})` : 'e.g. PAT-001'} />
        <Label>Requesting clinicianId</Label>
        <input value={props.selectedUser} disabled style={{ ...inputStyle, background: '#f5f5f5' }} placeholder="select a User in Context" />
        <Label>Title</Label>
        <select value={title} onChange={e => setTitle(e.target.value)} style={inputStyle}>
          <option value="">-- (omit) --</option>
          <option value="Mr">Mr</option>
          <option value="Mrs">Mrs</option>
          <option value="Miss">Miss</option>
          <option value="Ms">Ms</option>
          <option value="Dr">Dr</option>
          <option value="Other">Other</option>
        </select>
        <Label>First Name</Label>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
        <Label>Last Name <MustMatchSurname /></Label>
        <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
        <Label>DOB <MustMatchDob /></Label>
        <input value={dob} onChange={e => setDob(e.target.value)} style={inputStyle} placeholder="1990-01-01, 28/12/1990, or 12/28/1990" />
        <Label>Sex</Label>
        <select value={sex} onChange={e => setSex(e.target.value as SexValue)} style={inputStyle}>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="NotApplicable">NotApplicable</option>
        </select>
        <Label>Email</Label>
        <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <Label>Postcode</Label>
        <input value={postcode} onChange={e => setPostcode(e.target.value)} style={inputStyle} />
        <Label>Resend</Label>
        <label><input type="checkbox" checked={resend} onChange={e => setResend(e.target.checked)} /> Yes (applies to both email and link)</label>
      </Grid2>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={connectEmail} style={{ ...btnStyle, ...btnPrimary }}>POST connection-email</button>
        <button onClick={connectLink} style={btnStyle}>POST connection-link</button>
        <button onClick={randomize} style={btnStyle}>Randomize</button>
        <button onClick={clear} style={btnStyle}>Clear</button>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Update (PATCH demographic fields on an existing patient)
// ---------------------------------------------------------------------------

function PatientUpdateForm(props: {
  orb: OrbApi
  org: string
  patients: PatientItem[]
  selectedPatient: string
  onRefresh: () => void
  onChanged: () => void
}) {
  const [target, setTarget] = useState(props.selectedPatient)
  const [title, setTitle] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [sex, setSex] = useState<SexValue>('Male')
  const [email, setEmail] = useState('')
  const [postcode, setPostcode] = useState('')

  // Pre-fill from the cached patient list when the target changes (the API
  // has no GET-one-patient endpoint, so the list is our source of truth).
  useEffect(() => {
    if (!target) {
      setTitle(''); setFirstName(''); setLastName('')
      setDob(''); setSex('Male'); setEmail(''); setPostcode('')
      return
    }
    const p = props.patients.find(x => x.extPatientId === target)
    if (!p) return
    setTitle(p.title ?? '')
    setFirstName(p.firstName ?? '')
    setLastName(p.lastName ?? '')
    setDob(p.dateOfBirth ?? '')
    setSex((p.sex as SexValue) ?? 'Male')
    setEmail(p.emailAddress ?? '')
    setPostcode(p.postcode ?? '')
  }, [target, props.patients])

  // Keep target in sync if the Context patient changes while the tab is open.
  useEffect(() => { setTarget(props.selectedPatient) }, [props.selectedPatient])

  const randomize = () => {
    const r = randomPatientData()
    setTitle(r.title)
    setFirstName(r.firstName)
    setSex(r.sex === 'Male' ? 'Male' : 'Female')
    setEmail(r.email); setPostcode(r.postcode)
    // Deliberately do NOT randomize lastName / dob - those are validated and
    // a random value will always 409.
  }

  const patch = async () => {
    if (!target) return
    await props.orb.updatePatient(props.org, target, stripEmpty({
      title, firstName, lastName,
      dateOfBirth: normalizeDob(dob), sex,
      emailAddress: email, postcode,
    }) as Parameters<OrbApi['updatePatient']>[2])
    props.onChanged()
  }

  return (
    <Section title="Update Patient">
      <Hint>
        Values pre-fill from the cached patient list (no GET-one-patient endpoint exists).
        Click <b>↻</b> next to the dropdown to refresh. Empty inputs are dropped from PATCH.
        <br />
        <b>lastName</b> and <b>dateOfBirth</b> are validated against the existing ORB record,
        not overwritten - a mismatch returns 409.
      </Hint>
      <Grid2>
        <Label>Target patient</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">-- select --</option>
            {props.patients.map(p => (
              <option key={p.extPatientId} value={p.extPatientId}>
                {p.firstName} {p.lastName} ({p.extPatientId}){p.connectionStatus ? ` [${p.connectionStatus}]` : ''}
              </option>
            ))}
          </select>
          <button onClick={props.onRefresh} style={btnStyle} title="Refresh list">↻</button>
        </div>
        <Label>Title <FromServer /></Label>
        <select value={title} onChange={e => setTitle(e.target.value)} style={inputStyle}>
          <option value="">-- (omit) --</option>
          <option value="Mr">Mr</option>
          <option value="Mrs">Mrs</option>
          <option value="Miss">Miss</option>
          <option value="Ms">Ms</option>
          <option value="Dr">Dr</option>
          <option value="Other">Other</option>
        </select>
        <Label>First Name <FromServer /></Label>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
        <Label>Last Name <MustMatchSurname /></Label>
        <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
        <Label>DOB <MustMatchDob /></Label>
        <input value={dob} onChange={e => setDob(e.target.value)} style={inputStyle} placeholder="1990-01-01" />
        <Label>Sex <FromServer /></Label>
        <select value={sex} onChange={e => setSex(e.target.value as SexValue)} style={inputStyle}>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="NotApplicable">NotApplicable</option>
        </select>
        <Label>Email <FromServer /></Label>
        <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <Label>Postcode <FromServer /></Label>
        <input value={postcode} onChange={e => setPostcode(e.target.value)} style={inputStyle} />
      </Grid2>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={patch} style={{ ...btnStyle, ...btnPrimary }} disabled={!target}>PATCH Update</button>
        <button onClick={randomize} style={btnStyle} disabled={!target}>Randomize new values</button>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Status / Permissions / Remove connection
// ---------------------------------------------------------------------------

function PatientStatusPanel(props: {
  orb: OrbApi
  org: string
  selectedPatient: string
  showFlash: (msg: string) => void
  onChanged: () => void
}) {
  const guard = () => {
    if (!props.selectedPatient) {
      props.showFlash('Select a patient in Context first')
      return false
    }
    return true
  }

  const getStatus = async () => {
    if (!guard()) return
    await props.orb.getPatientConnection(props.org, props.selectedPatient)
  }

  const getPermissions = async () => {
    if (!guard()) return
    await props.orb.getPatientPermissions(props.org, props.selectedPatient)
  }

  const delConnection = async () => {
    if (!guard()) return
    if (!confirm(`Unlink patient ${props.selectedPatient} from organisation ${props.org}?`)) return
    await props.orb.deletePatientConnection(props.org, props.selectedPatient)
    props.onChanged()
  }

  return (
    <Section title="Status / Permissions">
      <p style={{ marginTop: 0, color: '#666', fontSize: 13 }}>
        Acts on the patient selected in the Context section
        {props.selectedPatient ? <> (<b>{props.selectedPatient}</b>)</> : <i> (none selected)</i>}.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={getStatus} style={btnStyle}>GET connection status</button>
        <button onClick={getPermissions} style={btnStyle}>GET permissions</button>
        <button onClick={delConnection} style={{ ...btnStyle, ...btnDanger }}>DELETE connection (unlink)</button>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// List + filters
// ---------------------------------------------------------------------------

function PatientListPanel(props: { orb: OrbApi; org: string }) {
  const [statusFilter, setStatusFilter] = useState<ListPatientsQuery['connectionStatus'] | ''>('')
  const [dataAccessFilter, setDataAccessFilter] = useState<ListPatientsQuery['dataAccessStatus'] | ''>('')
  const [dobMismatchFilter, setDobMismatchFilter] = useState<'' | 'true' | 'false'>('')
  const [surnameMismatchFilter, setSurnameMismatchFilter] = useState<'' | 'true' | 'false'>('')
  const [gpLimitedFilter, setGpLimitedFilter] = useState<'' | 'true' | 'false'>('')
  const [patientLimitedFilter, setPatientLimitedFilter] = useState<'' | 'true' | 'false'>('')
  const [nhsNumberFilter, setNhsNumberFilter] = useState('')

  const triBool = (v: '' | 'true' | 'false'): boolean | undefined =>
    v === '' ? undefined : v === 'true'

  const filters = (): ListPatientsQuery => {
    const dob = triBool(dobMismatchFilter)
    const surname = triBool(surnameMismatchFilter)
    const gp = triBool(gpLimitedFilter)
    const patient = triBool(patientLimitedFilter)
    return {
      ...(statusFilter ? { connectionStatus: statusFilter } : {}),
      ...(dataAccessFilter ? { dataAccessStatus: dataAccessFilter } : {}),
      ...(dob !== undefined ? { dobMismatch: dob } : {}),
      ...(surname !== undefined ? { surnameMismatch: surname } : {}),
      ...(gp !== undefined ? { gpDataAccessLimited: gp } : {}),
      ...(patient !== undefined ? { patientDataAccessLimited: patient } : {}),
      ...(nhsNumberFilter.trim() ? { nhsNumber: nhsNumberFilter.trim() } : {}),
    }
  }

  const listAll = () => {
    const f = filters()
    return props.orb.listPatients(props.org, Object.keys(f).length ? f : undefined)
  }

  const listPaged = () =>
    props.orb.listPatients(props.org, { limit: 50, offset: 0, ...filters() })

  const reset = () => {
    setStatusFilter('')
    setDataAccessFilter('')
    setDobMismatchFilter('')
    setSurnameMismatchFilter('')
    setGpLimitedFilter('')
    setPatientLimitedFilter('')
    setNhsNumberFilter('')
  }

  return (
    <Section title="List Patients">
      <Grid2>
        <Label>Connection status</Label>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={inputStyle}>
          <option value="">-- none --</option>
          <option value="InviteNotSent">InviteNotSent</option>
          <option value="InviteSent">InviteSent</option>
          <option value="InviteExpired">InviteExpired</option>
          <option value="DataMismatch">DataMismatch</option>
          <option value="Connected">Connected</option>
        </select>
        <Label>Data access status</Label>
        <select value={dataAccessFilter} onChange={e => setDataAccessFilter(e.target.value as typeof dataAccessFilter)} style={inputStyle}>
          <option value="">-- none --</option>
          <option value="RequestNotSent">RequestNotSent</option>
          <option value="RequestSent">RequestSent</option>
          <option value="Reviewed">Reviewed</option>
        </select>
        <Label>DOB mismatch</Label>
        <select value={dobMismatchFilter} onChange={e => setDobMismatchFilter(e.target.value as typeof dobMismatchFilter)} style={inputStyle}>
          <option value="">-- none --</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <Label>Surname mismatch</Label>
        <select value={surnameMismatchFilter} onChange={e => setSurnameMismatchFilter(e.target.value as typeof surnameMismatchFilter)} style={inputStyle}>
          <option value="">-- none --</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <Label>GP data access limited</Label>
        <select value={gpLimitedFilter} onChange={e => setGpLimitedFilter(e.target.value as typeof gpLimitedFilter)} style={inputStyle}>
          <option value="">-- none --</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <Label>Patient data access limited</Label>
        <select value={patientLimitedFilter} onChange={e => setPatientLimitedFilter(e.target.value as typeof patientLimitedFilter)} style={inputStyle}>
          <option value="">-- none --</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <Label>NHS Number</Label>
        <input value={nhsNumberFilter} onChange={e => setNhsNumberFilter(e.target.value)} style={inputStyle}
          placeholder="e.g. 9000000009 (spaces / hyphens ignored)" />
      </Grid2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button onClick={listAll} style={btnStyle}>GET list</button>
        <button onClick={listPaged} style={btnStyle}>GET first 50 (paginated)</button>
        <button onClick={reset} style={btnStyle}>Reset filters</button>
      </div>
    </Section>
  )
}
