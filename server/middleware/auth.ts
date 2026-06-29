// server/middleware/auth.ts
//
// PASSWORD GATE for the expensive API.
//
// Every call to /api/chat spends real money on Claude + the data API, so we gate
// it behind a session cookie that only our /api/login endpoint hands out.
//
// We do NOT gate the page itself: it loads as a login form first, and only the
// API endpoints cost money. We also let /api/login through (you can't log in if
// the gate blocks the login call) and leave it open in local dev (no SITE_PASSWORD).
//
// (This replaces the old HTTP Basic Auth popup — we needed a real login page so
// it could carry the language toggle and localized labels.)

export default defineEventHandler((event) => {
  const path = event.path || ''

  // Only the API needs protecting; static pages/assets load freely.
  if (!path.startsWith('/api/'))
    return

  // The login endpoint must stay reachable, and local dev (no password) is open.
  if (path.startsWith('/api/login') || authDisabled())
    return

  // Valid session cookie? Let it through. Otherwise refuse (the SPA shows login).
  if (getCookie(event, AUTH_COOKIE) === expectedToken())
    return

  throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
})
