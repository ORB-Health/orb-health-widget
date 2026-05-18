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
  decodeJwtPayload,
} from './widgetIntegration'
import type { LogEntry, TabName } from './types'
import { loadStored, saveStored, usePersistedState } from './storage'
import { inputStyle, btnStyle } from './styles'
import {
  Section, Grid2, Label, TabButton,
  InputWithHistory, LastResponsePanel, LogDetailTabs,
} from './ui'
import { WidgetTab } from './tabs/WidgetTab'
import { OrgsTab } from './tabs/OrgsTab'
import { UsersTab } from './tabs/UsersTab'
import { PatientsTab } from './tabs/PatientsTab'

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
    return 'https://apitest-api.orbforhealth.com'
  })
  const [apiKey, setApiKey] = usePersistedState('apiKey', '')
  const serverBase = serverUrl.replace(/\/+$/, '').replace(/\/(v1|medical-record-embedded)$/, '')
  const apiBaseUrl = `${serverBase}/v1`
  const widgetBaseUrl = `${serverBase}/medical-record-embedded`

  const [tab, setTab] = usePersistedState<TabName>('tab', 'widget')

  // -- Shared context ------------------------------------------------------
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [patients, setPatients] = useState<PatientItem[]>([])

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

  // Widget bakes apiOrigin/widgetBaseUrl in at construction. When either
  // changes, throw away the cached instance so the next open rebuilds it.
  useEffect(() => {
    widgetRef.current?.destroy()
    widgetRef.current = null
  }, [apiBaseUrl, widgetBaseUrl])

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
    () => createOrbApi({ baseUrl: apiBaseUrl, apiKey, onRequest: addLog }),
    [apiBaseUrl, apiKey, addLog]
  )
  const orbSilent: OrbApi = useMemo(
    () => createOrbApi({ baseUrl: apiBaseUrl, apiKey }),
    [apiBaseUrl, apiKey]
  )

  // ===================================================================
  // Loaders. `silent=true` routes through orbSilent so the log panel
  // doesn't record automatic refreshes.
  // ===================================================================
  const loadOrgs = useCallback(async (silent = false) => {
    setError(null)
    const client = silent ? orbSilent : orb
    try {
      const { ok, status, data } = await client.listOrganisations()
      if (ok && Array.isArray(data)) setOrgs(data)
      else if (!ok) setError(`Failed to load orgs: ${status}`)
    } catch (e) { setError(String(e)) }
  }, [orb, orbSilent])

  const loadUsers = useCallback(async (orgId: string, silent = false) => {
    if (!orgId) { setUsers([]); return }
    const client = silent ? orbSilent : orb
    try {
      const { ok, data } = await client.listUsers(orgId)
      if (ok && Array.isArray(data)) setUsers(data)
    } catch (e) { setError(String(e)) }
  }, [orb, orbSilent])

  const loadPatients = useCallback(async (orgId: string, silent = false) => {
    if (!orgId) { setPatients([]); return }
    const client = silent ? orbSilent : orb
    try {
      const { ok, data } = await client.listPatients(orgId)
      if (ok && Array.isArray(data)) setPatients(data)
    } catch (e) { setError(String(e)) }
  }, [orb, orbSilent])

  useEffect(() => {
    if (selectedOrg) {
      loadUsers(selectedOrg, true)
      loadPatients(selectedOrg, true)
    } else {
      setUsers([])
      setPatients([])
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
        setError(`Token request failed: ${status}`)
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
            dob: patient?.dateOfBirth || patient?.dob || ''
          }
        })
      } else {
        widgetRef.current.setToken(data.accessToken)
        widgetRef.current.open({
          ehr_patient_id: selectedPatient,
          first_name: patient?.firstName || '',
          last_name: patient?.lastName || '',
          dob: patient?.dateOfBirth || patient?.dob || ''
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
  // Render
  // ===================================================================
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1600, margin: '0 auto', padding: 24 }}>
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
            placeholder="https://apitest-api.orbforhealth.com"
          />
          <Label>API Key</Label>
          <InputWithHistory value={apiKey} onChange={setApiKey} historyKey="apiKeyHistory" placeholder="X-API-KEY" />
        </Grid2>
      </Section>

      {(orgs.length > 0 || selectedOrg) && (
        <Section title="Context">
          <Grid2>
            <Label>Organisation</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={selectedOrg} onChange={e => { setSelectedOrg(e.target.value); setSelectedUser(''); setSelectedPatient('') }} style={{ ...inputStyle, flex: 1 }}>
                <option value="">-- select --</option>
                {orgs.map(o => (
                  <option key={o.extOrganisationId} value={o.extOrganisationId}>
                    {o.organisationName} ({o.extOrganisationId}){o.suspended ? ' [SUSPENDED]' : ''}
                  </option>
                ))}
              </select>
              <button onClick={() => loadOrgs()} style={btnStyle} title="Refresh organisations" disabled={!apiKey}>↻</button>
            </div>

            <Label>User (Clinician)</Label>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={inputStyle} disabled={!selectedOrg}>
              <option value="">-- select --</option>
              {users.map(u => (
                <option key={u.extUserId} value={u.extUserId}>
                  {u.firstName} {u.lastName} ({u.extUserId})
                </option>
              ))}
            </select>

            <Label>Patient</Label>
            <select value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)} style={inputStyle} disabled={!selectedOrg}>
              <option value="">-- select --</option>
              {patients.map(p => (
                <option key={p.extPatientId} value={p.extPatientId}>
                  {p.firstName} {p.lastName} ({p.extPatientId}){p.connectionStatus ? ` [${p.connectionStatus}]` : ''}
                </option>
              ))}
            </select>
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
          orgs={orgs}
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
          onChanged={() => loadPatients(selectedOrg, true)}
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
  )
}
