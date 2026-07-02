# ⚡ Bitshake Smart Meter Dashboard

A comprehensive, real-time energy monitoring dashboard for the **Bitshake Smart Meter Reader Air**. Track electricity consumption, solar feed-in, costs, and detailed analytics — all in a premium, dark-themed web interface.

![Stack](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Stack](https://img.shields.io/badge/Fastify-5-white?logo=fastify)
![Stack](https://img.shields.io/badge/TimescaleDB-PostgreSQL-blue?logo=postgresql)
![Stack](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)
![Stack](https://img.shields.io/badge/MQTT-Mosquitto-purple?logo=eclipse-mosquitto)

---

## Architecture

```
Electricity Meter ──(IR)──> Bitshake Air (Tasmota)
                              │
                              │ MQTT (JSON telemetry)
                              ▼
                    ┌─────────────────────┐
                    │   Oracle Cloud VM    │
                    │   (Docker Compose)   │
                    │                     │
                    │ ┌─────────────────┐ │
                    │ │   Mosquitto     │ │ ← Port 1883 (MQTT)
                    │ │   MQTT Broker   │ │
                    │ └────────┬────────┘ │
                    │          │          │
                    │ ┌────────▼────────┐ │
                    │ │  Fastify API    │ │ ← MQTT Bridge + REST API
                    │ │  + MQTT Bridge  │ │
                    │ └────────┬────────┘ │
                    │          │          │
                    │ ┌────────▼────────┐ │
                    │ │  TimescaleDB    │ │ ← Time-series optimized
                    │ │  (PostgreSQL)   │ │
                    │ └─────────────────┘ │
                    │                     │
                    │ ┌─────────────────┐ │
                    │ │     Caddy       │ │ ← Port 443 (auto-SSL)
                    │ │  Reverse Proxy  │ │
                    │ └─────────────────┘ │
                    └─────────────────────┘
                              │
                              │ HTTPS
                              ▼
                    ┌─────────────────────┐
                    │   Vercel            │
                    │   Next.js Dashboard │
                    └─────────────────────┘
```

## Features

### Dashboard
- **6 Live KPI Cards** — Current power, today's consumption/feed-in, self-consumption rate, costs, earnings
- **Live Power Chart** — Real-time area chart (last 30 min, auto-refresh every 10s)
- **Daily Power Curve** — Consumption vs. solar feed-in over 24 hours
- **Weekly Energy Bars** — Stacked bar chart (import vs. export per day)
- **Monthly Trend** — Area chart showing daily consumption trend

### Analytics
- **Multi-range analysis** — 24 hours, 7 days, 30 days, 1 year
- **Energy Balance** — Consumption vs. export bar chart
- **Power Trend** — Average and peak power over time
- **Cost Calculations** — Net cost for any time range

### Settings
- **Electricity Price** — Configurable (default: €0.35/kWh)
- **Feed-in Tariff** — Configurable (Einspeisevergütung)
- **Currency** — EUR, USD, GBP, CHF
- **Auto-refresh** — 5–300 second intervals
- **CSV Export** — Download raw data for any date range
- **Password Management** — Change dashboard password

### Security
- JWT-based authentication (24h expiry)
- MQTT broker with username/password auth
- Database isolated in Docker network (not exposed)
- HTTPS via Caddy auto-SSL (Let's Encrypt)
- OCI Security Lists for port-level firewall
- Rate-limited login endpoint

### Data Pipeline
- **OBIS codes**: 1-0:1.8.0 (import), 1-0:2.8.0 (export), 1-0:16.7.0 (power), per-phase
- **TimescaleDB**: Hypertable with automatic time partitioning
- **Continuous Aggregates**: Pre-computed hourly and daily summaries
- **Data Retention**: Raw data kept for 1 year, aggregates kept forever

---

## Prerequisites

- **Bitshake Smart Meter Reader Air** — attached to your electricity meter
- **Meter PIN** — from your grid operator (Messstellenbetreiber) for extended data
- **Oracle Cloud instance** — A1 Ampere (4 OCPU / 24GB RAM recommended, Always Free tier)
- **Domain name** — for API HTTPS access
- **Vercel account** — for dashboard hosting (free tier)

---

## Quick Start

### 1. Deploy the Backend (Oracle Cloud)

```bash
# SSH into your Oracle Cloud instance
ssh opc@<your-oracle-cloud-ip>

# Clone the repo
git clone https://github.com/Sternpaul/bitshake.git
cd bitshake/backend

# Configure environment
cp .env.example .env
nano .env  # Fill in all values — see comments in the file

# Generate Mosquitto password file
mkdir -p mosquitto
touch mosquitto/passwd
docker run --rm -v $(pwd)/mosquitto:/mosquitto/config \
  eclipse-mosquitto:2 mosquitto_passwd -b -c /mosquitto/config/passwd bitshake <YOUR_PASSWORD_HERE>
sudo chown 1883:1883 mosquitto/passwd
sudo chmod 0700 mosquitto/passwd

# Update Caddyfile with your domain
nano caddy/Caddyfile

# Start everything
docker compose up -d --build

# Create the admin user
docker exec bitshake-api node src/setup-user.js

# Verify
curl https://api.yourdomain.com/api/health
```

### 2. Configure the Bitshake Device

See [docs/tasmota-setup.md](docs/tasmota-setup.md) for detailed step-by-step instructions.

**Quick version:**
1. Access Tasmota web UI at `http://<bitshake-ip>`
2. Add the SML script (see docs)
3. Configure MQTT to point to your Oracle Cloud IP
4. Set `TelePeriod 10` in the console

### 3. Deploy the Dashboard (Vercel)

See [docs/vercel-deploy.md](docs/vercel-deploy.md) for detailed instructions.

**Quick version:**
1. Import `Sternpaul/bitshake` in Vercel
2. Set root directory to `dashboard`
3. Add env variable: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
4. Deploy

### 4. DNS Setup

Add an A record for your API domain:

| Type | Name | Value |
|:-----|:-----|:------|
| A | `api` | `<Oracle Cloud Public IP>` |

Caddy will automatically obtain a Let's Encrypt SSL certificate.

---

## Project Structure

```
bitshake/
├── backend/                        # Oracle Cloud (Dockerized)
│   ├── docker-compose.yml          # 4-container stack
│   ├── .env.example                # Environment template
│   ├── caddy/Caddyfile             # Reverse proxy config
│   ├── mosquitto/
│   │   ├── mosquitto.conf          # MQTT broker config
│   │   └── passwd.example          # Password template
│   ├── db/init.sql                 # Database schema
│   └── api/
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── index.js            # Fastify server
│           ├── mqtt-bridge.js      # MQTT → DB bridge
│           ├── db.js               # PostgreSQL pool
│           ├── setup-user.js       # Admin user creation
│           ├── routes/
│           │   ├── auth.js         # Login, password change
│           │   ├── readings.js     # Live, history, export
│           │   ├── stats.js        # KPI calculations
│           │   └── settings.js     # Tariff configuration
│           └── middleware/
│               └── auth.js         # JWT verification
│
├── dashboard/                      # Vercel (Next.js 15)
│   ├── package.json
│   ├── vercel.json
│   ├── .env.example
│   └── src/
│       ├── app/
│       │   ├── layout.js           # Root layout
│       │   ├── page.js             # Main dashboard
│       │   ├── login/page.js       # Login page
│       │   ├── analytics/page.js   # Analytics
│       │   └── settings/page.js    # Settings
│       ├── components/
│       │   ├── charts/             # Recharts wrappers
│       │   ├── cards/KPICard.js    # KPI display
│       │   ├── layout/             # Sidebar, Header
│       │   └── auth/LoginForm.js   # Login form
│       ├── lib/
│       │   ├── api.js              # API client
│       │   └── auth-context.js     # Auth state
│       └── styles/globals.css      # Design system
│
├── docs/
│   ├── tasmota-setup.md
│   ├── oracle-cloud-setup.md
│   └── vercel-deploy.md
│
├── .gitignore
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `POST` | `/api/auth/login` | — | Login, returns JWT |
| `POST` | `/api/auth/change-password` | JWT | Change password |
| `GET` | `/api/auth/verify` | JWT | Verify token |
| `GET` | `/api/readings/live` | JWT | Latest reading |
| `GET` | `/api/readings/recent?minutes=30` | JWT | Recent raw data |
| `GET` | `/api/readings/history?range=24h` | JWT | Aggregated history |
| `GET` | `/api/readings/daily?date=YYYY-MM-DD` | JWT | Single day data |
| `GET` | `/api/readings/export?from=&to=` | JWT | CSV download |
| `GET` | `/api/stats/overview` | JWT | Dashboard KPIs |
| `GET` | `/api/settings` | JWT | Get settings |
| `PUT` | `/api/settings` | JWT | Update settings |
| `GET` | `/api/health` | — | Health check |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `DB_PASSWORD` | ✅ | — | PostgreSQL password |
| `MQTT_PASSWORD` | ✅ | — | Mosquitto password |
| `JWT_SECRET` | ✅ | — | JWT signing secret (64+ chars) |
| `CORS_ORIGIN` | ✅ | `*` | Dashboard URL for CORS |
| `ADMIN_USERNAME` | — | `admin` | Dashboard login username |
| `ADMIN_PASSWORD` | ✅ | — | Dashboard login password |
| `DB_NAME` | — | `bitshake` | Database name |
| `DB_USER` | — | `bitshake` | Database user |
| `MQTT_USER` | — | `bitshake` | MQTT username |
| `MQTT_TOPIC` | — | `tele/+/SENSOR` | MQTT topic filter |

### Dashboard (`dashboard/.env.local`)

| Variable | Required | Description |
|:---------|:---------|:------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL (e.g., `https://api.yourdomain.com`) |

---

## OBIS Codes Reference

| Metric | OBIS Code | Unit | Description |
|:-------|:----------|:-----|:------------|
| Total Consumption | `1-0:1.8.0` | kWh | Cumulative energy imported |
| Total Feed-in | `1-0:2.8.0` | kWh | Cumulative energy exported |
| Current Power | `1-0:16.7.0` | W | Instantaneous net power |
| Power Phase 1 | `1-0:36.7.0` | W | Phase 1 power |
| Power Phase 2 | `1-0:56.7.0` | W | Phase 2 power |
| Power Phase 3 | `1-0:76.7.0` | W | Phase 3 power |

---

## License

MIT
