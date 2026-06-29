// server/utils/auth.ts
//
// Shared auth helpers. Files in server/utils are AUTO-IMPORTED by Nitro, so the
// login endpoint and the middleware can both call these without an explicit
// import.
//
// We moved off HTTP Basic Auth (the native browser popup) so we could build our
// OWN login page — one that can show a language toggle and localized labels.
// The new flow:
//   1. The login page POSTs the password to /api/login.
//   2. If it matches SITE_PASSWORD, we drop a cookie holding a TOKEN.
//   3. The middleware lets a request through only if that cookie's token is right.
//
// The cookie stores sha256(password), never the raw password, so a stolen cookie
// doesn't directly reveal the site password.

import { createHash } from 'node:crypto'

// Name of the session cookie (httpOnly — JS in the browser can't read it).
export const AUTH_COOKIE = 'sa_auth'

// The token a valid session cookie must contain. Derived from SITE_PASSWORD; if
// none is set (local dev), we derive from a fixed string so /api/login can still
// hand out a working cookie while accepting ANY password.
export function expectedToken(): string {
  const password = process.env.SITE_PASSWORD?.trim()
  return createHash('sha256').update(password || 'dev-no-password').digest('hex')
}

/** True when no SITE_PASSWORD is configured — i.e. local dev, accept anything. */
export function authDisabled(): boolean {
  return !process.env.SITE_PASSWORD?.trim()
}
