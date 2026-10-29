# Design Specification: GitHub CI/CD Automation Suite for Zcrap

**Date:** 2026-10-29  
**Target Project:** Zcrap (Chrome Extension + Figma Plugin)  
**Status:** Approved  

---

## 1. Overview & Goals

Zcrap is an open-source web-to-Figma capture tool consisting of two core components:
1. **Chrome Extension (Manifest V3)** under `extension/`
2. **Figma Plugin** under `figma-plugin/`

This design specifies a lightweight, zero-external-dependency CI/CD infrastructure that ensures code quality, manifest integrity, security analysis, and automated release asset bundling.

---

## 2. Architecture & Components

```
.github/
└── workflows/
    ├── ci.yml        # PR & commit validation + test packaging + artifacts
    ├── release.yml   # Tag-triggered automated GitHub Releases with ZIP assets
    └── codeql.yml    # GitHub CodeQL static security analysis
scripts/
├── validate.js       # Standalone integrity checker (manifests, referenced files, JS syntax)
└── package.js        # Cross-platform zip bundler for extension & figma plugin
```

### 2.1 Validation Engine (`scripts/validate.js`)
- Runs without requiring `npm install` (pure Node.js standard library).
- Performs:
  - **Syntax Checking**: Compiles all `.js` files using Node's `vm.Script` or `node --check`.
  - **Manifest V3 Verification**: Validates `extension/manifest.json` structure, permissions, and ensures all referenced files (`background.service_worker`, `action.default_popup`, `icons/*`) actually exist on disk.
  - **Figma Manifest Verification**: Validates `figma-plugin/manifest.json` structure, ensuring `main`, `ui`, and assets exist.
  - **Asset Check**: Ensures required icons and SVG brand assets are valid and non-empty.

### 2.2 Packaging Engine (`scripts/package.js`)
- Builds release ZIP archives:
  - `dist/zcrap-extension.zip`
  - `dist/zcrap-figma-plugin.zip`
- Built with standard Node.js or cross-platform utilities (using built-in archiver or zip utility/PowerShell fallback when local, standard zip on Ubuntu runner).
- Excludes dev artifacts, hidden files, `.DS_Store`, and temporary files.

### 2.3 GitHub Actions Workflows

#### `ci.yml`
- **Events**: `push` on `main`, `pull_request` on `main`, `workflow_dispatch`.
- **Jobs**:
  - `lint-and-validate`: Checks code syntax and manifest integrity.
  - `build-artifacts`: Packages both plugins and uploads them to GitHub Actions summary for rapid testing.

#### `release.yml`
- **Events**: Push on tag `v*` (e.g. `v3.1.0`), `workflow_dispatch`.
- **Jobs**:
  - Runs validation.
  - Builds release packages.
  - Uses `softprops/action-gh-release@v2` (or GitHub CLI `gh`) to create a release with auto-generated changelogs and attaches the extension and figma plugin zip files.

#### `codeql.yml`
- **Events**: Push/PR on `main`, plus weekly cron.
- **Jobs**: Runs GitHub CodeQL engine targeting `javascript-typescript`.

---

## 3. Verification Plan
- Run `node scripts/validate.js` locally to verify passing status.
- Run `node scripts/package.js` locally and inspect created archives.
- Validate workflow YAML schema.
