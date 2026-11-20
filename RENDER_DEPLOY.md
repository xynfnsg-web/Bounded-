# 🚀 Deploying Bounded on Render (100% Free 24/7 Hosting)

This guide walks you through deploying the **Bounded Discord Bot & Live Website** to [Render](https://render.com) completely for free.

---

## 🌟 What's Included

- 🌐 **Public Bot Website & Live Dashboard:**
  - Modern dark gothic aesthetic showcasing bot features, live server counts, and ping.
  - Interactive searchable command manual with one-click command copy buttons.
  - Dynamic "Add to Discord" invite button using your bot's Client ID.
- 🩺 **Built-in Render Health Check (`/health` & `/ping`):**
  - Instant port binding to `0.0.0.0:$PORT` so Render deployments never time out.
  - Returns live JSON diagnostics for free uptime monitors.
- 📄 **Render Blueprint (`render.yaml`):**
  - Pre-configured so Render can automatically detect and configure your Web Service.

---

## 📋 Step-by-Step Deployment Guide

### Step 1: Push Your Latest Code to GitHub
Make sure all recent updates (the website, `.vcafk`, and push fixes) are pushed to your GitHub repository:
- Double-click [`push.bat`](push.bat), or
- In Discord chat: type `.push`

Your repository: `https://github.com/xynfnsg-web/Bounded-`

---

### Step 2: Create a Web Service on Render
1. Go to [Render.com](https://dashboard.render.com/) and sign in (or sign up with your GitHub account).
2. Click **New +** (top right) and select **Web Service**.
3. Under **Connect a repository**, choose **GitHub** and select your repository:
   ```
   xynfnsg-web/Bounded-
   ```
   *(If you don't see it, click "Configure account" to grant Render access to the repository).*
4. Fill in the service configuration:
   - **Name:** `bounded` (or any name you prefer)
   - **Region:** Any region close to you (e.g. Oregon, Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

---

### Step 3: Set Your Environment Variables
Scroll down to the **Environment Variables** section on Render and click **Add Environment Variable**:

| Key | Value | Description |
| :--- | :--- | :--- |
| `DISCORD_TOKEN` | `your_bot_token_here` | Your Discord Bot Token from [Discord Developer Portal](https://discord.com/developers/applications) |
| `NODE_VERSION` | `22.12.0` | *(Recommended)* Uses modern Node LTS |

---

### Step 4: Deploy
1. Click **Deploy Web Service** at the bottom.
2. Render will clone your repository, run `npm install`, and launch the web server and Discord bot.
3. Once finished, you will see:
   ```
   [WEB SERVER] Website & Health API listening on http://0.0.0.0:10000
   [READY] Logged in as Bounded#0000
   ```
4. Render will provide a live public URL:
   ```
   https://bounded.onrender.com
   ```
   Visiting that URL opens your bot's landing page and live command manual!

---

## ⚡ Step 5: Keep It Online 24/7 for Free ($0)

Render's free tier automatically sleeps after 15 minutes of inactivity. You can keep it awake 24/7 forever using a free HTTP pinging monitor:

1. Sign up for free at [UptimeRobot](https://uptimerobot.com/).
2. Click **Add New Monitor**.
3. Set:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `Bounded Bot Keep-Alive`
   - **URL (or IP):** `https://your-service-name.onrender.com/health`
   - **Monitoring Interval:** Every `5 minutes`
4. Click **Create Monitor**.

🎉 **Done!** UptimeRobot will ping `/health` every 5 minutes, keeping both your Discord bot and your website online 24/7 forever without paying a cent.
