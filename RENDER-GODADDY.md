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
4. **rhsvegas-api** → **Shell** → run once:
   ```bash
   npm run seed
   ```
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
| API deploy fails | Ensure Node 20; check **Logs** on rhsvegas-api |
| Admin login fails | Run `npm run seed` in API shell; check `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| Bookings disappear after redeploy | Add persistent disk on Render for `DATABASE_PATH` (paid plan) or back up `data/rhsvegas.db` |

---

## Do not use GoDaddy basic web hosting for this app

Basic GoDaddy hosting cannot run the Node.js API. Keep the domain at GoDaddy and host on Render as described above.
