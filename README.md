# PubCount

PubCount counts the publications at a congregation by weighing them. It replaces a spreadsheet: weigh a sample of each item, weigh the pile, and the app works out how many there are.

- **Offline, no server.** It is a PWA that runs entirely in the browser. There is no backend, no account and no analytics. Data is stored on the device (IndexedDB).
- **Hand-over file.** A count can be exported as a `.pubcount` file and opened on another device, so the next person can continue from the same data.
- **Languages.** Portuguese, English and Spanish (pt/en/es); the default follows the device language.
- Exports: print to PDF and Excel.

Built with Svelte 5, TypeScript and Vite.

## Development

Node 22 is required (`nvm use` reads `.nvmrc`).

```
npm install
npm run dev
npm test
npm run check
npm run build      # output in dist/
npm run preview    # serve the production build locally
```

## Deploy (Cloudflare Pages)

Create a Cloudflare Pages project linked to https://github.com/BrunoVini/publication-counter with:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `NODE_VERSION=22` |

`public/_headers` is copied to `dist/` and sets the security headers (CSP, nosniff, referrer and permissions policies). `index.html` carries a matching CSP meta tag as a fallback for other hosts.

Production URL: **TODO (author): paste the `*.pages.dev` URL here after the first deploy.**

## Pilot checklist

Real-use checklist (author):

- [ ] Install on the phone and on the hall laptop.
- [ ] Paste the publication list.
- [ ] Weigh the samples.
- [ ] Run a full count.
- [ ] Finish the count.
- [ ] Print to PDF and export Excel.
- [ ] Hand over the `.pubcount` and open it on a second device.
- [ ] Compare the totals with the spreadsheet.

Manual PWA checks:

- [ ] After `npm run build && npx vite preview`, Chrome shows the install prompt.
- [ ] With DevTools Network set to offline, reloading works, including `/?shared=1`.
- [ ] On desktop, after install, double-clicking a `.pubcount` file opens it, with a replace confirmation if data exists.
- [ ] On Android, sharing a `.pubcount` to the installed app opens it, with confirmation if data exists.
- [ ] The screen stays awake during an open count.
- [ ] On iOS Safari (not installed), the "Add to Home Screen" banner shows.
- [ ] After a new deploy, the "New version available · Reload" toast appears.
- [ ] An invalid or too-new file shows an error and changes nothing.
- [ ] The browser console shows no CSP violations on every screen.

## License

MIT, see [LICENSE](LICENSE). Copyright (c) 2026 BrunoVini.
