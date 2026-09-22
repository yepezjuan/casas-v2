const container = document.getElementById("dayClients");

async function fetchClientsForDate(date) {
  try {
    container.innerHTML = "";
    const res = await fetch(`/workDayList?date=${date}`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const { clients } = await res.json();
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
