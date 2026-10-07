# CasasCalendar — prototype

A dependency-free replacement for `@calendarjs/ce` on the dashboard. Three files, no build step:

| File | Role |
| --- | --- |
| `calendar.js` | The component (~11 KB unminified). No dependencies. |
| `calendar.css` | Styles, all scoped under `.cal` and driven by CSS variables. |
| `index.html` | Test bench only — mock clients, mock API, option switches. Not part of CASAS. |

## Test it on Replit

1. New Repl → **HTML, CSS, JS** template.
2. Delete the starter files, upload `index.html`, `calendar.js`, `calendar.css` at the repo root (drag all three in).
3. Hit **Run**, then open the webview URL on your phone — it's built mobile-first, and swipe + touch targets only make sense on real hardware.

Locally instead: `npx serve prototypes/calendar` and open the printed URL.

### What to try on the phone

- Tap a day → the panel below loads that day's list (mock, ~160 ms delay).
- Swipe the grid left/right to change month; tap the month title for a month/year picker.
- Tick/untick clients → **Save** → the green dot on the calendar updates immediately.
- Delete a day's list → the dot disappears.
- Flip the option switches: week start, count badge vs. dot, disable Sundays, min date, dark mode.
- The event log at the bottom shows every `onChange` / `onMonthChange` the component fires.

## What it does that the current calendar doesn't

- **Marked days are first-class.** `markedDates` is an option, so there's no `MutationObserver`
  re-reading month/year out of the DOM and re-marking cells on every mutation
  ([dashboard.ejs:133-188](../../views/dashboard.ejs#L133-L188) all goes away).
- **`onMonthChange` gives you the visible range**, so you can fetch marks for the 42 days on
  screen instead of a 3-year window up front.
- **All dates are local-time ISO strings.** No `new Date("...")` UTC parsing, so a day can't shift.
- **Counts, not just a flag** — show `3` on a day instead of a dot, if that reads better in the field.
- **Keyboard + screen reader**: `role="grid"`, roving tabindex, arrows / Home / End / PageUp / PageDown / Enter.
- **44 px minimum touch targets**, fixed 6-week height so the page never jumps between months,
  and dark mode via `prefers-color-scheme`.

## API

```js
const cal = CasasCalendar("#workCalendar", {
  value: new Date(),              // Date | "YYYY-MM-DD" | null
  markedDates: ["2026-10-07"],    // or { "2026-10-07": 3 } for counts, or a Set/Map
  min: null, max: null,           // Date | ISO | null
  weekStartsOn: 1,                // 0 = Sunday
  showCount: false,               // count badge instead of a dot
  disabledDaysOfWeek: [0],        // no Sunday visits
  selectAdjacent: true,           // tapping a trailing day jumps to that month
  swipe: true,
  todayButton: true,
  legend: "Has a work day",
  locale: undefined,              // undefined = browser locale
  onChange(iso, date) {},         // user selection only
  onMonthChange({ year, month, monthStart, monthEnd, rangeStart, rangeEnd }) {},
});

cal.getValue();                   // "2026-10-05" | null
cal.setValue(iso);                // set without firing onChange
cal.setMarkedDates(obj);          // replace all marks
cal.markDate(iso, count);         // add/update one
cal.unmarkDate(iso);
cal.goToMonth(2026, 9);
cal.goToToday();
cal.shiftMonth(-1);
cal.setOption("showCount", true);
cal.destroy();
```

## If you decide to switch

1. Copy `calendar.js` → `public/js/calendar.js`, `calendar.css` → `public/css/calendar.css`.
2. In [views/dashboard.ejs](../../views/dashboard.ejs), drop the `@calendarjs/ce` stylesheet
   (line 3-6), both CDN `<script>` tags (lines 121-122) and the whole inline block (lines 124-189),
   plus the `#workCalendar .workday-marker` rule in
   [public/css/style.css:124-127](../../public/css/style.css#L124-L127). Replace with:

```html
<link rel="stylesheet" href="/css/calendar.css" />
...
<script src="/js/calendar.js"></script>
<script>
  CasasCalendar("#workCalendar", {
    value: new Date(),
    disabledDaysOfWeek: [0],
    onChange: (iso) => {
      document.getElementById("form-date").textContent = iso;
      fetchClientsForDate(iso);
    },
    onMonthChange: ({ rangeStart, rangeEnd }) => {
      fetch(`/workDayList/dates?start=${rangeStart}&end=${rangeEnd}`)
        .then((r) => (r.ok ? r.json() : { dates: [] }))
        .catch(() => ({ dates: [] }))
        .then(({ dates }) => cal.setMarkedDates(dates || []));
    },
  });
</script>
```

Two ordering notes: assign the result to `cal` (`const cal = CasasCalendar(...)`) since
`onMonthChange` needs it — the first emit is deferred a microtask precisely so that works. And
`fetchClientsForDate` is defined by `js/main.js`, which currently loads *after* this block
([dashboard.ejs:191](../../views/dashboard.ejs#L191)); that's fine because `onChange` only fires on a
tap, but move the `<script src="js/main.js">` above the init if you ever select a date on load.

To use counts, have `/workDayList/dates` return `{ "2026-10-07": 3 }` instead of a flat array and
pass `showCount: true`.
