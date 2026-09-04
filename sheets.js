/* ==========================================================================
   AhamMaxxing ↔ Google Sheets

   The app stays local-first: localStorage is still the working copy, so it
   opens instantly and works with no signal. The sheet is the durable, portable
   copy — the thing you can open in Excel, sort, chart and keep after this app
   is gone.

   Three tabs, shaped for a human to read:

     Categories   id | name | emoji | colour | order
     Targets      id | categoryId | name | kind | direction | period |
                  goal | unit | step | days | order | archived
     Log          row 1 = target names   (for you)
                  row 2 = target ids     (for the app — safe to hide)
                  row 3+ = one row per date, one column per target

   The Log is wide rather than long on purpose: a day's edit becomes a single
   one-row write instead of a scattered set of appends, and the shape is what
   you would build by hand for a chart or a pivot table.

   Sync model is deliberately simple, because this is one person on one or two
   devices: pull on connect, debounced push on change, last write wins. Edits
   made while offline are queued and pushed on the next successful connect.
   ========================================================================== */

const Sync = (() => {
  const TAB = { CATS: "Categories", TARGETS: "Targets", LOG: "Log" };
  const LS_SHEET = "aham_maxxing.sheet";
  const LS_QUEUE = "aham_maxxing.queue";
  const SS_TOKEN = "aham_maxxing.token";
  const PUSH_DELAY = 2500;

  let tokenClient = null;

  const s = {
    token: null,
    exp: 0,
    sheetId: null,
    email: "",
    status: "off",        // off | connecting | ready | syncing | error | offline
    error: "",
    lastSync: 0,
    dateRow: {},          // "YYYY-MM-DD" -> 1-based row in the Log tab
    cols: [],             // target ids in Log column order (column B onward)
    queue: { meta: false, days: [], full: false },
    timer: null,
  };

  /* ------------------------------------------------------------ helpers -- */

  const configured = () => !!(window.CONFIG && CONFIG.CLIENT_ID);
  const q = encodeURIComponent;

  function colLetter(n) {           // 1 -> A, 27 -> AA
    let out = "";
    while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = (n - r - 1) / 26; }
    return out;
  }

  function setStatus(status, error) {
    s.status = status;
    s.error = error || "";
    try { renderSyncChip(); } catch (_) { /* app not rendered yet */ }
  }

  function loadQueue() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_QUEUE) || "null");
      if (raw) s.queue = { meta: !!raw.meta, days: raw.days || [], full: !!raw.full };
    } catch (_) { /* ignore */ }
  }
  function saveQueue() {
    try { localStorage.setItem(LS_QUEUE, JSON.stringify(s.queue)); } catch (_) { /* ignore */ }
  }
  const queueEmpty = () => !s.queue.meta && !s.queue.full && !s.queue.days.length;

  /* --------------------------------------------------------------- auth -- */

  function initAuth() {
    if (!configured() || typeof google === "undefined") return;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      callback: () => {},
    });
    try {
      const saved = JSON.parse(sessionStorage.getItem(SS_TOKEN) || "null");
      if (saved && saved.exp > Date.now() + 60000) { s.token = saved.token; s.exp = saved.exp; }
    } catch (_) { /* ignore */ }
  }

  function getToken(interactive) {
    return new Promise((resolve, reject) => {
      if (s.token && s.exp > Date.now() + 60000) return resolve(s.token);
      if (!tokenClient) return reject(new Error("Google sign-in is not configured"));
      tokenClient.callback = (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        s.token = resp.access_token;
        s.exp = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3500 * 1000);
        try { sessionStorage.setItem(SS_TOKEN, JSON.stringify({ token: s.token, exp: s.exp })); } catch (_) {}
        resolve(s.token);
      };
      try {
        tokenClient.requestAccessToken({ prompt: interactive ? "" : "none" });
      } catch (e) { reject(e); }
    });
  }

  /* ---------------------------------------------------------- transport -- */

  async function call(url, opts = {}, retry = true) {
    const token = await getToken(false).catch(() => getToken(true));
    const res = await fetch(url, {
      ...opts,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    if (res.status === 401 && retry) {          // expired mid-flight
      s.token = null; s.exp = 0;
      return call(url, opts, false);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const e = new Error(`Sheets ${res.status}: ${body.slice(0, 300)}`);
      e.status = res.status;
      throw e;
    }
    return res.status === 204 ? null : res.json();
  }

  const api = (path, opts) =>
    call(`https://sheets.googleapis.com/v4/spreadsheets/${s.sheetId}${path}`, opts);

  /* -------------------------------------------------- encode / decode ---- */

  const KIND_OUT = { binary: "tick", amount: "amount" };
  const DIR_OUT = { at_least: "at least", at_most: "at most" };

  const norm = (v) => String(v == null ? "" : v).trim().toLowerCase().replace(/[\s_-]+/g, "");
  const parseKind = (v) => (norm(v) === "amount" ? "amount" : "binary");
  const parseDir = (v) => (norm(v) === "atmost" || norm(v) === "max" ? "at_most" : "at_least");
  const parsePeriod = (v) => (norm(v) === "week" || norm(v) === "weekly" ? "week" : "day");
  const parseBool = (v) => ["true", "yes", "1", "y"].includes(norm(v));

  function daysOut(days) {
    if (!days || days.length === 0 || days.length === 7) return "All";
    return days.slice().sort((a, b) => a - b).map((d) => DOW[d]).join(", ");
  }
  function daysIn(v) {
    const t = String(v == null ? "" : v).trim();
    if (!t || norm(t) === "all" || norm(t) === "everyday") return [...ALL_DAYS];
    const out = [];
    t.split(/[,;/]+/).forEach((part) => {
      const p = norm(part);
      if (!p) return;
      if (/^\d$/.test(p)) { const n = Number(p); if (n >= 0 && n <= 6) out.push(n); return; }
      const i = DOW.findIndex((d) => norm(d) === p.slice(0, 3));
      if (i >= 0) out.push(i);
    });
    return out.length ? [...new Set(out)].sort((a, b) => a - b) : [...ALL_DAYS];
  }

  const CAT_HEAD = ["id", "name", "emoji", "colour", "order"];
  const TGT_HEAD = ["id", "categoryId", "name", "kind", "direction", "period",
                    "goal", "unit", "step", "days", "order", "archived"];

  const catRow = (c) => [c.id, c.name, c.emoji, c.color, c.order];
  const tgtRow = (t) => [
    t.id, t.catId, t.name, KIND_OUT[t.kind] || "tick", DIR_OUT[t.dir] || "at least",
    t.period, t.goal, t.unit || "", t.step, daysOut(t.days), t.order, t.archived ? "TRUE" : "FALSE",
  ];

  /* Log columns follow the app's target order, archived ones included: a target
     you paused still owns its history and must keep its column. */
  const logTargets = () => state.targets.slice();

  /* ------------------------------------------------------------- schema -- */

  async function ensureTabs() {
    const meta = await api("?fields=sheets.properties");
    const have = new Set((meta.sheets || []).map((sh) => sh.properties.title));
    const missing = Object.values(TAB).filter((t) => !have.has(t));

    if (missing.length) {
      await api(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
        }),
      });
    }

    // Freeze the header rows so the sheet stays readable once it is long.
    const fresh = await api("?fields=sheets.properties");
    const byTitle = {};
    (fresh.sheets || []).forEach((sh) => { byTitle[sh.properties.title] = sh.properties; });

    const freeze = [
      { title: TAB.CATS, rows: 1 },
      { title: TAB.TARGETS, rows: 1 },
      { title: TAB.LOG, rows: 2 },
    ].filter((f) => byTitle[f.title] &&
        (byTitle[f.title].gridProperties || {}).frozenRowCount !== f.rows)
     .map((f) => ({
        updateSheetProperties: {
          properties: { sheetId: byTitle[f.title].sheetId, gridProperties: { frozenRowCount: f.rows } },
          fields: "gridProperties.frozenRowCount",
        },
      }));

    if (freeze.length) {
      await api(":batchUpdate", { method: "POST", body: JSON.stringify({ requests: freeze }) });
    }
  }

  /* --------------------------------------------------------------- pull -- */

  async function readAll() {
    const ranges = [
      `${TAB.CATS}!A1:Z10000`,
      `${TAB.TARGETS}!A1:Z10000`,
      `${TAB.LOG}!A1:ZZ100000`,
    ].map((r) => `ranges=${q(r)}`).join("&");
    const res = await api(`/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`);
    const [cats, tgts, log] = (res.valueRanges || []).map((v) => v.values || []);
    return { cats: cats || [], tgts: tgts || [], log: log || [] };
  }

  /* Rebuild the whole local document from the sheet. The sheet wins, which is
     what "maintained in a spreadsheet" has to mean — otherwise editing a goal
     by hand would silently be undone on the next sync. */
  function adopt({ cats, tgts, log }) {
    const categories = cats.slice(1)
      .filter((r) => r && r[0])
      .map((r, i) => ({
        id: String(r[0]), name: String(r[1] || "Untitled"), emoji: String(r[2] || "⭐"),
        color: String(r[3] || "#3F7D5B"), order: Number(r[4]) || i,
      }));

    const targets = tgts.slice(1)
      .filter((r) => r && r[0])
      .map((r, i) => ({
        id: String(r[0]), catId: String(r[1] || ""), name: String(r[2] || "Untitled"),
        kind: parseKind(r[3]), dir: parseDir(r[4]), period: parsePeriod(r[5]),
        goal: Number(r[6]) || 1, unit: String(r[7] || ""), step: Number(r[8]) || 1,
        days: daysIn(r[9]), order: Number(r[10]) || i, archived: parseBool(r[11]),
      }))
      // A target whose category was deleted in the sheet would otherwise vanish
      // from every screen while still occupying a Log column.
      .filter((t) => categories.some((c) => c.id === t.catId));

    const ids = log.length > 1 ? log[1].slice(1).map((v) => String(v || "")) : [];
    const rows = {};
    const dateRow = {};
    log.slice(2).forEach((r, i) => {
      const date = String(r[0] || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      dateRow[date] = i + 3;                      // 1-based, past the two header rows
      const day = {};
      ids.forEach((id, c) => {
        const raw = r[c + 1];
        if (raw === "" || raw == null) return;
        const t = targets.find((x) => x.id === id);
        if (!t) return;
        const n = Number(raw);
        if (t.kind === "binary") { if (n || parseBool(raw)) day[id] = true; }
        else if (n) day[id] = round2(n);
      });
      if (Object.keys(day).length) rows[date] = day;
    });

    if (categories.length) {
      state.categories = categories;
      state.targets = targets;
      state.log = rows;
      save();
    }
    s.cols = ids;
    s.dateRow = dateRow;
    return categories.length;
  }

  /* --------------------------------------------------------------- push -- */

  async function clearAndWrite(tab, values) {
    await api(`/values/${q(tab + "!A1:ZZ100000")}:clear`, { method: "POST", body: "{}" });
    if (!values.length) return;
    await api(`/values/${q(tab + "!A1")}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ values }),
    });
  }

  async function pushMeta() {
    await clearAndWrite(TAB.CATS, [CAT_HEAD, ...state.categories
      .slice().sort((a, b) => a.order - b.order).map(catRow)]);
    await clearAndWrite(TAB.TARGETS, [TGT_HEAD, ...state.targets.map(tgtRow)]);
  }

  /* A full Log rewrite. Used whenever the column set changes (a target added,
     deleted or reordered) and on first connect, where it also has the pleasant
     side effect of re-sorting rows that were appended out of order. */
  async function pushLogFull() {
    const ts = logTargets();
    s.cols = ts.map((t) => t.id);

    const dates = Object.keys(state.log).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    const values = [
      ["Date", ...ts.map((t) => t.name)],
      ["id", ...ts.map((t) => t.id)],
      ...dates.map((d) => [d, ...ts.map((t) => {
        const v = (state.log[d] || {})[t.id];
        if (v === true) return 1;
        return v == null || v === false || v === 0 ? "" : v;
      })]),
    ];

    await clearAndWrite(TAB.LOG, values);
    s.dateRow = {};
    dates.forEach((d, i) => { s.dateRow[d] = i + 3; });
  }

  /* Incremental: one range write per already-present date, one append for the
     dates the sheet has not seen yet. */
  async function pushDays(days) {
    const ts = logTargets();
    const width = colLetter(ts.length + 1);
    const rowFor = (d) => [d, ...ts.map((t) => {
      const v = (state.log[d] || {})[t.id];
      if (v === true) return 1;
      return v == null || v === false || v === 0 ? "" : v;
    })];

    const existing = days.filter((d) => s.dateRow[d]);
    const fresh = days.filter((d) => !s.dateRow[d]).sort();

    if (existing.length) {
      await api("/values:batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: existing.map((d) => ({
            range: `${TAB.LOG}!A${s.dateRow[d]}:${width}${s.dateRow[d]}`,
            values: [rowFor(d)],
          })),
        }),
      });
    }

    if (fresh.length) {
      const res = await api(
        `/values/${q(TAB.LOG + "!A1")}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        { method: "POST", body: JSON.stringify({ values: fresh.map(rowFor) }) }
      );
      // Learn the row numbers the append landed on, so the next edit to these
      // dates is an update rather than a duplicate row.
      const m = /![A-Z]+(\d+):/.exec((res.updates || {}).updatedRange || "");
      if (m) fresh.forEach((d, i) => { s.dateRow[d] = Number(m[1]) + i; });
    }
  }

  async function flush() {
    if (!s.sheetId || queueEmpty()) return;
    setStatus("syncing");
    const job = { ...s.queue, days: [...s.queue.days] };
    s.queue = { meta: false, days: [], full: false };
    saveQueue();

    try {
      if (job.meta) await pushMeta();
      if (job.full || job.meta) await pushLogFull();     // column set may have moved
      else if (job.days.length) await pushDays(job.days);
      s.lastSync = Date.now();
      setStatus("ready");
    } catch (e) {
      // Put the work back so nothing is lost, and try again next time.
      s.queue.meta = s.queue.meta || job.meta;
      s.queue.full = s.queue.full || job.full;
      s.queue.days = [...new Set([...s.queue.days, ...job.days])];
      saveQueue();
      setStatus(navigator.onLine ? "error" : "offline", e.message);
    }
  }

  function schedule() {
    if (!s.sheetId) return;
    clearTimeout(s.timer);
    s.timer = setTimeout(flush, PUSH_DELAY);
    if (s.status === "ready") setStatus("syncing");
  }

  /* ------------------------------------------------------------- public -- */

  function markDay(dayKey) {
    if (!s.sheetId) return;
    if (!s.queue.days.includes(dayKey)) s.queue.days.push(dayKey);
    saveQueue();
    schedule();
  }

  function markMeta() {
    if (!s.sheetId) return;
    s.queue.meta = true;
    saveQueue();
    schedule();
  }

  async function createSheet() {
    const res = await call("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      body: JSON.stringify({
        properties: { title: "AhamMaxxing" },
        sheets: Object.values(TAB).map((title) => ({ properties: { title } })),
      }),
    });
    return res.spreadsheetId;
  }

  async function connect({ interactive = true, sheetId = null } = {}) {
    if (!configured()) {
      setStatus("error", "No Google client ID in config.js");
      return false;
    }
    setStatus("connecting");
    try {
      await getToken(interactive);

      s.sheetId = sheetId || s.sheetId || CONFIG.SPREADSHEET_ID || null;
      if (!s.sheetId) s.sheetId = await createSheet();
      localStorage.setItem(LS_SHEET, s.sheetId);

      await ensureTabs();
      const data = await readAll();
      const adopted = adopt(data);

      // An empty sheet gets seeded from whatever is already on this device;
      // a sheet with content is the source of truth and wins.
      if (!adopted) {
        await pushMeta();
        await pushLogFull();
      } else if (!queueEmpty()) {
        await flush();                      // replay edits made offline
      }

      s.lastSync = Date.now();
      setStatus("ready");
      render();
      return true;
    } catch (e) {
      setStatus(navigator.onLine ? "error" : "offline", e.message);
      render();
      return false;
    }
  }

  function disconnect({ forget = false } = {}) {
    if (s.token) { try { google.accounts.oauth2.revoke(s.token); } catch (_) {} }
    s.token = null; s.exp = 0;
    try { sessionStorage.removeItem(SS_TOKEN); } catch (_) {}
    if (forget) {
      s.sheetId = null;
      localStorage.removeItem(LS_SHEET);
      localStorage.removeItem(LS_QUEUE);
      s.queue = { meta: false, days: [], full: false };
    }
    setStatus("off");
    render();
  }

  async function pullNow() {
    if (!s.sheetId) return;
    setStatus("syncing");
    try {
      await ensureTabs();
      adopt(await readAll());
      s.lastSync = Date.now();
      setStatus("ready");
      render();
    } catch (e) {
      setStatus(navigator.onLine ? "error" : "offline", e.message);
      render();
    }
  }

  async function pushNow() {
    if (!s.sheetId) return;
    s.queue.meta = true;
    s.queue.full = true;
    saveQueue();
    clearTimeout(s.timer);
    await flush();
    render();
  }

  /* The Google Identity script is loaded async, so it may not have arrived by
     the time the app boots. */
  function whenGoogleReady(cb, tries = 0) {
    if (typeof google !== "undefined" && google.accounts && google.accounts.oauth2) return cb();
    if (tries > 60) return;
    setTimeout(() => whenGoogleReady(cb, tries + 1), 100);
  }

  function init() {
    loadQueue();
    s.sheetId = localStorage.getItem(LS_SHEET) || (window.CONFIG || {}).SPREADSHEET_ID || null;
    if (!configured()) return;

    whenGoogleReady(() => {
      initAuth();
      // Reconnect quietly if this browser already has a live Google session.
      if (s.sheetId) connect({ interactive: false }).then((ok) => { if (!ok) setStatus("off"); });
    });

    window.addEventListener("online", () => { if (s.sheetId && !queueEmpty()) flush(); });
  }

  const info = () => ({
    configured: configured(),
    connected: !!s.sheetId && ["ready", "syncing"].includes(s.status),
    sheetId: s.sheetId,
    status: s.status,
    error: s.error,
    pending: s.queue.days.length + (s.queue.meta ? 1 : 0) + (s.queue.full ? 1 : 0),
    lastSync: s.lastSync,
  });

  return { init, connect, disconnect, pullNow, pushNow, markDay, markMeta, info, flush };
})();
