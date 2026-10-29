#!/usr/bin/env node

/**
 * Zcrap Packaging Engine
 * Bundles Chrome Extension and Figma Plugin into clean, ready-to-distribute ZIP archives.
 * Cross-platform compatible (Windows via PowerShell, Linux/macOS via zip).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

function logPass(msg) {
  console.log(`\x1b[32m✔ [PACKAGED]\x1b[0m ${msg}`);
}

function logInfo(msg) {
  console.log(`\x1b[36mℹ [INFO]\x1b[0m ${msg}`);
}

function ensureDistDir() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    logInfo('Created dist/ directory.');
  }
}

function createZip(sourceRelDir, outputZipName) {
  const sourcePath = path.join(ROOT_DIR, sourceRelDir);
  const outputPath = path.join(DIST_DIR, outputZipName);

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  logInfo(`Bundling ${sourceRelDir} into dist/${outputZipName}...`);

  if (process.platform === 'win32') {
    // Windows: Use PowerShell Compress-Archive
    const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${sourcePath}\\*' -DestinationPath '${outputPath}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });
  } else {
    // Linux / macOS: Use zip utility
    const zipCmd = `cd "${sourcePath}" && zip -r "${outputPath}" . -x ".*" -x "__MACOSX"`;
    execSync(zipCmd, { stdio: 'inherit' });
  }

  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const sizeKb = (stats.size / 1024).toFixed(2);
    logPass(`${outputZipName} created successfully (${sizeKb} KB)`);
  } else {
    throw new Error(`Failed to create ${outputPath}`);
  }
}

try {
  console.log('--------------------------------------------------');
  logInfo('Starting Zcrap Build & Packaging...');
  console.log('--------------------------------------------------');

  ensureDistDir();

  // Package Chrome Extension
  createZip('extension', 'zcrap-extension.zip');

  // Package Figma Plugin
  createZip('figma-plugin', 'zcrap-figma-plugin.zip');

  console.log('--------------------------------------------------');
  logPass('All components packaged into dist/ ready for distribution! 📦');
  console.log('--------------------------------------------------');
  process.exit(0);
} catch (err) {
  console.error(`\x1b[31m✖ [ERROR]\x1b[0m Packaging failed: ${err.message}`);
  process.exit(1);
}
