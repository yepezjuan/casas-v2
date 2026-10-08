/*
 * CasasCalendar — dependency-free inline month calendar, built for phones.
 *
 *   const cal = CasasCalendar("#workCalendar", {
 *     value: "2026-10-05",
 *     markedDates: ["2026-10-07", "2026-10-09"],   // or { "2026-10-07": 3 }
 *     onChange: (iso) => fetchClientsForDate(iso),
 *     onMonthChange: ({ rangeStart, rangeEnd }) => loadMarks(rangeStart, rangeEnd),
 *   });
 *
 *   cal.setMarkedDates(obj)   cal.setValue(iso)   cal.getValue()
 *   cal.goToMonth(y, m)       cal.goToToday()     cal.setOption(k, v)
 *   cal.destroy()
 *
 * Everything is local time: no UTC parsing, so a date never shifts by a day.
 *
 * NOTE: copied unchanged from prototypes/calendar/calendar.js. Replaces the
 * @calendarjs/ce + lemonadejs CDN libraries. Only views/dashboard.ejs uses it,
 * where the init block wires it to main.js and /workDayList/dates.
 */
(function (global) {
  "use strict";

  var pad = function (n) {
    return String(n).padStart(2, "0");
  };

  var toISO = function (d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };

  var fromISO = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };

  // Accepts a Date, an ISO string, or null. Always returns midnight local.
  var toDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    return fromISO(v);
  };

  var addDays = function (d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  };

  var sameDay = function (a, b) {
    return !!a && !!b && a.getTime() === b.getTime();
  };

  // ["2026-10-07"] | [{date, count}] | {"2026-10-07": 3} | Set | Map -> Map<iso, count>
  var normalizeMarks = function (marks) {
    var map = new Map();
    if (!marks) return map;
    if (marks instanceof Map) {
      marks.forEach(function (v, k) {
        map.set(k, Number(v) || 0);
      });
      return map;
    }
    if (marks instanceof Set || Array.isArray(marks)) {
      marks.forEach(function (entry) {
        if (entry && typeof entry === "object") map.set(entry.date, Number(entry.count) || 0);
        else if (entry) map.set(String(entry), 0);
      });
      return map;
    }
    Object.keys(marks).forEach(function (k) {
      map.set(k, Number(marks[k]) || 0);
    });
    return map;
  };

  var DEFAULTS = {
    value: null, // Date | "YYYY-MM-DD" | null
    markedDates: null,
    min: null,
    max: null,
    weekStartsOn: 1, // 0 = Sunday, 1 = Monday
    locale: undefined, // undefined -> the browser's locale
    showCount: false, // show the number of clients instead of a dot
    disabledDaysOfWeek: [], // e.g. [0] to kill Sundays
    selectAdjacent: true, // tapping a trailing/leading day jumps months
    swipe: true,
    todayButton: true,
    legend: "Has a work day",
    onChange: null, // (iso, date) => void — user selection only
    onMonthChange: null, // ({ year, month, monthStart, monthEnd, rangeStart, rangeEnd })
  };

  var CHEVRON =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
    '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function CasasCalendar(root, options) {
    if (!(this instanceof CasasCalendar)) return new CasasCalendar(root, options);

    this.root = typeof root === "string" ? document.querySelector(root) : root;
    if (!this.root) throw new Error("CasasCalendar: container not found");

    this.opts = Object.assign({}, DEFAULTS, options || {});
    this.marks = normalizeMarks(this.opts.markedDates);
    this.min = toDate(this.opts.min);
    this.max = toDate(this.opts.max);
    this.selected = toDate(this.opts.value);

    var anchor = this.selected || new Date();
    this.view = { year: anchor.getFullYear(), month: anchor.getMonth() };
    this.focusISO = toISO(this.selected || new Date());
    this.pickerOpen = false;
    this.pickerYear = this.view.year;

    this._fmt = {
      month: new Intl.DateTimeFormat(this.opts.locale, { month: "long" }),
      monthShort: new Intl.DateTimeFormat(this.opts.locale, { month: "short" }),
      weekday: new Intl.DateTimeFormat(this.opts.locale, { weekday: "short" }),
      full: new Intl.DateTimeFormat(this.opts.locale, { dateStyle: "full" }),
    };

    this._build();
    this.render();

    // Deferred: the caller's `const cal = CasasCalendar(...)` has not been
    // assigned yet, and onMonthChange handlers almost always reference it.
    var self = this;
    Promise.resolve().then(function () {
      if (!self._destroyed) self._emitMonth();
    });
  }

  CasasCalendar.prototype._build = function () {
    this.root.classList.add("cal");
    this.root.innerHTML =
      '<div class="cal-head">' +
      '<button class="cal-nav" type="button" data-nav="prev" aria-label="Previous month">' +
      CHEVRON +
      "</button>" +
      '<button class="cal-title" type="button" aria-expanded="false">' +
      '<span class="cal-title-text"></span>' +
      '<span class="cal-caret" aria-hidden="true"></span>' +
      "</button>" +
      '<button class="cal-nav cal-nav-next" type="button" data-nav="next" aria-label="Next month">' +
      CHEVRON +
      "</button>" +
      "</div>" +
      '<div class="cal-body">' +
      '<div class="cal-dows" aria-hidden="true"></div>' +
      '<div class="cal-grid" role="grid" tabindex="-1"></div>' +
      '<div class="cal-picker" hidden>' +
      '<div class="cal-picker-head">' +
      '<button class="cal-nav" type="button" data-pick="prevYear" aria-label="Previous year">' +
      CHEVRON +
      "</button>" +
      '<span class="cal-picker-year"></span>' +
      '<button class="cal-nav cal-nav-next" type="button" data-pick="nextYear" aria-label="Next year">' +
      CHEVRON +
      "</button>" +
      "</div>" +
      '<div class="cal-picker-grid"></div>' +
      "</div>" +
      "</div>" +
      '<div class="cal-foot">' +
      '<button class="cal-today" type="button" data-nav="today">Today</button>' +
      '<span class="cal-legend"><i class="cal-legend-dot" aria-hidden="true"></i><span></span></span>' +
      '<div class="cal-live" role="status" aria-live="polite"></div>' +
      "</div>";

    this.els = {
      title: this.root.querySelector(".cal-title"),
      titleText: this.root.querySelector(".cal-title-text"),
      dows: this.root.querySelector(".cal-dows"),
      grid: this.root.querySelector(".cal-grid"),
      picker: this.root.querySelector(".cal-picker"),
      pickerYear: this.root.querySelector(".cal-picker-year"),
      pickerGrid: this.root.querySelector(".cal-picker-grid"),
      today: this.root.querySelector(".cal-today"),
      legend: this.root.querySelector(".cal-legend span"),
      live: this.root.querySelector(".cal-live"),
      foot: this.root.querySelector(".cal-foot"),
    };

    this.els.legend.textContent = this.opts.legend || "";
    this.els.today.hidden = !this.opts.todayButton;

    this._onClick = this._handleClick.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);

    this.root.addEventListener("click", this._onClick);
    this.els.grid.addEventListener("keydown", this._onKeyDown);
    if (this.opts.swipe) {
      this.els.grid.addEventListener("touchstart", this._onTouchStart, { passive: true });
      this.els.grid.addEventListener("touchend", this._onTouchEnd, { passive: true });
    }

    this._renderWeekdays();
    this._renderPickerMonths();
  };

  CasasCalendar.prototype._renderWeekdays = function () {
    var html = "";
    // 2024-01-07 was a Sunday, so + dow lands on the right weekday name.
    for (var i = 0; i < 7; i++) {
      var dow = (this.opts.weekStartsOn + i) % 7;
      html += "<span>" + this._fmt.weekday.format(new Date(2024, 0, 7 + dow)) + "</span>";
    }
    this.els.dows.innerHTML = html;
  };

  CasasCalendar.prototype._renderPickerMonths = function () {
    var html = "";
    for (var m = 0; m < 12; m++) {
      html +=
        '<button class="cal-picker-month" type="button" data-month="' +
        m +
        '">' +
        this._fmt.monthShort.format(new Date(2024, m, 1)) +
        "</button>";
    }
    this.els.pickerGrid.innerHTML = html;
  };

  CasasCalendar.prototype._isDisabled = function (d) {
    if (this.min && d.getTime() < this.min.getTime()) return true;
    if (this.max && d.getTime() > this.max.getTime()) return true;
    return this.opts.disabledDaysOfWeek.indexOf(d.getDay()) !== -1;
  };

  // First cell of the 6-week grid: the week start on or before the 1st.
  CasasCalendar.prototype._gridStart = function () {
    var first = new Date(this.view.year, this.view.month, 1);
    var shift = (first.getDay() - this.opts.weekStartsOn + 7) % 7;
    return addDays(first, -shift);
  };

  CasasCalendar.prototype.render = function (direction) {
    var today = new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var start = this._gridStart();
    var viewMonth = this.view.month;

    // Keep the roving tabindex inside the visible month.
    var focus = fromISO(this.focusISO);
    if (!focus || focus.getMonth() !== viewMonth || focus.getFullYear() !== this.view.year) {
      var selectedInView =
        this.selected &&
        this.selected.getMonth() === viewMonth &&
        this.selected.getFullYear() === this.view.year;
      this.focusISO = toISO(selectedInView ? this.selected : new Date(this.view.year, viewMonth, 1));
    }

    var html = "";
    for (var week = 0; week < 6; week++) {
      html += '<div class="cal-row" role="row">';
      for (var i = 0; i < 7; i++) {
        var d = addDays(start, week * 7 + i);
        var iso = toISO(d);
        var outside = d.getMonth() !== viewMonth;
        var disabled = this._isDisabled(d) || (outside && !this.opts.selectAdjacent);
        var isSelected = sameDay(d, this.selected);
        var count = this.marks.has(iso) ? this.marks.get(iso) : null;
        var cls = ["cal-day"];
        if (outside) cls.push("is-outside");
        if (isSelected) cls.push("is-selected");
        if (sameDay(d, today)) cls.push("is-today");
        if (count !== null) cls.push("is-marked");

        var label = this._fmt.full.format(d);
        if (count !== null) label += count ? ", " + count + " clients scheduled" : ", work day scheduled";

        var badge =
          count === null
            ? ""
            : this.opts.showCount && count
            ? '<span class="cal-count">' + count + "</span>"
            : '<span class="cal-dot"></span>';

        html +=
          '<button class="' +
          cls.join(" ") +
          '" type="button" role="gridcell" data-iso="' +
          iso +
          '" tabindex="' +
          (iso === this.focusISO ? "0" : "-1") +
          '" aria-selected="' +
          (isSelected ? "true" : "false") +
          '"' +
          (sameDay(d, today) ? ' aria-current="date"' : "") +
          (disabled ? " disabled" : "") +
          ' aria-label="' +
          label +
          '">' +
          '<span class="cal-num">' +
          d.getDate() +
          "</span>" +
          badge +
          "</button>";
      }
      html += "</div>";
    }

    this.els.grid.innerHTML = html;
    this.els.titleText.textContent =
      this._fmt.month.format(new Date(this.view.year, viewMonth, 1)) + " " + this.view.year;

    this.root.querySelector('[data-nav="prev"]').disabled = !this._canShift(-1);
    this.root.querySelector('[data-nav="next"]').disabled = !this._canShift(1);

    if (direction) {
      this.els.grid.classList.remove("slide-prev", "slide-next");
      // Force a reflow so the animation restarts on every month change.
      void this.els.grid.offsetWidth;
      this.els.grid.classList.add(direction < 0 ? "slide-prev" : "slide-next");
      this.els.live.textContent = this.els.titleText.textContent;
    }

    if (this._focusAfterRender) {
      this._focusAfterRender = false;
      var cell = this.els.grid.querySelector('[data-iso="' + this.focusISO + '"]');
      if (cell) cell.focus({ preventScroll: true });
    }
  };

  CasasCalendar.prototype._canShift = function (n) {
    var probe = new Date(this.view.year, this.view.month + n, n < 0 ? 31 : 1);
    if (n < 0 && this.min) return probe.getTime() >= new Date(this.min.getFullYear(), this.min.getMonth(), 1).getTime();
    if (n > 0 && this.max) return probe.getTime() <= this.max.getTime();
    return true;
  };

  CasasCalendar.prototype._emitMonth = function () {
    if (typeof this.opts.onMonthChange !== "function") return;
    var start = this._gridStart();
    this.opts.onMonthChange({
      year: this.view.year,
      month: this.view.month,
      monthStart: toISO(new Date(this.view.year, this.view.month, 1)),
      monthEnd: toISO(new Date(this.view.year, this.view.month + 1, 0)),
      rangeStart: toISO(start),
      rangeEnd: toISO(addDays(start, 41)),
    });
  };

  CasasCalendar.prototype._handleClick = function (e) {
    var nav = e.target.closest("[data-nav]");
    if (nav && this.root.contains(nav)) {
      if (nav.dataset.nav === "prev") this.shiftMonth(-1);
      else if (nav.dataset.nav === "next") this.shiftMonth(1);
      else this.goToToday();
      return;
    }

    if (e.target.closest(".cal-title")) {
      this.togglePicker();
      return;
    }

    var pick = e.target.closest("[data-pick]");
    if (pick) {
      this.pickerYear += pick.dataset.pick === "prevYear" ? -1 : 1;
      this._renderPicker();
      return;
    }

    var monthBtn = e.target.closest("[data-month]");
    if (monthBtn) {
      this.goToMonth(this.pickerYear, +monthBtn.dataset.month);
      this.togglePicker(false);
      return;
    }

    var cell = e.target.closest(".cal-day");
    if (cell && !cell.disabled) this.select(cell.dataset.iso, { fromUser: true });
  };

  CasasCalendar.prototype._handleKeyDown = function (e) {
    var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    var current = fromISO(this.focusISO) || new Date();

    if (step) {
      e.preventDefault();
      return this._moveFocus(addDays(current, step));
    }
    if (e.key === "Home") {
      e.preventDefault();
      return this._moveFocus(addDays(current, -((current.getDay() - this.opts.weekStartsOn + 7) % 7)));
    }
    if (e.key === "End") {
      e.preventDefault();
      return this._moveFocus(addDays(current, 6 - ((current.getDay() - this.opts.weekStartsOn + 7) % 7)));
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      var dir = e.key === "PageUp" ? -1 : 1;
      var target = new Date(current.getFullYear(), current.getMonth() + dir, 1);
      var lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(current.getDate(), lastDay));
      return this._moveFocus(target);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      return this.select(this.focusISO, { fromUser: true, keepFocus: true });
    }
    if (e.key === "Escape" && this.pickerOpen) this.togglePicker(false);
  };

  CasasCalendar.prototype._moveFocus = function (date) {
    var monthChanged = date.getMonth() !== this.view.month || date.getFullYear() !== this.view.year;
    this.focusISO = toISO(date);
    this._focusAfterRender = true;
    if (monthChanged) {
      var dir = date.getTime() < new Date(this.view.year, this.view.month, 1).getTime() ? -1 : 1;
      this.view = { year: date.getFullYear(), month: date.getMonth() };
      this.render(dir);
      this._emitMonth();
    } else {
      this.render();
    }
  };

  CasasCalendar.prototype._handleTouchStart = function (e) {
    var t = e.changedTouches[0];
    this._touch = { x: t.clientX, y: t.clientY, at: Date.now() };
  };

  CasasCalendar.prototype._handleTouchEnd = function (e) {
    if (!this._touch) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - this._touch.x;
    var dy = t.clientY - this._touch.y;
    var quick = Date.now() - this._touch.at < 600;
    this._touch = null;
    if (quick && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      this.shiftMonth(dx < 0 ? 1 : -1);
    }
  };

  /* ----- public API ----- */

  CasasCalendar.prototype.select = function (value, meta) {
    meta = meta || {};
    var d = toDate(value);
    if (!d || this._isDisabled(d)) return;

    var monthChanged = d.getMonth() !== this.view.month || d.getFullYear() !== this.view.year;
    this.selected = d;
    this.focusISO = toISO(d);
    if (meta.keepFocus) this._focusAfterRender = true;

    if (monthChanged) {
      var dir = d.getTime() < new Date(this.view.year, this.view.month, 1).getTime() ? -1 : 1;
      this.view = { year: d.getFullYear(), month: d.getMonth() };
      this.render(dir);
      this._emitMonth();
    } else {
      this.render();
    }

    if (meta.fromUser !== false && typeof this.opts.onChange === "function") {
      this.opts.onChange(toISO(d), d);
    }
  };

  // Programmatic set — does not fire onChange.
  CasasCalendar.prototype.setValue = function (value) {
    this.select(value, { fromUser: false });
  };

  CasasCalendar.prototype.getValue = function () {
    return this.selected ? toISO(this.selected) : null;
  };

  CasasCalendar.prototype.setMarkedDates = function (marks) {
    this.marks = normalizeMarks(marks);
    this.render();
  };

  CasasCalendar.prototype.markDate = function (iso, count) {
    this.marks.set(iso, Number(count) || 0);
    this.render();
  };

  CasasCalendar.prototype.unmarkDate = function (iso) {
    this.marks.delete(iso);
    this.render();
  };

  CasasCalendar.prototype.shiftMonth = function (n) {
    if (!this._canShift(n)) return;
    var next = new Date(this.view.year, this.view.month + n, 1);
    this.view = { year: next.getFullYear(), month: next.getMonth() };
    this.render(n);
    this._emitMonth();
  };

  CasasCalendar.prototype.goToMonth = function (year, month) {
    var dir =
      new Date(year, month, 1).getTime() < new Date(this.view.year, this.view.month, 1).getTime() ? -1 : 1;
    this.view = { year: year, month: month };
    this.render(dir);
    this._emitMonth();
  };

  CasasCalendar.prototype.goToToday = function () {
    this.select(new Date(), { fromUser: true });
  };

  CasasCalendar.prototype.setOption = function (key, value) {
    this.opts[key] = value;
    if (key === "markedDates") return this.setMarkedDates(value);
    if (key === "min") this.min = toDate(value);
    if (key === "max") this.max = toDate(value);
    if (key === "weekStartsOn") this._renderWeekdays();
    if (key === "legend") this.els.legend.textContent = value || "";
    if (key === "todayButton") this.els.today.hidden = !value;
    this.render();
  };

  CasasCalendar.prototype._renderPicker = function () {
    this.els.pickerYear.textContent = this.pickerYear;
    var self = this;
    this.els.pickerGrid.querySelectorAll("[data-month]").forEach(function (btn) {
      var m = +btn.dataset.month;
      var monthEnd = new Date(self.pickerYear, m + 1, 0);
      var monthStart = new Date(self.pickerYear, m, 1);
      btn.disabled =
        (self.min && monthEnd.getTime() < self.min.getTime()) ||
        (self.max && monthStart.getTime() > self.max.getTime());
      btn.classList.toggle("is-current", m === self.view.month && self.pickerYear === self.view.year);
    });
  };

  CasasCalendar.prototype.togglePicker = function (open) {
    this.pickerOpen = open === undefined ? !this.pickerOpen : open;
    if (this.pickerOpen) this.pickerYear = this.view.year;
    this.els.picker.hidden = !this.pickerOpen;
    this.els.title.setAttribute("aria-expanded", String(this.pickerOpen));
    this.root.classList.toggle("is-picking", this.pickerOpen);
    if (this.pickerOpen) this._renderPicker();
  };

  CasasCalendar.prototype.destroy = function () {
    this._destroyed = true;
    this.root.removeEventListener("click", this._onClick);
    this.els.grid.removeEventListener("keydown", this._onKeyDown);
    this.els.grid.removeEventListener("touchstart", this._onTouchStart);
    this.els.grid.removeEventListener("touchend", this._onTouchEnd);
    this.root.classList.remove("cal", "is-picking");
    this.root.innerHTML = "";
  };

  CasasCalendar.toISO = toISO;
  CasasCalendar.fromISO = fromISO;

  global.CasasCalendar = CasasCalendar;
  if (typeof module === "object" && module.exports) module.exports = CasasCalendar;
})(typeof window !== "undefined" ? window : this);
