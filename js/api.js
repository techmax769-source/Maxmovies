import { api } from "./api.js";
import { state } from "./state.js";
import { showToast } from "./ui.js";

const app = document.getElementById("app");

/************************************
 * BASIC VIEW RENDER HELPERS
 ************************************/
function renderList(items) {
    if (!items || !items.length) {
        app.innerHTML = `
            <div class="empty-message">
                <p>No content found.</p>
            </div>
        `;
        return;
    }

    app.innerHTML = `
        <div class="grid">
            ${items
                .map(item => {
                    const poster =
                        item.poster ||
                        item.image ||
                        item.cover ||
                        "";

                    return `
                        <div class="card" data-id="${item.id}">
                            <img src="${poster}" class="thumb" loading="lazy" />
                            <p class="title">${item.title || item.name}</p>
                        </div>
                    `;
                })
                .join("")}
        </div>
    `;

    // click event for cards
    document.querySelectorAll(".card").forEach(card => {
        card.onclick = () => {
            const id = card.getAttribute("data-id");
            navigate(`/info/${id}`);
        };
    });
}

/************************************
 * ROUTES
 ************************************/
async function renderHome() {
    app.innerHTML = `<div class="loader"></div>`;

    const data = await api.search("all");

    // FIX: your API returns data.results.items
    const list = Array.isArray(data?.results?.items)
        ? data.results.items
        : [];

    renderList(list);
}

async function renderSearch(query) {
    app.innerHTML = `<div class="loader"></div>`;

    const data = await api.search(query);

    // FIX: search also returns results.items
    const list = Array.isArray(data?.results?.items)
        ? data.results.items
        : [];

    renderList(list);
}

async function renderInfo(id) {
    app.innerHTML = `<div class="loader"></div>`;

    const data = await api.getInfo(id);

    const subject = data?.results?.subject;

    if (!subject) {
        app.innerHTML = `<p>No info available.</p>`;
        return;
    }

    const poster =
        subject.poster ||
        subject.image ||
        subject.cover ||
        "";

    app.innerHTML = `
        <div class="info-container">
            <img src="${poster}" class="info-poster" />
            <div class="info-data">
                <h2>${subject.title}</h2>
                <p>${subject.description || "No description available."}</p>

                ${subject.is_series ? `
                    <button id="playBtn">Select Episode</button>
                ` : `
                    <button id="playBtn">Play</button>
                `}
            </div>
        </div>
    `;

    document.getElementById("playBtn").onclick = () => {
        navigate(`/watch/${id}`);
    };
}

async function renderWatch(id) {
    app.innerHTML = `<div class="loader"></div>`;

    const data = await api.getSources(id);

    // FIX: your sources return results = []
    const sources = Array.isArray(data?.results)
        ? data.results
        : [];

    if (!sources.length) {
        app.innerHTML = `<p>No sources found.</p>`;
        return;
    }

    const src = sources[0].url || sources[0].download_url;

    app.innerHTML = `
        <video class="player" controls autoplay src="${src}"></video>
    `;
}

/************************************
 * SIMPLE CLIENT-SIDE ROUTER
 ************************************/
export function navigate(path) {
    window.history.pushState({}, "", path);
    router();
}

export function router() {
    const path = window.location.pathname;

    if (path === "/" || path === "/home") return renderHome();

    if (path.startsWith("/search/")) {
        const query = decodeURIComponent(path.replace("/search/", ""));
        return renderSearch(query);
    }

    if (path.startsWith("/info/")) {
        const id = path.replace("/info/", "");
        return renderInfo(id);
    }

    if (path.startsWith("/watch/")) {
        const id = path.replace("/watch/", "");
        return renderWatch(id);
    }

    app.innerHTML = `<p>Page not found.</p>`;
}

window.onpopstate = router;
router();
