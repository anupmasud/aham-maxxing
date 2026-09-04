# AhamMaxxing

Set targets by category, check them off daily, and see how the week actually went.

*Aham* — Sanskrit for "I". You define the categories, you set the targets, you
decide what counts.

A single-page PWA with no build step. It runs entirely on the device, and can
optionally keep everything in a Google Sheet on your own Drive — so the data is
yours in a form you can read, edit, chart and keep long after this app is gone.

## The model

Every target is described by three independent axes. Between them they cover
everything the app needs to track:

| Axis | Values | Meaning |
|---|---|---|
| `kind` | `tick` / `amount` | a checkbox, or a number you log |
| `direction` | `at least` / `at most` | a floor to reach, or a ceiling to stay under |
| `period` | `day` / `week` | judged each day, or across the whole week |

So:

- *8,000 steps every day* → `amount` / `at least` / `day`
- *Strength training 4× a week* → `tick` / `at least` / `week`
- *No more than 6 units of alcohol a week* → `amount` / `at most` / `week`
- *Meditate 10 minutes* → `amount` / `at least` / `day`

Daily targets can be restricted to particular weekdays. Weekly ones can be done
on any day; the week as a whole is what's judged.

### Floors and ceilings are scored differently, on purpose

The day ring counts only **daily floors** — the things you actively have to do.
A ceiling you simply haven't broken yet would otherwise inflate the score to
100% for doing nothing, so limits are reported separately ("Limits: all clear")
and get a weekly trend line in Insights rather than a hit rate. The interesting
question about alcohol isn't *did you pass* but *which way is it moving*.

For the same reason a blown **weekly** ceiling doesn't paint its whole week red
in the heatmap — one heavy Friday shouldn't repaint the other six days.

## Screens

- **Today** — the day's ring, a week strip, and every target grouped by category.
  Tap the circle to complete; use −/+ or tap the number for amounts.
- **Week** — the whole week as a grid, targets × days. Every cell is editable.
- **Insights** — hit rates by category and by target, streaks, weekly trend lines
  for each limit, and a day-by-day heatmap.
- **Setup** — categories and targets, a suggestion library per category, the
  Google Sheets connection, and backup export/import.

## Connecting Google Sheets

Off by default. Once connected, your data lives in a spreadsheet on your Drive
and syncs both ways: tick something here and the sheet updates; change a goal in
the sheet and the app picks it up on its next pull.

**1. Make an OAuth client.** In the [Google Cloud console](https://console.cloud.google.com/):

1. Create a project (or reuse one) and enable the **Google Sheets API**.
2. Under *APIs & Services → Credentials*, create an **OAuth client ID** of type
   **Web application**.
3. Add every origin you'll serve the app from to **Authorised JavaScript origins**:
   `http://localhost:8123` and `https://<your-username>.github.io`.
4. While the consent screen is in *Testing*, add your own Google address under
   **Test users**, or sign-in will be refused.

**2. Paste the client ID into `config.js`.** That's the only required setting.
Client IDs are not secrets — they ship in the page — and it's the origin
allow-list above that actually protects them.

If you already have a client from 33&Me you can reuse its ID, but you must add
this app's origins to that client first.

**3. Connect.** Open Setup → Google Sheets → *Connect Google Sheets*. With no
sheet configured the app creates one called "AhamMaxxing" on your Drive; or use
*Change sheet* to paste the link of an existing one.

### What the sheet looks like

Three tabs, shaped so a person can read them:

**Categories** — `id · name · emoji · colour · order`

**Targets** — `id · categoryId · name · kind · direction · period · goal · unit ·
step · days · order · archived`

`days` is written as `All` or as weekday names (`Mon, Wed, Fri`); both are
accepted back, as are day numbers where Monday is 0.

**Log** — one row per date, one column per target:

| | A | B | C |
|---|---|---|---|
| **1** | Date | Walk | Alcohol |
| **2** | id | t_a1b2c3 | t_d4e5f6 |
| **3** | 2026-09-04 | 45 | 2 |

Row 1 is target names, for you. Row 2 is target ids, for the app — hide it if it
bothers you, but don't delete it: it's what survives renaming a target. Ticks
are stored as `1` so the columns add up.

The Log is wide rather than one-row-per-entry on purpose: a day's edit becomes a
single one-row write, and the shape is what you'd build by hand for a chart or a
pivot table.

### How syncing behaves

- **Local-first.** localStorage stays the working copy, so the app opens
  instantly and works with no signal.
- **Pull on connect, debounced push on change** (about 2.5s after you stop
  tapping). Structural changes rewrite the Categories and Targets tabs; a day's
  edit updates just that row.
- **The sheet wins on pull.** Editing a goal by hand has to mean something, so a
  pull replaces the local copy. Setup warns you before pulling if there are
  unsent changes.
- **Offline edits are queued** and pushed the next time a connection succeeds;
  the header chip shows how many are waiting.
- **Last write wins.** This is one person on one or two devices, not a
  collaborative document, and pretending otherwise would add a lot of machinery
  for a conflict that mostly doesn't happen.
- Deleting a category row in the sheet also drops its targets, since a target
  with no category can't be shown anywhere.

## Running it

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123. Use port 8123 specifically if you're testing
Google sign-in, since that's the origin registered above. A service worker
caches the shell, so it works offline after the first load.

## Tests

The Sheets layer runs against an in-memory fake of the Sheets v4 API, covering
first connect, incremental writes, adopting hand-edits and the offline queue:

```bash
node test/sheets.test.js
```

No dependencies, no test runner.

## Deploying

Push to GitHub and enable Pages on the repository root. Bump `CACHE` in `sw.js`
whenever you change the shell files, or returning visitors keep the old ones.
Remember to add the Pages URL to the OAuth client's authorised origins.

## Reminders

There are none yet beyond the pill in the header telling you what's still open
today. Real scheduled notifications need the app installed to the home screen
(iOS 16.4+) plus a push service — the obvious next piece of work, and it would
sit on top of the existing scoring rather than change it.

## Your data

Without Google Sheets connected, everything is in `localStorage` on this device
only — which also means clearing your browser data erases it. Export a backup
from Setup before switching phones or clearing site data.

With Sheets connected, the spreadsheet is the durable copy and the export is
still there as a belt-and-braces option.

The app asks for the `spreadsheets` scope, which is access to your spreadsheets
and nothing else — no mail, no Drive browsing, no contacts.

## Files

| File | |
|---|---|
| `index.html` | markup for all four screens plus the modal host |
| `styles.css` | warm paper theme, light and dark |
| `app.js` | model, scoring, rendering, interaction |
| `sheets.js` | Google auth and the two-way Sheets sync |
| `config.js` | your OAuth client ID and optional default sheet |
| `sw.js` | app-shell cache |
| `test/sheets.test.js` | Sheets layer against a fake API |
