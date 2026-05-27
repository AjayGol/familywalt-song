const baseUrlBox = document.getElementById("api-base-url");
const apiGrid = document.getElementById("api-grid");
const baseUrl = window.location.origin;

function buildUrl(path) {
  return new URL(path, `${baseUrl}/`).toString();
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function slugTitle(title) {
  return `${title || ""}`.trim() || "Category";
}

async function loadCategories() {
  const response = await fetch("/api/categories", { cache: "no-cache" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load categories.");
  }

  return payload.categories || [];
}

function createBaseGroups(categories) {
  const firstCategory = categories[0];
  const firstCategoryApiId = firstCategory?.apiId || "aarti";
  const firstCategoryValue = firstCategory?.value || "arti";

  const categorySongEndpoints = categories.map((category) => ({
    label: `${slugTitle(category.label)} Songs`,
    method: "GET",
    path: `/api/mobile/categories/${category.apiId}/songs`,
  }));

  const categoryAlbumEndpoints = categories.flatMap((category) => [
    {
      label: `${slugTitle(category.label)} Albums`,
      method: "GET",
      path: `/api/mobile/categories/${category.apiId}/albums`,
    },
    {
      label: `${slugTitle(category.label)} One Album`,
      method: "GET",
      path: `/api/mobile/categories/${category.apiId}/albums/:albumId`,
    },
    {
      label: `${slugTitle(category.label)} Album Songs`,
      method: "GET",
      path: `/api/mobile/categories/${category.apiId}/albums/:albumId/songs`,
    },
  ]);

  return [
    {
      title: "Health",
      endpoints: [{ label: "Health Check", method: "GET", path: "/api/health" }],
    },
    {
      title: "Upload",
      endpoints: [
        { label: "Single Upload", method: "POST", path: "/api/uploads/song" },
        { label: "Bulk Upload", method: "POST", path: "/api/uploads/bulk" },
      ],
    },
    {
      title: "Admin Songs",
      endpoints: [
        { label: "Categories", method: "GET", path: "/api/categories" },
        { label: "All Songs", method: "GET", path: "/api/songs" },
        { label: "Songs by Category", method: "GET", path: `/api/songs?category=${firstCategoryValue}` },
        { label: "One Song", method: "GET", path: "/api/songs/:songId" },
        { label: "Update Song", method: "PATCH", path: "/api/songs/:songId" },
        { label: "Delete Song", method: "DELETE", path: "/api/songs/:songId" },
      ],
    },
    {
      title: "Admin Albums",
      endpoints: [
        { label: "All Albums", method: "GET", path: "/api/albums" },
        { label: "Albums by Category", method: "GET", path: `/api/albums?category=${firstCategoryValue}` },
        { label: "One Album", method: "GET", path: "/api/albums/:albumId" },
        { label: "Create Album", method: "POST", path: "/api/albums" },
        { label: "Rename Album", method: "PATCH", path: "/api/albums/:albumId" },
        { label: "Delete Album", method: "DELETE", path: "/api/albums/:albumId" },
        { label: "Add Song to Album", method: "POST", path: "/api/albums/:albumId/songs" },
        { label: "Remove Song from Album", method: "DELETE", path: "/api/albums/:albumId/songs/:songId" },
      ],
    },
    {
      title: "Mobile Categories",
      endpoints: [
        { label: "All Mobile Categories", method: "GET", path: "/api/mobile/categories" },
        ...categorySongEndpoints,
      ],
    },
    {
      title: "Mobile Albums",
      endpoints: categoryAlbumEndpoints,
    },
    {
      title: "Language Examples",
      endpoints: [
        { label: "Songs in English", method: "GET", path: `/api/songs?category=${firstCategoryValue}&lang=en` },
        { label: "Songs in Hindi", method: "GET", path: `/api/songs?category=${firstCategoryValue}&lang=hi` },
        { label: "Albums in English", method: "GET", path: `/api/albums?category=${firstCategoryValue}&lang=en` },
        {
          label: "Mobile Album Songs in Hindi",
          method: "GET",
          path: `/api/mobile/categories/${firstCategoryApiId}/albums/:albumId/songs?lang=hi`,
        },
        { label: "One Mobile Song", method: "GET", path: "/api/mobile/songs/:songId" },
      ],
    },
  ];
}

function renderGroups(groups) {
  apiGrid.innerHTML = "";

  for (const group of groups) {
    const section = document.createElement("section");
    section.className = "panel api-card";

    const title = document.createElement("h2");
    title.textContent = group.title;
    section.appendChild(title);

    const list = document.createElement("div");
    list.className = "api-card__list";

    for (const endpoint of group.endpoints) {
      const fullUrl = buildUrl(endpoint.path);
      const row = document.createElement("div");
      row.className = "api-row";
      row.innerHTML = `
        <div class="api-row__meta">
          <span class="api-row__method api-row__method--${endpoint.method.toLowerCase()}">${endpoint.method}</span>
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
          window.adminPopup?.flash({
            type: "success",
            eyebrow: "Copied",
            title: "API URL copied",
            message: "The API URL is now in your clipboard.",
          });
        } catch {
          window.adminPopup?.error("Unable to copy the API URL.", "Copy Failed");
        }
      });

      list.appendChild(row);
    }

    section.appendChild(list);
    apiGrid.appendChild(section);
  }
}

async function initApiPage() {
  baseUrlBox.textContent = baseUrl;

  try {
    const categories = await loadCategories();
    const groups = createBaseGroups(categories);
    renderGroups(groups);
  } catch (error) {
    apiGrid.innerHTML = '<section class="panel api-card"><p class="summary">Unable to load API links right now.</p></section>';
    window.adminPopup?.error(error instanceof Error ? error.message : String(error), "API Error");
  }
}

initApiPage();
