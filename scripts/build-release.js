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
  console.log(`${yellow('!')} Sidecar binary not found. Compiling with PyInstaller...`);
  execSync('python -m PyInstaller cortex-backend.spec --noconfirm', { cwd: ROOT_DIR, stdio: 'inherit', shell: true });
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
execSync('pnpm tauri build', { cwd: ROOT_DIR, stdio: 'inherit', shell: true });
console.log(`${green('✓')} Tauri bundle complete.`);

// 10. Locate generated installer and copy to dist-installer with distinguishable versioned name
const nsisDir = path.join(ROOT_DIR, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const distInstallerDir = path.join(ROOT_DIR, 'dist-installer');

if (!fs.existsSync(distInstallerDir)) {
  fs.mkdirSync(distInstallerDir, { recursive: true });
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

const targetVersionedPath = path.join(distInstallerDir, versionedSetupName);
const targetLatestPath = path.join(distInstallerDir, latestSetupName);

fs.copyFileSync(sourceInstallerPath, targetVersionedPath);
fs.copyFileSync(sourceInstallerPath, targetLatestPath);

const stats = fs.statSync(targetVersionedPath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log('\n' + green(bold('╔═════════════════════════════════════════════════════════════════════════╗')));
console.log(green(bold('║                      ✨ BUILD & RELEASE SUCCESSFUL! ✨                   ║')));
console.log(green(bold('╚═════════════════════════════════════════════════════════════════════════╝\n')));
console.log(`${bold('📦 Release Version:')}     ${green(bold('v' + newVersion))}`);
console.log(`${bold('📁 Versioned Installer:')} ${cyan(targetVersionedPath)}`);
console.log(`${bold('🔗 Latest Link:')}         ${cyan(targetLatestPath)}`);
console.log(`${bold('⚖️ File Size:')}           ${yellow(sizeMB + ' MB')}\n`);
console.log(gray(`Ready to distribute! You can give "${versionedSetupName}" directly to your friends.`));
