import fs from 'node:fs';
import path from 'node:path';

console.log('==============================================================');
console.log('       Packaging GNBVG for College PC Deployment');
console.log('==============================================================\n');

const ROOT = path.resolve('.');
const DEST = path.join(ROOT, 'college_package');

console.log('Source Directory:', ROOT);
console.log('Target Package:  ', DEST);

if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
}
fs.mkdirSync(DEST, { recursive: true });

function copyDir(src, dest, excludeFilter) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeFilter && excludeFilter(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludeFilter);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('[1/5] Copying built client...');
copyDir(path.join(ROOT, 'client', 'dist'), path.join(DEST, 'client', 'dist'));
copyDir(path.join(ROOT, 'client', 'public'), path.join(DEST, 'client', 'public'));

console.log('[2/5] Copying database (916 students + settings)...');
fs.mkdirSync(path.join(DEST, 'database'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'database', 'gnbvg.db'), path.join(DEST, 'database', 'gnbvg.db'));

console.log('[3/5] Copying server backend (excluding node_modules)...');
copyDir(path.join(ROOT, 'server'), path.join(DEST, 'server'), (name) => name === 'node_modules' || name === '.git');

console.log('[4/5] Copying scripts & tunnel binary...');
copyDir(path.join(ROOT, 'scripts'), path.join(DEST, 'scripts'));
if (fs.existsSync(path.join(ROOT, 'cloudflared.exe'))) {
  fs.copyFileSync(path.join(ROOT, 'cloudflared.exe'), path.join(DEST, 'cloudflared.exe'));
}

console.log('[5/5] Copying launch scripts and configs...');
fs.copyFileSync(path.join(ROOT, 'START-COLLEGE-HOSTEL.bat'), path.join(DEST, 'START-COLLEGE-HOSTEL.bat'));
fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(DEST, 'package.json'));

const destStats = fs.statSync(DEST);
console.log('\n==============================================================');
console.log('[SUCCESS] College Package created successfully at:');
console.log(DEST);
console.log('You can copy this folder directly onto a USB Pendrive!');
console.log('==============================================================\n');
