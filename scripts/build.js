#!/usr/bin/env node

/**
 * Zcrap Build Engine
 * Assembles modular source files from extension/src/ into extension/content.js
 * Zero dependencies, ultra-fast, and verified with vm.Script.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'extension', 'src');
const OUTPUT_FILE = path.join(ROOT_DIR, 'extension', 'content.js');

const MODULE_FILES = [
  'parsers.js',
  'naming.js',
  'dom-serializer.js',
  'svg-serializer.js',
  'controller.js'
];

function logInfo(msg) {
  console.log(`\x1b[36mℹ [BUILD]\x1b[0m ${msg}`);
}

function logPass(msg) {
  console.log(`\x1b[32m✔ [BUILD]\x1b[0m ${msg}`);
}

function logFail(msg) {
  console.error(`\x1b[31m✖ [BUILD]\x1b[0m ${msg}`);
}

function build() {
  logInfo('Starting Zcrap Content Script assembly from extension/src/...');

  const banner = `// Zcrap Content Script - High-Fidelity 1:1 Web Serializer
// AUTO-GENERATED from extension/src/ by scripts/build.js — DO NOT EDIT DIRECTLY!
(function () {
  window.__zcrap_installed = true;
  console.log('[Zcrap] High-fidelity 1:1 engine active.');

`;

  const footer = `\n})();\n`;

  const parts = [banner];

  for (const file of MODULE_FILES) {
    const filePath = path.join(SRC_DIR, file);
    if (!fs.existsSync(filePath)) {
      logFail(`Missing required module: ${file}`);
      process.exit(1);
    }

    const code = fs.readFileSync(filePath, 'utf8');
    parts.push(`  // ==========================================================================\n`);
    parts.push(`  // MODULE: ${file}\n`);
    parts.push(`  // ==========================================================================\n\n`);
    parts.push(code.trim());
    parts.push('\n\n');
  }

  parts.push(footer);

  const assembledCode = parts.join('');

  // Validate syntax before writing
  try {
    new vm.Script(assembledCode, { filename: 'extension/content.js' });
    logPass('Syntax verification PASSED for assembled content.js');
  } catch (err) {
    logFail(`Syntax verification FAILED: ${err.message}`);
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_FILE, assembledCode, 'utf8');
  const sizeKb = (Buffer.byteLength(assembledCode, 'utf8') / 1024).toFixed(2);
  const lineCount = assembledCode.split('\n').length;
  logPass(`Bundled ${MODULE_FILES.length} modules into extension/content.js (${lineCount} lines, ${sizeKb} KB)`);
}

build();
