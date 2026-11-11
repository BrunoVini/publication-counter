# Pilot checklist

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

