import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  createOrbApi,
  type OrbApi,
  type OrgItem,
  type UserItem,
  type PatientItem,
  type RequestLog,
} from './orbApi'
import {
  openOrbWidget,
  attachTokenRefreshListener,
  attachContractSignedListener,
  decodeJwtPayload,
} from './widgetIntegration'
import type { LogEntry, TabName, OrgContractStatus } from './types'
import { loadStored, saveStored, usePersistedState } from './storage'
import { SendNullLiteralContext } from './settings'
import { inputStyle, btnStyle } from './styles'
import {
  Section, Grid2, Label, TabButton,
  InputWithHistory, LastResponsePanel, LogDetailTabs, Spinner, HelpTip,
} from './ui'
import { WidgetTab } from './tabs/WidgetTab'
import { OrgsTab } from './tabs/OrgsTab'
import { UsersTab } from './tabs/UsersTab'
import { PatientsTab } from './tabs/PatientsTab'
import { ContractTab } from './tabs/ContractTab'
import { StatsTab } from './tabs/StatsTab'

// ============================================================================
// Main
// ============================================================================
export default function App() {
  // -- Config (persisted) --------------------------------------------------
  // One server URL; we tack on /v1 for the API and /medical-record-embedded
  // for the widget. Tolerates trailing slashes and accidental /v1 paste.
  const [serverUrl, setServerUrl] = usePersistedState('serverUrl', () => {
    // Migrate from the old split apiBaseUrl/widgetBaseUrl pair.
    const oldApi = loadStored<string>('apiBaseUrl', '')
    if (oldApi) return oldApi.replace(/\/+$/, '').replace(/\/v1$/, '')
    return 'https://api-test-app.orbforhealth.com'
  })
  const [apiKey, setApiKey] = usePersistedState('apiKey', '')
  // X-ORG-API-KEY per extOrganisationId.
  const [orgApiKeys, setOrgApiKeys] = usePersistedState<Record<string, string>>('orgApiKeys', {})
  const getOrgApiKey = useCallback((extOrganisationId: string) => orgApiKeys[extOrganisationId], [orgApiKeys])
  const [sendNullLiteral, setSendNullLiteral] = usePersistedState('sendNullLiteral', false)
  const serverBase = serverUrl.replace(/\/+$/, '').replace(/\/(v1|medical-record-embedded)$/, '')
  const apiBaseUrl = `${serverBase}/v1`
  const widgetBaseUrl = `${serverBase}/medical-record-embedded`
  const contractWidgetBaseUrl = `${serverBase}/medical-record-embedded/organisation-contract/sign`

  const [tab, setTab] = usePersistedState<TabName>('tab', 'widget')

  // -- Shared context ------------------------------------------------------
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [patients, setPatients] = useState<PatientItem[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [patientsLoading, setPatientsLoading] = useState(false)
  // Bump on each load; a response whose id is stale (org changed mid-flight) is dropped.
  const usersReqRef = useRef(0)
  const patientsReqRef = useRef(0)

  // Organisations added by ID + Org API key, so they can be used without the GovBody key
  // (List Organisations only accepts the GovBody key). Value is the name returned by Get Organisation.
  const [manualOrgNames, setManualOrgNames] = usePersistedState<Record<string, string>>('manualOrgNames', {})
  const [manualOrgId, setManualOrgId] = useState('')
  const [manualOrgKey, setManualOrgKey] = useState('')
  const knownOrgs: OrgItem[] = useMemo(() => {
    const listed = new Set(orgs.map(o => o.extOrganisationId))
    const manual = Object.keys(orgApiKeys)
      .filter(id => !listed.has(id))
      .map(id => ({ extOrganisationId: id, organisationName: manualOrgNames[id] ?? id, suspended: false }))
    return [...orgs, ...manual]
  }, [orgs, orgApiKeys, manualOrgNames])

  const [selectedOrg, setSelectedOrg] = usePersistedState('selectedOrg', '')
  const [selectedUser, setSelectedUser] = usePersistedState('selectedUser', '')
  const [selectedPatient, setSelectedPatient] = usePersistedState('selectedPatient', '')

  // -- Widget / JWT state --------------------------------------------------
  const [jwt, setJwt] = useState<string | null>(null)
  const [jwtClaims, setJwtClaims] = useState<Record<string, unknown> | null>(null)
  const [expiresIn, setExpiresIn] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

  const widgetRef = useRef<OrbWidget | null>(null)
  const expiryRef = useRef<number | null>(null)

  // -- Contract (org-scoped) widget state ----------------------------------
  const [contractStatus, setContractStatus] = useState<OrgContractStatus | null>(null)
  const contractWidgetRef = useRef<OrbWidget | null>(null)
  const [signatoryFirstName, setSignatoryFirstName] = usePersistedState('signatoryFirstName', '')
  const [signatoryLastName, setSignatoryLastName] = usePersistedState('signatoryLastName', '')
  const [signatoryEmail, setSignatoryEmail] = usePersistedState('signatoryEmail', '')

  // Widget bakes apiOrigin/widgetBaseUrl in at construction. When either
  // changes, throw away the cached instances so the next open rebuilds them.
  useEffect(() => {
    widgetRef.current?.destroy()
    widgetRef.current = null
    contractWidgetRef.current?.destroy()
    contractWidgetRef.current = null
  }, [apiBaseUrl, widgetBaseUrl, contractWidgetBaseUrl])

  // -- Log -----------------------------------------------------------------
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const logIdRef = useRef(0)

  // -- Right panel (collapse + resize) -------------------------------------
  const AUTO_COLLAPSE_WIDTH = 900
  const RIGHT_MIN = 320
  const RIGHT_MAX = 900
  const [rightCollapsed, setRightCollapsed] = usePersistedState(
    'rightCollapsed',
    () => typeof window !== 'undefined' && window.innerWidth < AUTO_COLLAPSE_WIDTH
  )
  // Clamp on load defends against stored values outside the current min/max.
  const [rightWidth, setRightWidth] = useState(() =>
    Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, loadStored('rightWidth', 460)))
  )
  useEffect(() => { saveStored('rightWidth', rightWidth) }, [rightWidth])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < AUTO_COLLAPSE_WIDTH) setRightCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = rightWidth
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, startWidth - (ev.clientX - startX)))
      setRightWidth(next)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [rightWidth])

  // -- Logging hook passed to the API client -------------------------------
  const addLog = useCallback((log: RequestLog) => {
    const body = log.error ?? log.responseBody ?? ''
    const capped = body.length > 50_000 ? body.slice(0, 50_000) + '\n…[truncated]' : body
    setLogs(prev => [{
      id: ++logIdRef.current,
      time: new Date().toLocaleTimeString(),
      method: log.method,
      url: log.path,
      status: log.status,
      body: capped,
      requestBody: log.requestBody,
      requestHeaders: log.requestHeaders,
    }, ...prev].slice(0, 100))
  }, [])

  const toggleExpand = useCallback((id: number) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // -- Build the API client. Re-created only when config changes. ---------
  // Two clients share the same baseUrl/apiKey: `orb` records every call to
  // the log panel, `orbSilent` does not. System-driven refreshes (auto-loads
  // on context change, post-CUD list refreshes, token auto-refresh) use the
  // silent one so the panel only shows calls the user actually triggered.
  const orb: OrbApi = useMemo(
    () => createOrbApi({ baseUrl: apiBaseUrl, apiKey, getOrgApiKey, onRequest: addLog }),
    [apiBaseUrl, apiKey, getOrgApiKey, addLog]
  )
  const orbSilent: OrbApi = useMemo(
    () => createOrbApi({ baseUrl: apiBaseUrl, apiKey, getOrgApiKey }),
    [apiBaseUrl, apiKey, getOrgApiKey]
  )

  // ===================================================================
  // Loaders. `silent=true` routes through orbSilent so the log panel
  // doesn't record automatic refreshes.
  // ===================================================================
  const loadOrgs = useCallback(async (silent = false) => {
    setError(null)
    // List Organisations needs the GovBody key; organisations added with an Org API key stay listed.
    if (!apiKey) { setOrgs([]); return }
    const client = silent ? orbSilent : orb
    try {
      const { ok, status, data } = await client.listOrganisations()
      if (ok && Array.isArray(data)) setOrgs(data)
      else if (!ok) setError(`Failed to load orgs: ${status}`)
    } catch (e) { setError(String(e)) }
  }, [orb, orbSilent, apiKey])

  const loadUsers = useCallback(async (orgId: string, silent = false) => {
    if (!orgId) { setUsers([]); setUsersLoading(false); return }
    const reqId = ++usersReqRef.current
    const client = silent ? orbSilent : orb
    setUsersLoading(true)
    try {
      const { ok, status, data } = await client.listUsers(orgId)
      if (reqId !== usersReqRef.current) return  // a newer org selection superseded this
      if (ok && Array.isArray(data)) setUsers(data)
      else if (!ok) {
        const errorBody = data as { errorCode?: string; errorMessage?: string } | null
        setError(errorBody?.errorMessage || `Failed to load users: ${status}`)
      }
    } catch (e) {
      if (reqId === usersReqRef.current) setError(String(e))
    } finally {
      if (reqId === usersReqRef.current) setUsersLoading(false)
    }
  }, [orb, orbSilent])

  const loadPatients = useCallback(async (orgId: string, silent = false) => {
    if (!orgId) { setPatients([]); setPatientsLoading(false); return }
    const reqId = ++patientsReqRef.current
    const client = silent ? orbSilent : orb
    setPatientsLoading(true)
    try {
      const { ok, status, data } = await client.listPatients(orgId)
      if (reqId !== patientsReqRef.current) return  // a newer org selection superseded this
      if (ok && Array.isArray(data)) setPatients(data)
      else if (!ok) {
        const errorBody = data as { errorCode?: string; errorMessage?: string } | null
        setError(errorBody?.errorMessage || `Failed to load patients: ${status}`)
      }
    } catch (e) {
      if (reqId === patientsReqRef.current) setError(String(e))
    } finally {
      if (reqId === patientsReqRef.current) setPatientsLoading(false)
    }
  }, [orb, orbSilent])

  useEffect(() => {
    // Clear first so the previous org's users/patients never show while the new lists load.
    setUsers([])
    setPatients([])
    if (selectedOrg) {
      loadUsers(selectedOrg, true)
      loadPatients(selectedOrg, true)
    }
  }, [selectedOrg, loadUsers, loadPatients])

  // Auto-load orgs when the API key or server URL changes, debounced.
  // (URL changes feed in via loadOrgs identity, which re-creates with orb.)
  useEffect(() => {
    if (!apiKey) { setOrgs([]); return }
    const t = setTimeout(() => { loadOrgs(true) }, 400)
    return () => clearTimeout(t)
  }, [apiKey, loadOrgs])

  // ===================================================================
  // Token refresh + countdown
  // ===================================================================
  useEffect(() => {
    if (expiryRef.current === null) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryRef.current! - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [jwt])

  useEffect(() => {
    return attachTokenRefreshListener(async () => {
      if (!selectedOrg || !selectedPatient || !selectedUser || !apiKey) return
      try {
        const { ok, data } = await orbSilent.requestAccessToken(selectedOrg, selectedPatient, selectedUser)
        if (ok && data) {
          setJwt(data.accessToken)
          setJwtClaims(decodeJwtPayload(data.accessToken))
          setExpiresIn(data.expiresIn)
          expiryRef.current = Date.now() + data.expiresIn * 1000
          widgetRef.current?.refreshToken(data.accessToken)
        }
      } catch { /* swallowed - background refresh */ }
    })
  }, [orbSilent, apiKey, selectedOrg, selectedUser, selectedPatient])

  // ===================================================================
  // Widget open
  // ===================================================================
  const viewNhsRecords = async () => {
    setError(null)
    const missing: string[] = []
    if (!selectedOrg) missing.push('organisation')
    if (!selectedUser) missing.push('user')
    if (!selectedPatient) missing.push('patient')
    if (missing.length) {
      setError(`Select ${missing.join(', ')} in the Context section first`)
      return
    }
    try {
      const { ok, status, data } = await orb.requestAccessToken(selectedOrg, selectedPatient, selectedUser)
      if (!ok || !data) {
        const errorBody = data as { errorMessage?: string; errorCode?: string } | null
        setError(
          errorBody?.errorMessage
            || `Token request failed: ${status}`
        )
        return
      }
      setJwt(data.accessToken)
      setJwtClaims(decodeJwtPayload(data.accessToken))
      setExpiresIn(data.expiresIn)
      expiryRef.current = Date.now() + data.expiresIn * 1000

      const patient = patients.find(p => p.extPatientId === selectedPatient)
      const apiOrigin = new URL(apiBaseUrl).origin

      if (!widgetRef.current) {
        widgetRef.current = openOrbWidget({
          token: data.accessToken,
          widgetBaseUrl,
          apiOrigin,
          patient: {
            ehr_patient_id: selectedPatient,
            first_name: patient?.firstName || '',
            last_name: patient?.lastName || '',
            dob: patient?.dateOfBirth || ''
          }
        })
      } else {
        widgetRef.current.refreshToken(data.accessToken)
        widgetRef.current.open({
          ehr_patient_id: selectedPatient,
          first_name: patient?.firstName || '',
          last_name: patient?.lastName || '',
          dob: patient?.dateOfBirth || ''
        })
      }
      addLog({
        method: 'WIDGET', path: 'open', status: 200,
        requestHeaders: {},
        responseBody: `Patient: ${patient?.firstName} ${patient?.lastName}`,
      })
    } catch (e) { setError(String(e)) }
  }

  // ===================================================================
  // Organisation contract: status poll + widget open
  // ===================================================================
  const checkContractStatus = async () => {
    setError(null)
    if (!selectedOrg) {
      setError('Select an organisation in the Context section first')
      return
    }
    try {
      const { ok, status, data } = await orb.getOrganisationContractStatus(selectedOrg)
      if (ok && data) setContractStatus(data)
      else if (!ok) setError(`Contract status request failed: ${status}`)
    } catch (e) { setError(String(e)) }
  }

  // Blank fields mean "send no SET_SIGNATORY", mirroring a host that doesn't support it.
  const buildSignatory = () => {
    const first = signatoryFirstName.trim()
    const last = signatoryLastName.trim()
    const email = signatoryEmail.trim()
    if (!first && !last && !email) return null
    return {
      first_name: first || undefined,
      last_name: last || undefined,
      email: email || undefined,
    }
  }

  const generateOrgApiKey = async () => {
    setError(null)
    if (!selectedOrg) return
    const org = selectedOrg
    const { ok, status, data } = await orb.generateOrganisationApiKey(org)
    if (!ok || !data) {
      setError(status === 409
        ? 'This organisation already has an API key; ORB cannot return it again'
        : `Generate organisation API key failed: ${status}`)
      return
    }
    setOrgApiKeys(prev => ({ ...prev, [org]: data.apiKey }))
  }

  const addOrgWithApiKey = async () => {
    setError(null)
    const id = manualOrgId.trim()
    const key = manualOrgKey.trim()
    if (!id || !key) return
    // Check the key against Get Organisation before storing it.
    const client = createOrbApi({ baseUrl: apiBaseUrl, apiKey: '', getOrgApiKey: () => key, onRequest: addLog })
    const { ok, status, data } = await client.getOrganisation(id)
    if (!ok || !data) {
      const errorBody = data as { errorMessage?: string } | null
      setError(`Organisation key check failed (${status})${errorBody?.errorMessage ? ': ' + errorBody.errorMessage : ''}`)
      return
    }
    setOrgApiKeys(prev => ({ ...prev, [id]: key }))
    setManualOrgNames(prev => ({ ...prev, [id]: data.organisationName }))
    setSelectedOrg(id)
    setSelectedUser('')
    setSelectedPatient('')
    setManualOrgId('')
    setManualOrgKey('')
  }

  const openContractWidget = async () => {
    setError(null)
    if (!selectedOrg) {
      setError('Select an organisation in the Context section first')
      return
    }
    try {
      const { ok, status, data } = await orb.requestContractAccessToken(selectedOrg)
      if (!ok || !data) {
        setError(`Contract token request failed: ${status}`)
        return
      }
      setJwt(data.accessToken)
      setJwtClaims(decodeJwtPayload(data.accessToken))
      setExpiresIn(data.expiresIn)
      expiryRef.current = Date.now() + data.expiresIn * 1000

      const apiOrigin = new URL(apiBaseUrl).origin
      const signatory = buildSignatory()

      if (!contractWidgetRef.current) {
        contractWidgetRef.current = openOrbWidget({
          token: data.accessToken,
          widgetBaseUrl: contractWidgetBaseUrl,
          apiOrigin,
          patient: null,
          signatory,
          title: 'Organisation Contract',
        })
      } else {
        contractWidgetRef.current.setSignatory(signatory)
        contractWidgetRef.current.refreshToken(data.accessToken)
        contractWidgetRef.current.open()
      }
      addLog({
        method: 'WIDGET', path: 'open-contract', status: 200,
        requestHeaders: {},
        responseBody: JSON.stringify({ organisation: selectedOrg, signatory }),
      })
    } catch (e) { setError(String(e)) }
  }

  // The contract iframe records the signature itself, then notifies the parent.
  // Refresh the displayed status when that happens.
  useEffect(() => {
    return attachContractSignedListener((url) => {
      addLog({
        method: 'WIDGET', path: 'contract-signed', status: 200,
        requestHeaders: {},
        responseBody: JSON.stringify({ signedContractUrl: url }),
      })
      checkContractStatus()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orb, selectedOrg, addLog])

  // ===================================================================
  // Render
  // ===================================================================
  return (
    <SendNullLiteralContext.Provider value={sendNullLiteral}>
    <div
      className={sendNullLiteral ? 'orb-send-null' : undefined}
      style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1600, margin: '0 auto', padding: 24 }}>
      <style>{`
        @keyframes orb-flash {
          0%   { background-color: #fff4cc; box-shadow: 0 0 0 2px #f5c518 inset; }
          60%  { background-color: #fffbe6; box-shadow: 0 0 0 0 transparent inset; }
          100% { background-color: transparent; box-shadow: none; }
        }
        @keyframes orb-row-flash {
          0%   { background-color: #fff4cc; transform: translateX(-2px); }
          40%  { transform: translateX(0); }
          100% { background-color: transparent; }
        }
        @keyframes orb-status-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes orb-spin { to { transform: rotate(360deg); } }
        .orb-spin { animation: orb-spin 0.7s linear infinite; }
        .orb-last-response { animation: orb-flash 900ms ease-out; }
        .orb-log-row       { animation: orb-row-flash 900ms ease-out; }
        .orb-status-pop    { display: inline-block; animation: orb-status-pop 500ms ease-out; transform-origin: center; }

        .orb-resizer > i { background: #ececec; transition: background 120ms ease; }
        .orb-resizer:hover > i,
        .orb-resizer:active > i { background: #9aa0a6; }

        .orb-icon-btn { background: transparent; color: #8a8f98; transition: background 120ms, color 120ms; }
        .orb-icon-btn:hover { background: #f3f4f6; color: #2e3138; }

        .orb-scroll { scrollbar-width: thin; scrollbar-color: #c8c8c8 transparent; }
        .orb-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .orb-scroll::-webkit-scrollbar-track { background: transparent; }
        .orb-scroll::-webkit-scrollbar-thumb { background: #d0d0d0; border-radius: 3px; }
        .orb-scroll::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
        .orb-scroll::-webkit-scrollbar-corner { background: transparent; }

        .orb-copy-btn { opacity: 0; transition: opacity 120ms ease; }
        .orb-copy-wrap:hover .orb-copy-btn,
        .orb-copy-wrap:focus-within .orb-copy-btn,
        .orb-copy-btn.is-copied { opacity: 1; }

        .orb-send-null .orb-null-scope input[value="null" i]:not([type="checkbox"]):not([type="radio"]) {
          color: #6e6487; background: #faf9fc; border-color: #d8d3e3;
          font-family: ui-monospace, Consolas, monospace; font-style: italic;
        }
        .orb-null-sample {
          color: #6e6487; background: #f5f3f8; border: 1px solid #e2deea; border-radius: 3px;
          padding: 0 4px; font-family: ui-monospace, Consolas, monospace; font-style: italic;
        }
      `}</style>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>ORB API Test Harness</h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: 16 }}>
        End-to-end testing for the ORB external API + widget integration
      </p>

      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
        <main style={{
          flex: 1,
          minWidth: 0,
          marginRight: rightCollapsed ? 12 : 0,
          position: 'relative',
          zIndex: 0,
          isolation: 'isolate'
        }}>

      <Section title="Configuration">
        <Grid2>
          <Label>ORB Server URL</Label>
          <InputWithHistory
            value={serverUrl}
            onChange={setServerUrl}
            historyKey="serverUrlHistory"
            placeholder="https://api-test-app.orbforhealth.com"
          />
          <Label>API Key</Label>
          <InputWithHistory value={apiKey} onChange={setApiKey} historyKey="apiKeyHistory" placeholder="X-API-KEY" />
          <Label>Add organisation</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={manualOrgId}
              onChange={e => setManualOrgId(e.target.value)}
              placeholder="extOrganisationId"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              value={manualOrgKey}
              onChange={e => setManualOrgKey(e.target.value)}
              placeholder="X-ORG-API-KEY"
              style={{ ...inputStyle, flex: 2 }}
            />
            <button
              onClick={addOrgWithApiKey}
              style={btnStyle}
              title="Checks the key with GET /organisations/{id}, then adds the organisation to the lists"
              disabled={!manualOrgId.trim() || !manualOrgKey.trim()}
            >
              Add
            </button>
            <HelpTip label="When do I need this?">
              Use this to test with an <b>Organisation API key only</b> (API Key left empty).
              Organisations are normally listed with <code>GET /organisations</code>, which needs the GovBody key.
              <span style={{ display: 'block', marginTop: 6 }}>
                The key is checked with <code>GET /organisations/{'{id}'}</code>, then the organisation appears in the
                Context and Stats organisation lists. Clear its <b>Org API Key</b> in Context to remove it.
              </span>
            </HelpTip>
          </div>
          <Label>Null values</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#444', cursor: 'pointer' }}>
              <input type="checkbox" checked={sendNullLiteral} onChange={e => setSendNullLiteral(e.target.checked)} />
              Send <span className="orb-null-sample">null</span> as a real null
            </label>
            <HelpTip label="What does sending a real null do?">
              <b>On:</b> type <code>null</code> in a field on a Create, Update or Connect form and it is sent as JSON <code>null</code>.
              The field turns purple so you can see which values will go as null.
              <span style={{ display: 'block', marginTop: 6 }}>
                <b>Off:</b> <code>null</code> is sent as the text "null".
              </span>
              <span style={{ display: 'block', marginTop: 6 }}>
                Blank fields are always left out of the request, so they never change anything.
              </span>
              <span style={{ display: 'block', marginTop: 6, color: '#c4c8cf' }}>
                Example: on Update Organisation, Address 1 = <code>null</code> and
                Postcode = <code>XY1 2ZZ</code> sends{' '}
                <code>{'{"address1": null, "postcode": "XY1 2ZZ"}'}</code>,
                which clears address 1, sets the postcode and leaves the rest unchanged.
              </span>
            </HelpTip>
          </div>
        </Grid2>
      </Section>

      {(knownOrgs.length > 0 || selectedOrg) && (
        <Section title="Context">
          <Grid2>
            <Label>Organisation</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={selectedOrg} onChange={e => { setSelectedOrg(e.target.value); setSelectedUser(''); setSelectedPatient('') }} style={{ ...inputStyle, flex: 1 }}>
                <option value="">-- select --</option>
                {knownOrgs.map(o => (
                  <option key={o.extOrganisationId} value={o.extOrganisationId}>
                    {o.organisationName} ({o.extOrganisationId}){o.suspended ? ' [SUSPENDED]' : ''}
                  </option>
                ))}
              </select>
              <button onClick={() => loadOrgs()} style={btnStyle} title="Refresh organisations" disabled={!apiKey}>↻</button>
            </div>

            <Label>Org API Key</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={selectedOrg ? orgApiKeys[selectedOrg] ?? '' : ''}
                onChange={e => {
                  const value = e.target.value.trim()
                  setOrgApiKeys(prev => {
                    const next = { ...prev }
                    if (value) next[selectedOrg] = value
                    else delete next[selectedOrg]
                    return next
                  })
                }}
                placeholder="X-ORG-API-KEY (stored per organisation)"
                style={{ ...inputStyle, flex: 1 }}
                disabled={!selectedOrg}
              />
              <button
                onClick={generateOrgApiKey}
                style={btnStyle}
                title="POST /organisations/{id}/api-key with the GovBody key (only if the organisation has no key yet)"
                disabled={!selectedOrg || !apiKey}
              >
                Generate
              </button>
            </div>

            <Label>User (Clinician)</Label>
            <div style={{ position: 'relative' }}>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ ...inputStyle, paddingRight: usersLoading ? 46 : undefined }} disabled={!selectedOrg}>
                <option value="">-- select --</option>
                {users.map(u => (
                  <option key={u.extUserId} value={u.extUserId}>
                    {u.firstName} {u.lastName} ({u.extUserId})
                  </option>
                ))}
              </select>
              {usersLoading && <Spinner style={{ position: 'absolute', right: 28, top: '50%', marginTop: -7, pointerEvents: 'none' }} />}
            </div>

            <Label>Patient</Label>
            <div style={{ position: 'relative' }}>
              <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)} style={{ ...inputStyle, paddingRight: patientsLoading ? 46 : undefined }} disabled={!selectedOrg}>
                <option value="">-- select --</option>
                {patients.map(p => (
                  <option key={p.extPatientId} value={p.extPatientId}>
                    {p.firstName} {p.lastName} ({p.extPatientId}){p.connectionStatus ? ` [${p.connectionStatus}]` : ''}
                  </option>
                ))}
              </select>
              {patientsLoading && <Spinner style={{ position: 'absolute', right: 28, top: '50%', marginTop: -7, pointerEvents: 'none' }} />}
            </div>
          </Grid2>
        </Section>
      )}

      {error && (
        <div style={{ padding: 12, background: '#fee', border: '1px solid #fcc', borderRadius: 8, marginBottom: 16, color: '#c00' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #ddd', marginBottom: 16 }}>
        <TabButton active={tab === 'widget'} onClick={() => setTab('widget')}>Widget</TabButton>
        <TabButton active={tab === 'orgs'} onClick={() => setTab('orgs')}>Organisations</TabButton>
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>Users</TabButton>
        <TabButton active={tab === 'patients'} onClick={() => setTab('patients')}>Patients</TabButton>
        <TabButton active={tab === 'contract'} onClick={() => setTab('contract')}>Contract</TabButton>
        <TabButton active={tab === 'stats'} onClick={() => setTab('stats')}>Stats</TabButton>
      </div>

      {tab === 'widget' && (
        <WidgetTab
          onOpen={viewNhsRecords}
          jwt={jwt}
          jwtClaims={jwtClaims}
          expiresIn={expiresIn}
          countdown={countdown}
        />
      )}

      {tab === 'orgs' && (
        <OrgsTab
          orb={orb}
          orgs={knownOrgs}
          onRefreshOrgs={() => loadOrgs()}
          onChanged={() => loadOrgs(true)}
        />
      )}

      {tab === 'users' && (
        <UsersTab
          orb={orb}
          selectedOrg={selectedOrg}
          users={users}
          onRefreshUsers={() => loadUsers(selectedOrg)}
          onChanged={() => loadUsers(selectedOrg, true)}
        />
      )}

      {tab === 'patients' && (
        <PatientsTab
          orb={orb}
          selectedOrg={selectedOrg}
          selectedUser={selectedUser}
          selectedPatient={selectedPatient}
          patients={patients}
          onRefreshPatients={() => loadPatients(selectedOrg)}
          onChanged={() => loadPatients(selectedOrg, true)}
        />
      )}

      {tab === 'stats' && (
        <StatsTab
          orb={orb}
          orgs={knownOrgs}
          onRefreshOrgs={() => loadOrgs()}
        />
      )}

      {tab === 'contract' && (
        <ContractTab
          selectedOrg={selectedOrg}
          contractStatus={contractStatus}
          signatoryFirstName={signatoryFirstName}
          signatoryLastName={signatoryLastName}
          signatoryEmail={signatoryEmail}
          onSignatoryFirstName={setSignatoryFirstName}
          onSignatoryLastName={setSignatoryLastName}
          onSignatoryEmail={setSignatoryEmail}
          onCheckStatus={checkContractStatus}
          onOpenContract={openContractWidget}
        />
      )}

        </main>

        {!rightCollapsed && (
          <div
            onMouseDown={startResize}
            onDoubleClick={() => setRightWidth(460)}
            title="Drag to resize - double-click to reset"
            className="orb-resizer"
            style={{
              width: 11,
              cursor: 'col-resize',
              position: 'sticky',
              top: 16,
              alignSelf: 'stretch',
              height: 'calc(100vh - 32px)',
              zIndex: 100,
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            <i style={{ width: 1, height: '100%', display: 'block' }} />
          </div>
        )}

        <aside style={{
          width: rightCollapsed ? 28 : rightWidth,
          flexShrink: 0,
          position: 'sticky',
          top: 16,
          alignSelf: 'flex-start',
          height: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          zIndex: 100,
          isolation: 'isolate',
          background: '#fff'
        }}>

      {rightCollapsed ? (
        <button
          onClick={() => setRightCollapsed(false)}
          title="Show API log"
          aria-label="Expand panel"
          className="orb-icon-btn"
          style={{
            width: 24, height: 24,
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'flex-start'
          }}>
          ‹
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6, flexShrink: 0 }}>
            <button
              onClick={() => setRightCollapsed(true)}
              title="Collapse panel"
              aria-label="Collapse panel"
              className="orb-icon-btn"
              style={{
                width: 24, height: 24,
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
              ›
            </button>
          </div>

          {logs[0] && <LastResponsePanel key={logs[0].id} entry={logs[0]} />}

          <Section title="API Call Log" style={{
            flex: 1,
            minHeight: 0,
            marginBottom: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
              <button onClick={() => { setLogs([]); setExpandedLogs(new Set()) }} style={btnStyle}>Clear</button>
              <div style={{
                fontSize: 12, color: '#999',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {logs.length > 0 && 'Click a row to expand'}
              </div>
            </div>
            {logs.length === 0 ? (
              <div style={{ color: '#999', fontSize: 13 }}>No calls yet</div>
            ) : (
              <div className="orb-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', fontSize: 12, fontFamily: 'monospace' }}>
                {logs.map(log => {
                  const isExpanded = expandedLogs.has(log.id)
                  return (
                    <div key={log.id} className="orb-log-row" style={{ borderBottom: '1px solid #f0f0f0', wordBreak: 'break-all' }}>
                      <div
                        onClick={() => toggleExpand(log.id)}
                        style={{ padding: '4px 0', cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ color: '#bbb', marginRight: 4 }}>{isExpanded ? '▼' : '▶'}</span>
                        <span style={{ color: '#999' }}>{log.time}</span>{' '}
                        <span style={{ color: '#07c', fontWeight: 600 }}>{log.method}</span>{' '}
                        <span>{log.url}</span>{' '}
                        {log.status !== undefined && (
                          <span style={{ color: log.status >= 200 && log.status < 300 ? '#0a0' : '#c00' }}>
                            [{log.status}]
                          </span>
                        )}
                        {!isExpanded && log.body && <span style={{ color: '#666' }}> {log.body.slice(0, 140)}</span>}
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '4px 0 8px 16px' }} onClick={e => e.stopPropagation()}>
                          <LogDetailTabs entry={log} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </>
      )}

        </aside>
      </div>
    </div>
    </SendNullLiteralContext.Provider>
  )
}
