import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
import { state, addToHistory } from './state.js';

const container = document.getElementById('app-container');

export const router = () => {
    try { destroyPlayer(); } catch {}

    const hash = window.location.hash.slice(1) || "home";
    const [route, p1, p2, p3] = hash.split("/");

    window.scrollTo(0, 0);

    switch (route) {
        case "home": return renderHome();
        case "search": return renderSearch();
        case "info": return renderInfo(p1);
        case "player": return renderPlayerPage(p1, p2, p3);
        case "downloads": return renderDownloads();
        case "library": return renderLibrary();
        case "settings": return renderSettings();
        default: return renderHome();
    }
};

/* ============================================================
   HOME PAGE
   ============================================================ */
async function renderHome() {
    const gridId = "trending-grid";
    container.innerHTML = `
        <div class="hero p-1"><h1>Trending Action</h1></div>
        <div id="${gridId}" class="media-grid"></div>
    `;

    const grid = document.getElementById(gridId);
    renderLoader(grid);

    try {
        const data = await api.search("action");
        grid.innerHTML = "";

        if (!data.results.length) {
            grid.innerHTML = `
                <div class="p-1 text-center" style="grid-column: 1/-1;">
                    <p>No movies found.</p>
                    <button class="btn" onclick="window.location.reload()">Retry</button>
                </div>`;
            return;
        }

        data.results.forEach(item => grid.appendChild(createCard(item)));

    } catch (err) {
        grid.innerHTML = `<p style="color:red">${err.message}</p>`;
    }
}

/* ============================================================
   SEARCH PAGE
   ============================================================ */
async function renderSearch() {
    container.innerHTML = `
        <div class="p-1">
            <input type="text" id="searchInput" class="search-bar" placeholder="Search movies & series...">
            <div id="search-results" class="media-grid"></div>
        </div>
    `;

    const input = document.getElementById("searchInput");
    const grid = document.getElementById("search-results");

    let delay;

    input.addEventListener("input", e => {
        clearTimeout(delay);

        const query = e.target.value.trim();
        if (!query) {
            grid.innerHTML = "";
            return;
        }

        delay = setTimeout(async () => {
            renderLoader(grid);

            const data = await api.search(query);
            grid.innerHTML = "";

            if (!data.results.length) {
                grid.innerHTML = `<p class="p-1">No results found.</p>`;
                return;
            }

            data.results.forEach(item => grid.appendChild(createCard(item)));
        }, 500);
    });
}

/* ============================================================
   INFO PAGE (Updated Layout)
   ============================================================ */
async function renderInfo(id) {
    renderLoader(container);

    try {
        const info = await api.getInfo(id);

        if (!info) {
            container.innerHTML = `<div class="p-1">Movie not found.</div>`;
            return;
        }

        const title = info.title || "Untitled";
        const desc = info.description || "No description available";
        const year = info.year || "N/A";
        const rating = info.rating || "N/A";

        const poster =
            info.poster ||
            info.thumbnail ||
            info.cover?.url ||
            "assets/placeholder.jpg";

        addToHistory({ id, title, poster });

        /* === NEW LAYOUT === */
        container.innerHTML = `
            <div class="info-header"
                style="
                    background: linear-gradient(to bottom, rgba(0,0,0,0.3), var(--dark)),
                    url(${poster}) center/cover;
                    height: 50vh;
                    min-height: 300px;
                    position: relative;">
            </div>

            <div class="info-content">

                <h1 class="movie-title-large">${title}</h1>

                <div class="movie-meta">
                    <span>${year}</span>
                    <span>•</span>
                    <span style="color: gold;">★ ${rating}</span>
                    <span>•</span>
                    <span>${info.type === "series" || info.subjectType === 1 ? "TV Series" : "Movie"}</span>
                </div>

                <div class="action-buttons">
                    <button id="playBtn" class="btn btn-lg">▶ Play</button>
                    <button id="downloadBtn" class="btn btn-secondary btn-lg">⬇ Download</button>
                </div>

                <p class="movie-description">${desc}</p>

                ${
                    info.type === "series" || info.subjectType === 1
                        ? `
                        <div style="margin-top: 2rem;">
                            <h3>Episodes</h3>
                            <div id="episodes" class="flex-col" style="margin-top: 1rem;"></div>
                        </div>`
                        : ""
                }
            </div>
        `;

        /* === EPISODE LOADING (GiftedMovie API) === */
        if (info.type === "series" || info.subjectType === 1) {
            const epsDiv = document.getElementById("episodes");

            const sources = await api.getSources(id);
            const seasons = sources.seasons || [];

            if (seasons.length === 0) {
                epsDiv.innerHTML = "<p>No episodes found.</p>";
            } else {
                seasons.forEach(season => {
                    season.episodes.forEach(ep => {
                        const btn = document.createElement("button");
                        btn.className = "btn-secondary";
                        btn.textContent = `S${season.season} • E${ep.episode} — ${ep.title}`;
                        btn.onclick = () =>
                            (window.location.hash = `#player/${id}/${season.season}/${ep.episode}`);
                        epsDiv.appendChild(btn);
                    });
                });
            }
        }

        /* === PLAY BUTTON === */
        document.getElementById("playBtn").onclick = () => {
            if (info.type === "series") {
                window.location.hash = `#player/${id}/1/1`;
            } else {
                window.location.hash = `#player/${id}`;
            }
        };

        /* === DOWNLOAD BUTTON === */
        document.getElementById("downloadBtn").onclick = async () => {
            showToast("Fetching download link...", "info");

            const data = await api.getSources(id);
            const best = data.sources?.slice(-1)[0];

            if (!best?.download)
                return showToast("No download link available.", "error");

            startDownload({ id, title, poster }, best.download);
        };

    } catch (err) {
        container.innerHTML = `<p class="p-1">Error: ${err.message}</p>`;
    }
}

/* ============================================================
   PLAYER PAGE (Series + Subtitles)
   ============================================================ */
async function renderPlayerPage(id, season, episode) {
    container.innerHTML = `
        <div id="player-mount" style="width:100%; height:100vh; background:black;"></div>
    `;

    showToast("Loading stream...", "info");

    try {
        const data = await api.getSources(id);

        let selected;

        if (season && episode) {
            const s = data.seasons?.find(x => x.season == season);
            const ep = s?.episodes?.find(e => e.episode == episode);
            selected = ep?.streams?.slice(-1)[0];
        } else {
            selected = data.sources?.slice(-1)[0];
        }

        if (!selected) {
            container.innerHTML = `<p class="p-1 center">No streaming source found.</p>`;
            return;
        }

        const subtitles = selected.subtitles || [];

        initPlayer(
            document.getElementById("player-mount"),
            selected.url,
            "",
            subtitles
        );

    } catch (err) {
        container.innerHTML = `<p class="p-1" style="color:red">Stream error: ${err.message}</p>`;
    }
}

/* ============================================================
   DOWNLOADS PAGE
   ============================================================ */
async function renderDownloads() {
    const list = await db.getAll();

    container.innerHTML = `
        <div class="p-1">
            <h2>Downloads</h2>
            ${list.length === 0 ? "<p>No downloads.</p>" : ""}
            <div class="media-grid">
                ${list
                    .map(
                        item => `
                    <div class="card" onclick="playOffline('${item.id}')">
                        <img src="${item.poster}">
                        <div class="card-info"><div class="card-title">${item.title}</div></div>
                    </div>
                `
                    )
                    .join("")}
            </div>
        </div>
    `;

    window.playOffline = async id => {
        const list = await db.getAll();
        const item = list.find(i => i.id === id);

        if (!item?.blob) return showToast("Download corrupted.", "error");

        const url = URL.createObjectURL(item.blob);
        container.innerHTML = `<div id="player-mount" style="height:100vh"></div>`;
        initPlayer(document.getElementById("player-mount"), url, item.poster);
    };
}

/* ============================================================
   LIBRARY PAGE
   ============================================================ */
function renderLibrary() {
    const items = state.history || [];

    container.innerHTML = `
        <div class="p-1">
            <h2>Recently Watched</h2>
            ${items.length === 0 ? "<p>No history recorded.</p>" : ""}
            <div class="media-grid">
                ${items
                    .map(
                        item => `
                    <div class="card" onclick="location.hash='#info/${item.id}'">
                        <img src="${item.poster}">
                        <div class="card-info"><div class="card-title">${item.title}</div></div>
                    </div>
                `
                    )
                    .join("")}
            </div>
        </div>
    `;
}

/* ============================================================
   SETTINGS PAGE
   ============================================================ */
function renderSettings() {
    container.innerHTML = `
        <div class="p-1">
            <h2>Settings</h2>
            <button class="btn btn-secondary" onclick="localStorage.clear(); location.reload()">Reset App</button>
            <br><br>
            <p>Version: 1.6 (GiftedMovie API)</p>
        </div>
    `;
}
