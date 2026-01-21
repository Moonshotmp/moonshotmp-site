export async function handler() {
  return {
    statusCode: 200,
    headers: {
      'Set-Cookie':
        'ms_partner_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
    },
    body: ''
  }
}
