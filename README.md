# ⚡ Bitshake Smart Meter Dashboard

A comprehensive, real-time energy monitoring dashboard for the **Bitshake Smart Meter Reader Air**. Track electricity consumption, solar feed-in, costs, and detailed analytics — all in a premium, dark-themed web interface.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-white?logo=fastify)](https://fastify.dev/)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-PostgreSQL-blue?logo=postgresql)](https://www.timescale.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)](https://www.docker.com/)
[![HiveMQ](https://img.shields.io/badge/MQTT-HiveMQ-purple?logo=hivemq)](https://www.hivemq.com/)

---

## Architecture

```
Electricity Meter ──(IR)──> Bitshake Air (Tasmota)
                              │
                              │ MQTT (JSON telemetry)
                              ▼
                    ┌─────────────────────┐
                    │   HiveMQ            │ ← External MQTT Broker (Serverless)
                    │   Cloud Cluster     │
                    └─────────┬───────────┘
                              │
                              │ MQTT Subscription
                              ▼
                    ┌─────────────────────┐
                    │   Oracle Cloud VM   │
                    │   (Docker Compose)  │
                    │                     │
                    │ ┌─────────────────┐ │     ┌──────────────────┐
                    │ │  Fastify API    │ │  ←  │  hm2mqtt (bridge)│ ← Solar Data
                    │ │  + MQTT Bridge  │ │     └──────────────────┘
                    │ └────────┬────────┘ │              ▲
                    │          │          │              │ Local MQTT
                    │ ┌────────▼────────┐ │     ┌────────▼─────────┐
                    │ │  TimescaleDB    │ │     │   hame-relay     │
                    │ │  (PostgreSQL)   │ │     │   (mock cloud)   │
                    │ └─────────────────┘ │     └──────────────────┘
                    │ ┌─────────────────┐ │              ▲
                    │ │   Cloudflared   │ │              │ Cloud connection
                    │ │     Tunnel      │ │     ┌────────▼─────────┐
                    │ └─────────────────┘ │     │ Marstek Inverter │
                    └─────────┬───────────┘     └──────────────────┘
                              │
                              │ HTTPS (Cloudflare Edge)
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
- **Solar Generation Integration** — Direct integration with Marstek/Hame Microinverters. Total Solar generation dynamically recorded and visualized alongside grid data. 
  - **Dual-Layer Visualization**: Displays 100% true measured data from the East inverter as solid yellow bars/areas, with the Gaussian-estimated extrapolation of the unmeasured South inverter overlaid in transparent stripes. (See [docs/marstek-solar-setup.md](docs/marstek-solar-setup.md))

### Analytics
- **Multi-range analysis** — 24 hours, 7 days, 30 days, 1 year
- **Trend Indicators** — Dynamic color-coded badges showing percentage change vs. previous period
- **Energy Balance** — Consumption vs. export bar chart
- **Hourly Profile (24h)** — Average daily consumption and export cycle curve
- **Weekly Heatmap** — 7x24 grid visualizing power intensity by day of week and hour
- **Projections & Insights** — Calculates Standby base load, yearly projected consumption/export, and yearly projected net cost
- **Cost Calculations** — Net cost for any time range

### Settings
- **Solar Curve Configuration** — 6 interactive sliders to fully configure the Gaussian model for your East (measured) and South (extrapolated) panels:
  - Configure theoretical maximum Capacity (W).
  - Configure Solar Peak Time (Hour).
  - Configure Curve Width (Spread).
  - Changes are applied instantly to the math engine without needing a restart!
- **Electricity Price** — Configurable (default: €0.35/kWh)
- **Feed-in Tariff** — Configurable (Einspeisevergütung)
- **Currency** — EUR, USD, GBP, CHF
- **Auto-refresh** — 5–300 second intervals
- **CSV Export** — Download raw data for any date range
- **Password Management** — Change dashboard password

### Security
- JWT-based authentication (24h expiry)
- MQTT broker (HiveMQ Serverless) with TLS and username/password auth
- Database isolated in Docker network (not exposed)
- Secure ingress via Cloudflare Tunnel (no open ports needed)
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


# Start everything
docker compose up -d --build

# Create the admin user
docker exec bitshake-api node src/setup-user.js

# Verify the backend is running
curl http://localhost:3001/api/health

# Verify your Cloudflare Tunnel is connected
docker compose logs cloudflared
```

### 2. Configure the Bitshake Device

See [docs/tasmota-setup.md](docs/tasmota-setup.md) for detailed step-by-step instructions.

**Quick version:**
1. Access Tasmota web UI at `http://<bitshake-ip>`
2. Add the SML script (see docs)
3. Configure MQTT to point to your HiveMQ Broker URL
4. Set `TelePeriod 10` in the console

### 3. Deploy the Dashboard (Vercel)

See [docs/vercel-deploy.md](docs/vercel-deploy.md) for detailed instructions.

**Quick version:**
1. Import `Sternpaul/bitshake` in Vercel
2. Set root directory to `dashboard`
3. Add env variable: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
4. Deploy

### 4. DNS Setup

Add a CNAME record in your Cloudflare dashboard pointing your API subdomain (e.g., `api.yourdomain.com`) to your Cloudflare Tunnel UUID (e.g., `<uuid>.cfargotunnel.com`). Cloudflare automatically handles the Let's Encrypt SSL certificates.

---

## Project Structure

```
bitshake/
├── backend/                        # Oracle Cloud (Dockerized)
│   ├── docker-compose.yml          # 3-container stack
│   ├── .env.example                # Environment template
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
│   ├── vercel-deploy.md
│   └── marstek-solar-setup.md
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
| `GET` | `/api/stats/hourly-profile?days=30` | JWT | Average 24h cycle |
| `GET` | `/api/stats/compare?range=7d` | JWT | Trend vs previous period |
| `GET` | `/api/stats/heatmap?days=30` | JWT | Weekly 7x24 matrix |
| `GET` | `/api/settings` | JWT | Get settings |
| `PUT` | `/api/settings` | JWT | Update settings |
| `GET` | `/api/health` | — | Health check |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|:---------|:---------|:--------|:------------|
| `DB_PASSWORD` | ✅ | — | PostgreSQL password |
| `MQTT_PASSWORD` | ✅ | — | HiveMQ password |
| `JWT_SECRET` | ✅ | — | JWT signing secret (64+ chars) |
| `CORS_ORIGIN` | ✅ | `*` | Dashboard URL for CORS |
| `ADMIN_USERNAME` | — | `admin` | Dashboard login username |
| `ADMIN_PASSWORD` | ✅ | — | Dashboard login password |
| `DB_NAME` | — | `bitshake` | Database name |
| `DB_USER` | — | `bitshake` | Database user |
| `MQTT_USER` | — | `bitshake` | MQTT username |
| `MQTT_TOPIC` | — | `tele/+/SENSOR,hm2mqtt/+/device/+/data` | MQTT topic filter |
| `HAME_USER` | ✅ | — | Email for Marstek/Hame Cloud Account |
| `HAME_PASS` | ✅ | — | Password for Marstek/Hame Cloud |
| `MARSTEK_MAC` | ✅ | — | MAC address of the microinverter |

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
