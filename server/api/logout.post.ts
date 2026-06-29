// server/api/logout.post.ts  ->  POST /api/logout
//
// Clears the session cookie so the next request is treated as signed-out.

export default defineEventHandler((event) => {
  deleteCookie(event, AUTH_COOKIE, { path: '/' })
  return { ok: true }
})
