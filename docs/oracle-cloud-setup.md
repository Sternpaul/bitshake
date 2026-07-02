# Oracle Cloud Setup Guide

This guide walks you through deploying the Bitshake backend on an Oracle Cloud Always Free A1 instance.

## Prerequisites

- Oracle Cloud account with Always Free tier
- An A1 Ampere instance (4 OCPU / 24GB RAM recommended)
- A domain name with DNS access (for the API subdomain)
- SSH key pair for server access

## Step 1: Provision the VM

1. Log into the [OCI Console](https://cloud.oracle.com)
2. Go to **Compute > Instances > Create Instance**
3. Configure:
   - **Shape:** VM.Standard.A1.Flex (Ampere)
   - **OCPU:** 4
   - **Memory:** 24 GB
   - **Image:** Oracle Linux 9 or Ubuntu 22.04
   - **SSH Key:** Upload your public key
4. Click **Create**
5. Note the **Public IP Address** once provisioned

## Step 2: Configure OCI Security Lists

Open these ports in your VCN's security list:

| Port | Protocol | Source | Purpose |
|:-----|:---------|:-------|:--------|
| 22 | TCP | Your IP | SSH access |



### How to add a Security List rule:

1. Go to **Networking > Virtual Cloud Networks > [Your VCN] > Security Lists > Default Security List**
2. Click **Add Ingress Rules**
3. Add each port from the table above


## Step 4: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to the docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Verify
docker --version
docker compose version
```

## Step 5: Clone the Repository

```bash
cd ~
git clone https://github.com/Sternpaul/bitshake.git
cd bitshake/backend
```

## Step 6: Configure Environment

```bash
# Copy the template
cp .env.example .env

# Edit with your values
nano .env
```

Fill in all the values in `.env`:

```env
DB_NAME=bitshake
DB_USER=bitshake
DB_PASSWORD=<generate a strong random password>

MQTT_USER=bitshake
MQTT_PASSWORD=<generate a strong random password>

JWT_SECRET=<generate a 64-character random string>

CORS_ORIGIN=https://your-dashboard.vercel.app

ADMIN_USERNAME=admin
ADMIN_PASSWORD=<your dashboard login password>

DOMAIN=api.yourdomain.com
```

> **Tip:** Generate strong passwords with: `openssl rand -base64 32`

## Step 7: Set Up HiveMQ Cloud Serverless

Instead of running a local MQTT broker and exposing it to the internet, we use a free Cloud MQTT broker.

1. Go to [HiveMQ Cloud](https://console.hivemq.cloud/) and sign up for a free Serverless broker.
2. Under "Access Management", create a set of credentials (username and password).
3. Under "Broker Details", locate your **TLS MQTT URL**.
4. Update your `.env` file with these details:
   - `MQTT_HOST=mqtts://<your-broker-url>.s1.eu.hivemq.cloud:8883` (You MUST add the `mqtts://` prefix!)
   - `MQTT_USER=<your-hivemq-username>`
   - `MQTT_PASSWORD=<your-hivemq-password>`

## Step 8: Configure Cloudflare Tunnel

Instead of opening ports and managing SSL certificates manually, we use Cloudflare Tunnels.

1. Go to your [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com).
2. Navigate to **Networks > Tunnels**.
3. Click **Create a tunnel** -> Select **Cloudflared** -> Name it (e.g., `bitshake-api`).
4. On the "Install and run a connector" page, you will see a command like:
   `cloudflared.exe service install eyJh...`
5. Copy **only the token string** (the long string of random characters starting with `ey`).
6. Paste this token into your `.env` file as `CLOUDFLARE_TUNNEL_TOKEN=eyJh...`
7. Click Next. For the **Public Hostname**:
   - Subdomain: `api`
   - Domain: `yourdomain.com`
   - Service Type: `HTTP`
   - Service URL: `api:3001`
8. Click **Save Tunnel**.
## Step 9: Start the Stack

```bash
# Build and start all services
docker compose up -d --build

# Check that all containers are running
docker compose ps

# View logs
docker compose logs -f
```

You should see all 4 containers running:
- `bitshake-caddy`
- `bitshake-mosquitto`
- `bitshake-timescaledb`
- `bitshake-api`

## Step 11: Create the Admin User

```bash
docker exec bitshake-api node src/setup-user.js
```

This uses the `ADMIN_USERNAME` and `ADMIN_PASSWORD` from your `.env` file.

## Step 12: Verify

```bash
# Check API health
curl https://api.yourdomain.com/api/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":...,"mqtt":{"connected":true,...}}
```

## Maintenance

### View logs
```bash
docker compose logs -f api        # API logs
docker compose logs -f mosquitto  # MQTT logs
docker compose logs -f timescaledb # Database logs
```

### Restart services
```bash
docker compose restart
```

### Update to latest code
```bash
cd ~/bitshake/backend
git pull
docker compose up -d --build
```

### Database backup
```bash
docker exec bitshake-timescaledb pg_dump -U bitshake bitshake > backup_$(date +%Y%m%d).sql
```

### Check disk usage
```bash
docker system df
docker volume ls
```
