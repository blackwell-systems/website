# Blackwell Systems website

Source for [blackwell-systems.com](https://blackwell-systems.com): the marketing and portfolio site for Blackwell Systems, an evidence-first AI infrastructure and consulting practice. The site is a static Astro build served from GitHub Pages behind Cloudflare, with one server-side piece: a Cloudflare Worker that backs the contact form.

## Tech stack

- **Astro 6** (`output: 'static'`) built on the [AstroWind](https://github.com/onwidget/astrowind) theme.
- **TypeScript** across config, integrations, and content collections.
- **Tailwind CSS v4**, wired through the `@tailwindcss/vite` plugin.
- **MDX** for blog content, `astro-icon` (Tabler + flat-color-icons), `@astrojs/sitemap`, `@astrojs/rss`, and `astro-compress` for HTML/CSS/JS minification at build time.
- **Cloudflare** in front of the origin: DNS plus proxy (orange cloud). The proxy is what lets the same-origin `/api/contact` route reach the Worker.
- **GitHub Pages** for static hosting.
- **GitHub Actions** for build, checks, and deploy.
- **Cloudflare Workers** (the contact backend) with a Turnstile check and email delivery by a transactional email provider (ZeptoMail).

## Architecture

The rendered site is fully static. The only dynamic path is the contact form, which posts to a same-origin endpoint that Cloudflare routes to a Worker. Keeping the endpoint same-origin (`/api/contact`) means the browser makes a plain request to the site's own domain: no third-party form host, no cross-origin setup on the happy path.

### Contact pipeline

```
 Browser (static contact.astro page)
    |
    |  POST /api/contact   (same-origin JSON: name, email, message,
    |                       honeypot field "company", Turnstile token)
    v
 Cloudflare edge  (blackwell-systems.com is PROXIED / orange cloud)
    |
    |  route match: blackwell-systems.com/api/contact
    v
 Cloudflare Worker  (worker/index.js)
    |
    |  Defense in depth, in order:
    |    1. Method gate       -> only POST (OPTIONS -> CORS preflight 204)
    |    2. Per-IP rate limit -> 5 requests / 60s per IP, else 429
    |    3. Honeypot          -> hidden "company" field filled -> silently accept + drop
    |    4. Field validation  -> all fields present, email shape, message <= 5000 chars
    |    5. Turnstile verify   -> Cloudflare siteverify, else reject
    v
 Transactional email provider (ZeptoMail)
    |
    |  POST to ZEPTO_API_URL with reply_to set to the sender
    v
 Inbox  (dayna@blackwell-systems.com)
```

### Defense-in-depth layers

The Worker rejects cheap-to-detect abuse before spending work on expensive checks:

1. **Method gate.** Non-`POST` requests get `405`; `OPTIONS` returns a `204` CORS preflight. CORS is locked to `https://blackwell-systems.com`.
2. **Per-IP rate limit.** A Cloudflare rate-limit binding (`RATE_LIMITER`, 5 requests per 60 seconds per IP, keyed on `CF-Connecting-IP`) sheds bursts early, before parsing or any outbound call. Over the limit returns `429`.
3. **Honeypot.** The form renders a hidden `company` field, positioned off-screen and `aria-hidden`. Humans never see it; bots tend to fill it. A filled honeypot returns a `200` (so the bot sees success) but the message is dropped.
4. **Field validation.** Name, email, and message must be present; email is shape-checked; message is capped at 5000 characters.
5. **Turnstile verification.** The token from the page's Turnstile widget is verified server-side against Cloudflare's `siteverify` endpoint. A failed or missing token is rejected.

Only after all five pass does the Worker call the transactional email provider. Delivery sets `reply_to` to the submitter so replies go straight back to them, and the `from` address is a send-only subdomain (`send.blackwell-systems.com`) kept off the Zoho MX that receives real mail. On a provider error the Worker returns `502` with a fallback message pointing at the direct email address, and logs the provider detail for debugging.

## Repository and deploy model

Two long-lived branches, with different roles:

| Branch | Role |
|---|---|
| `main` | Repository default branch (`origin/HEAD -> main`). Runs the CI workflow (`.github/workflows/actions.yaml`): build plus checks on push and pull request. |
| `master` | Deploy source. Runs the deploy workflow (`.github/workflows/deploy.yml`): build and publish to GitHub Pages on push. The deploy workflow lives only on this branch. |

The two branches have diverged, so a change goes live only once it lands on `master`. Confirm the branch you push to matches the outcome you want: `main` for CI signal, `master` to ship.

### Deploy workflow (`.github/workflows/deploy.yml`)

Triggered on push to `master`. Pins actions by commit SHA and grants `pages: write` / `id-token: write`.

1. **build**: checkout, set up Node 22 with npm cache, `npm ci`, `npm run build`, then upload `dist/` as a Pages artifact.
2. **deploy**: `actions/deploy-pages` publishes the artifact to the `github-pages` environment.

Concurrency is grouped on `pages` with `cancel-in-progress: true`, so a newer push supersedes an in-flight deploy.

### CI workflow (`.github/workflows/actions.yaml`)

Triggered on push and pull request against `main`. Two jobs on Node 22:

- **build**: `npm ci` then `npm run build`. (A `npm test` step is present but commented out; there is no test suite yet.)
- **check**: `npm ci` then `npm run check` (Astro type check, ESLint, Prettier).

### Legacy config

`netlify.toml` and `vercel.json` are unused legacy from the AstroWind template (the site deploys to GitHub Pages, not Netlify or Vercel); `public/_headers` and Cloudflare handle asset caching. They are harmless and can be removed.

## Local development

Prerequisites: **Node >= 22.12** (the workflows pin Node 22) and npm.

```sh
npm ci            # install exact dependencies from package-lock.json
npm run dev       # local dev server (astro dev)
npm run build     # production build to dist/
npm run preview   # serve the built dist/ locally
npm run check     # astro check + eslint + prettier --check
npm run fix       # eslint --fix + prettier -w
```

Note that `/api/contact` is served by the Cloudflare Worker, not by `astro dev`, so the contact form's POST will not resolve against the local dev server. To exercise the backend locally, run the Worker (see below) or test against the deployed endpoint.

### Worker (contact backend)

The Worker lives in `worker/` with its own `package.json` and `wrangler.toml`.

```sh
cd worker
npm install
npm run dev       # wrangler dev  (local Worker)
npm run deploy    # wrangler deploy  (binds the route in wrangler.toml)
npm run tail      # wrangler tail  (stream live logs)
```

`wrangler deploy` reads the `routes` in `wrangler.toml` and binds the Worker to `blackwell-systems.com/api/contact`.

## Contact backend

The backend is a single Cloudflare Worker (`worker/index.js`). It runs the five defense-in-depth checks above, then delivers the message by email through a transactional email provider (ZeptoMail, Zoho's transactional-email product). The site itself stays static; this Worker is the only server-side component.

Configuration splits into non-secret vars and secrets:

**Vars** (plain values in `worker/wrangler.toml`):

| Name | Purpose |
|---|---|
| `TO_EMAIL` | Destination inbox for inquiries. |
| `FROM_ADDRESS` / `FROM_NAME` | Sender identity; the address must be on the provider-verified domain. |
| `ZEPTO_API_URL` | Provider API host for the account's data center. |

**Secrets** (set with `wrangler secret put`, never committed, referenced by name only):

| Name | Purpose |
|---|---|
| `ZEPTOMAIL_TOKEN` | Transactional email provider send token. |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key (server-side verification). |

The **Turnstile site key** is public by design and lives in `src/pages/contact.astro` (`TURNSTILE_SITE_KEY`), alongside the widget it drives.

A hard requirement: the DNS record serving the site must be **proxied** (orange cloud) for the same-origin `/api/contact` route to intercept. If it is DNS-only, either flip it to proxied or move the Worker to a dedicated proxied subdomain and point the form's `fetch` there; the CORS headers in `worker/index.js` already cover a cross-origin call.

For the granular one-time setup and deploy runbook (Turnstile widget creation, ZeptoMail domain verification and DKIM/TXT records, secret setup, and an end-to-end test), see [`worker/README.md`](worker/README.md).

## Project structure

```
.
├── astro.config.ts         # Astro config: static output, integrations, Tailwind via Vite, ~ alias
├── src/
│   ├── config.yaml         # Site metadata, SEO defaults, blog toggles, UI theme
│   ├── navigation.ts       # Header and footer link data
│   ├── content.config.ts   # Content collection schema (blog posts)
│   ├── pages/
│   │   ├── index.astro     # Home
│   │   ├── services.astro  # Services (fractional CTO, technical due diligence, AI cost optimization)
│   │   ├── about.astro     # About
│   │   ├── contact.astro   # Contact form + Turnstile widget; posts to /api/contact
│   │   ├── pricing.astro   # Pricing
│   │   ├── privacy.md      # Privacy policy
│   │   ├── terms.md        # Terms
│   │   ├── 404.astro       # Not-found page
│   │   ├── rss.xml.ts      # RSS feed endpoint
│   │   ├── [...blog]/      # Blog index, post, category, and tag routes
│   │   ├── homes/          # AstroWind demo home-page variants (template stock)
│   │   └── landing/        # AstroWind demo landing-page variants (template stock)
│   ├── components/         # Astro components (common, ui, widgets, blog, Logo, Favicons)
│   ├── layouts/            # Page / Landing / Markdown / base layouts
│   ├── data/post/          # Blog post source (MDX / Markdown)
│   ├── assets/             # Images and styles
│   └── utils/              # Frontmatter plugins, permalinks, helpers
├── vendor/integration/     # AstroWind integration (config builder / loader)
├── public/                 # Static passthrough: robots.txt, og-image, _headers, decapcms
├── worker/
│   ├── index.js            # Contact-form Worker (rate limit, honeypot, Turnstile, validation, send)
│   ├── wrangler.toml       # Worker config: route, rate-limit binding, non-secret vars
│   └── README.md           # One-time setup + deploy runbook for the Worker
├── .github/workflows/
│   ├── deploy.yml          # master -> build -> GitHub Pages (deploy source)
│   └── actions.yaml        # main -> build + check (CI)
├── netlify.toml            # Unused legacy (template stock)
├── vercel.json             # Unused legacy (template stock)
└── package.json            # Scripts and dependencies (Node >= 22.12)
```
