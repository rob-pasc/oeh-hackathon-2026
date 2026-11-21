// Admin configuration (feature 013 FR-001, FR-002). The admin area exists only when both
// ADMIN_USERNAME and ADMIN_PASSWORD are set and the password is long enough; otherwise every admin
// route is absent (404) and the rest of the server runs as usual.

/** Shorter passwords switch the admin area off: the login page is public (FR-002). */
export const MIN_ADMIN_PASSWORD_LENGTH = 16

export interface AdminConfig {
  username: string
  password: string
}

export function loadAdminConfig(env: NodeJS.ProcessEnv, warn: (message: string) => void = console.warn): AdminConfig | null {
  const username = env.ADMIN_USERNAME?.trim() ?? ''
  const password = env.ADMIN_PASSWORD ?? ''
  if (!username || !password) return null
  if ([...password].length < MIN_ADMIN_PASSWORD_LENGTH) {
    // Never include the password, or its length, in the message.
    warn(`admin area disabled: ADMIN_PASSWORD must have at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`)
    return null
  }
  return { username, password }
}
