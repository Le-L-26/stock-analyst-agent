// server/api/login.post.ts  ->  POST /api/login
//
// Checks the password typed on our custom login page and, if it's right, sets
// the session cookie the middleware looks for. The username is collected by the
// form for familiarity but it's not used for anything yet (this is a single
// shared-password site), so we ignore it here.

export default defineEventHandler(async (event) => {
  const { password } = await readBody<{ username?: string, password?: string }>(event)

  const required = process.env.SITE_PASSWORD?.trim()

  // When a password IS configured, it must match. When it's not (local dev),
  // we accept anything — see authDisabled() — so you can still exercise the UI.
  if (required && password?.trim() !== required) {
    throw createError({ statusCode: 401, statusMessage: 'Wrong password' })
  }

  setCookie(event, AUTH_COOKIE, expectedToken(), {
    httpOnly: true, // not readable by browser JS — mitigates XSS cookie theft
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // stay signed in for a week
  })

  return { ok: true }
})
