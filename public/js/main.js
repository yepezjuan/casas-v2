(function () {
  const dayClients = document.getElementById("dayClients");
  const displaySection = document.getElementById("showWorkDayClients");
  const actions = document.getElementById("workDayActions");
  const formSection = document.getElementById("showWorkDayForm");
  const form = document.getElementById("workDayForm");
  const dateInput = document.getElementById("date");
  const listIdInput = document.getElementById("listId");
  const submitBtn = document.getElementById("workDayFormSubmit");
  const toggle = document.getElementById("editToggle");
  const optimizeBtn = document.getElementById("optimizeRoute");
  const routeSummary = document.getElementById("routeSummary");
  const routeTotals = document.getElementById("routeTotals");
  const routeLink = document.getElementById("routeLink");
  const routeLinkNote = document.getElementById("routeLinkNote");
  const routeStatus = document.getElementById("routeStatus");

  // todos.ejs also loads this file; none of these exist there.
  if (!form || !displaySection || !dayClients || !actions || !toggle) return;
  if (!optimizeBtn || !routeSummary) return;

  const CREATE = { action: "/workDayList", label: "Create workDayList" };
  const EDIT = {
    action: "/workDayList?_method=PUT",
    label: "Save changes",
  };

  let requestToken = 0;
  // the server's version of the current date's list, for Cancel to fall back to
  let savedClientIds = [];
  // whether the current date's list may be optimized: saved, 2+ clients, not past
  let canOptimize = false;

  const boxes = () => form.querySelectorAll('input[name="clientIds"]');

  function setMode(mode, listId) {
    const cfg = mode === "edit" ? EDIT : CREATE;
    form.setAttribute("action", cfg.action);
    submitBtn.value = cfg.label;
    listIdInput.value = mode === "edit" ? listId || "" : "";
  }

  // One synchronous "forget the previous date" step.
  function resetForDate(date) {
    dayClients.innerHTML = "";
    savedClientIds = [];
    boxes().forEach((b) => (b.checked = false));
    dateInput.value = date;
    setMode("create");
    displaySection.classList.add("hidden");
    formSection.classList.add("hidden");
    actions.classList.add("hidden");
    toggle.textContent = "Edit";
    canOptimize = false;
    optimizeBtn.classList.add("hidden");
    optimizeBtn.disabled = false;
    routeSummary.classList.add("hidden");
    routeStatus.textContent = "";
  }

  // the user's own calendar day, in the same YYYY-MM-DD form as list dates
  function localToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // numbered marks the list as being in optimized visit order
  function renderClients(clients, numbered) {
    dayClients.innerHTML = "";
    clients.forEach((client, i) => {
      const a = document.createElement("a");
      a.href = `/clients/${client._id}`;
      a.className = "client-row";

      if (numbered) {
        const stop = document.createElement("span");
        stop.className = "stop-number";
        stop.textContent = i + 1;
        a.appendChild(stop);
      }

      const name = document.createElement("span");
      name.className = "client-row-name";
      name.textContent = client.name;

      const chevron = document.createElement("span");
      chevron.className = "chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "›";

      a.append(name, chevron);
      dayClients.appendChild(a);
    });
  }

  function renderRoute(route) {
    routeSummary.classList.toggle("hidden", !route);
    optimizeBtn.textContent = route ? "Re-optimize route" : "Optimize route";
    if (!route) return;

    routeTotals.textContent = `${route.miles} mi · ${route.minutes} min drive`;
    routeLink.classList.toggle("hidden", !route.deepLink);
    routeLinkNote.classList.toggle("hidden", !!route.deepLink);
    if (route.deepLink) routeLink.href = route.deepLink;
    else routeLink.removeAttribute("href");
  }

  // Draw a saved list as the server describes it.
  function showList({ clients, listId, route }) {
    renderClients(clients, !!route);
    renderRoute(route);
    setMode("edit", listId);
    savedClientIds = clients.map((c) => String(c._id));
    syncBoxesToSaved();
    canOptimize = clients.length >= 2 && dateInput.value >= localToday();
    optimizeBtn.classList.toggle("hidden", !canOptimize);
  }

  // Mirror the saved list onto the boxes. Clears first, so this also undoes
  // boxes the user checked — Cancel has to discard both directions of an edit.
  function syncBoxesToSaved() {
    boxes().forEach((b) => (b.checked = false));
    savedClientIds.forEach((id) => {
      const box = form.querySelector(`#client_${CSS.escape(id)}`);
      if (box) box.checked = true;
    });
  }

  async function fetchClientsForDate(date) {
    const token = ++requestToken;
    resetForDate(date);
    try {
      const res = await fetch(`/workDayList?date=${encodeURIComponent(date)}`);
      if (token !== requestToken) return;

      if (res.status === 404) {
        formSection.classList.remove("hidden");
        return;
      }
      if (!res.ok) throw new Error(`Status ${res.status}`);

      const list = await res.json();
      if (token !== requestToken) return;

      showList(list);
      displaySection.classList.remove("hidden");
      actions.classList.remove("hidden");
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    }
  }

  toggle.addEventListener("click", () => {
    const opening = formSection.classList.contains("hidden");
    // Cancel: drop the unsaved edits instead of leaving them staged for the
    // next Save, which would delete the unchecked clients and their history.
    if (!opening) syncBoxesToSaved();
    formSection.classList.toggle("hidden", !opening);
    displaySection.classList.toggle("hidden", opening);
    toggle.textContent = opening ? "Cancel" : "Edit";
    optimizeBtn.classList.toggle("hidden", opening || !canOptimize);
    routeStatus.textContent = "";
  });

  optimizeBtn.addEventListener("click", async () => {
    // a date change bumps the token, so a late answer can't land on another day
    const token = requestToken;
    optimizeBtn.disabled = true;
    routeStatus.textContent = "Optimizing…";
    try {
      const res = await fetch("/workDayList/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: listIdInput.value }),
      });
      const body = await res.json().catch(() => ({}));
      if (token !== requestToken) return;
      if (!res.ok) throw new Error(body.error || "Could not optimize route.");

      showList(body);
      routeStatus.textContent = "";
    } catch (err) {
      if (token !== requestToken) return;
      console.error("Failed to optimize route:", err);
      // fetch itself rejects with a TypeError when the phone has no signal
      routeStatus.textContent =
        err instanceof TypeError
          ? "No connection. Try again."
          : err.message;
    } finally {
      if (token === requestToken) optimizeBtn.disabled = false;
    }
  });

  // The inline calendar script calls this by bare name — the IIFE would hide it.
  window.fetchClientsForDate = fetchClientsForDate;
})();
