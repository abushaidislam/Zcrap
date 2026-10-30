#!/usr/bin/env node

/**
 * Zcrap Integrity & Validation Engine
 * Zero-dependency syntax and manifest validator for CI and local verification.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
let errors = 0;

function logPass(msg) {
  console.log(`\x1b[32m✔ [PASS]\x1b[0m ${msg}`);
}

function logFail(msg) {
  console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${msg}`);
  errors++;
}

function logInfo(msg) {
  console.log(`\x1b[36mℹ [INFO]\x1b[0m ${msg}`);
}

// 1. Validate JavaScript syntax
function validateJsSyntax(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    logFail(`File not found: ${filePath}`);
    return;
  }

  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(code, { filename: filePath });
    logPass(`Syntax valid: ${filePath}`);
  } catch (err) {
    logFail(`Syntax error in ${filePath}: ${err.message}`);
  }
}

// 2. Validate Chrome Extension Manifest
function validateExtensionManifest() {
  const manifestPath = path.join(ROOT_DIR, 'extension', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    logFail('extension/manifest.json does not exist.');
    return;
  }

  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    if (manifest.manifest_version !== 3) {
      logFail(`extension/manifest.json must have manifest_version 3, got: ${manifest.manifest_version}`);
    } else {
      logPass('extension/manifest.json manifest_version is 3');
    }

    if (!manifest.name || typeof manifest.name !== 'string') {
      logFail('extension/manifest.json is missing valid "name"');
    }

    if (!manifest.version || !/^\d+(\.\d+)*$/.test(manifest.version)) {
      logFail(`extension/manifest.json has invalid "version": ${manifest.version}`);
    } else {
      logPass(`extension/manifest.json version is ${manifest.version}`);
    }

    if (manifest.background && manifest.background.service_worker) {
      const swPath = path.join(ROOT_DIR, 'extension', manifest.background.service_worker);
      if (fs.existsSync(swPath)) {
        logPass(`Extension service worker found: ${manifest.background.service_worker}`);
      } else {
        logFail(`Extension service worker missing: ${manifest.background.service_worker}`);
      }
    } else {
      logFail('extension/manifest.json missing background.service_worker');
    }

    if (manifest.action && manifest.action.default_popup) {
      const popupPath = path.join(ROOT_DIR, 'extension', manifest.action.default_popup);
      if (fs.existsSync(popupPath)) {
        logPass(`Extension popup found: ${manifest.action.default_popup}`);
      } else {
        logFail(`Extension popup missing: ${manifest.action.default_popup}`);
      }
    }

    if (manifest.icons && typeof manifest.icons === 'object') {
      for (const [size, iconRelPath] of Object.entries(manifest.icons)) {
        const iconPath = path.join(ROOT_DIR, 'extension', iconRelPath);
        if (fs.existsSync(iconPath)) {
          logPass(`Extension icon (${size}px) found: ${iconRelPath}`);
        } else {
          logFail(`Extension icon (${size}px) missing at: ${iconRelPath}`);
        }
      }
    }
  } catch (err) {
    logFail(`Failed to parse extension/manifest.json: ${err.message}`);
  }
}

// 3. Validate Figma Plugin Manifest
function validateFigmaManifest() {
  const manifestPath = path.join(ROOT_DIR, 'figma-plugin', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    logFail('figma-plugin/manifest.json does not exist.');
    return;
  }

  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    if (!manifest.name || typeof manifest.name !== 'string') {
      logFail('figma-plugin/manifest.json missing "name"');
    }

    if (!manifest.id || typeof manifest.id !== 'string') {
      logFail('figma-plugin/manifest.json missing "id"');
    } else {
      logPass(`figma-plugin/manifest.json id verified: ${manifest.id}`);
    }

    if (!manifest.main || typeof manifest.main !== 'string') {
      logFail('figma-plugin/manifest.json missing "main" entrypoint');
    } else {
      const mainPath = path.join(ROOT_DIR, 'figma-plugin', manifest.main);
      if (fs.existsSync(mainPath)) {
        logPass(`Figma plugin main script found: ${manifest.main}`);
      } else {
        logFail(`Figma plugin main script missing: ${manifest.main}`);
      }
    }

    if (manifest.ui && typeof manifest.ui !== 'string') {
      logFail('figma-plugin/manifest.json invalid "ui" field');
    } else if (manifest.ui) {
      const uiPath = path.join(ROOT_DIR, 'figma-plugin', manifest.ui);
      if (fs.existsSync(uiPath)) {
        logPass(`Figma plugin UI file found: ${manifest.ui}`);
      } else {
        logFail(`Figma plugin UI file missing: ${manifest.ui}`);
      }
    }
  } catch (err) {
    logFail(`Failed to parse figma-plugin/manifest.json: ${err.message}`);
  }
}

// 4. Validate HTML Files
function validateHtmlFiles() {
  const htmlFiles = [
    'extension/popup.html',
    'figma-plugin/ui.html'
  ];

  for (const file of htmlFiles) {
    const fullPath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(fullPath)) {
      logFail(`Missing HTML file: ${file}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8').trim();
    if (content.length === 0) {
      logFail(`HTML file is empty: ${file}`);
    } else {
      logPass(`HTML file verified: ${file} (${content.length} bytes)`);
    }
  }
}

// 5. Validate Version Synchronization across all 6 files
function validateVersionSynchronization() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    const extManifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'extension', 'manifest.json'), 'utf8'));
    const popupHtml = fs.readFileSync(path.join(ROOT_DIR, 'extension', 'popup.html'), 'utf8');
    const bgJs = fs.readFileSync(path.join(ROOT_DIR, 'extension', 'background.js'), 'utf8');
    const figmaUi = fs.readFileSync(path.join(ROOT_DIR, 'figma-plugin', 'ui.html'), 'utf8');
    const readme = fs.readFileSync(path.join(ROOT_DIR, 'README.md'), 'utf8');

    const expectedVersion = pkg.version;
    const vTag = `v${expectedVersion}`;

    if (extManifest.version !== expectedVersion) {
      logFail(`Version mismatch in extension/manifest.json: expected "${expectedVersion}", got "${extManifest.version}"`);
    } else {
      logPass(`1. package.json & 2. extension/manifest.json match version: ${expectedVersion}`);
    }

    if (!popupHtml.includes(vTag)) {
      logFail(`Version mismatch: extension/popup.html does not contain "${vTag}"`);
    } else {
      logPass(`3. extension/popup.html contains: ${vTag}`);
    }

    if (!bgJs.includes(vTag)) {
      logFail(`Version mismatch: extension/background.js header does not contain "${vTag}"`);
    } else {
      logPass(`4. extension/background.js contains: ${vTag}`);
    }

    if (!figmaUi.includes(vTag)) {
      logFail(`Version mismatch: figma-plugin/ui.html header does not contain "${vTag}"`);
    } else {
      logPass(`5. figma-plugin/ui.html contains: ${vTag}`);
    }

    if (!readme.includes(vTag)) {
      logFail(`Version mismatch: README.md does not contain "${vTag}"`);
    } else {
      logPass(`6. README.md contains: ${vTag}`);
    }
  } catch (err) {
    logFail(`Version synchronization check failed: ${err.message}`);
  }
}

// Run All Verifications
console.log('--------------------------------------------------');
logInfo('Starting Zcrap Project Validation...');
console.log('--------------------------------------------------');

// JS files to syntax check
const jsFiles = [
  'extension/background.js',
  'extension/content.js',
  'extension/popup.js',
  'extension/src/parsers.js',
  'extension/src/naming.js',
  'extension/src/dom-serializer.js',
  'extension/src/svg-serializer.js',
  'extension/src/controller.js',
  'figma-plugin/code.js',
  'scripts/build.js',
  'scripts/validate.js',
  'scripts/package.js'
];

logInfo('1. Validating JavaScript Files Syntax...');
for (const file of jsFiles) {
  validateJsSyntax(file);
}

console.log('--------------------------------------------------');
logInfo('2. Validating Chrome Extension Manifest V3...');
validateExtensionManifest();

console.log('--------------------------------------------------');
logInfo('3. Validating Figma Plugin Manifest...');
validateFigmaManifest();

console.log('--------------------------------------------------');
logInfo('4. Validating HTML Templates...');
validateHtmlFiles();

console.log('--------------------------------------------------');
logInfo('5. Validating Version Synchronization (ALL 6 files)...');
validateVersionSynchronization();

console.log('--------------------------------------------------');
if (errors === 0) {
  logPass('All project validations PASSED with 0 errors! 🎉');
  console.log('--------------------------------------------------');
  process.exit(0);
} else {
  logFail(`Validation completed with ${errors} error(s). Please fix before releasing.`);
  console.log('--------------------------------------------------');
  process.exit(1);
}
