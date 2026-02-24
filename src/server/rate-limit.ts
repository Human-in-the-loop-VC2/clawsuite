/**
 * Simple in-memory rate limiter (no external deps).
 * Uses a sliding window approach per key.
 */

const store = new Map<string, { timestamps: number[] }>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, 300_000)

/**
 * Check if a request is allowed under the rate limit.
 * @returns true if allowed, false if blocked
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now()
  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    return false
  }

  entry.timestamps.push(now)
  return true
}

/**
 * Extract client IP from request for rate limiting key.
 */
export function getClientIp(request: Request): string {
  const trustedProxy = process.env.TRUSTED_PROXY_IP?.trim()

  // Security Hardening: Only trust proxy headers if a trusted proxy is configured.
  // Otherwise, an attacker can spoof their IP by sending these headers directly.
  if (trustedProxy) {
    // Use X-Real-IP if available
    const realIp = request.headers.get('x-real-ip')
    if (realIp) return realIp.trim()

    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
  }

  // Fallback for local development or non-proxied requests
  return 'local'
}

/**
 * Return a 429 Too Many Requests response.
 */
export function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests, please try again later' }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

/**
 * Sanitize error for response — hide details in production.
 */
export function safeErrorMessage(err: unknown): string {
  if (process.env.NODE_ENV === 'production') {
    return 'Internal server error'
  }
  return err instanceof Error ? err.message : String(err)
}
