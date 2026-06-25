// server/middleware/auth.ts
//
// PASSWORD GATE for the whole site.
//
// The app is public (anyone with the link can reach it) and every request to
// /api/chat spends real money on Claude + the data API. To stop strangers and
// bots from running up the bill, we put one shared password in front of
// EVERYTHING using HTTP Basic Auth.
//
//   - Set SITE_PASSWORD in the host's env to turn the gate ON.
//   - Leave it unset (e.g. local dev) and the gate is OFF — nothing changes.
//
// How visitors get in: the browser shows a native "username / password" popup.
// The username is ignored; they just type the shared password. The browser then
// remembers it and attaches it to every later request automatically (including
// the /api/chat fetches), so they only enter it once.

export default defineEventHandler((event) => {
  const password = process.env.SITE_PASSWORD?.trim()

  // No password configured → gate disabled (keeps local dev frictionless).
  if (!password)
    return

  const header = getRequestHeader(event, 'authorization') ?? ''

  if (header.startsWith('Basic ')) {
    // Decode "Basic base64(user:pass)" and compare only the password half.
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    const supplied = decoded.slice(decoded.indexOf(':') + 1)
    if (supplied === password)
      return // authorized — let the request through
  }

  // Missing or wrong password → challenge the browser to prompt for it.
  setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="Stock Analyst Agent"')
  throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
})
