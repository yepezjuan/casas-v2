const container = document.getElementById("dayClients");
const existingListSection = document.getElementById("showWorkDayClients");
const createFormSection = document.getElementById("showWorkDayForm");

async function fetchClientsForDate(date) {
  try {
    container.innerHTML = "";
    const res = await fetch(`/workDayList?date=${date}`);
    if (res.status == 404) {
      existingListSection.classList.add("hidden");
      createFormSection.classList.remove("hidden");
      document.getElementById("date").value = date;
      return;
    }
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const { clients } = await res.json();
    createFormSection.classList.add("hidden");
    existingListSection.classList.remove("hidden");

    renderClients(clients);
  } catch (err) {
    console.error("Failed to fetch clients:", err);
  }
}

async function renderClients(clients) {
  container.innerHTML = "";

  clients.forEach((client) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `/clients/${client._id}`;
    a.textContent = client.name;
    li.appendChild(a);
    container.appendChild(li);
  });
  // TODO: display workDay clients
}
