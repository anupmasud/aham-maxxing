/* ==========================================================================
   AhamMaxxing — targets by category, checked off daily.

   Everything lives in one JSON document in localStorage. There is no server
   and no account; a backup is an export of that document.

   The vocabulary, which the whole app is built on:
     kind   'binary' | 'amount'      a tick, or a number you log
     dir    'at_least' | 'at_most'   a floor to reach, or a ceiling to stay under
     period 'day' | 'week'           judged each day, or across the whole week

   Those three axes cover every target type in the app. "8,000 steps every day"
   is amount/at_least/day; "strength 4x a week" is binary/at_least/week;
   "6 units of alcohol a week" is amount/at_most/week.
   ========================================================================== */

const STORE_KEY = "aham_maxxing.v1";
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_LETTER = ["M", "T", "W", "T", "F", "S", "S"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/* ---------------------------------------------------------------- dates --
   All dates are local, keyed "YYYY-MM-DD". Weeks start Monday, so day
   indexes throughout are 0=Mon .. 6=Sun rather than JS's 0=Sun.          */

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const dow = (d) => (d.getDay() + 6) % 7;
const todayKey = () => keyOf(new Date());

function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d) { return addDays(d, -dow(d)); }
function weekKeys(monday) { return ALL_DAYS.map((i) => keyOf(addDays(monday, i))); }
function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }

const fmtDay = (d) => d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
const fmtShort = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

/* Numbers: goals like 3 L of water move in quarters, so keep two decimals
   but never show a trailing ".00". */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmtNum = (n) => {
  const r = round2(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, "");
};

/* ----------------------------------------------------------------- seed --
   Categories seeded empty are not clutter: Today and Week only render
   categories that actually have targets scheduled, so an untouched category
   is visible in Setup alone, where its suggestions are one tap away. */

const SEED_CATEGORIES = [
  { id: "c_move",    name: "Movement",          emoji: "🚶", color: "#3F7D5B" },
  { id: "c_food",    name: "Nutrition",         emoji: "🥗", color: "#5E8C3F" },
  { id: "c_limits",  name: "Limits",            emoji: "🍷", color: "#B4443A" },
  { id: "c_sleep",   name: "Sleep & recovery",  emoji: "🌙", color: "#4A5F9E" },
  { id: "c_mind",    name: "Mind",              emoji: "🧘", color: "#7A5EA8" },
  { id: "c_health",  name: "Preventive health", emoji: "💊", color: "#2F6D8C" },
  { id: "c_learn",   name: "Learning",          emoji: "📚", color: "#8C6D2F" },
  { id: "c_connect", name: "Connection",        emoji: "💬", color: "#C1663F" },
  { id: "c_play",    name: "Creative & play",   emoji: "🎧", color: "#9E4A7C" },
  { id: "c_home",    name: "Home & admin",      emoji: "🧺", color: "#6B7280" },
  { id: "c_digital", name: "Digital hygiene",   emoji: "📵", color: "#7E7264" },
];

/* The targets you actually named, ready to use on first run. */
const SEED_TARGETS = [
  { catId: "c_move",   name: "Walk",              kind: "amount", dir: "at_least", period: "day",  goal: 30,   unit: "min",   step: 5 },
  { catId: "c_move",   name: "Strength training", kind: "binary", dir: "at_least", period: "week", goal: 4,    unit: "",      step: 1 },
  { catId: "c_move",   name: "Steps",             kind: "amount", dir: "at_least", period: "day",  goal: 8000, unit: "steps", step: 500 },
  { catId: "c_food",   name: "Water",             kind: "amount", dir: "at_least", period: "day",  goal: 3,    unit: "L",     step: 0.25 },
  { catId: "c_limits", name: "Alcohol",           kind: "amount", dir: "at_most",  period: "week", goal: 6,    unit: "units", step: 1 },
  { catId: "c_limits", name: "Meat",              kind: "amount", dir: "at_most",  period: "week", goal: 3,    unit: "meals", step: 1 },
];

/* A library per category, offered as one-tap chips in Setup. */
const SUGGESTIONS = {
  c_move: [
    { name: "Walk",               kind: "amount", dir: "at_least", period: "day",  goal: 30,   unit: "min",   step: 5 },
    { name: "Steps",              kind: "amount", dir: "at_least", period: "day",  goal: 8000, unit: "steps", step: 500 },
    { name: "Strength training",  kind: "binary", dir: "at_least", period: "week", goal: 4,    unit: "",      step: 1 },
    { name: "Stretch / mobility", kind: "amount", dir: "at_least", period: "day",  goal: 10,   unit: "min",   step: 5 },
    { name: "Rest day",           kind: "binary", dir: "at_least", period: "week", goal: 1,    unit: "",      step: 1 },
    { name: "Cycle or swim",      kind: "binary", dir: "at_least", period: "week", goal: 2,    unit: "",      step: 1 },
  ],
  c_food: [
    { name: "Water",              kind: "amount", dir: "at_least", period: "day",  goal: 3,  unit: "L",        step: 0.25 },
    { name: "Portions of veg",    kind: "amount", dir: "at_least", period: "day",  goal: 5,  unit: "portions", step: 1 },
    { name: "Protein",            kind: "amount", dir: "at_least", period: "day",  goal: 70, unit: "g",        step: 10 },
    { name: "Home-cooked dinner", kind: "binary", dir: "at_least", period: "week", goal: 5,  unit: "",         step: 1 },
    { name: "Breakfast",          kind: "binary", dir: "at_least", period: "day",  goal: 1,  unit: "",         step: 1 },
  ],
  c_limits: [
    { name: "Alcohol",       kind: "amount", dir: "at_most", period: "week", goal: 6, unit: "units",  step: 1 },
    { name: "Meat",          kind: "amount", dir: "at_most", period: "week", goal: 3, unit: "meals",  step: 1 },
    { name: "Takeaway",      kind: "amount", dir: "at_most", period: "week", goal: 1, unit: "meals",  step: 1 },
    { name: "Caffeine",      kind: "amount", dir: "at_most", period: "day",  goal: 2, unit: "cups",   step: 1 },
    { name: "Added sugar",   kind: "amount", dir: "at_most", period: "week", goal: 3, unit: "treats", step: 1 },
  ],
  c_sleep: [
    { name: "Lights out by 11",     kind: "binary", dir: "at_least", period: "day", goal: 1,   unit: "",  step: 1 },
    { name: "Hours slept",          kind: "amount", dir: "at_least", period: "day", goal: 7.5, unit: "h", step: 0.5 },
    { name: "No screens before bed",kind: "binary", dir: "at_least", period: "day", goal: 1,   unit: "",  step: 1 },
  ],
  c_mind: [
    { name: "Meditate",          kind: "amount", dir: "at_least", period: "day",  goal: 10, unit: "min", step: 5 },
    { name: "Journal",           kind: "binary", dir: "at_least", period: "day",  goal: 1,  unit: "",    step: 1 },
    { name: "Daylight outdoors", kind: "amount", dir: "at_least", period: "day",  goal: 20, unit: "min", step: 10 },
    { name: "Three good things", kind: "binary", dir: "at_least", period: "day",  goal: 1,  unit: "",    step: 1 },
  ],
  c_health: [
    { name: "Vitamins",           kind: "binary", dir: "at_least", period: "day",  goal: 1, unit: "", step: 1 },
    { name: "Physio exercises",   kind: "binary", dir: "at_least", period: "week", goal: 3, unit: "", step: 1 },
    { name: "Floss",              kind: "binary", dir: "at_least", period: "day",  goal: 1, unit: "", step: 1 },
    { name: "Skincare",           kind: "binary", dir: "at_least", period: "day",  goal: 1, unit: "", step: 1 },
  ],
  c_learn: [
    { name: "Read",             kind: "amount", dir: "at_least", period: "day",  goal: 20, unit: "pages", step: 5 },
    { name: "Language practice",kind: "binary", dir: "at_least", period: "day",  goal: 1,  unit: "",      step: 1 },
    { name: "Course or project",kind: "amount", dir: "at_least", period: "week", goal: 3,  unit: "h",     step: 0.5 },
  ],
  c_connect: [
    { name: "Call family",      kind: "binary", dir: "at_least", period: "week", goal: 2, unit: "", step: 1 },
    { name: "See a friend",     kind: "binary", dir: "at_least", period: "week", goal: 1, unit: "", step: 1 },
    { name: "Message someone",  kind: "binary", dir: "at_least", period: "day",  goal: 1, unit: "", step: 1 },
  ],
  c_play: [
    { name: "Listen to a full record", kind: "binary", dir: "at_least", period: "week", goal: 2,  unit: "",    step: 1 },
    { name: "Instrument practice",     kind: "amount", dir: "at_least", period: "day",  goal: 20, unit: "min", step: 10 },
    { name: "Draw or write",           kind: "binary", dir: "at_least", period: "week", goal: 2,  unit: "",    step: 1 },
  ],
  c_home: [
    { name: "Tidy 15 minutes", kind: "binary", dir: "at_least", period: "day",  goal: 1, unit: "", step: 1 },
    { name: "Meal prep",       kind: "binary", dir: "at_least", period: "week", goal: 1, unit: "", step: 1 },
    { name: "Review finances", kind: "binary", dir: "at_least", period: "week", goal: 1, unit: "", step: 1 },
  ],
  c_digital: [
    { name: "Social media",         kind: "amount", dir: "at_most",  period: "day", goal: 30, unit: "min", step: 15 },
    { name: "No phone at meals",    kind: "binary", dir: "at_least", period: "day", goal: 1,  unit: "",    step: 1 },
    { name: "Phone out of bedroom", kind: "binary", dir: "at_least", period: "day", goal: 1,  unit: "",    step: 1 },
  ],
};

const UNITS = ["", "min", "h", "steps", "L", "ml", "g", "km", "pages", "units", "meals", "cups", "portions", "treats", "times"];

/* ----------------------------------------------------------------- state -- */

let state = null;
let ui = {
  view: "today",
  day: todayKey(),
  weekMonday: keyOf(startOfWeek(new Date())),
  insightsRange: 28,
};

const uid = (p) => p + Math.random().toString(36).slice(2, 9);

function blankState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    categories: [],
    targets: [],
    log: {},
    settings: { weekStart: 1 },
  };
}

function seededState() {
  const s = blankState();
  s.categories = SEED_CATEGORIES.map((c, i) => ({ ...c, order: i }));
  s.targets = SEED_TARGETS.map((t, i) => ({
    ...t, id: uid("t_"), order: i, archived: false, days: [...ALL_DAYS],
  }));
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.categories ? parsed : null;
  } catch (e) {
    console.warn("Could not read saved data", e);
    return null;
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast("Could not save — storage may be full");
    }
  }, 120);
}

/* ------------------------------------------------------------- accessors -- */

const catById    = (id) => state.categories.find((c) => c.id === id);
const targetById = (id) => state.targets.find((t) => t.id === id);
const liveTargets = () => state.targets.filter((t) => !t.archived);
const targetsIn = (catId) =>
  state.targets.filter((t) => t.catId === catId).sort((a, b) => a.order - b.order);

/* Raw logged value for one target on one day. Binary targets store true/false,
   amount targets store a number; both read out as a number here. */
function valueOn(targetId, dayKey) {
  const day = state.log[dayKey];
  if (!day) return 0;
  const v = day[targetId];
  if (v === true) return 1;
  if (v === false || v == null) return 0;
  return Number(v) || 0;
}

function setValue(targetId, dayKey, value) {
  if (!state.log[dayKey]) state.log[dayKey] = {};
  if (!value) delete state.log[dayKey][targetId];
  else state.log[dayKey][targetId] = value;
  if (!Object.keys(state.log[dayKey]).length) delete state.log[dayKey];
  save();
}

/* Does this target apply on this date at all? Weekly targets are eligible on
   any of their chosen days; daily ones are scheduled on theirs. */
function appliesOn(t, dayKey) {
  const days = t.days && t.days.length ? t.days : ALL_DAYS;
  return days.includes(dow(parseKey(dayKey)));
}

const isFuture = (dayKey) => daysBetween(todayKey(), dayKey) > 0;

/* ------------------------------------------------------------- progress --
   One function answers "how is this target doing" for both periods. For a
   weekly target the window is the whole week the day falls in; for a daily
   one it is just that day. `met` is the pass/fail; `ratio` drives the bars. */

function progress(t, dayKey) {
  let total, window;
  if (t.period === "week") {
    const monday = startOfWeek(parseKey(dayKey));
    window = weekKeys(monday);
    total = window.reduce((sum, k) => sum + valueOn(t.id, k), 0);
  } else {
    window = [dayKey];
    total = valueOn(t.id, dayKey);
  }
  total = round2(total);

  const goal = Number(t.goal) || 1;
  const met = t.dir === "at_most" ? total <= goal : total >= goal;
  const ratio = goal > 0 ? total / goal : 0;

  return { total, goal, met, ratio, window, over: t.dir === "at_most" && total > goal };
}

/* The day ring counts only the "things to actively do" scheduled that day:
   daily at_least targets. Ceilings are reported beside it as limits kept,
   because a limit you have simply not broken yet should not inflate a score. */
/* Ceilings broken *on this specific day* — daily ones only. A weekly ceiling
   that has blown its budget is true of the whole week, so colouring every day
   of that week red would let one heavy Friday repaint the other six. Weekly
   ceilings get their own trend card in Insights instead. */
function dayLimitsBroken(dayKey) {
  return liveTargets().filter(
    (t) => t.dir === "at_most" && t.period === "day" && appliesOn(t, dayKey) && progress(t, dayKey).over
  ).length;
}

function dayScore(dayKey) {
  const due = liveTargets().filter(
    (t) => t.period === "day" && t.dir === "at_least" && appliesOn(t, dayKey)
  );
  const done = due.filter((t) => progress(t, dayKey).met).length;

  const limits = liveTargets().filter((t) => t.dir === "at_most" && appliesOn(t, dayKey));
  const broken = limits.filter((t) => progress(t, dayKey).over).length;

  return { due: due.length, done, pct: due.length ? done / due.length : 0, limits: limits.length, broken };
}

/* The day you started. Nothing before it can count towards a streak: an empty
   week in the past trivially satisfies "no more than 6 units", which would
   otherwise hand every ceiling an infinite streak reaching back to 1970. */
function firstDay() {
  return state.createdAt ? keyOf(new Date(state.createdAt)) : todayKey();
}

/* Consecutive periods met, counting back from now. A period still in progress
   (today, or this week) never breaks a streak — it just does not add to it. */
function streak(t) {
  const from = firstDay();

  if (t.period === "week") {
    let monday = startOfWeek(new Date());
    if (!progress(t, keyOf(monday)).met) monday = addDays(monday, -7);
    let n = 0;
    for (let i = 0; i < 260; i++) {
      if (daysBetween(from, keyOf(addDays(monday, 6))) < 0) break;   // week predates install
      if (!progress(t, keyOf(monday)).met) break;
      n++;
      monday = addDays(monday, -7);
    }
    return n;
  }

  let d = new Date();
  if (appliesOn(t, keyOf(d)) && !progress(t, keyOf(d)).met) d = addDays(d, -1);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const k = keyOf(d);
    if (daysBetween(from, k) < 0) break;
    if (appliesOn(t, k)) {
      if (!progress(t, k).met) break;
      n++;
    }
    d = addDays(d, -1);
  }
  return n;
}

/* ============================== rendering ============================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
}

function render() {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $(`#${ui.view}-view`).classList.remove("hidden");
  $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === ui.view));

  if (ui.view === "today") renderToday();
  if (ui.view === "week") renderWeek();
  if (ui.view === "insights") renderInsights();
  if (ui.view === "setup") renderSetup();
  renderNudge();
}

/* The only "reminder" in v1: a pill in the header saying what is still open
   today. A push-notification path would replace this, not the logic behind it. */
function renderNudge() {
  const pill = $("#nudge-pill");
  const s = dayScore(todayKey());
  const left = s.due - s.done;
  if (s.broken) {
    pill.textContent = `${s.broken} limit${s.broken > 1 ? "s" : ""} over`;
    pill.style.color = "var(--over)";
    pill.style.background = "var(--over-soft)";
    pill.classList.remove("hidden");
  } else if (left > 0) {
    pill.textContent = `${left} left today`;
    pill.style.color = "";
    pill.style.background = "";
    pill.classList.remove("hidden");
  } else if (s.due > 0) {
    pill.textContent = "Day complete";
    pill.style.color = "var(--good)";
    pill.style.background = "var(--good-soft)";
    pill.classList.remove("hidden");
  } else {
    pill.classList.add("hidden");
  }
}

/* -------------------------------------------------------------- today --- */

function renderToday() {
  const dayKey = ui.day;
  const d = parseKey(dayKey);
  const diff = daysBetween(todayKey(), dayKey);

  $("#day-title").textContent = diff === 0 ? "Today" : diff === -1 ? "Yesterday" : diff === 1 ? "Tomorrow" : fmtDay(d);
  $("#day-sub").textContent = diff === 0 ? fmtDay(d) : diff === -1 || diff === 1 ? fmtDay(d) : "";
  $("#day-next").disabled = diff >= 0;
  $("#day-next").style.opacity = diff >= 0 ? ".3" : "1";

  const s = dayScore(dayKey);
  const CIRC = 2 * Math.PI * 52;
  $("#ring-fill").style.strokeDashoffset = String(CIRC * (1 - s.pct));
  $("#ring-fill").style.stroke = s.pct >= 1 ? "var(--good)" : "var(--good)";
  $("#ring-pct").textContent = s.due ? Math.round(s.pct * 100) + "%" : "—";
  $("#ring-sub").textContent = s.due ? `${s.done} of ${s.due}` : "nothing due";

  $("#dayscore-note").innerHTML = s.limits === 0 ? ""
    : s.broken === 0
      ? `<span style="color:var(--good);font-weight:600">Limits: all clear</span> · ${s.limits} tracked`
      : `<span style="color:var(--over);font-weight:600">${s.broken} limit${s.broken > 1 ? "s" : ""} over</span> · ${s.limits} tracked`;

  renderWeekStrip(dayKey);

  /* Only categories with something scheduled show up here — which is what
     keeps eleven seeded categories from becoming eleven empty headings. */
  const rows = [];
  state.categories
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((cat) => {
      const ts = targetsIn(cat.id).filter((t) => !t.archived && appliesOn(t, dayKey));
      if (!ts.length) return;

      const doneCount = ts.filter((t) => progress(t, dayKey).met).length;
      rows.push(`
        <section class="cat-block">
          <div class="cat-head">
            <div class="cat-swatch" style="background:${esc(cat.color)}"></div>
            <span class="cat-emoji">${esc(cat.emoji)}</span>
            <h3 class="cat-name">${esc(cat.name)}</h3>
            <span class="cat-count">${doneCount}/${ts.length}</span>
          </div>
          ${ts.map((t) => targetRow(t, dayKey)).join("")}
        </section>`);
    });

  $("#today-list").innerHTML = rows.join("");
  $("#today-empty").classList.toggle("hidden", rows.length > 0);
}

function targetRow(t, dayKey) {
  const p = progress(t, dayKey);
  const future = isFuture(dayKey);
  const weekly = t.period === "week";
  const todayVal = valueOn(t.id, dayKey);

  /* The circle: a control for binary targets, a status light for amounts,
     and for ceilings purely a status light (you cannot "tick" a limit). */
  const tickOn = t.dir === "at_most" ? !p.over : p.met;
  const tickCls = t.dir === "at_most" && p.over ? "over" : tickOn ? "on" : "";
  const tickGlyph = t.dir === "at_most" ? (p.over ? "!" : "✓") : "✓";
  const tickAct = t.dir === "at_most" ? "" : `data-act="tick" data-id="${t.id}" data-day="${dayKey}"`;

  let meta, bar = "";
  if (t.kind === "binary" && !weekly) {
    meta = p.met ? `<span class="good-txt">Done</span>` : "Not yet";
  } else if (weekly) {
    const label = t.kind === "binary"
      ? `${fmtNum(p.total)} of ${fmtNum(p.goal)} this week`
      : `${fmtNum(p.total)} of ${fmtNum(p.goal)} ${esc(t.unit)} this week`;
    const cls = p.over ? "over-txt" : p.met && t.dir === "at_least" ? "good-txt" : "";
    const verb = t.dir === "at_most" ? (p.over ? " · over" : " · within limit") : "";
    meta = `<span class="${cls}">${label}</span>${verb}${todayVal ? ` · ${fmtNum(todayVal)} today` : ""}`;
    bar = progressBar(p, t);
  } else {
    const cls = p.over ? "over-txt" : p.met && t.dir === "at_least" ? "good-txt" : "";
    const cap = t.dir === "at_most" ? "max" : "";
    meta = `<span class="${cls}">${fmtNum(p.total)} / ${fmtNum(p.goal)} ${esc(t.unit)}</span>${cap ? " " + cap : ""}`;
    bar = progressBar(p, t);
  }

  // Only amounts get a stepper; a weekly tick is toggled by its circle.
  const stepper = t.kind === "amount"
    ? `<div class="stepper">
         <button class="step-btn" data-act="step" data-id="${t.id}" data-day="${dayKey}" data-delta="-1" aria-label="Less">−</button>
         <button class="step-val" data-act="setval" data-id="${t.id}" data-day="${dayKey}">${fmtNum(todayVal)}</button>
         <button class="step-btn" data-act="step" data-id="${t.id}" data-day="${dayKey}" data-delta="1" aria-label="More">+</button>
       </div>`
    : "";

  return `
    <div class="trow ${p.met && t.dir === "at_least" ? "done" : ""}" style="${future ? "opacity:.55" : ""}">
      <button class="tick ${tickCls}" ${tickAct} aria-label="${esc(t.name)}">${tickGlyph}</button>
      <div class="tbody">
        <div class="tname">${esc(t.name)}</div>
        <div class="tmeta">${meta}</div>
        ${bar}
      </div>
      ${stepper}
    </div>`;
}

function progressBar(p, t) {
  const pct = Math.min(100, Math.round(p.ratio * 100));
  let cls = "";
  if (t.dir === "at_most") cls = p.over ? "over" : p.ratio > 0.75 ? "warn" : "";
  return `<div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>`;
}

function renderWeekStrip(dayKey) {
  const monday = startOfWeek(parseKey(dayKey));
  const html = weekKeys(monday).map((k, i) => {
    const s = dayScore(k);
    const h = Math.round(s.pct * 100);
    const cls = [
      "strip-day",
      k === todayKey() ? "is-today" : "",
      k === dayKey && k !== todayKey() ? "is-sel" : "",
      isFuture(k) ? "is-future" : "",
    ].join(" ");
    const fill = dayLimitsBroken(k) ? "var(--over)" : "var(--good)";
    return `<button class="${cls}" data-act="stripday" data-day="${k}">
        <span class="strip-letter">${DOW_LETTER[i]}</span>
        <span class="strip-dot"><span class="strip-fill" style="height:${h}%;background:${fill}"></span></span>
      </button>`;
  }).join("");
  $("#week-strip").innerHTML = html;
}

/* --------------------------------------------------------------- week --- */

function renderWeek() {
  const monday = parseKey(ui.weekMonday);
  const keys = weekKeys(monday);
  const thisMonday = keyOf(startOfWeek(new Date()));
  const offset = Math.round(daysBetween(thisMonday, ui.weekMonday) / 7);

  $("#week-title").textContent =
    offset === 0 ? "This week" : offset === -1 ? "Last week" : offset === 1 ? "Next week" : `Week of ${fmtShort(monday)}`;
  $("#week-sub").textContent = `${fmtShort(monday)} – ${fmtShort(addDays(monday, 6))}`;
  $("#week-next").disabled = offset >= 0;
  $("#week-next").style.opacity = offset >= 0 ? ".3" : "1";

  const blocks = [];
  state.categories
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((cat) => {
      const ts = targetsIn(cat.id).filter((t) => !t.archived);
      if (!ts.length) return;

      const head = `<th class="wg-namecol"></th>` +
        keys.map((k, i) => `<th${k === todayKey() ? ' style="color:var(--ink)"' : ""}>${DOW_LETTER[i]}</th>`).join("");

      const body = ts.map((t) => {
        const p = progress(t, keys[0]);
        let goalLabel, goalCls = "";
        if (t.period === "week") {
          goalLabel = t.dir === "at_most"
            ? `${fmtNum(p.total)} / ${fmtNum(p.goal)} ${esc(t.unit)} max`
            : `${fmtNum(p.total)} of ${fmtNum(p.goal)}${t.unit ? " " + esc(t.unit) : ""}`;
          goalCls = p.over ? "over" : p.met && t.dir === "at_least" ? "hit" : "";
        } else {
          const hits = keys.filter((k) => appliesOn(t, k) && !isFuture(k) && progress(t, k).met).length;
          const sched = keys.filter((k) => appliesOn(t, k) && !isFuture(k)).length;
          goalLabel = `${t.dir === "at_most" ? "max " : ""}${fmtNum(t.goal)}${t.unit ? " " + esc(t.unit) : ""}/day · ${hits}/${sched} days`;
          goalCls = sched && hits === sched ? "hit" : "";
        }

        const cells = keys.map((k) => weekCell(t, k)).join("");
        return `<tr>
            <td class="wg-name">${esc(t.name)}<span class="wg-goal ${goalCls}">${goalLabel}</span></td>
            ${cells}
          </tr>`;
      }).join("");

      blocks.push(`
        <div class="wg-cat"><span>${esc(cat.emoji)}</span> ${esc(cat.name)}</div>
        <table class="wg-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
    });

  $("#week-grid").innerHTML = blocks.join("");
  $("#week-empty").classList.toggle("hidden", blocks.length > 0);
}

function weekCell(t, dayKey) {
  if (!appliesOn(t, dayKey)) return `<td><div class="wg-cell na" aria-hidden="true"></div></td>`;

  const v = valueOn(t.id, dayKey);
  const future = isFuture(dayKey);
  const cls = ["wg-cell"];
  let label = "";

  if (t.kind === "binary") {
    if (v) { cls.push("on"); label = "✓"; }
  } else {
    if (v) {
      // Round to a whole "k" only above 10k; below that the rounding could show
      // 7,500 steps as "8k" against an 8,000 goal, which reads as a hit.
      label = v >= 10000 ? Math.round(v / 1000) + "k"
            : v >= 1000  ? (Math.floor(v / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k"
            : fmtNum(v);
      if (t.dir === "at_most") {
        const dayGoal = t.period === "day" ? t.goal : Infinity;
        cls.push(v > dayGoal ? "over" : "part");
      } else if (t.period === "day") {
        cls.push(v >= t.goal ? "on" : "part");
      } else {
        cls.push("part");
      }
    }
  }

  /* A ceiling that has blown its weekly budget marks every logged day red, so
     the week reads at a glance as "this is where it went". */
  if (t.period === "week" && t.dir === "at_most" && progress(t, dayKey).over && v) {
    cls.push("over");
  }
  if (future) cls.push("future");
  if (dayKey === todayKey()) cls.push("today");

  return `<td><button class="${cls.join(" ")}" data-act="cell" data-id="${t.id}" data-day="${dayKey}"
      aria-label="${esc(t.name)} ${dayKey}">${label}</button></td>`;
}

/* ----------------------------------------------------------- insights --- */

/* The range never reaches back past the day you started using AhamMaxxing, so early
   weeks do not read as a wall of failure you never had the chance to log. */
function rangeKeys(days) {
  const start = state.createdAt ? keyOf(new Date(state.createdAt)) : todayKey();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = keyOf(addDays(new Date(), -i));
    if (daysBetween(start, k) >= 0) out.push(k);
  }
  return out.length ? out : [todayKey()];
}

function targetStats(t, keys) {
  if (t.period === "week") {
    const mondays = [...new Set(keys.map((k) => keyOf(startOfWeek(parseKey(k)))))];
    const done = mondays.filter((m) => progress(t, m).met).length;
    const totals = mondays.map((m) => progress(t, m).total);
    return { n: mondays.length, done, pct: mondays.length ? done / mondays.length : 0, totals, labels: mondays, unitLabel: "weeks" };
  }
  const sched = keys.filter((k) => appliesOn(t, k));
  const done = sched.filter((k) => progress(t, k).met).length;
  return { n: sched.length, done, pct: sched.length ? done / sched.length : 0, totals: sched.map((k) => valueOn(t.id, k)), labels: sched, unitLabel: "days" };
}

function renderInsights() {
  const keys = rangeKeys(ui.insightsRange);
  const targets = liveTargets();
  const body = $("#insights-body");

  if (!targets.length) {
    body.innerHTML = `<p class="empty">Add some targets in <b>Setup</b> and your analysis will build itself from there.</p>`;
    return;
  }

  /* --- headline numbers --- */
  const scores = keys.map((k) => dayScore(k));
  const scored = scores.filter((s) => s.due > 0);
  const avg = scored.length ? scored.reduce((a, s) => a + s.pct, 0) / scored.length : 0;
  const perfect = scored.filter((s) => s.pct >= 1 && s.broken === 0).length;
  // A ceiling's "streak" is just days you have not broken it, which is not the
  // same kind of achievement, so the headline reports floors only.
  const floors = targets.filter((t) => t.dir === "at_least");
  const best = floors.reduce((acc, t) => Math.max(acc, streak(t)), 0);
  const bestT = floors.find((t) => streak(t) === best);

  const out = [`
    <div class="stat-row">
      <div class="stat"><b>${Math.round(avg * 100)}%</b><span>targets kept</span></div>
      <div class="stat"><b>${perfect}</b><span>full days</span></div>
      <div class="stat"><b>${best}</b><span>best streak${bestT ? ` · ${esc(bestT.period === "week" ? "wks" : "days")}` : ""}</span></div>
    </div>`];

  /* --- by category --- */
  const catRows = state.categories
    .slice().sort((a, b) => a.order - b.order)
    .map((cat) => {
      const ts = targetsIn(cat.id).filter((t) => !t.archived);
      if (!ts.length) return "";
      const stats = ts.map((t) => targetStats(t, keys));
      const n = stats.reduce((a, s) => a + s.n, 0);
      const done = stats.reduce((a, s) => a + s.done, 0);
      const pct = n ? done / n : 0;
      return `<div class="ins-row">
          <div class="ins-label">${esc(cat.emoji)} ${esc(cat.name)}<small>${ts.length} target${ts.length > 1 ? "s" : ""}</small></div>
          <div class="ins-bar"><i style="width:${Math.round(pct * 100)}%;background:${esc(cat.color)}"></i></div>
          <div class="ins-pct">${Math.round(pct * 100)}%</div>
        </div>`;
    }).filter(Boolean).join("");
  if (catRows) out.push(`<div class="card"><h3>By category <span class="sub">— share of targets kept</span></h3>${catRows}</div>`);

  /* --- every target, floors first --- */
  const floorRows = targets.filter((t) => t.dir === "at_least").map((t) => {
    const s = targetStats(t, keys);
    const st = streak(t);
    return `<div class="ins-row">
        <div class="ins-label">${esc(t.name)}<small>${s.done}/${s.n} ${s.unitLabel}${st ? ` · streak ${st}` : ""}</small></div>
        <div class="ins-bar"><i style="width:${Math.round(s.pct * 100)}%"></i></div>
        <div class="ins-pct">${Math.round(s.pct * 100)}%</div>
      </div>`;
  }).join("");
  if (floorRows) out.push(`<div class="card"><h3>Targets <span class="sub">— hit rate</span></h3>${floorRows}</div>`);

  /* --- ceilings get a trend line, not a hit rate: the interesting question
         for alcohol or meat is which way the amount is moving. --- */
  const ceilings = targets.filter((t) => t.dir === "at_most");
  if (ceilings.length) {
    const cards = ceilings.map((t) => {
      const mondays = [...new Set(keys.map((k) => keyOf(startOfWeek(parseKey(k)))))];
      const series = mondays.map((m) => {
        if (t.period === "week") return progress(t, m).total;
        return round2(weekKeys(parseKey(m)).reduce((a, k) => a + valueOn(t.id, k), 0));
      });
      const weekGoal = t.period === "week" ? t.goal : t.goal * 7;
      const kept = series.filter((v) => v <= weekGoal).length;
      const avgW = series.length ? round2(series.reduce((a, b) => a + b, 0) / series.length) : 0;
      return `<div class="card">
          <h3>${esc(t.name)} <span class="sub">— ${fmtNum(avgW)} ${esc(t.unit)}/week average, limit ${fmtNum(weekGoal)}</span></h3>
          ${sparkline(series, weekGoal, mondays)}
          <p class="muted" style="margin:8px 0 0">Within the limit in <b>${kept} of ${series.length}</b> weeks.</p>
        </div>`;
    }).join("");
    out.push(cards);
  }

  /* --- heatmap --- */
  out.push(heatmap(keys));

  body.innerHTML = out.join("");
}

/* A weekly-total line with the limit drawn across it as a dashed rule. */
function sparkline(series, goal, labels) {
  if (!series.length) return "";
  const W = 300, H = 46, pad = 4;
  const max = Math.max(goal * 1.15, ...series, 1);
  const x = (i) => series.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (series.length - 1);
  const y = (v) => H - pad - (v / max) * (H - pad * 2);

  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `M${x(0).toFixed(1)},${(H - pad).toFixed(1)} L${pts.split(" ").join(" L")} L${x(series.length - 1).toFixed(1)},${(H - pad).toFixed(1)} Z`;
  const dots = series.map((v, i) =>
    `<circle class="spark-dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${v > goal ? 3 : 2}"
       style="${v > goal ? "fill:var(--over)" : ""}"><title>${labels && labels[i] ? fmtShort(parseKey(labels[i])) : ""}: ${fmtNum(v)}</title></circle>`).join("");

  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Weekly totals">
      <path class="spark-area" d="${area}" />
      <polyline class="spark-line" points="${pts}" />
      <line class="spark-goal" x1="${pad}" y1="${y(goal).toFixed(1)}" x2="${W - pad}" y2="${y(goal).toFixed(1)}" />
      ${dots}
    </svg>`;
}

function heatmap(keys) {
  const firstMonday = startOfWeek(parseKey(keys[0]));
  const lastMonday = startOfWeek(parseKey(keys[keys.length - 1]));
  const weeks = Math.round(daysBetween(keyOf(firstMonday), keyOf(lastMonday)) / 7);

  const rows = [];
  for (let w = 0; w <= weeks; w++) {
    const monday = addDays(firstMonday, w * 7);
    const cells = weekKeys(monday).map((k) => {
      if (isFuture(k) || daysBetween(keys[0], k) < 0) {
        return `<span class="heat-cell" style="opacity:.25"></span>`;
      }
      const s = dayScore(k);
      if (!s.due) return `<span class="heat-cell"></span>`;
      const bg = dayLimitsBroken(k)
        ? `color-mix(in srgb, var(--over) ${25 + s.pct * 60}%, transparent)`
        : `color-mix(in srgb, var(--good) ${12 + s.pct * 88}%, transparent)`;
      return `<span class="heat-cell" style="background:${bg}" title="${k} — ${Math.round(s.pct * 100)}%"></span>`;
    }).join("");
    rows.push(`<div class="heat-row" title="Week of ${esc(fmtShort(monday))}">
        <span class="heat-lab">${monday.getDate()}</span>${cells}</div>`);
  }

  return `<div class="card">
      <h3>Every day <span class="sub">— Mon to Sun, week by week (row = Monday's date)</span></h3>
      <div class="heat">${rows.join("")}</div>
      <div class="heat-legend">
        <span>less</span>
        <span class="heat-cell" style="background:color-mix(in srgb,var(--good) 20%,transparent)"></span>
        <span class="heat-cell" style="background:color-mix(in srgb,var(--good) 55%,transparent)"></span>
        <span class="heat-cell" style="background:var(--good)"></span>
        <span>more</span>
        <span class="heat-cell" style="margin-left:10px;background:var(--over)"></span>
        <span>limit broken</span>
      </div>
    </div>`;
}

/* -------------------------------------------------------------- setup --- */

/* A plain-English sentence for a target, used everywhere a target needs
   explaining. Reading these back is the quickest way to tell whether the
   three axes were set the way you meant them. */
function describe(t) {
  const unit = t.unit ? " " + t.unit : "";
  const days = t.days && t.days.length && t.days.length < 7
    ? " on " + t.days.slice().sort().map((d) => DOW[d]).join(", ")
    : "";

  if (t.period === "week") {
    if (t.dir === "at_most") return `No more than ${fmtNum(t.goal)}${unit} a week`;
    return t.kind === "binary"
      ? `${fmtNum(t.goal)}× a week`
      : `At least ${fmtNum(t.goal)}${unit} a week`;
  }
  if (t.kind === "binary") return `Every day${days}`;
  if (t.dir === "at_most") return `No more than ${fmtNum(t.goal)}${unit} a day${days}`;
  return `At least ${fmtNum(t.goal)}${unit} a day${days}`;
}

function renderSetup() {
  const html = state.categories
    .slice().sort((a, b) => a.order - b.order)
    .map((cat) => {
      const ts = targetsIn(cat.id);
      const rows = ts.map((t) => `
        <div class="srow ${t.archived ? "archived" : ""}">
          <div class="srow-body">
            <div class="srow-name">${esc(t.name)}</div>
            <div class="srow-meta">${esc(describe(t))}${t.archived ? " · paused" : ""}</div>
          </div>
          <div class="srow-actions">
            <button class="mini-btn" data-act="target-pause" data-id="${t.id}" title="${t.archived ? "Resume" : "Pause"}">${t.archived ? "▶" : "❚❚"}</button>
            <button class="mini-btn" data-act="target-edit" data-id="${t.id}" title="Edit">✎</button>
            <button class="mini-btn danger" data-act="target-del" data-id="${t.id}" title="Delete">✕</button>
          </div>
        </div>`).join("");

      const used = new Set(ts.map((t) => t.name.toLowerCase()));
      const chips = (SUGGESTIONS[cat.id] || [])
        .filter((s) => !used.has(s.name.toLowerCase()))
        .map((s, i) => `<button class="chip" data-act="suggest" data-cat="${cat.id}" data-i="${i}">+ ${esc(s.name)}</button>`)
        .join("");

      return `<section class="cat-block">
          <div class="setup-cat-head">
            <div class="cat-swatch" style="background:${esc(cat.color)}"></div>
            <span class="cat-emoji">${esc(cat.emoji)}</span>
            <h3 class="cat-name">${esc(cat.name)}</h3>
            <div class="srow-actions">
              <button class="mini-btn" data-act="cat-edit" data-id="${cat.id}" title="Edit category">✎</button>
              <button class="mini-btn danger" data-act="cat-del" data-id="${cat.id}" title="Delete category">✕</button>
            </div>
          </div>
          ${rows}
          <div class="add-target-row">
            <button class="btn btn-sm" data-act="target-new" data-cat="${cat.id}">+ New target</button>
            ${chips}
          </div>
        </section>`;
    }).join("");

  $("#setup-list").innerHTML = html ||
    `<p class="empty">No categories yet. Tap <b>+ Category</b> to make your first one.</p>`;
}

/* ------------------------------------------------------------- modals --- */

function openModal(html) {
  $("#modal-panel").innerHTML = html;
  $("#modal-host").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  const first = $("#modal-panel").querySelector("input, select");
  if (first) setTimeout(() => first.focus(), 60);
}
function closeModal() {
  $("#modal-host").classList.add("hidden");
  $("#modal-panel").innerHTML = "";
  document.body.style.overflow = "";
}

/* The three-axis form. Fields appear and disappear as the axes change, so the
   form only ever asks for what the chosen combination actually needs. */
function targetEditor(t, catId) {
  const isNew = !t;
  const d = t || {
    id: null, catId: catId || (state.categories[0] && state.categories[0].id),
    name: "", kind: "binary", dir: "at_least", period: "day",
    goal: 1, unit: "", step: 1, days: [...ALL_DAYS], archived: false,
  };

  const cats = state.categories.slice().sort((a, b) => a.order - b.order)
    .map((c) => `<option value="${c.id}" ${c.id === d.catId ? "selected" : ""}>${esc(c.emoji)} ${esc(c.name)}</option>`).join("");
  const units = UNITS.map((u) => `<option value="${u}" ${u === d.unit ? "selected" : ""}>${u || "— none —"}</option>`).join("");

  openModal(`
    <h3>${isNew ? "New target" : "Edit target"}</h3>

    <div class="field">
      <label for="f-name">Name</label>
      <input id="f-name" class="input" value="${esc(d.name)}" placeholder="e.g. Strength training" />
    </div>

    <div class="field">
      <label for="f-cat">Category</label>
      <select id="f-cat" class="select">${cats}</select>
    </div>

    <div class="field">
      <label>What are you tracking?</label>
      <div class="seg-group" id="f-kind">
        <button type="button" class="seg-opt ${d.kind === "binary" ? "on" : ""}" data-v="binary">Did it<small>a tick</small></button>
        <button type="button" class="seg-opt ${d.kind === "amount" ? "on" : ""}" data-v="amount">An amount<small>a number you log</small></button>
      </div>
    </div>

    <div class="field">
      <label>Aiming to…</label>
      <div class="seg-group" id="f-dir">
        <button type="button" class="seg-opt ${d.dir === "at_least" ? "on" : ""}" data-v="at_least">Reach it<small>at least</small></button>
        <button type="button" class="seg-opt ${d.dir === "at_most" ? "on" : ""}" data-v="at_most">Stay under<small>at most</small></button>
      </div>
    </div>

    <div class="field">
      <label>Measured…</label>
      <div class="seg-group" id="f-period">
        <button type="button" class="seg-opt ${d.period === "day" ? "on" : ""}" data-v="day">Each day</button>
        <button type="button" class="seg-opt ${d.period === "week" ? "on" : ""}" data-v="week">Across the week</button>
      </div>
    </div>

    <div class="field-row" id="f-goalrow">
      <div class="field">
        <label for="f-goal">Goal</label>
        <input id="f-goal" class="input" type="number" step="any" min="0" value="${d.goal}" />
      </div>
      <div class="field" id="f-unitwrap">
        <label for="f-unit">Unit</label>
        <select id="f-unit" class="select">${units}</select>
      </div>
      <div class="field" id="f-stepwrap">
        <label for="f-step">Tap size</label>
        <input id="f-step" class="input" type="number" step="any" min="0" value="${d.step}" />
      </div>
    </div>

    <div class="field" id="f-dayswrap">
      <label>Which days</label>
      <div class="daypicker" id="f-days">
        ${ALL_DAYS.map((i) => `<button type="button" class="daypick ${(d.days || ALL_DAYS).includes(i) ? "on" : ""}" data-v="${i}">${DOW_LETTER[i]}</button>`).join("")}
      </div>
    </div>

    <p class="hint" id="f-summary"></p>

    <div class="modal-actions">
      <button class="btn" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="target-save" data-id="${d.id || ""}">Save</button>
    </div>
  `);

  const panel = $("#modal-panel");
  const seg = (id) => panel.querySelector(`#${id} .seg-opt.on`).dataset.v;

  function sync() {
    const kind = seg("f-kind"), dir = seg("f-dir"), period = seg("f-period");

    // A daily tick has no goal to set — it is simply "done or not".
    const needsGoal = kind === "amount" || period === "week";
    panel.querySelector("#f-goalrow").style.display = needsGoal ? "" : "none";
    panel.querySelector("#f-unitwrap").style.display = kind === "amount" ? "" : "none";
    panel.querySelector("#f-stepwrap").style.display = kind === "amount" ? "" : "none";
    // Weekly targets can be done on any day, so the day picker only applies daily.
    panel.querySelector("#f-dayswrap").style.display = period === "week" ? "none" : "";

    const goalEl = panel.querySelector("#f-goal");
    if (kind === "binary" && period === "day") goalEl.value = 1;

    panel.querySelector("#f-summary").textContent = describe({
      kind, dir, period,
      goal: Number(goalEl.value) || 1,
      unit: kind === "amount" ? panel.querySelector("#f-unit").value : "",
      days: currentDays(),
    });
  }

  function currentDays() {
    return Array.from(panel.querySelectorAll("#f-days .daypick.on")).map((b) => Number(b.dataset.v));
  }

  panel.querySelectorAll(".seg-group").forEach((g) => {
    g.addEventListener("click", (e) => {
      const b = e.target.closest(".seg-opt");
      if (!b) return;
      g.querySelectorAll(".seg-opt").forEach((x) => x.classList.toggle("on", x === b));
      sync();
    });
  });
  panel.querySelector("#f-days").addEventListener("click", (e) => {
    const b = e.target.closest(".daypick");
    if (!b) return;
    b.classList.toggle("on");
    if (!currentDays().length) b.classList.add("on");   // never allow zero days
    sync();
  });
  ["#f-goal", "#f-unit"].forEach((s) => panel.querySelector(s).addEventListener("input", sync));
  sync();

  panel._readForm = () => ({
    name: panel.querySelector("#f-name").value.trim(),
    catId: panel.querySelector("#f-cat").value,
    kind: seg("f-kind"),
    dir: seg("f-dir"),
    period: seg("f-period"),
    goal: Math.max(0, Number(panel.querySelector("#f-goal").value) || 1),
    unit: seg("f-kind") === "amount" ? panel.querySelector("#f-unit").value : "",
    step: Math.max(0.01, Number(panel.querySelector("#f-step").value) || 1),
    days: seg("f-period") === "week" ? [...ALL_DAYS] : currentDays(),
  });
}

function categoryEditor(cat) {
  const isNew = !cat;
  const d = cat || { id: null, name: "", emoji: "⭐", color: "#3F7D5B" };
  const palette = ["#3F7D5B", "#5E8C3F", "#B4443A", "#4A5F9E", "#7A5EA8", "#2F6D8C", "#8C6D2F", "#C1663F", "#9E4A7C", "#6B7280"];

  openModal(`
    <h3>${isNew ? "New category" : "Edit category"}</h3>
    <div class="field-row">
      <div class="field" style="flex:0 0 84px">
        <label for="c-emoji">Icon</label>
        <input id="c-emoji" class="input" value="${esc(d.emoji)}" maxlength="4" style="text-align:center;font-size:1.2rem" />
      </div>
      <div class="field">
        <label for="c-name">Name</label>
        <input id="c-name" class="input" value="${esc(d.name)}" placeholder="e.g. Physical health" />
      </div>
    </div>
    <div class="field">
      <label>Colour</label>
      <div class="daypicker" id="c-colors">
        ${palette.map((p) => `<button type="button" class="daypick ${p === d.color ? "on" : ""}" data-v="${p}"
            style="background:${p};border-color:${p};height:34px"></button>`).join("")}
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="cat-save" data-id="${d.id || ""}">Save</button>
    </div>
  `);

  const panel = $("#modal-panel");
  panel.querySelector("#c-colors").addEventListener("click", (e) => {
    const b = e.target.closest(".daypick");
    if (!b) return;
    panel.querySelectorAll("#c-colors .daypick").forEach((x) => x.classList.toggle("on", x === b));
  });
  panel._readForm = () => ({
    name: panel.querySelector("#c-name").value.trim(),
    emoji: panel.querySelector("#c-emoji").value.trim() || "⭐",
    color: (panel.querySelector("#c-colors .daypick.on") || {}).dataset?.v || d.color,
  });
}

/* Quick numeric entry, reached by tapping a value or a week-grid cell. */
function amountEditor(t, dayKey) {
  const v = valueOn(t.id, dayKey);
  const quick = t.kind === "binary" ? [0, 1] : [0, t.step, t.goal, round2(t.goal / 2)]
    .filter((x, i, a) => x > 0 || i === 0)
    .filter((x, i, a) => a.indexOf(x) === i)
    .sort((a, b) => a - b);

  openModal(`
    <h3>${esc(t.name)}</h3>
    <p class="muted" style="margin:-8px 0 14px">${esc(parseKey(dayKey).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }))} · ${esc(describe(t))}</p>
    <div class="field">
      <label for="a-val">Logged${t.unit ? " (" + esc(t.unit) + ")" : ""}</label>
      <input id="a-val" class="input" type="number" step="any" min="0" value="${v || ""}" placeholder="0" />
    </div>
    <div class="btn-row" id="a-quick">
      ${quick.map((q) => `<button class="chip" data-v="${q}">${q === 0 ? "Clear" : fmtNum(q) + (t.unit ? " " + esc(t.unit) : "")}</button>`).join("")}
    </div>
    <div class="modal-actions">
      <button class="btn" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="amount-save" data-id="${t.id}" data-day="${dayKey}">Save</button>
    </div>
  `);
  const panel = $("#modal-panel");
  panel.querySelector("#a-quick").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    panel.querySelector("#a-val").value = b.dataset.v === "0" ? "" : b.dataset.v;
  });
  panel.querySelector("#a-val").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveAmount(t.id, dayKey); }
  });
}

function saveAmount(id, dayKey) {
  const t = targetById(id);
  const raw = Number($("#a-val").value);
  const val = isNaN(raw) || raw <= 0 ? 0 : round2(raw);
  setValue(id, dayKey, t.kind === "binary" ? (val ? true : 0) : val);
  closeModal();
  render();
}

/* ============================== interaction ============================== */

/* Tapping the circle. A tick toggles; an amount either fills in exactly what
   is still needed to hit the goal, or clears the day if you tap it again. */
function toggleTarget(id, dayKey) {
  const t = targetById(id);
  if (!t || t.dir === "at_most") return;

  if (t.kind === "binary") {
    setValue(id, dayKey, valueOn(id, dayKey) ? 0 : true);
    return;
  }

  const today = valueOn(id, dayKey);
  if (today > 0) { setValue(id, dayKey, 0); return; }

  const p = progress(t, dayKey);
  const stillNeeded = t.period === "week" ? Math.max(t.step, round2(p.goal - p.total)) : t.goal;
  setValue(id, dayKey, round2(stillNeeded));
}

function stepTarget(id, dayKey, delta) {
  const t = targetById(id);
  const next = Math.max(0, round2(valueOn(id, dayKey) + delta * t.step));
  setValue(id, dayKey, next);
}

function saveTargetForm(id) {
  const form = $("#modal-panel")._readForm();
  if (!form.name) { toast("Give it a name"); return; }

  if (id) {
    Object.assign(targetById(id), form);
  } else {
    const siblings = targetsIn(form.catId);
    state.targets.push({
      ...form, id: uid("t_"), archived: false,
      order: siblings.length ? Math.max(...siblings.map((t) => t.order)) + 1 : 0,
    });
  }
  save(); closeModal(); render();
  toast(id ? "Target updated" : "Target added");
}

function saveCategoryForm(id) {
  const form = $("#modal-panel")._readForm();
  if (!form.name) { toast("Give it a name"); return; }

  if (id) {
    Object.assign(catById(id), form);
  } else {
    state.categories.push({
      ...form, id: uid("c_"),
      order: state.categories.length ? Math.max(...state.categories.map((c) => c.order)) + 1 : 0,
    });
  }
  save(); closeModal(); render();
}

function deleteCategory(id) {
  const cat = catById(id);
  const n = targetsIn(id).length;
  const msg = n
    ? `Delete "${cat.name}" and its ${n} target${n > 1 ? "s" : ""}? Logged history for them is removed too.`
    : `Delete "${cat.name}"?`;
  if (!confirm(msg)) return;

  const ids = new Set(targetsIn(id).map((t) => t.id));
  state.targets = state.targets.filter((t) => t.catId !== id);
  Object.keys(state.log).forEach((k) => {
    ids.forEach((tid) => delete state.log[k][tid]);
    if (!Object.keys(state.log[k]).length) delete state.log[k];
  });
  state.categories = state.categories.filter((c) => c.id !== id);
  save(); render();
}

function deleteTarget(id) {
  const t = targetById(id);
  if (!confirm(`Delete "${t.name}"? Its logged history goes too.\n\nTo keep the history, pause it instead.`)) return;
  state.targets = state.targets.filter((x) => x.id !== id);
  Object.keys(state.log).forEach((k) => {
    delete state.log[k][id];
    if (!Object.keys(state.log[k]).length) delete state.log[k];
  });
  save(); render();
}

/* ------------------------------------------------------------ plumbing --- */

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `aham_maxxing-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Backup downloaded");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.categories) || !Array.isArray(data.targets)) {
        throw new Error("not an AhamMaxxing backup");
      }
      if (!confirm("Replace everything currently in AhamMaxxing with this backup?")) return;
      state = { ...blankState(), ...data };
      save(); render();
      toast("Backup restored");
    } catch (e) {
      toast("That file is not an AhamMaxxing backup");
    }
  };
  reader.readAsText(file);
}

const ACTIONS = {
  tick:     (d) => { toggleTarget(d.id, d.day); render(); },
  step:     (d) => { stepTarget(d.id, d.day, Number(d.delta)); render(); },
  setval:   (d) => amountEditor(targetById(d.id), d.day),
  stripday: (d) => { ui.day = d.day; render(); },
  cell:     (d) => {
    const t = targetById(d.id);
    if (t.kind === "binary") { toggleTarget(d.id, d.day); render(); }
    else amountEditor(t, d.day);
  },

  "target-new":   (d) => targetEditor(null, d.cat),
  "target-edit":  (d) => targetEditor(targetById(d.id)),
  "target-del":   (d) => deleteTarget(d.id),
  "target-pause": (d) => { const t = targetById(d.id); t.archived = !t.archived; save(); render(); },
  "target-save":  (d) => saveTargetForm(d.id || null),

  "cat-edit": (d) => categoryEditor(catById(d.id)),
  "cat-del":  (d) => deleteCategory(d.id),
  "cat-save": (d) => saveCategoryForm(d.id || null),

  suggest: (d) => {
    const s = SUGGESTIONS[d.cat][Number(d.i)];
    const siblings = targetsIn(d.cat);
    state.targets.push({
      ...s, id: uid("t_"), catId: d.cat, archived: false, days: [...ALL_DAYS],
      order: siblings.length ? Math.max(...siblings.map((t) => t.order)) + 1 : 0,
    });
    save(); render();
    toast(`Added "${s.name}"`);
  },

  "amount-save": (d) => saveAmount(d.id, d.day),
  "modal-close": () => closeModal(),
};

function wire() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) { closeModal(); return; }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const fn = ACTIONS[btn.dataset.act];
    if (fn) { e.preventDefault(); fn(btn.dataset); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#modal-host").classList.contains("hidden")) closeModal();
  });

  $$(".tab").forEach((b) => b.addEventListener("click", () => { ui.view = b.dataset.view; render(); }));

  $("#day-prev").addEventListener("click", () => { ui.day = keyOf(addDays(parseKey(ui.day), -1)); render(); });
  $("#day-next").addEventListener("click", () => {
    if (daysBetween(todayKey(), ui.day) >= 0) return;
    ui.day = keyOf(addDays(parseKey(ui.day), 1)); render();
  });
  $("#week-prev").addEventListener("click", () => { ui.weekMonday = keyOf(addDays(parseKey(ui.weekMonday), -7)); render(); });
  $("#week-next").addEventListener("click", () => {
    if (daysBetween(keyOf(startOfWeek(new Date())), ui.weekMonday) >= 0) return;
    ui.weekMonday = keyOf(addDays(parseKey(ui.weekMonday), 7)); render();
  });

  $("#insights-range").addEventListener("change", (e) => { ui.insightsRange = Number(e.target.value); render(); });

  $("#add-category").addEventListener("click", () => categoryEditor(null));
  $("#export-btn").addEventListener("click", exportBackup);
  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (e) => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = "";
  });
  $("#reset-btn").addEventListener("click", () => {
    if (!confirm("Erase every category, target and logged day? This cannot be undone.")) return;
    if (!confirm("Really erase everything? Export a backup first if you might want it back.")) return;
    localStorage.removeItem(STORE_KEY);
    location.reload();
  });

  $("#welcome-start").addEventListener("click", () => start(seededState()));
  $("#welcome-blank").addEventListener("click", () => start(blankState()));

  /* Left open overnight, the app would otherwise still be showing yesterday. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const t = todayKey();
    if (ui.day !== t && daysBetween(t, ui.day) < 0 && ui._lastSeen !== t) {
      ui.day = t;
      ui.weekMonday = keyOf(startOfWeek(new Date()));
    }
    ui._lastSeen = t;
    render();
  });
}

function start(s) {
  state = s;
  save();
  $("#welcome-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  render();
}

function boot() {
  wire();
  ui._lastSeen = todayKey();
  const saved = load();
  if (saved) {
    state = saved;
    $("#app-view").classList.remove("hidden");
    render();
  } else {
    $("#welcome-view").classList.remove("hidden");
  }

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

boot();
