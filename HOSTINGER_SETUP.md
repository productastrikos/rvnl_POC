# Hostinger Setup Guide — GitHub Auto-Deployment

This guide connects your GitHub repository to Hostinger for automatic deployments.

---

## Overview

Every push to `master` on GitHub triggers a build via GitHub Actions. The built files are committed to a `deployment` branch, which Hostinger pulls and serves directly.

- **No manual ZIP uploads** — fully automated
- **No secrets in environment** — build runs on GitHub's infrastructure
- **Rollback via Git** — revert a commit to revert a deploy

---

## Prerequisites

- [ ] GitHub repository access (this one)
- [ ] Hostinger account with Web/Premium/Business shared hosting plan
- [ ] hPanel access (login to Hostinger)
- [ ] A custom domain or use the free `*.hostingersite.com` preview

---

## 1. Enable GitHub Actions (first run only)

The `.github/workflows/deploy.yml` workflow is already in the repo. When you push to master, GitHub will:

1. Install dependencies
2. Run tests
3. Build the production bundle
4. Verify `.htaccess` and `index.html` are present
5. Push the built output to the `deployment` branch

**To watch the build:**

1. Go to your GitHub repository
2. Click **Actions**
3. You'll see "Build & Deploy to Hostinger" running
4. Once it completes, the `deployment` branch will contain the built files

---

## 2. Connect Hostinger to the Deployment Branch

### Step A: Generate a personal access token on GitHub

1. GitHub → **Settings** (top right) → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **Generate new token**
3. Name it `hostinger-deploy`
4. Grant scopes:
   - ✓ `repo` (full control of private repositories)
   - ✓ `read:org` (read org data)
5. Click **Generate token**
6. **Copy the token immediately** — you won't see it again

### Step B: Configure Hostinger Git

1. Log in to **hPanel** (Hostinger dashboard)
2. Navigate to **Advanced** → **Git**
3. Click **Connect Repository**
4. Fill in:
   - **Repository URL:** `https://github.com/productastrikos/rvnl_POC.git`
   - **Branch:** `deployment`
   - **Deployment path:** `/public_html` (creates it if missing)
5. Hostinger will ask for credentials:
   - **Username:** Your GitHub username (e.g., `productastrikos`)
   - **Password:** Paste the personal access token you generated above
6. Click **Connect**

Hostinger will now pull the `deployment` branch and update `public_html` whenever it changes.

---

## 3. Configure Domain & SSL

### Domain

1. hPanel → **Domains** → point your domain at this hosting account, or use the preview domain (`*.hostingersite.com`)

### SSL Certificate

1. hPanel → **Security** → **SSL**
2. Click **Manage** → **Install Let's Encrypt** (free)
3. Wait for status to show *Active* (usually 5–15 minutes)

**Note:** The `.htaccess` redirects HTTP → HTTPS. If testing on a preview domain before SSL is active, comment out section 2 of `.htaccess` in the `deployment` branch to avoid redirect loops.

---

## 4. First Deployment

1. Make a test commit and push to `master`:
   ```bash
   echo "test" >> test.txt
   git add test.txt
   git commit -m "Test deployment"
   git push origin master
   ```

2. Watch **GitHub → Actions** → the build complete (2–3 minutes)

3. Once GitHub Actions finishes, Hostinger will pull the `deployment` branch (usually within 15 minutes; you can refresh manually in hPanel)

4. Visit your domain or preview URL — you should see the live app

---

## 5. Verify the Deployment

### Home page loads

- ✓ Navigate to your domain

### Deep links work

- Open the browser console (F12)
- Navigate to any route (e.g., `/twin`, `/projects`)
- **Hard-refresh** (Ctrl+Shift+R / Cmd+Shift+R)
- If the page reloads without a 404, the `.htaccess` routing is working

### HTTPS is active

- Confirm the URL bar shows 🔒 and `https://`

---

## 6. Redeploy (update a deployment)

Every time you push to `master`, GitHub Actions will automatically rebuild and push to `deployment`. To make a new version live:

### Option A: Auto-pull (if Hostinger Git is configured)

Wait for Hostinger to auto-pull. By default, Hostinger checks every 12 hours; you can also:
1. hPanel → **Advanced** → **Git** → click your repository → **Pull now**

### Option B: Manual rebuild (if Hostinger's auto-pull is slow)

1. hPanel → **Advanced** → **Git** → **Delete repository**
2. Repeat step 2 (Connect Hostinger to the Deployment Branch) above

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Hostinger says "Authentication failed" | Wrong token, or token expired | Regenerate a new Personal Access Token on GitHub and update in hPanel |
| GitHub Actions build fails | Lint/test errors, or missing build file | Check **Actions** → the failed workflow → scroll through logs. Fix the error in code and push again |
| `.htaccess` not present after deploy | Not pulled/extracted correctly | Verify the `deployment` branch has `.htaccess` at the root: `git show deployment:.htaccess` |
| Refreshing `/twin` returns 404 | `.htaccess` missing or not applied | Check that `.htaccess` is in `public_html`. Enable **Settings → Show hidden files** in hPanel File Manager |
| "Redirect loop" when accessing the site | HTTPS redirect fired before SSL active | Comment out section 2 of `.htaccess` temporarily, or wait for SSL to activate |
| Site serves old version after a deploy | Hostinger edge cache | hPanel → **Advanced** → **Cache Manager** → **Purge All** |

---

## 8. Advanced: Deploying to a Subfolder

To serve from `https://example.com/nirman-setu/` instead of the root:

1. In `client/.env.production`, change:
   ```
   PUBLIC_URL=/nirman-setu
   ```

2. In `client/public/.htaccess`, change both paths in the rewrite block:
   ```apache
   RewriteBase /nirman-setu/
   RewriteRule . /nirman-setu/index.html [L]
   ```

3. Push to `master` — GitHub Actions will rebuild and deploy
4. On Hostinger, change the **Deployment path** to `/public_html/nirman-setu`

---

## 9. Security Notes

- **No authentication on the app.** The role switcher in the UI is a demo control. Protect with Hostinger's **Password Protect Directories** (hPanel → Advanced) if this needs to be private.
- **All data is bundled.** Everything in the React app ships as JavaScript and is visible in the browser. No sensitive data should be hardcoded.
- **Never commit secrets.** `.env.local` is in `.gitignore` — use it for local overrides only. Never put API keys, passwords, or tokens in committed files.

---

## Support

- **GitHub Actions logs:** GitHub → **Actions** → workflow name → click a run
- **Hostinger support:** hPanel → **Help & Support**
- **DEPLOYMENT.md:** Original deployment guide with manual upload options
