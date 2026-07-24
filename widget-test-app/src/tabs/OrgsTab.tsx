import { useState, useEffect, useRef } from 'react'
import type { OrbApi, OrgItem } from '../orbApi'
import { usePersistedState } from '../storage'
import { stripEmpty } from '../helpers'
import { randomOrgData } from '../random'
import { Section, Grid2, Label, Hint, SubTabs, FromServer, NotReturned } from '../ui'
import { inputStyle, btnStyle, btnPrimary, btnDanger } from '../styles'

export function OrgsTab(props: {
  orb: OrbApi
  orgs: OrgItem[]
  onRefreshOrgs: () => void
  onChanged: () => void
}) {
  const [sub, setSub] = usePersistedState<'create' | 'update' | 'branding' | 'list'>('orgSubTab', 'create')

  return (
    <>
      <SubTabs value={sub} onChange={setSub} tabs={[
        { key: 'create', label: 'Create' },
        { key: 'update', label: 'Update / Manage' },
        { key: 'branding', label: 'Branding' },
        { key: 'list', label: 'List' }
      ]} />
      {sub === 'create' && <OrgCreateForm orb={props.orb} onChanged={props.onChanged} />}
      {sub === 'update' && <OrgUpdateForm orb={props.orb} orgs={props.orgs} onRefresh={props.onRefreshOrgs} onChanged={props.onChanged} />}
      {sub === 'branding' && <OrgBrandingForm orb={props.orb} orgs={props.orgs} />}
      {sub === 'list' && <OrgListPanel orb={props.orb} />}
    </>
  )
}

function OrgCreateForm(props: { orb: OrbApi; onChanged: () => void }) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')
  const [address3, setAddress3] = useState('')
  const [address4, setAddress4] = useState('')
  const [postcode, setPostcode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [cqc, setCqc] = useState('')
  const [researchOptOut, setResearchOptOut] = useState(false)

  const randomize = () => {
    const r = randomOrgData()
    setId(r.id); setName(r.name)
    setAddress1(r.address1); setAddress2(r.address2)
    setAddress3(r.address3); setAddress4(r.address4)
    setPostcode(r.postcode); setPhoneNumber(r.phoneNumber)
    setCqc(r.cqc); setResearchOptOut(false)
  }

  const clear = () => {
    setId(''); setName(''); setAddress1(''); setAddress2('')
    setAddress3(''); setAddress4('')
    setPostcode(''); setPhoneNumber(''); setCqc(''); setResearchOptOut(false)
  }

  const create = async () => {
    if (!id || !name) return
    await props.orb.createOrganisation(id, stripEmpty({
      organisationName: name,
      address1, address2, address3, address4,
      postcode, phoneNumber,
      cqcRegistrationNumber: cqc,
      researchOptOut
    }) as Parameters<OrbApi['createOrganisation']>[1])
    props.onChanged()
  }

  return (
    <Section title="Create Organisation">
      <Grid2>
        <Label>extOrganisationId</Label>
        <input value={id} onChange={e => setId(e.target.value)} style={inputStyle} placeholder="e.g. ORG-001" />
        <Label>Name</Label>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        <Label>Address 1</Label>
        <input value={address1} onChange={e => setAddress1(e.target.value)} style={inputStyle} />
        <Label>Address 2</Label>
        <input value={address2} onChange={e => setAddress2(e.target.value)} style={inputStyle} />
        <Label>Address 3</Label>
        <input value={address3} onChange={e => setAddress3(e.target.value)} style={inputStyle} placeholder="(optional)" />
        <Label>Address 4</Label>
        <input value={address4} onChange={e => setAddress4(e.target.value)} style={inputStyle} placeholder="(optional)" />
        <Label>Postcode</Label>
        <input value={postcode} onChange={e => setPostcode(e.target.value)} style={inputStyle} />
        <Label>Phone</Label>
        <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={inputStyle} />
        <Label>CQC Reg Number</Label>
        <input value={cqc} onChange={e => setCqc(e.target.value)} style={inputStyle} />
        <Label>Research Opt-Out</Label>
        <label><input type="checkbox" checked={researchOptOut} onChange={e => setResearchOptOut(e.target.checked)} /> Yes</label>
      </Grid2>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={create} style={{ ...btnStyle, ...btnPrimary }} disabled={!id || !name}>POST Create</button>
        <button onClick={randomize} style={btnStyle}>Randomize</button>
        <button onClick={clear} style={btnStyle}>Clear</button>
      </div>
    </Section>
  )
}

function OrgUpdateForm(props: {
  orb: OrbApi
  orgs: OrgItem[]
  onRefresh: () => void
  onChanged: () => void
}) {
  const [target, setTarget] = useState('')
  const [name, setName] = useState('')
  const [address1, setAddress1] = useState('')
  const [address2, setAddress2] = useState('')
  const [address3, setAddress3] = useState('')
  const [address4, setAddress4] = useState('')
  const [postcode, setPostcode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [cqc, setCqc] = useState('')
  const [researchOptOut, setResearchOptOut] = useState(false)
  const [autoDeleteDays, setAutoDeleteDays] = useState('')
  const [current, setCurrent] = useState<OrgItem | null>(null)

  useEffect(() => {
    if (!target) { setCurrent(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const { ok, data } = await props.orb.getOrganisation(target)
        if (cancelled || !ok || !data) return
        setCurrent(data)
        setName(data.organisationName ?? '')
        // Address / phone / CQC / researchOptOut are write-only - the server
        // does not return them, so leave the inputs blank for user-driven input.
        setAddress1('')
        setAddress2('')
        setAddress3('')
        setAddress4('')
        setPostcode('')
        setPhoneNumber('')
        setCqc('')
        setResearchOptOut(false)
      } catch { /* logged */ }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const randomize = () => {
    const r = randomOrgData()
    setName(r.name)
    setAddress1(r.address1); setAddress2(r.address2)
    setAddress3(r.address3); setAddress4(r.address4)
    setPostcode(r.postcode); setPhoneNumber(r.phoneNumber)
    setCqc(r.cqc)
  }

  const save = async () => {
    if (!target) return
    await props.orb.updateOrganisation(target, stripEmpty({
      organisationName: name, address1, address2, address3, address4,
      postcode, phoneNumber, cqcRegistrationNumber: cqc,
      researchOptOut
    }) as Parameters<OrbApi['updateOrganisation']>[1])
    props.onChanged()
  }

  const suspend = async () => {
    if (!target) return
    await props.orb.updateOrganisation(target, stripEmpty({
      suspended: true,
      ...(autoDeleteDays ? { autoDeleteDays: Number(autoDeleteDays) } : {})
    }) as Parameters<OrbApi['updateOrganisation']>[1])
    props.onChanged()
  }

  const unsuspend = async () => {
    if (!target) return
    await props.orb.updateOrganisation(target, { suspended: false })
    props.onChanged()
  }

  const del = async () => {
    if (!target) return
    if (!confirm(`Archive organisation ${target}? This does not hard-delete the ORB records.`)) return
    await props.orb.deleteOrganisation(target)
    setTarget('')
    props.onChanged()
  }

  return (
    <>
      <Section title="Update Organisation">
        <Hint>
          Per spec, <code>GET /organisations/{'{id}'}</code> only returns <b>name</b>, <b>suspended</b>, and <b>autoDeleteDate</b>.
          Address / phone / CQC / researchOptOut are <b>not</b> returned, so they can't be pre-filled.
          Empty inputs are dropped from the PATCH body (<code>stripEmpty</code>) - blank means "don't change".
        </Hint>
        <Grid2>
          <Label>Target organisation</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={target} onChange={e => setTarget(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">-- select --</option>
              {props.orgs.map(o => (
                <option key={o.extOrganisationId} value={o.extOrganisationId}>
                  {o.organisationName} ({o.extOrganisationId}){o.suspended ? ' [SUSPENDED]' : ''}
                </option>
              ))}
            </select>
            <button onClick={props.onRefresh} style={btnStyle} title="Refresh list">↻</button>
          </div>
          <Label>Name <FromServer /></Label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          <Label>Address 1 <NotReturned /></Label>
          <input value={address1} onChange={e => setAddress1(e.target.value)} style={inputStyle} placeholder="(not pre-filled; type to change)" />
          <Label>Address 2 <NotReturned /></Label>
          <input value={address2} onChange={e => setAddress2(e.target.value)} style={inputStyle} placeholder="(not pre-filled; type to change)" />
          <Label>Address 3 <NotReturned /></Label>
          <input value={address3} onChange={e => setAddress3(e.target.value)} style={inputStyle} placeholder="(not pre-filled; type to change)" />
          <Label>Address 4 <NotReturned /></Label>
          <input value={address4} onChange={e => setAddress4(e.target.value)} style={inputStyle} placeholder="(not pre-filled; type to change)" />
          <Label>Postcode <NotReturned /></Label>
          <input value={postcode} onChange={e => setPostcode(e.target.value)} style={inputStyle} placeholder="(not pre-filled; type to change)" />
          <Label>Phone <NotReturned /></Label>
          <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={inputStyle} placeholder="(not pre-filled; type to change)" />
          <Label>CQC Reg Number <NotReturned /></Label>
          <input value={cqc} onChange={e => setCqc(e.target.value)} style={inputStyle} placeholder="(not pre-filled; type to change)" />
          <Label>Research Opt-Out <NotReturned /></Label>
          <label><input type="checkbox" checked={researchOptOut} onChange={e => setResearchOptOut(e.target.checked)} /> Yes</label>
        </Grid2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={save} style={{ ...btnStyle, ...btnPrimary }} disabled={!target}>PATCH Update</button>
          <button onClick={randomize} style={btnStyle} disabled={!target}>Randomize new values</button>
        </div>
      </Section>

      <Section title="Suspend / Unsuspend / Delete">
        <Grid2>
          <Label>Auto-delete days (on suspend)</Label>
          <input value={autoDeleteDays} onChange={e => setAutoDeleteDays(e.target.value)} style={inputStyle} placeholder="default 180" />
        </Grid2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={suspend} style={btnStyle} disabled={!target}>Suspend</button>
          <button onClick={unsuspend} style={btnStyle} disabled={!target}>Unsuspend</button>
          <button onClick={del} style={{ ...btnStyle, ...btnDanger }} disabled={!target}>DELETE (archive)</button>
        </div>
        {current && (
          <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
            Current: <b>{current.organisationName}</b> - {current.suspended ? 'SUSPENDED' : 'active'}
            {current.autoDeleteDate ? ` (auto-delete: ${current.autoDeleteDate})` : ''}
          </p>
        )}
      </Section>
    </>
  )
}

function OrgBrandingForm(props: { orb: OrbApi; orgs: OrgItem[] }) {
  const [target, setTarget] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [welcomeTitle, setWelcomeTitle] = useState('')
  const [welcomeSubtitle, setWelcomeSubtitle] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
  }

  const clear = () => {
    setFile(null)
    setWelcomeTitle('')
    setWelcomeSubtitle('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const upload = async () => {
    if (!target) return
    await props.orb.setOrganisationBranding(target, {
      file: file ?? undefined,
      ...(welcomeTitle ? { patientNHSActivationWelcomeTitle: welcomeTitle } : {}),
      ...(welcomeSubtitle ? { patientNHSActivationWelcomeSubtitle: welcomeSubtitle } : {}),
    })
  }

  const removeLogo = async () => {
    if (!target) return
    if (!confirm(`Remove the existing logo for ${target}? An empty multipart body is posted.`)) return
    await props.orb.setOrganisationBranding(target, {})
    clear()
  }

  return (
    <Section title="Set Organisation Branding">
      <Hint>
        <code>POST /organisations/{'{id}'}/branding</code> is multipart/form-data.
        Send a <b>file</b> (PNG / JPEG / JPG / SVG, max 1MB) to set or replace the logo.
        Send an empty body (no file, no text) to remove the logo. The welcome-text fields
        are optional and only updated when included.
      </Hint>
      <Grid2>
        <Label>Target organisation</Label>
        <select value={target} onChange={e => setTarget(e.target.value)} style={inputStyle}>
          <option value="">-- select --</option>
          {props.orgs.map(o => (
            <option key={o.extOrganisationId} value={o.extOrganisationId}>
              {o.organisationName} ({o.extOrganisationId}){o.suspended ? ' [SUSPENDED]' : ''}
            </option>
          ))}
        </select>
        <Label>Logo file</Label>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" onChange={onFile} style={inputStyle} />
        <Label>NHS welcome title</Label>
        <input value={welcomeTitle} onChange={e => setWelcomeTitle(e.target.value)} style={inputStyle} placeholder="(optional)" />
        <Label>NHS welcome subtitle</Label>
        <input value={welcomeSubtitle} onChange={e => setWelcomeSubtitle(e.target.value)} style={inputStyle} placeholder="(optional)" />
      </Grid2>
      {file && (
        <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
          Selected: <b>{file.name}</b> ({Math.round(file.size / 1024)} KB, {file.type || 'unknown type'})
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={upload} style={{ ...btnStyle, ...btnPrimary }} disabled={!target}>POST branding</button>
        <button onClick={removeLogo} style={{ ...btnStyle, ...btnDanger }} disabled={!target}>Remove logo (empty body)</button>
        <button onClick={clear} style={btnStyle}>Clear inputs</button>
      </div>
    </Section>
  )
}

function OrgListPanel(props: { orb: OrbApi }) {
  return (
    <Section title="List Organisations">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => props.orb.listOrganisations()} style={btnStyle}>GET all</button>
        <button onClick={() => props.orb.listOrganisationsBySuspended(true)} style={btnStyle}>GET suspended</button>
        <button onClick={() => props.orb.listOrganisationsBySuspended(false)} style={btnStyle}>GET active</button>
      </div>
    </Section>
  )
}
