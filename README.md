# PubCount

[![CI](https://github.com/BrunoVini/publication-counter/actions/workflows/ci.yml/badge.svg)](https://github.com/BrunoVini/publication-counter/actions/workflows/ci.yml)

Counts the publications at a congregation by weighing them, replacing a spreadsheet: weigh a sample, weigh the pile, get the count.

Offline PWA with no server or account. Data stays on the device, and a count can be handed over as a `.pubcount` file. Optional personal backup to your own Google Drive. See the [privacy page](public/privacy.html). Available in Portuguese, English and Spanish, with print/PDF and Excel export.

## Run

Node 22 (`nvm use`).

```
npm install
npm run dev     # local dev server
npm test        # tests
npm run build   # production build in dist/
```

## Deploy

Cloudflare Pages: build `npm run build`, output `dist`, env `NODE_VERSION=22`.
Production URL: TODO.

Pilot checklist: [docs/pilot-checklist.md](docs/pilot-checklist.md).

## License

[MIT](LICENSE)
