const baseUrlBox = document.getElementById("api-base-url");
const apiGrid = document.getElementById("api-grid");
const baseUrl = window.location.origin;

const endpointGroups = [
  {
    title: "Health",
    endpoints: [{ label: "Health Check", path: "/api/health" }],
  },
  {
    title: "Upload",
    endpoints: [
      { label: "Single Upload", path: "/api/uploads/song" },
      { label: "Bulk Upload", path: "/api/uploads/bulk" },
    ],
  },
  {
    title: "Admin",
    endpoints: [
      { label: "Categories", path: "/api/categories" },
      { label: "All Songs", path: "/api/songs" },
      { label: "One Song", path: "/api/songs/:songId" },
      { label: "Update Song", path: "/api/songs/:songId" },
    ],
  },
  {
    title: "Mobile",
    endpoints: [
      { label: "Mobile Categories", path: "/api/mobile/categories" },
      { label: "Aarti Songs", path: "/api/mobile/categories/aarti/songs" },
      { label: "Chalisa Songs", path: "/api/mobile/categories/chalisa/songs" },
      { label: "Sundarkand Songs", path: "/api/mobile/categories/sundarkand/songs" },
      { label: "Path Songs", path: "/api/mobile/categories/path/songs" },
      { label: "Mantra Songs", path: "/api/mobile/categories/mantra/songs" },
      { label: "One Mobile Song", path: "/api/mobile/songs/:songId" },
    ],
  },
  {
    title: "Language Examples",
    endpoints: [
      { label: "Songs in English", path: "/api/songs?category=arti&lang=en" },
      { label: "Songs in Hindi", path: "/api/songs?category=arti&lang=hi" },
      { label: "Mobile Hindi", path: "/api/mobile/categories/aarti/songs?lang=hi" },
    ],
  },
];

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

baseUrlBox.textContent = baseUrl;

for (const group of endpointGroups) {
  const section = document.createElement("section");
  section.className = "panel api-card";

  const title = document.createElement("h2");
  title.textContent = group.title;
  section.appendChild(title);

  const list = document.createElement("div");
  list.className = "api-card__list";

  for (const endpoint of group.endpoints) {
    const fullUrl = `${baseUrl}${endpoint.path}`;
    const row = document.createElement("div");
    row.className = "api-row";
    row.innerHTML = `
      <div class="api-row__meta">
        <strong>${endpoint.label}</strong>
        <code>${fullUrl}</code>
      </div>
      <div class="actions">
        <a class="button-link secondary-link" href="${fullUrl}" target="_blank" rel="noreferrer">Open</a>
        <button type="button">Copy</button>
      </div>
    `;

    row.querySelector("button").addEventListener("click", async () => {
      try {
        await copyText(fullUrl);
        row.querySelector("button").textContent = "Copied";
        setTimeout(() => {
          row.querySelector("button").textContent = "Copy";
        }, 1200);
      } catch (error) {
        row.querySelector("button").textContent = "Failed";
      }
    });

    list.appendChild(row);
  }

  section.appendChild(list);
  apiGrid.appendChild(section);
}
