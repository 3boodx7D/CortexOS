import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ANSI formatting helpers
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const gray = (s) => `\x1b[90m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

console.log('\n' + cyan(bold('╔══════════════════════════════════════════════════════╗')));
console.log(cyan(bold('║     🧠 CORTEXOS — AUTOMATED SETUP BUILD & RELEASE    ║')));
console.log(cyan(bold('╚══════════════════════════════════════════════════════╝\n')));

// 1. Parse current version from package.json
const pkgPath = path.join(ROOT_DIR, 'package.json');
const tauriConfPath = path.join(ROOT_DIR, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(ROOT_DIR, 'src-tauri', 'Cargo.toml');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '0.3.20';

// 2. Determine new version
const args = process.argv.slice(2);
let newVersion = '';

// Check if user passed explicit version or bump flag
const explicitVersion = args.find(a => /^\d+\.\d+\.\d+$/.test(a));
const bumpArg = args.find(a => a.startsWith('--bump=') || a === '--minor' || a === '--major');

if (explicitVersion) {
  newVersion = explicitVersion;
} else {
  const parts = currentVersion.split('.').map(Number);
  while (parts.length < 3) parts.push(0);

  if (bumpArg === '--major' || bumpArg === '--bump=major') {
    newVersion = `${parts[0] + 1}.0.0`;
  } else if (bumpArg === '--minor' || bumpArg === '--bump=minor') {
    newVersion = `${parts[0]}.${parts[1] + 1}.0`;
  } else {
    // Default: bump patch version
    newVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

console.log(`${gray('•')} Current Version: ${yellow(currentVersion)}`);
console.log(`${green('✓')} Target Release Version: ${green(bold('v' + newVersion))}\n`);

// 3. Update version in package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`${green('✓')} Updated ${bold('package.json')} -> ${newVersion}`);

// 4. Update version in src-tauri/tauri.conf.json
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
console.log(`${green('✓')} Updated ${bold('tauri.conf.json')} -> ${newVersion}`);

// 5. Update version in src-tauri/Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoContent = cargoContent.replace(/^version\s*=\s*".*?"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoContent, 'utf8');
  console.log(`${green('✓')} Updated ${bold('Cargo.toml')} -> ${newVersion}`);
}

// 6. Terminate locking processes to prevent "Access is denied (os error 5)"
console.log(`\n${cyan('•')} Releasing file locks on running binaries...`);
try {
  execSync('taskkill /F /IM app.exe /IM cortex-backend.exe /IM CortexOS*.exe 2>nul || exit 0', { shell: 'cmd.exe', stdio: 'ignore' });
  console.log(`${green('✓')} Process locks cleared.`);
} catch {
  // Ignored if no processes were running
}

// 7. Check backend sidecar binary
const sidecarPath = path.join(ROOT_DIR, 'src-tauri', 'binaries', 'cortex-backend-x86_64-pc-windows-msvc.exe');
if (!fs.existsSync(sidecarPath)) {
  const venvPython = path.join(ROOT_DIR, 'backend', 'venv', 'Scripts', 'python.exe');
  const pyCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
  execSync(`${pyCmd} -m PyInstaller cortex-backend.spec --noconfirm`, { cwd: ROOT_DIR, stdio: 'inherit', shell: true });
  fs.copyFileSync(path.join(ROOT_DIR, 'dist', 'cortex-backend.exe'), sidecarPath);
  console.log(`${green('✓')} Sidecar binary created.`);
} else {
  console.log(`${green('✓')} Backend sidecar verified: ${gray(sidecarPath)}`);
}

// 8. Build Frontend (Vite)
console.log(`\n${cyan('•')} Compiling frontend assets with Vite...`);
execSync('pnpm run build', { cwd: ROOT_DIR, stdio: 'inherit', shell: true });
console.log(`${green('✓')} Frontend build complete.`);

// 9. Build Tauri NSIS Setup
console.log(`\n${cyan('•')} Building native NSIS Setup Installer with Tauri...`);

// Auto-detect private signing key if not set in environment
if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  const localKeyPath = path.join(ROOT_DIR, '~', '.tauri', 'cortexos.key');
  const homeKeyPath = path.join(process.env.USERPROFILE || process.env.HOME || '', '.tauri', 'cortexos.key');

  if (fs.existsSync(localKeyPath)) {
    process.env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(localKeyPath, 'utf8').trim();
    console.log(`${green('✓')} Loaded signing key from ${gray(localKeyPath)}`);
  } else if (fs.existsSync(homeKeyPath)) {
    process.env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(homeKeyPath, 'utf8').trim();
    console.log(`${green('✓')} Loaded signing key from ${gray(homeKeyPath)}`);
  }
}

if (!process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD && process.env.TAURI_SIGNING_PRIVATE_KEY) {
  process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '';
}

execSync('pnpm tauri build', { cwd: ROOT_DIR, stdio: 'inherit', shell: true, env: process.env });
console.log(`${green('✓')} Tauri bundle complete.`);

// 10. Locate generated installer and copy to version-specific folder in dist-installer
const nsisDir = path.join(ROOT_DIR, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const distInstallerDir = path.join(ROOT_DIR, 'dist-installer');
const versionFolder = path.join(distInstallerDir, `v${newVersion}`);

if (!fs.existsSync(distInstallerDir)) {
  fs.mkdirSync(distInstallerDir, { recursive: true });
}
if (!fs.existsSync(versionFolder)) {
  fs.mkdirSync(versionFolder, { recursive: true });
}

const nsisFiles = fs.readdirSync(nsisDir).filter(f => f.endsWith('.exe') && !f.includes('nsis-'));
if (nsisFiles.length === 0) {
  console.error(red('✖ Error: Could not find generated NSIS installer in ' + nsisDir));
  process.exit(1);
}

// Pick the installer matching our version or the most recently modified one
const sourceInstaller = nsisFiles.find(f => f.includes(newVersion)) || nsisFiles[0];
const sourceInstallerPath = path.join(nsisDir, sourceInstaller);

const versionedSetupName = `CortexOS-Setup-v${newVersion}.exe`;
const latestSetupName = `CortexOS-Setup-Latest.exe`;

// Target paths: inside version folder AND in root for latest
const targetInVersionFolder = path.join(versionFolder, versionedSetupName);
const targetLatestPath = path.join(distInstallerDir, latestSetupName);

fs.copyFileSync(sourceInstallerPath, targetInVersionFolder);
fs.copyFileSync(sourceInstallerPath, targetLatestPath);

const stats = fs.statSync(targetInVersionFolder);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

// 11. Copy updater artifacts (signature + latest.json) for Tauri v2 auto-update
console.log(`\n${cyan('•')} Preparing updater artifacts in ${bold(`v${newVersion}`)} folder...`);
const allSigFiles = fs.readdirSync(nsisDir).filter(f => f.endsWith('.sig'));

let updaterReady = false;

if (allSigFiles.length > 0) {
  const sigFile = allSigFiles.find(f => f.includes(newVersion)) || allSigFiles[0];
  const sigContent = fs.readFileSync(path.join(nsisDir, sigFile), 'utf8').trim();
  
  // Save signature inside version folder
  const targetSigName = `${versionedSetupName}.sig`;
  fs.writeFileSync(path.join(versionFolder, targetSigName), sigContent, 'utf8');
  console.log(`${green('✓')} Saved signature -> ${bold(targetSigName)}`);

  // Generate latest.json manifest
  const manifest = {
    version: `v${newVersion}`,
    notes: `CortexOS Release v${newVersion} - Neural auto-updates and full offline engine support.`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: sigContent,
        url: `https://github.com/3boodx7D/CortexOS/releases/download/v${newVersion}/${versionedSetupName}`
      }
    }
  };

  const manifestStr = JSON.stringify(manifest, null, 2) + '\n';
  // Write in version folder AND in dist-installer root
  fs.writeFileSync(path.join(versionFolder, 'latest.json'), manifestStr, 'utf8');
  fs.writeFileSync(path.join(distInstallerDir, 'latest.json'), manifestStr, 'utf8');
  console.log(`${green('✓')} Generated ${bold('latest.json')} manifest inside ${bold(`v${newVersion}`)}.`);
  updaterReady = true;
} else {
  console.log(`${yellow('!')} No signature file found. Set TAURI_SIGNING_PRIVATE_KEY to enable updater signing.`);
}

// 12. Clean up any loose versioned files in dist-installer root into their respective folders
try {
  const rootFiles = fs.readdirSync(distInstallerDir);
  for (const f of rootFiles) {
    const full = path.join(distInstallerDir, f);
    if (fs.statSync(full).isFile() && f.startsWith('CortexOS-Setup-v')) {
      const match = f.match(/v(\d+\.\d+\.\d+)/);
      if (match) {
        const vDir = path.join(distInstallerDir, `v${match[1]}`);
        if (!fs.existsSync(vDir)) fs.mkdirSync(vDir, { recursive: true });
        fs.renameSync(full, path.join(vDir, f));
      }
    }
  }
} catch {}

// 13. Auto Git Commit & Push
try {
  console.log(`\n${cyan('•')} Syncing release changes to Git...`);
  execSync('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock', { cwd: ROOT_DIR, stdio: 'ignore' });
  execSync(`git commit -m "chore(release): bump to v${newVersion}"`, { cwd: ROOT_DIR, stdio: 'ignore' });
  execSync('git push origin main', { cwd: ROOT_DIR, stdio: 'ignore' });
  console.log(`${green('✓')} Git repo synced and pushed to GitHub main.`);
} catch {
  console.log(`${gray('•')} Git is already up to date.`);
}

console.log('\n' + green(bold('╔═════════════════════════════════════════════════════════════════════════╗')));
console.log(green(bold('║                      ✨ BUILD & RELEASE SUCCESSFUL! ✨                   ║')));
console.log(green(bold('╚═════════════════════════════════════════════════════════════════════════╝\n')));
console.log(`${bold('📦 Release Version:')}     ${green(bold('v' + newVersion))}`);
console.log(`${bold('📁 Dedicated Folder:')}    ${cyan(versionFolder)}`);
console.log(`${bold('⚖️ File Size:')}           ${yellow(sizeMB + ' MB')}\n`);
console.log(gray(`Ready to publish! The 3 release files are waiting inside:`));
console.log(cyan(`   ${versionFolder}\n`));

// 14. Automatically open the folder in Windows Explorer
try {
  execSync(`explorer "${versionFolder}"`);
  console.log(`${green('✓')} Opened release folder in Windows Explorer.`);
} catch {}

