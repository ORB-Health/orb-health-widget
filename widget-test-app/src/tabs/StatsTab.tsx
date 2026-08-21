import { useRef, useState } from 'react'
import type { OrbApi, OrgItem, StatsQuery } from '../orbApi'
import { Section, Grid2, Label, Hint } from '../ui'
import { inputStyle, btnStyle } from '../styles'

/**
 * Free-text date input with a native calendar picker on the side. Text is
 * sent verbatim (full ISO date-times and invalid values stay testable); the
 * hidden date input only exists so showPicker() can anchor a calendar to it.
 */
function DateField(props: { value: string; onChange: (v: string) => void }) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const asPickerValue = /^\d{4}-\d{2}-\d{2}$/.test(props.value) ? props.value : ''
  return (
    <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
      <input value={props.value} onChange={e => props.onChange(e.target.value)}
        style={{ ...inputStyle, flex: 1 }} placeholder="YYYY-MM-DD or ISO date-time (optional)" />
      <input ref={pickerRef} type="date" tabIndex={-1} aria-hidden="true"
        value={asPickerValue} onChange={e => props.onChange(e.target.value)}
        style={{ position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0, padding: 0 }} />
      <button onClick={() => pickerRef.current?.showPicker()} title="Pick a date"
        style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', padding: '8px 10px', color: '#8a8f98' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    </div>
  )
}

export function StatsTab(props: {
  orb: OrbApi
  orgs: OrgItem[]
  onRefreshOrgs: () => void
}) {
  const [orgFilter, setOrgFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const query = (): StatsQuery | undefined => {
    const q: StatsQuery = {
      ...(orgFilter ? { extOrganizationKey: orgFilter } : {}),
      ...(fromDate.trim() ? { fromDate: fromDate.trim() } : {}),
      ...(toDate.trim() ? { toDate: toDate.trim() } : {}),
    }
    return Object.keys(q).length ? q : undefined
  }

  const reset = () => {
    setOrgFilter('')
    setFromDate('')
    setToDate('')
  }

  return (
    <>
      <Section title="Filters">
        <Hint>
          All stats endpoints return one row per organisation the API key can see.
          The organisation filter narrows to a single org (404 if the key doesn't own it).
          Note the query parameter is spelled <code>extOrganizationKey</code> (with a "z").
          Dates accept <code>YYYY-MM-DD</code> or full ISO date-time and are sent verbatim;
          <b> fromDate &gt; toDate</b> returns 400.
        </Hint>
        <Grid2>
          <Label>Organisation (optional)</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={orgFilter} onChange={e => setOrgFilter(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">-- all organisations --</option>
              {props.orgs.map(o => (
                <option key={o.extOrganisationId} value={o.extOrganisationId}>
                  {o.organisationName} ({o.extOrganisationId}){o.suspended ? ' [SUSPENDED]' : ''}
                </option>
              ))}
            </select>
            <button onClick={props.onRefreshOrgs} style={btnStyle} title="Refresh organisations">↻</button>
          </div>
          <Label>From date (optional)</Label>
          <DateField value={fromDate} onChange={setFromDate} />
          <Label>To date (optional)</Label>
          <DateField value={toDate} onChange={setToDate} />
        </Grid2>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={reset} style={btnStyle}>Reset filters</button>
        </div>
      </Section>

      <Section title="Consent statistics">
        <Hint>
          Without dates, counts come from each patient's <b>last</b> invitation /
          data-access-request email date. With a date range, counts come from the
          per-link send history (distinct patients with a link sent in the range).
          <b> consent-granted</b> counts patients with any IM1 category enabled;
          <b> no-response</b> counts sent requests that were neither accepted nor declined.
        </Hint>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => props.orb.getLinksSentStats(query())} style={btnStyle}>GET links-sent</button>
          <button onClick={() => props.orb.getConsentGrantedStats(query())} style={btnStyle}>GET consent-granted</button>
          <button onClick={() => props.orb.getConsentDeclinedStats(query())} style={btnStyle}>GET consent-declined</button>
          <button onClick={() => props.orb.getNoResponseStats(query())} style={btnStyle}>GET no-response</button>
        </div>
      </Section>

      <Section title="Widget T&amp;Cs / NHS records viewed">
        <Hint>
          <b>widget-terms</b> is a snapshot of the current signed / not-signed state
          (archived users excluded; clinician and locum are independent flags, so a
          locum clinician counts in both splits). It has <b>no date range</b> - only the
          organisation filter is sent. <b>nhs-records-viewed</b> counts distinct patients
          viewed via the IM1 widget per org and per user, honours all three filters, and
          lists non-archived users even with 0 views.
        </Hint>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => props.orb.getWidgetTermsStats(orgFilter || undefined)} style={btnStyle}>GET widget-terms</button>
          <button onClick={() => props.orb.getNhsRecordsViewedStats(query())} style={btnStyle}>GET nhs-records-viewed</button>
        </div>
      </Section>
    </>
  )
}
