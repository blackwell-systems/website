# Contact-form Worker

Backend for the `/contact` form. Receives the form POST, checks Turnstile, and
emails the message to `dayna@blackwell-systems.com` via ZeptoMail. The site itself
stays static on GitHub Pages; this is the only server-side piece.

## One-time setup

### 1. Turnstile (anti-spam)

1. Cloudflare dashboard -> **Turnstile** -> **Add widget**.
2. Name it, add hostname `blackwell-systems.com`, widget type **Managed**.
3. Copy the **Site key** and **Secret key**.
4. Paste the **Site key** into `src/pages/contact.astro` -> `TURNSTILE_SITE_KEY`
   (this one is public, it belongs in the page).

### 2. ZeptoMail (email delivery)

ZeptoMail is Zoho's transactional-email product, same Zoho login you already use
for mail. A Worker cannot drop a message into an inbox directly; it has to *send*
one, and sending needs a service. This is that service, kept in the Zoho family.

1. Open [ZeptoMail](https://www.zoho.com/zeptomail/) with your Zoho account and
   create a **Mail Agent**.
2. **Domains** -> add `send.blackwell-systems.com` (a send-only subdomain keeps
   this off the Zoho MX that delivers your real `dayna@` mail, so nothing you
   already rely on changes).
3. ZeptoMail shows DNS records (a domain-verification TXT and a DKIM record). Add
   them in Cloudflare DNS, then click **Verify**. (Ask Claude to add them via the
   Cloudflare API, or add them by hand.)
4. Create a **Send Mail token** (this is `ZEPTOMAIL_TOKEN`).
5. If you verify a different domain/subdomain, update `FROM_ADDRESS` in
   `wrangler.toml` to match (the `from` address must be on the verified domain).
   If your account is on the EU/IN/AU data center, update `ZEPTO_API_URL` too.

### 3. Deploy the Worker

```sh
cd worker
npm install -g wrangler      # or use: npx wrangler <cmd>
wrangler login               # ! wrangler login  (run in the Claude session to auth interactively)
wrangler secret put ZEPTOMAIL_TOKEN       # paste the ZeptoMail Send Mail token
wrangler secret put TURNSTILE_SECRET_KEY  # paste the Turnstile secret key
wrangler deploy
```

`wrangler deploy` reads the `routes` in `wrangler.toml` and binds the Worker to
`blackwell-systems.com/api/contact`.

## Requirement: the site record must be proxied

For the same-origin route to intercept, the DNS record serving the site
(`blackwell-systems.com`, and `www` if used) must be **proxied** (orange cloud)
in Cloudflare. GitHub Pages behind Cloudflare's proxy is fine. If it is DNS-only,
either flip it to proxied, or deploy this Worker on a dedicated proxied subdomain
(`api.blackwell-systems.com`), point the form's `fetch` at that URL, and the CORS
headers already in `index.js` will cover the cross-origin call.

## Test

```sh
curl -i https://blackwell-systems.com/api/contact \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"you@example.com","message":"hello","turnstileToken":"x"}'
# Expect 400 "Spam check failed" (no real Turnstile token) -> the Worker is live.
```

Then submit the real form once end to end and confirm the email arrives.

## Config summary

| Setting | Where | Value |
|---|---|---|
| `TO_EMAIL` | `wrangler.toml` vars | `dayna@blackwell-systems.com` |
| `FROM_ADDRESS` / `FROM_NAME` | `wrangler.toml` vars | address on the ZeptoMail-verified domain |
| `ZEPTO_API_URL` | `wrangler.toml` vars | ZeptoMail API host for your data center |
| `ZEPTOMAIL_TOKEN` | `wrangler secret` | ZeptoMail Send Mail token |
| `TURNSTILE_SECRET_KEY` | `wrangler secret` | Turnstile secret key |
| `TURNSTILE_SITE_KEY` | `src/pages/contact.astro` | Turnstile site key (public) |
