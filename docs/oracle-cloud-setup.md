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
| 80 | TCP | 0.0.0.0/0 | HTTP (Caddy redirect) |
| 443 | TCP | 0.0.0.0/0 | HTTPS (Caddy / API) |
| 1883 | TCP | Your home IP | MQTT (Bitshake device) |

> **Important:** Restrict port 1883 to your home IP address only. Do NOT open it to 0.0.0.0/0.

### How to add a Security List rule:

1. Go to **Networking > Virtual Cloud Networks > [Your VCN] > Security Lists > Default Security List**
2. Click **Add Ingress Rules**
3. Add each port from the table above

## Step 3: Configure the OS Firewall

SSH into your instance and open the required ports:

```bash
# Oracle Linux 9
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=1883/tcp
sudo firewall-cmd --reload

# Ubuntu 22.04
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 1883 -j ACCEPT
sudo netfilter-persistent save
```

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

## Step 7: Set Up Mosquitto Password

```bash
# Generate the Mosquitto password file
docker run --rm -v $(pwd)/mosquitto:/mosquitto/config \
  eclipse-mosquitto:2 mosquitto_passwd -c /mosquitto/config/passwd bitshake

# Enter the SAME password as MQTT_PASSWORD in .env when prompted
```

## Step 8: Configure DNS

Add an A record for your domain:

| Type | Name | Value | TTL |
|:-----|:-----|:------|:----|
| A | `api` | `<Oracle Cloud Public IP>` | 300 |

This creates `api.yourdomain.com` pointing to your server.

> Wait a few minutes for DNS propagation before proceeding.

## Step 9: Update the Caddyfile

```bash
# Edit the Caddyfile with your actual domain
nano caddy/Caddyfile
```

Replace `{$DOMAIN:api.yourdomain.com}` with your actual domain:

```
api.yourdomain.com {
    reverse_proxy api:3001
    
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    log {
        output stdout
        format json
    }
}
```

## Step 10: Start the Stack

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
