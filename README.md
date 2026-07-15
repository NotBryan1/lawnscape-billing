# Lawnscape Billing

A desktop billing app for a lawnscaping business, for Mac and Windows. Manage customers, bill them weekly or monthly, print professional PDF invoices, and track payments — with all data stored locally on your machine, never in the cloud.

## Download & install

Grab the latest installer from the [Releases page](https://github.com/NotBryan1/lawnscape-billing/releases):

- **Windows:** download `Lawnscape-Billing-Setup-<version>.exe` and run it. Windows installs **update themselves automatically** when a new version is released.
- **Mac:** download the `.dmg` and drag the app to Applications. Because the app isn't code-signed, macOS may say it's "damaged" — it isn't. Fix it with:

  ```bash
  xattr -dr com.apple.quarantine "/Applications/Lawnscape Billing.app"
  ```

  Mac installs do not auto-update; download the new `.dmg` when a release comes out (or build locally — see [docs/RELEASING.md](docs/RELEASING.md)).

## What it does

**Billing**
- Multi-step New Bill wizard: pick a customer, add one or more work days, add services (Lawn Mowing, Mulch, Maintenance, or custom) with prices that carry over from the customer's last bill
- Optional note per work day that prints on the invoice
- Sequential invoice numbers starting at #1001
- Save bills as **drafts** and mark them finished later
- Duplicate-bill warning if a bill with the same dates and services already exists
- **Monthly Billing:** generate a month's bills for every customer in one pass, based on each customer's service day; already-billed customers are kept separate so nobody gets double-billed
- Print or email any bill; sent bills are highlighted in Bill History

**Money**
- **Payments tab:** record cash, check (with check number), Zelle, or other; partial payments allowed, capped at the bill total
- **Overdue tracking:** unpaid bills older than a configurable number of days (default 30) get red badges, a sidebar counter, and a "needs attention" list on the dashboard
- **Reports tab:** yearly and monthly income, per-customer totals, spreadsheet export, and a printable **client directory** (name, address, contact, average charge per month)

**Customers**
- Full customer list with search, sorting, and filters (including by service day)
- Add customers one at a time or **import from a spreadsheet** (English or Spanish column headers)
- Per-customer notes, bill history, and paid-month tracking
- Discontinue a customer without losing their history; reactivate any time

**Quality of life**
- **Today dashboard:** who's scheduled today, recent bills, and what needs attention
- **⌘K command palette:** jump to any page or customer from the keyboard
- Light and dark mode
- **English and Spanish UI** — the language setting only changes the app itself; invoices and client emails always stay in English
- Built-in Help tab with a tutorial of every feature

## Your data

Everything (customers, bills, settings) lives in plain JSON files on your computer — nothing is uploaded anywhere, and no customer data is ever committed to this repo.

- **macOS:** `~/Library/Application Support/lawnscape-billing/data/`
- **Windows:** `%APPDATA%\lawnscape-billing\data\`

The app also protects your data automatically:
- **Weekly auto-backups** (the last 8 are kept) in a `backups` folder next to the data — Settings has a button to open it
- **Manual backup & restore** from Settings, so you can move your data to a new computer

## Development

```bash
npm install
npm run dev        # run the app with hot reload
```

Build installers locally:

```bash
npm run package        # current platform
npm run package:mac    # Mac .dmg
npm run package:win    # Windows installer
```

Releases are built and published automatically by GitHub Actions when a `v*` tag is pushed — the full process is in [docs/RELEASING.md](docs/RELEASING.md).

Built with Electron, React, Vite, Tailwind CSS, jsPDF, and SheetJS.
