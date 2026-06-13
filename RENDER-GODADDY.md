# Deploy on Render with GoDaddy domain (rhsvegas.com)

**GoDaddy** = domain name and DNS only  
**Render** = hosts the website, booking API, and staff portal

| URL | Render service | Custom domain |
|-----|----------------|---------------|
| Website | `rhsvegas-site` | `rhsvegas.com`, `www.rhsvegas.com` |
| API + admin | `rhsvegas-api` | `api.rhsvegas.com` |

The repo is already configured in `js/config.js` and `render.yaml` for this setup.

---

## Part 1 — Deploy on Render (if not already done)

1. Push this repo to GitHub.
2. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** → connect repo (uses `render.yaml`).
   - Or use your existing `rhsvegas-site` and `rhsvegas-api` services linked to `main`.
3. On **rhsvegas-api** → **Environment**, set:
   - `ADMIN_EMAIL` — your login email
   - `ADMIN_PASSWORD` — strong password
   - `OWNER_EMAIL` — where booking notifications go
   - `FRONTEND_ORIGINS` — should include (already in `render.yaml`):
     ```
     https://rhsvegas.com,https://www.rhsvegas.com,https://rhsvegas-site-c5y0.onrender.com
     ```
   - `JWT_SECRET` — auto-generated is fine (must be 32+ characters)
4. **rhsvegas-api** uses a **persistent disk** (see Part 5) — admin login is auto-created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on startup; you do not need to run `npm run seed` on Render.
5. Confirm both services show **Live** in **Events**.

Test before custom domain:

- Site: `https://rhsvegas-site-c5y0.onrender.com/`
- API: `https://rhsvegas-api-c5y0.onrender.com/api/health`
- Admin: `https://rhsvegas-api-c5y0.onrender.com/admin/`

---

## Part 2 — Add custom domains in Render

### Website (`rhsvegas-site`)

1. **Settings** → **Custom Domains**
2. Add **`rhsvegas.com`**
3. Add **`www.rhsvegas.com`**
4. Render shows DNS records — keep this page open

### API (`rhsvegas-api`)

1. **Settings** → **Custom Domains**
2. Add **`api.rhsvegas.com`**
3. Note the CNAME target Render provides

Render provisions free SSL automatically once DNS is correct.

---

## Part 3 — Point DNS in GoDaddy

1. [godaddy.com](https://www.godaddy.com) → **My Products** → **rhsvegas.com** → **DNS**
2. Add/update records **exactly as Render shows** (examples below — use Render’s values):

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| **CNAME** | `www` | `rhsvegas-site.onrender.com` (or your exact hostname) | Website |
| **CNAME** | `api` | your API hostname on Render | Booking API |
| **A** or **ALIAS** | `@` | IP or ANAME from Render | Apex `rhsvegas.com` |

3. Remove old A/CNAME records that conflict (GoDaddy parking page, old hosting).
4. Wait 15 minutes to 48 hours for DNS to propagate.

Check: [dnschecker.org](https://dnschecker.org) for `rhsvegas.com` and `api.rhsvegas.com`.

---

## Part 4 — Verify production

When DNS is live:

| Test | URL |
|------|-----|
| Homepage | https://rhsvegas.com/ |
| Services | https://rhsvegas.com/installation/ |
| Checkout | Add item → checkout → slots load |
| Admin | https://api.rhsvegas.com/admin/ |

Hard refresh Safari after first visit: **Cmd + Shift + R**

---

## Part 5 — Persist staff availability and bookings

Render’s **free** tier uses an **ephemeral filesystem** — a local SQLite file is wiped whenever the API restarts or spins down after inactivity.

This repo uses **[Turso](https://turso.tech)** (free tier) for cloud SQLite so your **weekly schedule**, **date overrides**, **bookings**, and **staff accounts** survive restarts without paying for Render’s Starter plan or persistent disk.

On each startup the API also **regenerates bookable time slots** from the saved weekly schedule so checkout dates appear immediately.

### One-time Turso setup

1. Sign up at [turso.tech](https://turso.tech) and install the CLI (optional but helpful):
   ```bash
   brew install tursodatabase/tap/turso
   turso auth login
   ```
2. Create a database:
   ```bash
   turso db create rhsvegas
   turso db show rhsvegas --url
   turso db tokens create rhsvegas
   ```
3. Render dashboard → **rhsvegas-api** → **Environment** → add:
   | Variable | Value |
   |----------|--------|
   | `TURSO_DATABASE_URL` | `libsql://…` from step 2 |
   | `TURSO_AUTH_TOKEN` | token from step 2 |
4. **Manual Deploy** → deploy latest commit.

Local dev still uses a file at `server/data/rhsvegas.db` — no Turso credentials needed unless you want to point at the cloud DB.

After the first deploy, re-save your weekly schedule once in the staff portal if slots were lost before migration.

---

## How the pieces connect

```
Customer browser
    ↓
https://rhsvegas.com          (Render static site — pages, cart)
    ↓ checkout API calls
https://api.rhsvegas.com/api  (Render Node server — bookings, slots)
    ↓
Staff portal
https://api.rhsvegas.com/admin/
```

`js/config.js` sends API requests to `api.rhsvegas.com` when the site is opened on `rhsvegas.com`.

---

## Updating the site later

1. Push changes to GitHub `main`
2. Render auto-redeploys both services
3. Hard refresh browser if layout looks stale

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Domain shows GoDaddy parking page | DNS not updated or still propagating |
| Checkout fails on rhsvegas.com | Check `FRONTEND_ORIGINS` includes `https://rhsvegas.com` |
| API deploy fails on startup | Logs say `JWT_SECRET` — add a 32+ character random string in Environment and Save |
| API deploy fails on build | Set **Root Directory** to `.`, **Build** `cd server && npm install`, **Start** `cd server && npm start` |
| Admin login fails | Check `ADMIN_EMAIL` / `ADMIN_PASSWORD` in Environment; redeploy and try again |
| Staff availability gone after idle | Upgrade to **Starter** + persistent disk at `/var/data` (see Part 5) |
| Bookings disappear after redeploy | Same as above — database must live on the persistent disk |

---

## Do not use GoDaddy basic web hosting for this app

Basic GoDaddy hosting cannot run the Node.js API. Keep the domain at GoDaddy and host on Render as described above.
