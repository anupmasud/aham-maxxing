# AhamMaxxing

Set targets by category, check them off daily, and see how the week actually went.

*Aham* — Sanskrit for "I". You define the categories, you set the targets, you
decide what counts.

A single-page PWA. No build step, no server, no account: everything lives in
`localStorage` on the device, and a backup is a JSON file you export yourself.

## The model

Every target is described by three independent axes. Between them they cover
everything the app needs to track:

| Axis | Values | Meaning |
|---|---|---|
| `kind` | `binary` / `amount` | a tick, or a number you log |
| `dir` | `at_least` / `at_most` | a floor to reach, or a ceiling to stay under |
| `period` | `day` / `week` | judged each day, or across the whole week |

So:

- *8,000 steps every day* → `amount` / `at_least` / `day`
- *Strength training 4× a week* → `binary` / `at_least` / `week`
- *No more than 6 units of alcohol a week* → `amount` / `at_most` / `week`
- *Meditate 10 minutes* → `amount` / `at_least` / `day`

Daily targets can also be restricted to particular weekdays. Weekly ones can be
done on any day; the week is what's judged.

### Floors and ceilings are scored differently, on purpose

The day ring counts only **daily floors** — the things you actively have to do.
A ceiling you simply haven't broken yet would otherwise inflate the score to
100% for doing nothing, so limits are reported separately ("Limits: all clear")
and get a weekly trend line in Insights rather than a hit rate. The interesting
question about alcohol isn't *did you pass* but *which way is it moving*.

For the same reason, a blown **weekly** ceiling doesn't paint its whole week red
in the heatmap — one heavy Friday shouldn't repaint the other six days.

## Screens

- **Today** — the day's ring, a week strip, and every target grouped by category.
  Tap the circle to complete; use −/+ or tap the number for amounts.
- **Week** — the whole week as a grid, targets × days. Every cell is editable.
- **Insights** — hit rates by category and by target, streaks, weekly trend lines
  for each limit, and a day-by-day heatmap.
- **Setup** — categories and targets, a suggestion library per category, and
  backup export/import.

## Running it

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123. A service worker caches the shell, so it works
offline after the first load.

## Deploying

Push to GitHub and enable Pages on the repository root. Bump `CACHE` in `sw.js`
whenever you change `app.js`, `styles.css` or `index.html`, or returning visitors
will keep the old shell.

## Reminders

There are none yet, beyond the pill in the header telling you what's still open
today. Real scheduled notifications need the app installed to the home screen
(iOS 16.4+) plus a push service — that's the obvious next piece of work, and it
would sit on top of the existing scoring rather than change it.

## Your data

`localStorage` only. It never leaves the device, which also means clearing your
browser data erases it. **Export a backup from Setup before switching phones or
clearing site data.**

## Files

| File | |
|---|---|
| `index.html` | markup for all four screens plus the modal host |
| `styles.css` | warm paper theme, light and dark |
| `app.js` | model, scoring, rendering, interaction — no dependencies |
| `sw.js` | app-shell cache |
