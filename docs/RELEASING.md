# Releasing a new version

How to ship a new version of Lawnscape Billing so that Windows users auto-update, Mac users can download it, and your own Mac gets the new build.

## Prerequisites

- On the `main` branch with all features merged and the working tree clean
- The app tested in dev mode (`npm run dev`)
- Push access to https://github.com/NotBryan1/lawnscape-billing

## Steps

### 1. Bump the version

Edit `version` in `package.json` (e.g. `1.3.1` → `1.3.2` for fixes, `1.4.0` for new features). The sidebar version badge reads this automatically.

### 2. Commit, tag, and push

```bash
git add -A
git commit -m "Release v1.3.2: <what changed>"
git push origin main
git tag v1.3.2
git push origin v1.3.2
```

Pushing the `v*` tag triggers the **Build desktop apps** workflow (`.github/workflows/build.yml`), which builds on both macOS and Windows runners and publishes a GitHub Release with:

- `Lawnscape-Billing-<version>-arm64.dmg` (Mac)
- `Lawnscape-Billing-Setup-<version>.exe` (Windows)
- `latest.yml` / `latest-mac.yml` — the auto-update manifests. **Don't delete these**; Windows auto-update reads `latest.yml` to discover new versions.

### 3. Verify the release

Watch the workflow, then confirm the release has all assets and is not a draft:

```bash
gh run watch --repo NotBryan1/lawnscape-billing
gh release view v1.3.2 --repo NotBryan1/lawnscape-billing
```

Windows installs pick up the update automatically the next time the app launches.

### 4. Update the local Mac install

Mac has no auto-update, and downloaded unsigned `.dmg`s get quarantined by macOS ("app is damaged"). So the Mac app is always **built locally and installed directly**:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package
pkill -f "Lawnscape Billing" || true
rm -rf "/Applications/Lawnscape Billing.app"
cp -R "dist/mac-arm64/Lawnscape Billing.app" /Applications/
xattr -l "/Applications/Lawnscape Billing.app" | grep quarantine || echo "no quarantine flag ✓"
open "/Applications/Lawnscape Billing.app"
```

User data is untouched — it lives in `~/Library/Application Support/lawnscape-billing/`, not inside the app bundle.

## Rollback

If a release is broken:

```bash
gh release delete v1.3.2 --repo NotBryan1/lawnscape-billing --yes
git push origin :refs/tags/v1.3.2
```

Then fix the problem, bump to a **new** version number, and release again. Don't reuse a version number that was already published — Windows machines may have cached its manifest.

## Troubleshooting

- **Mac says the downloaded app "is damaged"** — it's the quarantine flag on unsigned apps, not corruption. Either build locally (step 4) or clear it: `xattr -dr com.apple.quarantine "/Applications/Lawnscape Billing.app"`.
- **Workflow fails publishing** — the publish step needs `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` and `permissions: contents: write`, both already in `build.yml`; check the run logs if a GitHub outage or token change breaks it.
- **Need installers without releasing** — run the workflow manually (Actions → Build desktop apps → Run workflow). Manual runs build both installers as downloadable artifacts and publish nothing.
