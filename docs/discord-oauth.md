# Discord OAuth2 Admin Login

This fork of **txAdmin** adds direct **Discord OAuth2 authentication** for administrators on the web interface, allowing server staff to log in with a single click using their Discord account.

---

## 🌟 How It Works

1. **Seamless Admin Account Matching:**
   txAdmin automatically matches the authenticated Discord user with existing admin accounts configured in `admins.json`.
   - If an admin in `admins.json` has a Discord identifier (`discord:<ID>`) matching the logged-in Discord account, they are authenticated immediately with all their configured permissions.
   - If the Discord ID does not match any registered administrator, access is denied (`not_admin`) and the session is cleared.

2. **Security & CSRF Protection:**
   - Authorization flow uses random state tokens hashed with SHA1 (`stateKern`) stored in temporary session cookies.
   - Login endpoints (`/auth/discord/redirect` and `/auth/discord/callback`) are protected by the txAdmin authentication rate limiter (`authLimiter`).
   - Sessions are cryptographically signed and expire after 7 days (or immediately on logout/admin revocation).

3. **Avatar Synchronization:**
   - When logging in via Discord, the admin's Discord avatar is automatically retrieved from the Discord CDN and cached for display in the txAdmin top bar.

---

## ⚙️ Setup Guide

### Step 1: Discord Developer Portal Configuration

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a **New Application** (or select your existing bot application).
2. Navigate to **OAuth2** -> **General** in the left sidebar.
3. Under **Redirects**, click **Add Redirect** and enter your txAdmin web panel callback URL:
   ```
   https://<your-panel-domain-or-ip>/login/discord/callback
   ```
   > [!IMPORTANT]
   > Ensure the protocol (`http://` or `https://`) and port match your actual web access URL. For example:
   > - Domain with HTTPS: `https://txadmin.yourserver.com/login/discord/callback`
   > - Direct IP & Port: `http://198.51.100.25:40120/login/discord/callback`
4. Under **Client Information**, copy your **Client ID** and generate / copy your **Client Secret**.
5. Save changes in the Discord Developer Portal.

### Step 2: txAdmin Panel Configuration

1. Log into your txAdmin web panel with your master account or an administrator with `settings.write` permission.
2. Navigate to **Settings** -> **Discord**.
3. Under the **Discord OAuth2 Login** section:
   - Paste your **OAuth2 Client ID**.
   - Paste your **OAuth2 Client Secret**.
4. Click **Save Discord Settings**.

Once configured, the **"Login with Discord"** button will automatically appear on the txAdmin login page.

---

## 👥 Assigning Discord IDs to Admins

To allow an admin to log in with Discord:

1. Open **Admins** in the txAdmin left navigation menu.
2. Click **Add Admin** (or edit an existing admin).
3. In the **Discord ID** field, enter the admin's numerical Discord user ID (e.g., `123456789012345678`).
4. Select their permissions and save.

The admin can now immediately log in by clicking **"Login with Discord"** on the login screen.
