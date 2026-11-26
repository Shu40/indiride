const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const nodeModulesInAssets = path.join(distDir, 'assets', 'node_modules');
const expoModulesInAssets = path.join(distDir, 'assets', 'expo_modules');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(nodeModulesInAssets)) {
  console.log('[fix-web-export] Copying assets/node_modules to assets/expo_modules so Vercel does not ignore fonts...');
  copyDirRecursive(nodeModulesInAssets, expoModulesInAssets);
}

function replaceInDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      replaceInDir(fullPath);
    } else if (/\.(js|html|json)$/.test(item.name)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('/assets/node_modules/')) {
        content = content.replace(/\/assets\/node_modules\//g, '/assets/expo_modules/');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`[fix-web-export] Updated font paths in ${path.relative(distDir, fullPath)}`);
      }
    }
  }
}

replaceInDir(distDir);

// Guarantee 200.html and _redirects for SPA routing on Vercel
const indexHtmlPath = path.join(distDir, 'index.html');
const twoHundredPath = path.join(distDir, '200.html');
const redirectsPath = path.join(distDir, '_redirects');

if (fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(indexHtmlPath, twoHundredPath);
  fs.writeFileSync(redirectsPath, '/*    /index.html   200\n', 'utf8');
  console.log('[fix-web-export] Created 200.html and _redirects for Vercel SPA routing.');
}

console.log('[fix-web-export] Web build post-processing complete.');
