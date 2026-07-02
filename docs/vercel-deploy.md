# Vercel Deployment Guide

This guide walks you through deploying the Bitshake dashboard to Vercel.

## Prerequisites

- [Vercel account](https://vercel.com) (free tier works)
- Backend already deployed on Oracle Cloud (see [oracle-cloud-setup.md](./oracle-cloud-setup.md))
- Your API URL (e.g., `https://api.yourdomain.com`)

## Step 1: Connect GitHub Repository

1. Log into [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New... > Project"**
3. Import the `Sternpaul/bitshake` repository from GitHub
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `dashboard` ← **Important!** Set this to `dashboard`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)

## Step 2: Configure Environment Variables

In the Vercel project settings, add the following environment variable:

| Key | Value | Environment |
|:----|:------|:------------|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | Production, Preview, Development |

## Step 3: Deploy

1. Click **"Deploy"**
2. Vercel will build and deploy the dashboard
3. You'll receive a URL like `https://bitshake-xxxx.vercel.app`

## Step 4: Update Backend CORS

Now that you have the Vercel URL, update your backend to allow requests from it:

```bash
# On your Oracle Cloud server
cd ~/bitshake/backend
nano .env

# Update CORS_ORIGIN to your Vercel domain
# CORS_ORIGIN=https://bitshake-xxxx.vercel.app

# Restart the API
docker compose restart api
```

## Step 5: Custom Domain (Optional)

1. In Vercel, go to **Project Settings > Domains**
2. Add your custom domain (e.g., `energy.yourdomain.com`)
3. Add the DNS records Vercel provides:
   - CNAME record pointing to `cname.vercel-dns.com`
4. Vercel automatically provisions SSL

## Step 6: Verify

1. Navigate to your Vercel URL
2. You should see the login page
3. Log in with your admin credentials
4. The dashboard should display data (once your Bitshake device is sending data)

## Automatic Deployments

Vercel automatically deploys every time you push to the `main` branch:

```bash
git add .
git commit -m "Update dashboard"
git push origin main
```

Preview deployments are created for pull requests.

## Troubleshooting

### API requests failing (CORS error)
- Verify `CORS_ORIGIN` in your backend `.env` matches your Vercel domain exactly
- Make sure `NEXT_PUBLIC_API_URL` is set correctly in Vercel

### Build failing
- Check the Vercel build logs for errors
- Ensure `Root Directory` is set to `dashboard`
- Run `npm run build` locally to test

### Login not working
- Verify the backend API is reachable: `curl https://api.yourdomain.com/api/health`
- Check browser dev tools for network errors
