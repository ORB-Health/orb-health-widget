import { useState, useRef, useEffect } from 'react'
import type { OrbApi, ListPatientsQuery } from '../orbApi'
import { stripEmpty, normalizeDob } from '../helpers'
import { randomPatientData } from '../random'
import { Section, Grid2, Label, MustMatchSurname, MustMatchDob } from '../ui'
import { inputStyle, btnStyle, btnPrimary, btnDanger } from '../styles'

export function PatientsTab(props: {
  orb: OrbApi
  selectedOrg: string
  selectedUser: string
  selectedPatient: string
  onChanged: () => void
}) {
  const [patId, setPatId] = useState('')
  const [title, setTitle] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [sex, setSex] = useState<'Male' | 'Female' | 'NotApplicable'>('Male')
  const [email, setEmail] = useState('')
  const [postcode, setPostcode] = useState('')
  const [resend, setResend] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ListPatientsQuery['connectionStatus'] | ''>('')
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

  const org = props.selectedOrg
  const targetPatient = patId || props.selectedPatient

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

  const connectionBody = () => stripEmpty({
    title, firstName, lastName,
    dateOfBirth: normalizeDob(dob), sex,
    emailAddress: email, postcode,
    requestingClinicianId: props.selectedUser,
  })

  const connectEmail = async () => {
    if (!org) return showFlash('Select an organisation in Context first')
    if (!props.selectedUser) return showFlash('Select a user (clinician) in Context first')
    if (!patId) return showFlash('Enter a patient ID in the form (or click Randomize)')
    await props.orb.sendConnectionEmail(org, patId, {
      ...connectionBody() as Parameters<OrbApi['sendConnectionEmail']>[2],
      resend,
    })
    props.onChanged()
  }

  const connectLink = async () => {
    if (!org) return showFlash('Select an organisation in Context first')
    if (!props.selectedUser) return showFlash('Select a user (clinician) in Context first')
    if (!patId) return showFlash('Enter a patient ID in the form (or click Randomize)')
    await props.orb.createConnectionLink(org, patId,
      connectionBody() as Parameters<OrbApi['createConnectionLink']>[2])
    props.onChanged()
  }

  const getStatus = async () => {
    if (!org) return showFlash('Select an organisation in Context first')
    if (!targetPatient) return showFlash('Select a patient in Context or enter a patient ID')
    await props.orb.getPatientConnection(org, targetPatient)
  }

  const getPermissions = async () => {
    if (!org) return showFlash('Select an organisation in Context first')
    if (!targetPatient) return showFlash('Select a patient in Context or enter a patient ID')
    await props.orb.getPatientPermissions(org, targetPatient)
  }

  const delConnection = async () => {
    if (!org) return showFlash('Select an organisation in Context first')
    if (!targetPatient) return showFlash('Select a patient in Context or enter a patient ID')
    if (!confirm(`DELETE patient connection ${targetPatient}? (spec: not used in V1)`)) return
    await props.orb.deletePatientConnection(org, targetPatient)
    props.onChanged()
  }

  const listAll = () => {
    if (!org) return showFlash('Select an organisation in Context first')
    return props.orb.listPatients(org, statusFilter ? { connectionStatus: statusFilter } : undefined)
  }

  const listPaged = () => {
    if (!org) return showFlash('Select an organisation in Context first')
    return props.orb.listPatients(org, {
      limit: 50, offset: 0,
      ...(statusFilter ? { connectionStatus: statusFilter } : {})
    })
  }

  return (
    <>
      {!org && (
        <div style={{ padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          Select an organisation in the Context section first.
        </div>
      )}

      {flash && (
        <div style={{
          padding: '10px 14px', background: '#fff4cc', border: '1px solid #f5c518',
          borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#6b5200'
        }}>
          {flash}
        </div>
      )}

      <Section title="Connect Patient (Email or Link)">
        <Grid2>
          <Label>extOrganisationId</Label>
          <input value={org} disabled style={{ ...inputStyle, background: '#f5f5f5' }} />
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
          <select value={sex} onChange={e => setSex(e.target.value as typeof sex)} style={inputStyle}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="NotApplicable">NotApplicable</option>
          </select>
          <Label>Email</Label>
          <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <Label>Postcode</Label>
          <input value={postcode} onChange={e => setPostcode(e.target.value)} style={inputStyle} />
          <Label>Resend (email only)</Label>
          <label><input type="checkbox" checked={resend} onChange={e => setResend(e.target.checked)} /> Yes</label>
        </Grid2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={connectEmail} style={{ ...btnStyle, ...btnPrimary }}>POST connection-email</button>
          <button onClick={connectLink} style={btnStyle}>POST connection-link</button>
          <button onClick={randomize} style={btnStyle}>Randomize</button>
          <button onClick={clear} style={btnStyle}>Clear</button>
        </div>
      </Section>

      <Section title="Status / Permissions">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={getStatus} style={btnStyle}>GET connection status</button>
          <button onClick={getPermissions} style={btnStyle}>GET permissions</button>
          <button onClick={delConnection} style={{ ...btnStyle, ...btnDanger }}>DELETE connection</button>
        </div>
      </Section>

      <Section title="List Patients">
        <Grid2>
          <Label>Status filter (optional)</Label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={inputStyle}>
            <option value="">-- none --</option>
            <option value="InviteNotSent">InviteNotSent</option>
            <option value="InviteSent">InviteSent</option>
            <option value="InviteExpired">InviteExpired</option>
            <option value="DataMismatch">DataMismatch</option>
            <option value="Connected">Connected</option>
          </select>
        </Grid2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button onClick={listAll} style={btnStyle}>GET list</button>
          <button onClick={listPaged} style={btnStyle}>GET first 50 (paginated)</button>
        </div>
      </Section>
    </>
  )
}
