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
   HOME
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
   SEARCH
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
   INFO PAGE
   ============================================================ */
async function renderInfo(id) {
    renderLoader(container);

    try {
        const info = await api.getInfo(id);

        if (!info) {
            container.innerHTML = `<div class="p-1">Not found.</div>`;
            return;
        }

        const { title, description, poster, year, rating, type } = info;

        addToHistory({ id, title, poster });

        container.innerHTML = `
            <div class="info-header"
                style="
                    background: linear-gradient(to bottom, rgba(0,0,0,0.3), var(--dark)),
                    url(${poster}) center/cover;
                    height: 50vh;">
            </div>

            <div class="info-content">

                <h1 class="movie-title-large">${title}</h1>

                <div class="movie-meta">
                    <span>${year}</span>
                    <span>•</span>
                    <span style="color: gold;">★ ${rating}</span>
                    <span>•</span>
                    <span>${type === "series" ? "TV Series" : "Movie"}</span>
                </div>

                <div class="action-buttons">
                    <button id="playBtn" class="btn btn-lg">▶ Play</button>
                    <button id="downloadBtn" class="btn btn-secondary btn-lg">⬇ Download</button>
                </div>

                <p class="movie-description">${description}</p>

                ${
                    type === "series"
                        ? `
                        <div style="margin-top: 2rem;">
                            <h3>Episodes</h3>
                            <div id="episodes" class="flex-col" style="margin-top: 1rem;"></div>
                        </div>`
                        : ""
                }
            </div>
        `;

        /* === Load Episodes for Series === */
        if (type === "series") {
            const epsDiv = document.getElementById("episodes");
            const sourceData = await api.getSources(id);

            if (!Array.isArray(sourceData)) {
                epsDiv.innerHTML = "<p>No episodes available.</p>";
                return;
            }

            sourceData.forEach(season => {
                season.episodes.forEach(ep => {
                    const btn = document.createElement("button");
                    btn.className = "btn-secondary";
                    btn.textContent = `S${season.season} • E${ep.episode} — ${ep.title}`;
                    btn.onclick = () =>
                        (location.hash = `#player/${id}/${season.season}/${ep.episode}`);
                    epsDiv.appendChild(btn);
                });
            });
        }

        /* Play Button */
        document.getElementById("playBtn").onclick = () => {
            if (type === "series") {
                location.hash = `#player/${id}/1/1`;
            } else {
                location.hash = `#player/${id}`;
            }
        };

        /* Download Button */
        document.getElementById("downloadBtn").onclick = async () => {
            showToast("Fetching download link...", "info");

            const sources = await api.getSources(id);

            // movie mode
            const movie = Array.isArray(sources.sources)
                ? sources.sources.slice(-1)[0]
                : null;

            const best = movie?.download || movie?.stream;

            if (!best) return showToast("No download link available.", "error");

            startDownload({ id, title, poster }, best);
        };

    } catch (err) {
        container.innerHTML = `<p class="p-1">${err.message}</p>`;
    }
}

/* ============================================================
   PLAYER (Supports Series, Subtitles, Movies)
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
            const s = data.find(x => x.season == season);
            const ep = s?.episodes?.find(e => e.episode == episode);
            selected = ep?.streams?.slice(-1)[0];
        } else {
            selected = data.sources?.slice(-1)[0];
        }

        if (!selected) {
            container.innerHTML = `<p class="p-1 center">No streaming source found.</p>`;
            return;
        }

        initPlayer(
            document.getElementById("player-mount"),
            selected.url,
            "",
            selected.subtitles || []
        );

    } catch (err) {
        container.innerHTML = `<p class="p-1" style="color:red">Stream error: ${err.message}</p>`;
    }
}

/* ============================================================
   DOWNLOADS
   ============================================================ */
async function renderDownloads() {
    const list = await db.getAll();

    container.innerHTML = `
        <div class="p-1">
            <h2>Downloads</h2>
            ${!list.length ? "<p>No downloads.</p>" : ""}
            <div class="media-grid">
                ${list
                    .map(
                        i => `
                    <div class="card" onclick="playOffline('${i.id}')">
                        <img src="${i.poster}">
                        <div class="card-info"><div class="card-title">${i.title}</div></div>
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

        if (!item?.blob) return showToast("Download broken", "error");

        const url = URL.createObjectURL(item.blob);
        container.innerHTML = `<div id="player-mount" style="height:100vh"></div>`;
        initPlayer(document.getElementById("player-mount"), url, item.poster);
    };
}

/* ============================================================
   LIBRARY
   ============================================================ */
function renderLibrary() {
    const items = state.history || [];

    container.innerHTML = `
        <div class="p-1">
            <h2>Recently Watched</h2>
            ${!items.length ? "<p>No history found.</p>" : ""}
            <div class="media-grid">
                ${items
                    .map(
                        i => `
                    <div class="card" onclick="location.hash='#info/${i.id}'">
                        <img src="${i.poster}">
                        <div class="card-info"><div class="card-title">${i.title}</div></div>
                    </div>
                `
                    )
                    .join("")}
            </div>
        </div>
    `;
}

/* ============================================================
   SETTINGS
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
