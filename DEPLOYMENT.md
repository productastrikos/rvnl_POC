# Deploying RVNL Nirman Setu to Hostinger

The application is a **single-page React app with no backend**. Every figure on
every screen comes from the dataset bundled at
[rvnlData.js](client/src/data/rvnlData.js), and
[api.js](client/src/services/api.js) resolves it in-memory rather than over the
network. There is no server to run, no database to provision and no API keys to
configure.

That means it deploys as **static files** into Hostinger's `public_html`. Any
Hostinger Web/Premium/Business shared plan is enough — you do **not** need the
Node.js hosting or a VPS.

---

## 1. What gets deployed

```
public_html/
├── .htaccess                 ← routing, HTTPS, compression, caching, headers
├── index.html
├── favicon.svg
├── robots.txt
├── site.webmanifest
├── Logo Transparent Horizontal.png
└── static/
    ├── css/main.<hash>.css
    └── js/main.<hash>.js
```

`.htaccess` is the file that matters most. React Router owns paths like `/twin`
and `/projects/RVNL-001`; Apache knows nothing about them. Without the rewrite
rule, those URLs work when you click through the app but return **404 on
refresh or on a shared link**. The packaging script refuses to build an archive
that is missing it.

---

## 2. Build and package

From the repository root:

```bash
npm run install:all     # first time only
npm run package
```

This runs the production build and writes an upload-ready archive:

```
dist/rvnl-nirman-setu-<YYYY-MM-DD>.zip     (~0.3 MB)
```

The archive holds the **contents** of the build folder, so extracting it inside
`public_html` puts `index.html` at the web root — not one level too deep.

Preview exactly what will be uploaded before you upload it:

```bash
npm run preview         # http://localhost:5000
```

Click into the Digital Twin, then hard-refresh the page. If the refresh works
locally it will work on Hostinger.

---

## 3. Upload

### Option A — hPanel File Manager (recommended)

1. hPanel → **Files** → **File Manager** → open `public_html`.
2. Delete the Hostinger placeholder `default.php` / `index.html` if present.
3. **Upload** → select `dist/rvnl-nirman-setu-<date>.zip`.
4. Right-click the uploaded archive → **Extract** → into `public_html`.
5. Delete the `.zip` afterwards so it is not publicly downloadable.
6. Confirm `.htaccess` is present. The File Manager hides dotfiles by default —
   enable **Settings → Show hidden files**. If it did not extract, upload
   `client/build/.htaccess` on its own.

### Option B — FTP

hPanel → **Files** → **FTP Accounts** gives you the host, username and port
(21). Point FileZilla at it and upload the **contents** of `client/build/` into
`public_html`, with the transfer set to show hidden files so `.htaccess` goes
across.

### Option C — Git deployment

hPanel → **Advanced** → **Git**. Hostinger's shared-plan Git integration only
*pulls files* — it does not run `npm install` or `npm run build`. To use it,
commit the built output (remove `client/build/` from `.gitignore` and point the
repository path at it), or keep using Option A. For anything more automated,
Hostinger's Node.js/VPS plans can run a real build step.

---

## 4. Domain and SSL

1. hPanel → **Domains** — point the domain at this hosting account, or use the
   free `*.hostingersite.com` preview domain while testing.
2. hPanel → **Security** → **SSL** → install the free Let's Encrypt certificate
   and wait for it to show *Active*.
3. The `.htaccess` already redirects HTTP → HTTPS. If you are testing on a
   preview domain before the certificate is issued, comment out section 2 of
   `.htaccess` or you will hit a redirect loop.
4. Once HTTPS is confirmed working, optionally uncomment the
   `Strict-Transport-Security` header in `.htaccess`. Only do this when you are
   sure — browsers cache it for a year and will refuse plain HTTP afterwards.

---

## 5. Deploying into a subfolder

To serve from `https://example.com/nirman-setu/` instead of the domain root:

1. In [client/.env.production](client/.env.production), set:
   ```
   PUBLIC_URL=/nirman-setu
   ```
   The React Router `basename` in [App.js](client/src/App.js) reads the same
   value, so routes and assets stay in sync.

2. In [client/public/.htaccess](client/public/.htaccess), change both paths in
   the rewrite block:
   ```apache
   RewriteBase /nirman-setu/
   RewriteRule . /nirman-setu/index.html [L]
   ```

3. Rebuild (`npm run package`) and extract into
   `public_html/nirman-setu/`.

---

## 6. Redeploying

```bash
npm run package
```

Upload and extract over the existing files, then:

- **Purge the LiteSpeed cache** — hPanel → **Advanced** → **Cache Manager** →
  *Purge All*. Hostinger caches aggressively at the edge, and a stale
  `index.html` will keep pointing browsers at the previous bundle.
- Old `static/js/main.<oldhash>.js` files linger after an extract. They are
  harmless — nothing references them — but you can delete them to keep
  `public_html` tidy.

The asset filenames are content-hashed and `index.html` is served
`no-cache`, so returning users pick up a new deploy on their next page load
without a manual refresh.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Home page loads, but refreshing `/twin` gives 404 | `.htaccess` missing or not extracted | Re-upload `client/build/.htaccess`; enable hidden files in File Manager |
| Blank white page, console shows 404s for `/static/js/...` | Files extracted one level too deep, or app is in a subfolder without `PUBLIC_URL` | Move contents up so `index.html` sits directly in `public_html`, or follow §5 |
| Blank page, console shows `main.js` 404 with a `\` in the path | Archive built with Windows path separators | Repackage with `npm run package` — the script normalises separators |
| Redirect loop | HTTPS forced before the SSL certificate is active | Wait for SSL, or comment out §2 of `.htaccess` |
| Every URL returns 500 right after upload | Host disallows `Options` overrides in `.htaccess` | Comment out the `Options -Indexes -MultiViews` line in §1 |
| Map tiles do not render | Outbound tile CDNs blocked (Esri / OpenRailwayMap / CARTO) | Check the network tab; these are third-party and must be reachable from the client |
| Fonts fall back to system sans | `fonts.googleapis.com` unreachable | Cosmetic only; self-host Inter if the network blocks Google Fonts |
| Old version keeps loading after a deploy | LiteSpeed edge cache | hPanel → Cache Manager → Purge All |

---

## 8. Pre-flight checklist

- [ ] `npm test` passes (42 smoke tests)
- [ ] `npm run package` completes with no source-map warning
- [ ] `npm run preview` — hard-refresh on `/twin` and `/projects/RVNL-001` works
- [ ] `.htaccess` visible in `public_html` after extract
- [ ] SSL active, `http://` redirects to `https://`
- [ ] Deep link opened in a fresh private window loads correctly
- [ ] Uploaded `.zip` deleted from `public_html`

---

## Notes on what is *not* production hardened

Worth stating plainly before this is shown to a client as a live system:

- **No authentication.** The role switcher in the UI is a demo control, not an
  access boundary. Anyone with the URL sees everything. `robots.txt` and the
  `noindex` meta tag keep it out of search results, but that is obscurity, not
  security. If it needs to be private, add Hostinger's **Password Protect
  Directories** (hPanel → Advanced) on `public_html`.
- **No shared persistence.** Approvals, DSR submissions and acknowledgements
  survive a reload — [store.js](client/src/services/store.js) writes to
  `localStorage` — but they live in *each visitor's own browser*. Two people
  looking at the same URL do not see each other's actions, and clearing browser
  data resets the demo. Uploaded site photos are held in memory only and are
  lost on reload.
- **All data is bundled and public.** Everything in `rvnlData.js` ships inside
  the JavaScript bundle and is readable by any visitor.
