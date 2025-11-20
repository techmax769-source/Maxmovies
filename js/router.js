import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
import { state, addToHistory } from './state.js'; 

const container = document.getElementById('app-container');

/* ----------------------------------------
    MAIN ROUTER
---------------------------------------- */
export const router = async () => {
    try {
        destroyPlayer();
    } catch {}

    const hash = window.location.hash.slice(1) || "home";
    const params = hash.split("/");
    const route = params[0];

    window.scrollTo(0, 0);

    switch (route) {
        case "home": return renderHome();
        case "search": return renderSearch();
        case "info": return renderInfo(params[1]);
        case "player": return renderPlayerPage(params[1], params[2], params[3]);
        case "downloads": return renderDownloads();
        case "library": return renderLibrary();
        case "settings": return renderSettings();
        default:
            container.innerHTML = `<div class="p-1">Page not found.</div>`;
    }
};

/* ----------------------------------------
    HOME PAGE
---------------------------------------- */
async function renderHome() {
    const gridId = "trending-grid";
    container.innerHTML = `
        <div class="hero p-1"><h1>Trending Now</h1></div>
        <div id="${gridId}" class="media-grid"></div>
    `;

    const grid = document.getElementById(gridId);
    renderLoader(grid);

    try {
        const data = await api.search("action", 1, "movie");
        const list = Array.isArray(data?.results) ? data.results : [];

        grid.innerHTML = "";

        if (!list.length) {
            grid.innerHTML = `
                <div class="p-1 text-center" style="grid-column:1/-1;">
                    <p>No content found.</p>
                    <button class="btn" onclick="window.location.reload()">Retry</button>
                </div>
            `;
            return;
        }

        list.forEach(item => {
            if (item?.id) grid.appendChild(createCard(item));
        });

    } catch (err) {
        grid.innerHTML = `
            <div class="p-1" style="color:red;">
                Error loading content.<br>${err.message}
            </div>
        `;
    }
}

/* ----------------------------------------
    SEARCH PAGE
---------------------------------------- */
async function renderSearch() {
    container.innerHTML = `
        <div class="p-1">
            <input id="searchInput" class="search-bar" placeholder="Search movies...">
            <div id="search-results" class="media-grid"></div>
        </div>
    `;

    const input = document.getElementById("searchInput");
    const grid = document.getElementById("search-results");

    let debounce;

    input.addEventListener("input", e => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
            const query = e.target.value.trim();
            if (!query) {
                grid.innerHTML = "";
                return;
            }

            renderLoader(grid);

            try {
                const data = await api.search(query);
                const list = Array.isArray(data?.results) ? data.results : [];

                grid.innerHTML = "";

                if (!list.length) {
                    grid.innerHTML = `<p class="p-1">No results found</p>`;
                    return;
                }

                list.forEach(item => {
                    if (item?.id) grid.appendChild(createCard(item));
                });

            } catch {
                grid.innerHTML = `<p class="p-1" style="color:red;">Search failed</p>`;
            }
        }, 350);
    });
}

/* ----------------------------------------
    INFO PAGE
---------------------------------------- */
async function renderInfo(id) {
    if (!id) {
        container.innerHTML = `<div class="p-1">Invalid ID.</div>`;
        return;
    }

    renderLoader(container);

    try {
        const data = await api.getInfo(id);

        const info = data?.results?.subject || null;
        if (!info) {
            container.innerHTML = `<div class="p-1">Content not found.</div>`;
            return;
        }

        addToHistory({
            id: info.id,
            title: info.title,
            poster: info.poster
        });

        container.innerHTML = `
            <div class="info-header"
                style="background:linear-gradient(to top,#141414 10%,transparent),
                url(${info.poster}) center/cover; height:350px;">
                <div style="position:absolute; bottom:0; padding:20px;">
                    <h1>${info.title}</h1>
                    <p>${info.year || ''} • ${info.rating || ''}</p>
                </div>
            </div>

            <div class="p-1">
                <p>${info.description || "No description available."}</p>

                <div class="flex gap-1 m-1">
                    <button id="playBtn" class="btn">▶ Play</button>
                    <button id="downloadBtn" class="btn btn-secondary">⬇ Download</button>
                </div>
            </div>
        `;

        document.getElementById("playBtn").onclick = () => {
            window.location.hash = `#player/${id}`;
        };

        document.getElementById("downloadBtn").onclick = async () => {
            showToast("Fetching download...", "info");

            const sources = await api.getSources(id);
            const list = Array.isArray(sources?.results) ? sources.results : [];

            if (!list.length) {
                showToast("No download sources found", "error");
                return;
            }

            const best = list[0];
            const url = best?.download_url || best?.url;

            if (!url) {
                showToast("Invalid source", "error");
                return;
            }

            startDownload(info, url);
        };

    } catch (e) {
        container.innerHTML = `<div class="p-1">Error: ${e.message}</div>`;
    }
}

/* ----------------------------------------
    PLAYER PAGE
---------------------------------------- */
async function renderPlayerPage(id, season, episode) {
    container.innerHTML = `<div id="player-mount" style="height:100vh; background:black;"></div>`;
    showToast("Loading stream...", "info");

    try {
        const srcData = await api.getSources(id, season, episode);
        const list = Array.isArray(srcData?.results) ? srcData.results : [];

        if (!list.length) {
            container.innerHTML = `<div class="p-1 center">No Video Sources Found</div>`;
            return;
        }

        const source =
            list.find(s => s.url?.includes(".m3u8")) ||
            list[0];

        if (!source?.url) {
            container.innerHTML = `<div class="p-1 center">Invalid streaming source.</div>`;
            return;
        }

        initPlayer(
            document.getElementById("player-mount"),
            source.url,
            ""
        );

    } catch (e) {
        container.innerHTML = `<div class="p-1 center" style="color:red">Stream Error: ${e.message}</div>`;
    }
}

/* ----------------------------------------
    DOWNLOADS PAGE
---------------------------------------- */
async function renderDownloads() {
    try {
        const items = (await db.getAll()) || [];

        container.innerHTML = `
            <div class="p-1">
                <h2>Downloads</h2>
                ${items.length === 0 ? "<p>No downloads yet.</p>" : ""}
                <div class="media-grid">
                    ${items.map(item => `
                        <div class="card" onclick="playOffline('${item.id}')">
                            <img src="${item.poster}">
                            <div class="card-info">
                                <div class="card-title">${item.title}</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;

        window.playOffline = async id => {
            const all = await db.getAll();
            const item = all.find(i => i.id === id);

            if (!item?.blob) {
                showToast("File missing or corrupted", "error");
                return;
            }

            const url = URL.createObjectURL(item.blob);
            container.innerHTML = `<div id="player-mount" style="height:100vh;"></div>`;
            initPlayer(document.getElementById("player-mount"), url, item.poster);
        };

    } catch (e) {
        container.innerHTML = `<div class="p-1">Error loading downloads: ${e.message}</div>`;
    }
}

/* ----------------------------------------
    LIBRARY PAGE
---------------------------------------- */
async function renderLibrary() {
    const history = state.history || [];

    container.innerHTML = `
        <div class="p-1">
            <h2>Recently Watched</h2>
            ${history.length === 0 ? "<p>No history yet.</p>" : ""}
            <div class="media-grid">
                ${history.map(item => `
                    <div class="card" onclick="location.hash='#info/${item.id}'">
                        <img src="${item.poster}">
                        <div class="card-info"><div class="card-title">${item.title}</div></div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

/* ----------------------------------------
    SETTINGS PAGE
---------------------------------------- */
async function renderSettings() {
    container.innerHTML = `
        <div class="p-1">
            <h2>Settings</h2>
            <button class="btn btn-secondary" onclick="localStorage.clear(); location.reload()">
                Reset App Data
            </button>
            <br><br>
            <p>Version: 1.1.0 (Stable)</p>
        </div>
    `;
}
