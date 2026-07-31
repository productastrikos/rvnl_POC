#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Packages build/ into dist/<name>.zip, ready to upload straight into
   Hostinger's public_html via hPanel → File Manager → Upload → Extract.

   The archive contains the CONTENTS of build/ (index.html at the top level),
   not the build/ folder itself — extracting it inside public_html therefore
   lands index.html where the web server expects it.

   Verifies .htaccess made it into the build, because a missing .htaccess is
   the failure that turns every deep link into a 404 and is invisible until
   someone refreshes a page other than the home page.
   ═══════════════════════════════════════════════════════════════════════════ */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, 'build');
const distDir = path.join(root, 'dist');

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  fail('No production build found. Run `npm run build` first.');
}

/* react-scripts copies public/ verbatim, but a stale build predating the
   .htaccess would ship without it. Catch that here rather than in production. */
if (!fs.existsSync(path.join(buildDir, '.htaccess'))) {
  fail(
    'build/.htaccess is missing — deep links would 404 on Hostinger.\n' +
    '    Re-run `npm run build` so public/.htaccess is copied into the build.'
  );
}

/* Source maps are disabled in .env.production; warn if any slipped through. */
const strays = fs.readdirSync(path.join(buildDir, 'static', 'js'))
  .filter(f => f.endsWith('.map'));
if (strays.length) {
  console.warn(`  ! ${strays.length} source map(s) in the build — GENERATE_SOURCEMAP is not taking effect.`);
}

fs.mkdirSync(distDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 10);
const zipPath = path.join(distDir, `rvnl-nirman-setu-${stamp}.zip`);
fs.rmSync(zipPath, { force: true });

if (process.platform === 'win32') {
  /* Entry names are normalised to forward slashes by hand. Both
     Compress-Archive and ZipFile.CreateFromDirectory on Windows PowerShell
     (.NET Framework) write backslash separators, which Linux unzip treats as
     part of the filename — the upload would extract as a flat directory
     holding a file literally called "static\js\main.js" and the site would
     load nothing but a blank page. */
  const ps = [
    `$ErrorActionPreference='Stop'`,
    `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
    `$src='${buildDir}'`,
    `$archive=[System.IO.Compression.ZipFile]::Open('${zipPath}','Create')`,
    `Get-ChildItem -LiteralPath $src -Recurse -File -Force | ForEach-Object {` +
      ` $rel=$_.FullName.Substring($src.Length+1).Replace('\\','/');` +
      ` [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(` +
      `$archive,$_.FullName,$rel,[System.IO.Compression.CompressionLevel]::Optimal) }`,
    `$archive.Dispose()`,
  ].join('; ');

  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
} else {
  try {
    execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: buildDir, stdio: 'inherit' });
  } catch (err) {
    fail('`zip` is required to package the build on this platform (apt install zip / brew install zip).');
  }
}

const mb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
console.log(`\n  ✓ ${path.relative(root, zipPath)}  (${mb} MB)`);
console.log('    Upload to Hostinger: hPanel → File Manager → public_html → Upload → Extract\n');
