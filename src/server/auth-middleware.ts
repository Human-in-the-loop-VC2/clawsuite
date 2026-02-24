import { randomBytes, timingSafeEqual, pbkdf2Sync } from 'node:crypto'

/**
 * In-memory session store.
 * Now using a Map to track expiration and prevent DoS by limiting total sessions.
 */
const validTokens = new Map<string, number>()
const MAX_SESSIONS = 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * Generate a cryptographically secure session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Store a session token as valid.
 * Evicts the oldest session if the limit is reached.
 */
export function storeSessionToken(token: string): void {
  if (validTokens.size >= MAX_SESSIONS) {
    const oldestKey = validTokens.keys().next().value
    if (oldestKey) validTokens.delete(oldestKey)
  }
  validTokens.set(token, Date.now() + SESSION_TTL_MS)
}

/**
 * Check if a session token is valid and not expired.
 */
export function isValidSessionToken(token: string): boolean {
  const expiresAt = validTokens.get(token)
  if (!expiresAt) return false
  if (Date.now() > expiresAt) {
    validTokens.delete(token)
    return false
  }
  return true
}

/**
 * Remove a session token (logout).
 */
export function revokeSessionToken(token: string): void {
  validTokens.delete(token)
}

/**
 * Check if password protection is enabled.
 */
export function isPasswordProtectionEnabled(): boolean {
  return Boolean(
    (process.env.CLAWSUITE_PASSWORD && process.env.CLAWSUITE_PASSWORD.length > 0) ||
    (process.env.CLAWSUITE_PASSWORD_HASH && process.env.CLAWSUITE_PASSWORD_HASH.length > 0)
  )
}

/**
 * Verify password using timing-safe comparison or PBKDF2 hash.
 */
export function verifyPassword(password: string): boolean {
  // 1. Try Hash comparison if configured (more secure)
  const hashedConfig = process.env.CLAWSUITE_PASSWORD_HASH
  if (hashedConfig && hashedConfig.includes(':')) {
    try {
      const [salt, iterations, hash] = hashedConfig.split(':')
      const derived = pbkdf2Sync(
        password,
        salt,
        parseInt(iterations, 10),
        32,
        'sha256'
      ).toString('hex')
      return timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'))
    } catch {
      // Fallback or fail
    }
  }

  // 2. Fallback to Plaintext comparison (legacy/dev)
  const configured = process.env.CLAWSUITE_PASSWORD
  if (!configured || configured.length === 0) {
    return false
  }

  // Timing-safe comparison
  const passwordBuf = Buffer.from(password, 'utf8')
  const configuredBuf = Buffer.from(configured, 'utf8')

  // If lengths differ, still do a comparison to avoid timing leak
  if (passwordBuf.length !== configuredBuf.length) {
    return false
  }

  try {
    return timingSafeEqual(passwordBuf, configuredBuf)
  } catch {
    return false
  }
}

/**
 * Extract session token from cookie header.
 */
export function getSessionTokenFromCookie(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map((c) => c.trim())
  for (const cookie of cookies) {
    if (cookie.startsWith('clawsuite-auth=')) {
      return cookie.substring('clawsuite-auth='.length)
    }
  }
  return null
}

/**
 * Check if the request is authenticated.
 * Returns true if:
 * - Password protection is disabled, OR
 * - Request has a valid session token
 */
export function isAuthenticated(request: Request): boolean {
  // No password configured? No auth needed
  if (!isPasswordProtectionEnabled()) {
    return true
  }

  // Check for valid session token
  const cookieHeader = request.headers.get('cookie')
  const token = getSessionTokenFromCookie(cookieHeader)

  if (!token) {
    return false
  }

  return isValidSessionToken(token)
}

export function requireAuth(request: Request): Response | null {
  if (!isAuthenticated(request)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Double-submit CSRF validation for mutating methods
  if (!validateCsrf(request)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'CSRF validation failed' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return null
}

// ── CSRF Protection (double-submit cookie pattern) ──────────────────────────

const CSRF_COOKIE_NAME = 'clawsuite-csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Generate a CSRF token.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Create a Set-Cookie header for the CSRF token (readable by JS, unlike auth cookie).
 */
export function createCsrfCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  return `${CSRF_COOKIE_NAME}=${token}; SameSite=Strict; Path=/;${secure} Max-Age=${30 * 24 * 60 * 60}`
}

/**
 * Extract CSRF token from cookie header.
 */
function getCsrfTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((c) => c.trim())
  for (const cookie of cookies) {
    if (cookie.startsWith(`${CSRF_COOKIE_NAME}=`)) {
      return cookie.substring(CSRF_COOKIE_NAME.length + 1)
    }
  }
  return null
}

/**
 * Validate CSRF token by comparing the cookie value with the header value.
 * Only applies to mutating methods (POST, PUT, PATCH, DELETE).
 */
export function validateCsrf(request: Request): boolean {
  const method = request.method.toUpperCase()
  // Safe methods don't need CSRF validation
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true
  }
  // If no password protection, skip CSRF too
  if (!isPasswordProtectionEnabled()) {
    return true
  }
  const cookieToken = getCsrfTokenFromCookie(request.headers.get('cookie'))
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!cookieToken || !headerToken) {
    return false
  }
  try {
    const cookieBuf = Buffer.from(cookieToken, 'utf8')
    const headerBuf = Buffer.from(headerToken, 'utf8')
    if (cookieBuf.length !== headerBuf.length) return false
    return timingSafeEqual(cookieBuf, headerBuf)
  } catch {
    return false
  }
}

/**
 * Create a Set-Cookie header for the session token.
 */
export function createSessionCookie(token: string): string {
  // httpOnly: prevents JS access
  // secure: HTTPS only (disabled for local dev)
  // sameSite=strict: CSRF protection
  // path=/: available everywhere
  // maxAge: 30 days
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  return `clawsuite-auth=${token}; HttpOnly; SameSite=Strict; Path=/;${secure} Max-Age=${30 * 24 * 60 * 60}`
}
