# Ryan's Home Solutions — Setup Guide

Static site (GitHub Pages) + Node.js booking server + staff availability portal.

## Architecture

| Part | Purpose |
|------|---------|
| **Website** (`index.html`, `assembly/`, etc.) | Customer-facing pages, cart in `localStorage` |
| **API server** (`server/`) | Stores availability, bookings, employee accounts |
| **Staff portal** (`admin/`) | Employees log in and set open appointment times |

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

In `js/config.js`:

```javascript
apiUrl: "http://localhost:3001/api",           // production: https://your-api-url.com/api
adminUrl: "http://localhost:3001/admin/",
```

For production, set `apiUrl` to your deployed server URL.

---

## 3. Deploy the API server (production)

Recommended hosts: [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io).

1. Push this repo to GitHub.
2. Create a new service pointing at the `server/` folder.
3. Set environment variables from `server/.env.example`.
4. Add a **persistent disk/volume** for `DATABASE_PATH` (e.g. `/data/rhsvegas.db`) so bookings survive restarts.
5. Run seed once (Railway/Render shell): `npm run seed`
6. Add your live site URL to `FRONTEND_ORIGINS` (e.g. `https://rhsvegas.com`).

Update `js/config.js` `apiUrl` to your production API URL.

---

## 4. Deploy the website (GitHub Pages)

1. Enable GitHub Pages on the repo (branch `main`, root `/`).
2. Point `rhsvegas.com` DNS to GitHub Pages.
3. Ensure `js/config.js` uses your **production** `apiUrl`.

---

## 5. Email notifications (optional)

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

Staff portal is served from the API server at `/admin/`, not GitHub Pages.

---

## Legacy Google Apps Script

`api/Code.gs` is **deprecated** — replaced by the Node server. You can delete it after migrating.
