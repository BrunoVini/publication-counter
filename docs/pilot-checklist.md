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


## Google Drive setup (author only)

- [ ] Deploy to Cloudflare Pages, note the `<project>.pages.dev` URL and fill in the README "Production URL" line.
- [ ] Create a Google Cloud project and enable the Google Drive API.
- [ ] Configure the OAuth consent screen: External, app name without any JW name, privacy policy URL `https://<pages.dev>/privacy.html`, scope `drive.file` only, and add yourself as a test user.
- [ ] Create an OAuth Client ID of type Web application, with authorised JavaScript origins `https://<pages.dev>` and `http://localhost:5173`.
- [ ] Set `VITE_GOOGLE_CLIENT_ID` in the Cloudflare Pages environment variables and in a local `.env.local` (gitignored), then redeploy.
- [ ] Replace `CONTACT: TODO (author)` in `public/privacy.html`.
- [ ] Test: connect, back up now, conflict (edit on two devices), expiry (wait about 1 h, then Reconnect), and disconnect.
- [ ] Check whether brand verification is required before publishing (`drive.file` is non-sensitive, so unverified should be OK), then switch the publishing status to In production.
