// Scan sessions (feature 006 FR-002 to FR-004). Adopted 2026-11-20 with the user; see
// docs/features/feature-006-web-app/DESIGN.md.
//
// Flow: the landing page creates a session, downloads the scanner with the session ID appended
// to the executable (marker SCANNER_SESSION_MARKER + ID, read back by the scanner), and opens
// /s/:sessionId. The scanner posts its progress to the session and sends the ID with its upload;
// the server then emits `complete` with the device ID. The session ID is a bearer secret for
// progress only: it grants no access to device data and no device route returns it.
import { Type, type Static } from 'typebox'
import { DeviceId } from './common.ts'

/** 26 Crockford base32 characters from a CSPRNG (130 bits). */
export const SessionId = Type.String({
  pattern: '^[0-9A-HJKMNP-TV-Z]{26}$',
  description: '26 Crockford base32 characters encoding 130 random bits',
})
export type SessionId = Static<typeof SessionId>

/** Appended to the downloaded executable, followed by the session ID (37 bytes in total). */
export const SCANNER_SESSION_MARKER = 'LEAAFSCAN1:'

/** Response of POST /api/sessions. */
export const ScanSession = Type.Object(
  {
    session_id: SessionId,
    download_url: Type.String({ description: 'Relative URL of the scanner built for this session' }),
  },
  { additionalProperties: false },
)
export type ScanSession = Static<typeof ScanSession>

export const SCAN_STEP_IDS = ['started', 'cpu_memory', 'storage', 'battery', 'upload'] as const
export const ScanStepId = Type.Enum(SCAN_STEP_IDS)
export type ScanStepId = Static<typeof ScanStepId>

export const ScanStepEvent = Type.Object(
  { type: Type.Literal('step'), step: ScanStepId, state: Type.Enum(['running', 'done', 'skipped']) },
  { additionalProperties: false },
)

export const ScanErrorEvent = Type.Object(
  {
    type: Type.Literal('error'),
    code: Type.Enum(['scanner_failed', 'upload_failed', 'timeout', 'unknown']),
    message: Type.String({ maxLength: 500 }),
  },
  { additionalProperties: false },
)

/** What the scanner may post to POST /api/sessions/:id/events. */
export const ScannerEvent = Type.Union([ScanStepEvent, ScanErrorEvent])
export type ScannerEvent = Static<typeof ScannerEvent>

export const ScanCompleteEvent = Type.Object(
  { type: Type.Literal('complete'), device_id: DeviceId },
  { additionalProperties: false },
)

/** What GET /api/sessions/:id/events streams; the SSE event name equals `type`. */
export const ScanSessionEvent = Type.Union([ScanStepEvent, ScanErrorEvent, ScanCompleteEvent])
export type ScanSessionEvent = Static<typeof ScanSessionEvent>
