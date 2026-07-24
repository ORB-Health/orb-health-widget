import { Section, Hint, Grid2, Label } from '../ui'
import { btnStyle, btnPrimary, inputStyle } from '../styles'
import type { OrgContractStatus } from '../types'

export function ContractTab(props: {
  selectedOrg: string
  contractStatus: OrgContractStatus | null
  signatoryFirstName: string
  signatoryLastName: string
  signatoryEmail: string
  onSignatoryFirstName: (value: string) => void
  onSignatoryLastName: (value: string) => void
  onSignatoryEmail: (value: string) => void
  onCheckStatus: () => void
  onOpenContract: () => void
}) {
  if (!props.selectedOrg) {
    return (
      <div style={{ padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
        Select an organisation in the Context section first.
      </div>
    )
  }

  const status = props.contractStatus

  return (
    <>
      <Section title="Contract status">
        <p style={{ marginTop: 0, color: '#666', fontSize: 13 }}>
          Polls whether the selected organisation's contract has been signed.
          The signing itself happens inside the iframe below, not via this call.
        </p>
        <button onClick={props.onCheckStatus} style={btnStyle}>
          GET contract-status
        </button>
        {status && (
          <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 12 }}>
            <div><b>extOrganisationId:</b> {status.extOrganisationId}</div>
            <div>
              <b>contractSigned:</b>{' '}
              <span style={{ color: status.contractSigned ? '#0a0' : '#c00', fontWeight: 600 }}>
                {String(status.contractSigned)}
              </span>
            </div>
            <div><b>contractSignedAt:</b> {status.contractSignedAt ?? '-'}</div>
          </div>
        )}
      </Section>

      <Section title="Signatory details (SET_SIGNATORY)">
        <Hint>
          Optional. Sent to the iframe via the SET_SIGNATORY postMessage right
          after SET_TOKEN. The widget renders these into the contract text and
          pre-fills the signature form. Leave blank to open the contract with
          empty signatory placeholders, as hosts that don't send the message
          would see it.
        </Hint>
        <Grid2>
          <Label>First name</Label>
          <input
            style={inputStyle}
            value={props.signatoryFirstName}
            onChange={e => props.onSignatoryFirstName(e.target.value)}
            placeholder="Jane"
          />
          <Label>Last name</Label>
          <input
            style={inputStyle}
            value={props.signatoryLastName}
            onChange={e => props.onSignatoryLastName(e.target.value)}
            placeholder="Smith"
          />
          <Label>Email</Label>
          <input
            style={inputStyle}
            value={props.signatoryEmail}
            onChange={e => props.onSignatoryEmail(e.target.value)}
            placeholder="jane.smith@clinic.example"
          />
        </Grid2>
      </Section>

      <Section title="Sign contract">
        <Hint>
          Requests an organisation-scoped contract token and opens the contract
          widget iframe. The widget records the signature itself, then notifies
          this harness, which refreshes the status above.
        </Hint>
        <button onClick={props.onOpenContract} style={{ ...btnStyle, ...btnPrimary }}>
          Open Contract iFrame
        </button>
      </Section>
    </>
  )
}
