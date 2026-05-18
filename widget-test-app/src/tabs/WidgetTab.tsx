import { Section } from '../ui'
import { btnStyle, btnPrimary } from '../styles'

export function WidgetTab(props: {
  onOpen: () => void
  jwt: string | null
  jwtClaims: Record<string, unknown> | null
  expiresIn: number | null
  countdown: number | null
}) {
  return (
    <>
      <Section title="Open Widget">
        <p style={{ marginTop: 0, color: '#666', fontSize: 13 }}>
          Requests an access token for the selected org/user/patient and opens the widget iframe.
        </p>
        <button onClick={props.onOpen} style={{ ...btnStyle, ...btnPrimary }}>
          View NHS Records
        </button>
      </Section>

      {props.jwt && (
        <Section title="JWT Token">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all', background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 80, overflow: 'auto' }}>
              {props.jwt}
            </code>
            <button onClick={() => navigator.clipboard.writeText(props.jwt!)} style={btnStyle}>Copy</button>
          </div>
          {props.jwtClaims && (
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div><b>extOrganisationId:</b> {String(props.jwtClaims.extOrganisationId || '-')}</div>
              <div><b>extUserId:</b> {String(props.jwtClaims.extUserId || '-')}</div>
              <div><b>extPatientId:</b> {String(props.jwtClaims.extPatientId || '-')}</div>
              <div><b>iss:</b> {String(props.jwtClaims.iss || '-')} | <b>aud:</b> {String(props.jwtClaims.aud || '-')}</div>
              <div><b>exp:</b> {props.jwtClaims.exp ? new Date(Number(props.jwtClaims.exp) * 1000).toLocaleTimeString() : '-'}</div>
              <div>
                <b>Expires in:</b>{' '}
                <span style={{ color: props.countdown !== null && props.countdown < 60 ? '#c00' : '#333', fontWeight: 600 }}>
                  {props.countdown !== null
                    ? `${Math.floor(props.countdown / 60)}m ${props.countdown % 60}s`
                    : `${props.expiresIn}s`}
                </span>
              </div>
            </div>
          )}
        </Section>
      )}
    </>
  )
}
