import { useState, useEffect } from 'react'
import type { OrbApi, UserItem } from '../orbApi'
import { usePersistedState } from '../storage'
import { stripEmpty } from '../helpers'
import { randomUserData } from '../random'
import { Section, Grid2, Label, Hint, SubTabs } from '../ui'
import { inputStyle, btnStyle, btnPrimary, btnDanger } from '../styles'

export function UsersTab(props: {
  orb: OrbApi
  selectedOrg: string
  users: UserItem[]
  onRefreshUsers: () => void
  onChanged: () => void
}) {
  const [sub, setSub] = usePersistedState<'create' | 'update' | 'list'>('userSubTab', 'create')

  if (!props.selectedOrg) {
    return (
      <div style={{ padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
        Select an organisation in the Context section first.
      </div>
    )
  }

  return (
    <>
      <SubTabs value={sub} onChange={setSub} tabs={[
        { key: 'create', label: 'Create' },
        { key: 'update', label: 'Update / Delete' },
        { key: 'list', label: 'List' }
      ]} />
      {sub === 'create' && <UserCreateForm orb={props.orb} org={props.selectedOrg} onChanged={props.onChanged} />}
      {sub === 'update' && <UserUpdateForm orb={props.orb} org={props.selectedOrg} users={props.users} onRefresh={props.onRefreshUsers} onChanged={props.onChanged} />}
      {sub === 'list' && <UserListPanel orb={props.orb} org={props.selectedOrg} />}
    </>
  )
}

function UserCreateForm(props: { orb: OrbApi; org: string; onChanged: () => void }) {
  const [userId, setUserId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [regNum, setRegNum] = useState('')
  const [email, setEmail] = useState('')
  const [isLocum, setIsLocum] = useState(false)
  const [authorisedSignatory, setAuthorisedSignatory] = useState(false)

  const randomize = () => {
    const r = randomUserData()
    setUserId(r.id); setFirstName(r.firstName); setLastName(r.lastName)
    setRegNum(r.regNum); setEmail(r.email)
  }

  const clear = () => {
    setUserId(''); setFirstName(''); setLastName(''); setRegNum(''); setEmail('')
    setIsLocum(false); setAuthorisedSignatory(false)
  }

  const create = async () => {
    if (!props.org || !userId) return
    await props.orb.createUser(props.org, userId, stripEmpty({
      firstName, lastName,
      professionalRegNumber: regNum,
      emailAddress: email,
      isLocum,
      authorisedSignatory
    }) as Parameters<OrbApi['createUser']>[2])
    props.onChanged()
  }

  return (
    <Section title="Create User">
      <Grid2>
        <Label>extOrganisationId</Label>
        <input value={props.org} disabled style={{ ...inputStyle, background: '#f5f5f5' }} />
        <Label>extUserId</Label>
        <input value={userId} onChange={e => setUserId(e.target.value)} style={inputStyle} placeholder="e.g. USER-001" />
        <Label>First Name</Label>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
        <Label>Last Name</Label>
        <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
        <Label>Reg Number</Label>
        <input value={regNum} onChange={e => setRegNum(e.target.value)} style={inputStyle} />
        <Label>Email</Label>
        <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <Label>Locum</Label>
        <label><input type="checkbox" checked={isLocum} onChange={e => setIsLocum(e.target.checked)} /> Yes</label>
        <Label>Authorised Signatory</Label>
        <label><input type="checkbox" checked={authorisedSignatory} onChange={e => setAuthorisedSignatory(e.target.checked)} /> Yes</label>
      </Grid2>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={create} style={{ ...btnStyle, ...btnPrimary }} disabled={!userId}>POST Create</button>
        <button onClick={randomize} style={btnStyle}>Randomize</button>
        <button onClick={clear} style={btnStyle}>Clear</button>
      </div>
    </Section>
  )
}

function UserUpdateForm(props: {
  orb: OrbApi
  org: string
  users: UserItem[]
  onRefresh: () => void
  onChanged: () => void
}) {
  const [target, setTarget] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [regNum, setRegNum] = useState('')
  const [email, setEmail] = useState('')
  const [isLocum, setIsLocum] = useState(false)
  const [authorisedSignatory, setAuthorisedSignatory] = useState(false)

  useEffect(() => {
    if (!target) {
      setFirstName(''); setLastName(''); setRegNum(''); setEmail('')
      setIsLocum(false); setAuthorisedSignatory(false)
      return
    }
    const u = props.users.find(x => x.extUserId === target)
    if (!u) return
    setFirstName(u.firstName ?? '')
    setLastName(u.lastName ?? '')
    setRegNum(u.professionalRegNumber ?? '')
    setEmail(u.emailAddress ?? '')
    setIsLocum(!!u.isLocum)
    setAuthorisedSignatory(!!u.authorisedSignatory)
  }, [target, props.users])

  const randomize = () => {
    const r = randomUserData()
    setFirstName(r.firstName); setLastName(r.lastName)
    setRegNum(r.regNum); setEmail(r.email)
  }

  const patch = async () => {
    if (!target) return
    await props.orb.updateUser(props.org, target, stripEmpty({
      firstName, lastName,
      professionalRegNumber: regNum,
      emailAddress: email,
      isLocum,
      authorisedSignatory
    }) as Parameters<OrbApi['updateUser']>[2])
    props.onChanged()
  }

  const del = async () => {
    if (!target) return
    if (!confirm(`Archive user ${target}? This does not hard-delete the ORB records.`)) return
    await props.orb.deleteUser(props.org, target)
    setTarget('')
    props.onChanged()
  }

  return (
    <Section title="Update User">
      <Hint>
        Values pre-fill from the cached user list (all fields are returned by <code>GET /users</code>).
        Click <b>↻</b> next to the dropdown to refresh. Empty inputs are dropped from PATCH.
      </Hint>
      <Grid2>
        <Label>Target user</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">-- select --</option>
            {props.users.map(u => (
              <option key={u.extUserId} value={u.extUserId}>
                {u.firstName} {u.lastName} ({u.extUserId})
              </option>
            ))}
          </select>
          <button onClick={props.onRefresh} style={btnStyle} title="Refresh list">↻</button>
        </div>
        <Label>First Name</Label>
        <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
        <Label>Last Name</Label>
        <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
        <Label>Reg Number</Label>
        <input value={regNum} onChange={e => setRegNum(e.target.value)} style={inputStyle} />
        <Label>Email</Label>
        <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <Label>Locum</Label>
        <label><input type="checkbox" checked={isLocum} onChange={e => setIsLocum(e.target.checked)} /> Yes</label>
        <Label>Authorised Signatory</Label>
        <label><input type="checkbox" checked={authorisedSignatory} onChange={e => setAuthorisedSignatory(e.target.checked)} /> Yes</label>
      </Grid2>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={patch} style={{ ...btnStyle, ...btnPrimary }} disabled={!target}>PATCH Update</button>
        <button onClick={randomize} style={btnStyle} disabled={!target}>Randomize new values</button>
        <button onClick={del} style={{ ...btnStyle, ...btnDanger }} disabled={!target}>DELETE (archive)</button>
      </div>
    </Section>
  )
}

function UserListPanel(props: { orb: OrbApi; org: string }) {
  return (
    <Section title="List Users">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => props.orb.listUsers(props.org)} style={btnStyle}>GET all</button>
        <button onClick={() => props.orb.listUsersPaginated(props.org, 50, 0)} style={btnStyle}>GET first 50 (paginated)</button>
      </div>
    </Section>
  )
}
