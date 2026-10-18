// Contact-form Worker for blackwell-systems.com
//
// Flow: rate limit -> honeypot -> validate -> Turnstile verify -> send via ZeptoMail -> JSON.
// Routed at blackwell-systems.com/api/contact (see wrangler.toml).
//
// Secrets (set with `wrangler secret put`):
//   ZEPTOMAIL_TOKEN       ZeptoMail "Send Mail" token
//   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret key
// Vars (in wrangler.toml):
//   TO_EMAIL, FROM_ADDRESS, FROM_NAME, ZEPTO_API_URL

// Sites whose forms post here. The form on blackwell-systems.com is
// same-origin; golang-agents.com (the AI Agents in Go guide) posts
// cross-origin, and its name goes in the email's subject.
const ALLOWED_ORIGINS = {
  'https://blackwell-systems.com': '',
  'https://golang-agents.com': 'golang-agents.com',
  'https://www.golang-agents.com': 'golang-agents.com',
};
const DEFAULT_ORIGIN = 'https://blackwell-systems.com';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin in ALLOWED_ORIGINS ? origin : DEFAULT_ORIGIN,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, origin);
    }

    // Per-IP burst limit (on top of Turnstile). Shed abusive load early.
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return json({ ok: false, error: 'Too many attempts. Please wait a minute and try again.' }, 429, origin);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid request.' }, 400, origin);
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();
    const honeypot = String(body.company || '').trim();
    const token = String(body.turnstileToken || '');

    // Honeypot: bots fill the hidden field, people never see it. Accept and drop.
    if (honeypot) {
      return json({ ok: true }, 200, origin);
    }

    if (!name || !email || !message) {
      return json({ ok: false, error: 'Please fill in every field.' }, 400, origin);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: 'That email address looks off.' }, 400, origin);
    }
    if (message.length > 5000) {
      return json({ ok: false, error: 'Message is too long.' }, 400, origin);
    }

    // Verify Turnstile.
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    });
    const verify = await verifyRes.json();
    if (!verify.success) {
      return json({ ok: false, error: 'Spam check failed. Please try again.' }, 400, origin);
    }

    // Deliver via ZeptoMail (Zoho transactional email).
    const sendRes = await fetch(env.ZEPTO_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-enczapikey ${env.ZEPTOMAIL_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from: { address: env.FROM_ADDRESS, name: env.FROM_NAME },
        to: [{ email_address: { address: env.TO_EMAIL } }],
        reply_to: [{ address: email, name: name }],
        subject: ALLOWED_ORIGINS[origin]
          ? `New inquiry from ${name} (${ALLOWED_ORIGINS[origin]})`
          : `New inquiry from ${name}`,
        textbody: `From: ${name} <${email}>\n\n${message}`,
      }),
    });

    if (!sendRes.ok) {
      const detail = await sendRes.text();
      console.error('ZeptoMail error', sendRes.status, detail);
      return json(
        { ok: false, error: 'Could not send right now. Please email dayna@blackwell-systems.com directly.' },
        502,
        origin
      );
    }

    return json({ ok: true }, 200, origin);
  },
};
