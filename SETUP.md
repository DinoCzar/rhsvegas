# Ryan's Home Solutions — Setup Guide

Static site on **Render** + Node.js booking API + staff portal. Domain at **GoDaddy** (`rhsvegas.com`).

**Production deploy:** see [RENDER-GODADDY.md](RENDER-GODADDY.md)

## Architecture

| Part | Purpose |
|------|---------|
| **Website** (`index.html`, `assembly/`, etc.) | Customer-facing pages on Render static site |
| **API server** (`server/`) | Bookings, availability, SQLite database on Render |
| **Staff portal** (`admin/`) | Served from API at `/admin/` |

Customers pick from **staff-entered availability** at checkout — not Google Calendar.

---

## 1. Run the booking server locally

```bash
cd server
cp .env.example .env
# Edit .env — set JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, OWNER_EMAIL
npm install
npm run seed    # creates your admin login
npm start
```

Server runs at **http://localhost:3001**

- API: `http://localhost:3001/api`
- Staff portal: **http://localhost:3001/admin/**

### Staff workflow

1. Open the staff portal and sign in.
2. **Add Available Time** — pick date, start, and end (e.g. 9:00 AM – 11:00 AM).
3. Repeat for each open block you want customers to book.
4. **Employees** — admins can create employee accounts; each employee logs in and manages their own slots.
5. When a customer books, that slot is marked **Booked** and removed from checkout.

---

## 2. Configure the website

Production URLs are set in `js/config.js`:

- **rhsvegas.com** → API at `https://api.rhsvegas.com`
- **Render preview URL** → fallback Render API hostname
- **localhost** → `http://localhost:3001`

No manual changes needed unless your domain or Render service names differ.

---

## 3. Deploy to production (Render + GoDaddy)

Full step-by-step: **[RENDER-GODADDY.md](RENDER-GODADDY.md)**

Summary:

1. Deploy via `render.yaml` (two services: `rhsvegas-site` + `rhsvegas-api`)
2. Set API env vars and run `npm run seed`
3. Add custom domains in Render (`rhsvegas.com`, `www`, `api.rhsvegas.com`)
4. Point GoDaddy DNS to Render

---

## 4. Email notifications (optional)

Set SMTP variables in server `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@rhsvegas.com
OWNER_EMAIL=you@example.com
```

On checkout, the server emails you and the customer. Bookings still save if SMTP is not configured.

---

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/login` | — | Staff login |
| GET | `/api/auth/me` | Bearer | Current user |
| POST | `/api/auth/users` | Admin | Create employee |
| GET | `/api/auth/users` | Admin | List employees |
| GET | `/api/availability?date=YYYY-MM-DD` | — | Public open slots |
| GET | `/api/availability/manage?from=&to=` | Bearer | Staff view slots |
| POST | `/api/availability` | Bearer | Add slot |
| DELETE | `/api/availability/:id` | Bearer | Remove unbooked slot |
| POST | `/api/checkout` | — | Submit order + book slot |

---

## Pages to publish

| URL | File |
|-----|------|
| `/` | `index.html` |
| `/services/` | `services/index.html` |
| `/assembly/` | `assembly/index.html` |
| `/installation/` | `installation/index.html` |
| `/other-services/` | `other-services/index.html` |
| `/cart/` | `cart/index.html` |
| `/checkout/` | `checkout/index.html` |
| `/confirmation/` | `confirmation/index.html` |

Staff portal is served from the API at `https://api.rhsvegas.com/admin/` in production.

---

## Legacy Google Apps Script

`api/Code.gs` is **deprecated** — replaced by the Node server. You can delete it after migrating.
