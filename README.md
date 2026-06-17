# Lawnscape Billing Manager

A desktop billing app for lawnscaping businesses. Create professional PDF invoices, manage customers, and track billing history — all stored locally on your machine.

## Features

- Save and reuse customer information each month
- Pick the date of work and select services (Mowing, Mulch, Trimming + custom)
- Prices auto-fill from the last bill for each customer
- Generate professional PDF invoices with your business logo, name, phone, and email
- View and filter full billing history
- Re-export any past invoice as a PDF

## Data Privacy

All data (customers, bills, settings) is stored locally on your computer in the OS user-data directory — **never uploaded anywhere**. This repo contains only source code; no customer information is ever committed.

- **macOS:** `~/Library/Application Support/lawnscape-billing/`
- **Windows:** `%APPDATA%\lawnscape-billing\`

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run package
```

Built with Electron + React + Vite + Tailwind CSS.
