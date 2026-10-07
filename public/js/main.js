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

  // todos.ejs also loads this file; none of these exist there.
  if (!form || !displaySection || !dayClients || !actions || !toggle) return;

  const CREATE = { action: "/workDayList", label: "Create workDayList" };
  const EDIT = {
    action: "/workDayList?_method=PUT",
    label: "Save changes",
  };

  let requestToken = 0;
  // the server's version of the current date's list, for Cancel to fall back to
  let savedClientIds = [];

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
  }

  function renderClients(clients) {
    dayClients.innerHTML = "";
    clients.forEach((client) => {
      const a = document.createElement("a");
      a.href = `/clients/${client._id}`;
      a.className = "client-row";

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

      const { clients, listId } = await res.json();
      if (token !== requestToken) return;

      renderClients(clients);
      setMode("edit", listId);
      savedClientIds = clients.map((c) => String(c._id));
      syncBoxesToSaved();
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
  });

  // The inline calendar script calls this by bare name — the IIFE would hide it.
  window.fetchClientsForDate = fetchClientsForDate;
})();
