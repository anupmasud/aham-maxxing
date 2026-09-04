/* Exercises sheets.js against an in-memory fake of the Sheets v4 API.
   Covers the paths a real OAuth session would hit: first connect on an empty
   sheet, incremental day writes, and adopting hand-edits made in the sheet. */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const SRC = process.argv[2] || path.join(__dirname, "..", "sheets.js");

/* ----------------------------------------------------- fake spreadsheet -- */

const doc = { id: null, tabs: {} };            // title -> 2D array of cells
let nextSheetId = 1;
const sheetIds = {};

const A1 = (range) => {
  const [tab, cells] = range.includes("!") ? range.split("!") : [range, ""];
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(cells || "");
  const col = (L) => L.split("").reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0);
  return {
    tab: tab.replace(/^'|'$/g, ""),
    row: m ? Number(m[2]) : 1,
    col: m ? col(m[1]) : 1,
    endRow: m && m[4] ? Number(m[4]) : null,
  };
};

const lastRow = (t) => {
  const g = doc.tabs[t] || [];
  for (let i = g.length - 1; i >= 0; i--) if ((g[i] || []).some((c) => c !== "" && c != null)) return i + 1;
  return 0;
};

function writeAt(tab, row, col, values) {
  doc.tabs[tab] = doc.tabs[tab] || [];
  values.forEach((r, i) => {
    const y = row - 1 + i;
    doc.tabs[tab][y] = doc.tabs[tab][y] || [];
    r.forEach((v, j) => { doc.tabs[tab][y][col - 1 + j] = v; });
  });
}

let calls = [];

async function fakeFetch(url, opts = {}) {
  const method = opts.method || "GET";
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push(method + " " + url.replace("https://sheets.googleapis.com/v4/spreadsheets", ""));
  const ok = (json) => ({ ok: true, status: 200, json: async () => json, text: async () => "" });

  // create
  if (method === "POST" && /\/spreadsheets$/.test(url.split("?")[0])) {
    doc.id = "FAKESHEET";
    (body.sheets || []).forEach((sh) => {
      doc.tabs[sh.properties.title] = [];
      sheetIds[sh.properties.title] = nextSheetId++;
    });
    return ok({ spreadsheetId: doc.id });
  }
  // metadata
  if (method === "GET" && /\?fields=sheets\.properties$/.test(url)) {
    return ok({
      sheets: Object.keys(doc.tabs).map((title) => ({
        properties: { title, sheetId: sheetIds[title], gridProperties: { frozenRowCount: 0 } },
      })),
    });
  }
  // structural batchUpdate
  if (method === "POST" && /:batchUpdate$/.test(url) && !url.includes("/values")) {
    (body.requests || []).forEach((r) => {
      if (r.addSheet) {
        const t = r.addSheet.properties.title;
        doc.tabs[t] = doc.tabs[t] || [];
        sheetIds[t] = sheetIds[t] || nextSheetId++;
      }
    });
    return ok({});
  }
  // batchGet
  if (method === "GET" && url.includes("/values:batchGet")) {
    const ranges = [...url.matchAll(/ranges=([^&]+)/g)].map((m) => decodeURIComponent(m[1]));
    return ok({ valueRanges: ranges.map((r) => ({ values: doc.tabs[A1(r).tab] || [] })) });
  }
  // clear
  if (method === "POST" && /:clear$/.test(url)) {
    const r = decodeURIComponent(url.match(/\/values\/([^:]+):clear/)[1]);
    doc.tabs[A1(r).tab] = [];
    return ok({});
  }
  // append
  if (method === "POST" && url.includes(":append")) {
    const r = decodeURIComponent(url.match(/\/values\/([^:]+):append/)[1]);
    const tab = A1(r).tab;
    const start = lastRow(tab) + 1;
    writeAt(tab, start, 1, body.values);
    const end = start + body.values.length - 1;
    return ok({ updates: { updatedRange: `${tab}!A${start}:Z${end}` } });
  }
  // values batchUpdate
  if (method === "POST" && url.includes("/values:batchUpdate")) {
    (body.data || []).forEach((d) => {
      const a = A1(d.range);
      writeAt(a.tab, a.row, a.col, d.values);
    });
    return ok({});
  }
  // single PUT
  if (method === "PUT" && url.includes("/values/")) {
    const r = decodeURIComponent(url.match(/\/values\/([^?]+)/)[1]);
    const a = A1(r);
    writeAt(a.tab, a.row, a.col, body.values);
    return ok({});
  }
  return { ok: false, status: 404, text: async () => "unhandled " + method + " " + url, json: async () => ({}) };
}

/* --------------------------------------------------------- app globals -- */

const store = {};
const mkStorage = () => ({
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
});

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const state = {
  createdAt: new Date().toISOString(),
  categories: [
    { id: "c_move", name: "Movement", emoji: "🚶", color: "#3F7D5B", order: 0 },
    { id: "c_limits", name: "Limits", emoji: "🍷", color: "#B4443A", order: 1 },
  ],
  targets: [
    { id: "t1", catId: "c_move", name: "Walk", kind: "amount", dir: "at_least", period: "day", goal: 30, unit: "min", step: 5, days: [...ALL_DAYS], order: 0, archived: false },
    { id: "t2", catId: "c_move", name: "Strength training", kind: "binary", dir: "at_least", period: "week", goal: 4, unit: "", step: 1, days: [0, 2, 4], order: 1, archived: false },
    { id: "t3", catId: "c_limits", name: "Alcohol", kind: "amount", dir: "at_most", period: "week", goal: 6, unit: "units", step: 1, days: [...ALL_DAYS], order: 2, archived: false },
  ],
  log: { "2026-09-01": { t1: 30, t2: true }, "2026-09-03": { t3: 2 } },
};

const ctx = vm.createContext({
  console, setTimeout, clearTimeout, Math, Date, JSON, Number, String, Object, Array, Set, RegExp, Error, Promise, isNaN,
  fetch: fakeFetch,
  localStorage: mkStorage(),
  sessionStorage: mkStorage(),
  navigator: { onLine: true },
  google: { accounts: { oauth2: { initTokenClient: (o) => ({ requestAccessToken() { this.callback({ access_token: "fake", expires_in: 3600 }); } }), revoke() {} } } },
  window: {},
  state, DOW, ALL_DAYS, round2,
  save: () => {},
  render: () => {},
  renderSyncChip: () => {},
});
ctx.window.CONFIG = ctx.CONFIG = { CLIENT_ID: "test.apps.googleusercontent.com", SPREADSHEET_ID: "" };
ctx.globalThis = ctx;
ctx.window.addEventListener = () => {};

vm.runInContext(fs.readFileSync(SRC, "utf8"), ctx);
const Sync = vm.runInContext("Sync", ctx);

/* ------------------------------------------------------------- asserts -- */

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label + "\n         got  " + g + "\n         want " + w); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("\n1. First connect to an empty sheet seeds it from the device");
  Sync.init();
  await Sync.connect({ interactive: true });
  if (Sync.info().status !== "ready") console.log("  connect error: " + Sync.info().error);

  eq("three tabs created", Object.keys(doc.tabs).sort(), ["Categories", "Log", "Targets"]);
  eq("Categories header", doc.tabs.Categories[0], ["id", "name", "emoji", "colour", "order"]);
  eq("category rows", doc.tabs.Categories.length - 1, 2);
  eq("target row for Walk", doc.tabs.Targets[1],
     ["t1", "c_move", "Walk", "amount", "at least", "day", 30, "min", 5, "All", 0, "FALSE"]);
  eq("restricted days written as names", doc.tabs.Targets[2][9], "Mon, Wed, Fri");
  eq("Log row 1 is names", doc.tabs.Log[0], ["Date", "Walk", "Strength training", "Alcohol"]);
  eq("Log row 2 is ids", doc.tabs.Log[1], ["id", "t1", "t2", "t3"]);
  eq("logged days written sorted", doc.tabs.Log.slice(2).map((r) => r[0]), ["2026-09-01", "2026-09-03"]);
  eq("tick stored as 1", doc.tabs.Log[2], ["2026-09-01", 30, 1, ""]);
  eq("status ready", Sync.info().status, "ready");

  console.log("\n2. A new day is appended, an existing day is updated in place");
  state.log["2026-09-04"] = { t1: 45 };
  Sync.markDay("2026-09-04");
  await sleep(60); await Sync.flush();
  eq("new day appended", doc.tabs.Log[4], ["2026-09-04", 45, "", ""]);

  state.log["2026-09-01"].t1 = 60;
  Sync.markDay("2026-09-01");
  await sleep(60); await Sync.flush();
  eq("existing day updated in place", doc.tabs.Log[2], ["2026-09-01", 60, 1, ""]);
  eq("no duplicate row created", doc.tabs.Log.filter((r) => r[0] === "2026-09-01").length, 1);

  console.log("\n3. Hand-edits in the sheet win on the next pull");
  doc.tabs.Targets[1][6] = 45;              // Walk goal 30 -> 45
  doc.tabs.Targets[1][2] = "Morning walk";  // renamed
  doc.tabs.Targets[3][9] = "Sat, Sun";      // Alcohol restricted to weekends
  await Sync.pullNow();

  eq("goal adopted", state.targets.find((t) => t.id === "t1").goal, 45);
  eq("rename adopted", state.targets.find((t) => t.id === "t1").name, "Morning walk");
  eq("days parsed from names", state.targets.find((t) => t.id === "t3").days, [5, 6]);
  eq("log survived the round trip", state.log["2026-09-01"], { t1: 60, t2: true });
  eq("amount stayed numeric", state.log["2026-09-04"], { t1: 45 });

  console.log("\n4. Deleting a category row in the sheet drops its orphaned targets");
  doc.tabs.Categories = doc.tabs.Categories.filter((r) => r[0] !== "c_limits");
  await Sync.pullNow();
  eq("category gone", state.categories.map((c) => c.id), ["c_move"]);
  eq("its target dropped too", state.targets.some((t) => t.id === "t3"), false);

  console.log("\n5. Edits made offline are queued, not lost");
  ctx.navigator.onLine = false;
  const realFetch = ctx.fetch;
  ctx.fetch = async () => { throw new Error("network down"); };
  state.log["2026-09-05"] = { t1: 20 };
  Sync.markDay("2026-09-05");
  await sleep(60); await Sync.flush();
  eq("status reflects offline", Sync.info().status, "offline");
  eq("change still pending", Sync.info().pending >= 1, true);

  ctx.fetch = realFetch;
  ctx.navigator.onLine = true;
  await Sync.flush();
  eq("queue drains once back online", Sync.info().pending, 0);
  eq("offline day reached the sheet", doc.tabs.Log.some((r) => r[0] === "2026-09-05"), true);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();
