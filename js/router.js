import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
import { state, addToHistory } from './state.js';

const container = document.getElementById('app-container');

export const router = async () => {

    try { destroyPlayer(); } catch {}

    const hash = window.location.hash.slice(1) || 'home';
    const params = hash.split('/');
    const route = params[0];

    window.scrollTo(0, 0);

    if (route === 'home') return renderHome();
    if (route === 'search') return renderSearch();
    if (route === 'info') return renderInfo(params[1]);
    if (route === 'player') return renderPlayerPage(params[1], params[2], params[3]);
    if (route === 'downloads') return renderDownloads();
    if (route === 'library') return renderLibrary();
    if (route === 'settings') return renderSettings();
};

/* ============================================================
   HOME PAGE
   ============================================================ */
async function renderHome() {
    const gridId = 'trending-grid';
    container.innerHTML = `
        <div class="hero p-1"><h1>Trending Action</h1></div>
        <div id="${gridId}" class="media-grid"></div>
    `;

    const grid = document.getElementById(gridId);
    renderLoader(grid);

    try {
        const data = await api.search('action', 1, 'movie');
        grid.innerHTML = '';

        if (!data?.results?.length) {
            grid.innerHTML = `
                <div class="p-1 text-center" style="grid-column: 1/-1;">
                    <p>No movies found.</p>
                    <button class="btn" onclick="window.location.reload()">Retry</button>
                </div>`;
            return;
        }

        data.results.forEach(item => grid.appendChild(createCard(item)));

    } catch (err) {
        grid.innerHTML = `
            <div class="p-1" style="color: red;">
                <h3>Error loading</h3>
                <p>${err.message}</p>
            </div>`;
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

    const input = document.getElementById('searchInput');
    const grid = document.getElementById('search-results');

    let timeout;

    input.addEventListener('input', e => {
        clearTimeout(timeout);
        const query = e.target.value.trim();
        if (!query) return;

        timeout = setTimeout(async () => {
            renderLoader(grid);
            try {
                const data = await api.search(query);
                grid.innerHTML = '';

                if (data?.results?.length) {
                    data.results.forEach(item => grid.appendChild(createCard(item)));
                } else {
                    grid.innerHTML = `<p class="p-1">No results.</p>`;
                }

            } catch (err) {
                grid.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
            }
        }, 700);
    });
}

/* ============================================================
   INFO PAGE
   ============================================================ */
async function renderInfo(id) {

    renderLoader(container);

    try {
        const raw = await api.getInfo(id);
        const info = raw?.result || raw?.data || raw;

        if (!info) {
            container.innerHTML = `<div class="p-1">Not found.</div>`;
            return;
        }

        const title = info.title || info.name || 'Untitled';
        const desc = info.description || info.plot || 'No description available';

        let poster =
            info.cover?.url ||
            info.thumbnail ||
            info.poster ||
            'assets/placeholder.jpg';

        const year = info.releaseDate ? info.releaseDate.split('-')[0] :
                     info.year || 'N/A';

        const rating = info.imdbRatingValue || info.rating || 'N/A';

        addToHistory({ id, title, poster });

        container.innerHTML = `
            <div class="info-header"
                style="background: linear-gradient(to top,#141414 10%,transparent),
                url(${poster}) center/cover; height: 350px;">
                <div style="position:absolute; bottom:0; padding:20px;">
                    <h1>${title}</h1>
                    <p>${year} • ⭐ ${rating}</p>
                </div>
            </div>

            <div class="p-1">
                <p>${desc}</p>

                <div class="flex gap-1 m-1">
                    <button id="playBtn" class="btn">▶ Play</button>
                    <button id="downloadBtn" class="btn btn-secondary">⬇ Download</button>
                </div>

                ${(info.subjectType === 1) ? `
                    <h3>Episodes</h3>
                    <div class="flex flex-col gap-1">
                        <button class="btn-secondary" onclick="location.hash='#player/${id}/1/1'">
                            Season 1 Episode 1
                        </button>
                    </div>
                ` : ''}
            </div>
        `;

        /* --- PLAY BUTTON --- */
        document.getElementById('playBtn').onclick = () => {
            if (info.subjectType === 1) {
                window.location.hash = `#player/${id}/1/1`;
            } else {
                window.location.hash = `#player/${id}`;
            }
        };

        /* --- DOWNLOAD BUTTON --- */
        document.getElementById('downloadBtn').onclick = async () => {
            showToast('Preparing download...', 'info');

            try {
                const source = await api.getSources(id);

                const best = source.sources?.[source.sources.length - 1];
                if (!best?.download) return showToast('No download link found', 'error');

                startDownload({ id, title, poster }, best.download);

            } catch (e) {
                showToast('Download error', 'error');
            }
        };

    } catch (e) {
        container.innerHTML = `<div class="p-1">Error: ${e.message}</div>`;
    }
}

/* ============================================================
   PLAYER PAGE
   ============================================================ */
async function renderPlayerPage(id, season, episode) {

    container.innerHTML = `
        <div id="player-mount" style="width:100%; height:100vh; background:black;"></div>
    `;

    showToast('Loading stream...', 'info');

    try {
        const data = await api.getSources(id, season, episode);

        const srcList = data.sources || [];
        if (!srcList.length) {
            container.innerHTML = `<div class="center p-1">No sources found</div>`;
            return;
        }

        const chosen = srcList[srcList.length - 1]; // highest quality

        initPlayer(
            document.getElementById('player-mount'),
            chosen.url,
            '',
            data.subtitles || []
        );

    } catch (e) {
        container.innerHTML =
            `<div class="p-1" style="color:red">Stream error: ${e.message}</div>`;
    }
}

/* ============================================================
   DOWNLOADS PAGE
   ============================================================ */
async function renderDownloads() {

    try {
        const items = await db.getAll();
        const list = items || [];

        container.innerHTML = `
            <div class="p-1">
                <h2>Downloads</h2>
                ${list.length === 0 ? '<p>No downloads.</p>' : ''}
                <div class="media-grid">
                    ${list.map(item => `
                        <div class="card" onclick="playOffline('${item.id}')">
                            <img src="${item.poster}">
                            <div class="card-info"><div class="card-title">${item.title}</div></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        window.playOffline = async (id) => {
            const items = await db.getAll();
            const item = items.find(i => i.id === id);

            if (!item?.blob) {
                return showToast('File missing', 'error');
            }

            const url = URL.createObjectURL(item.blob);

            container.innerHTML = `<div id="player-mount" style="height:100vh"></div>`;
            initPlayer(document.getElementById('player-mount'), url, item.poster);
        };

    } catch (e) {
        container.innerHTML = `<div class="p-1">Error: ${e.message}</div>`;
    }
}

/* ============================================================
   LIBRARY PAGE
   ============================================================ */
async function renderLibrary() {

    const history = state.history || [];

    container.innerHTML = `
        <div class="p-1">
            <h2>Recently Watched</h2>
            ${history.length === 0 ? '<p>No history yet.</p>' : ''}
            <div class="media-grid">
                ${history.map(item => `
                    <div class="card" onclick="location.hash='#info/${item.id}'">
                        <img src="${item.poster}">
                        <div class="card-info"><div class="card-title">${item.title}</div></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/* ============================================================
   SETTINGS PAGE
   ============================================================ */
async function renderSettings() {
    container.innerHTML = `
        <div class="p-1">
            <h2>Settings</h2>
            <button class="btn btn-secondary" onclick="localStorage.clear(); location.reload()">Reset App</button>
            <br><br>
            <p>Version: 1.6 (GiftedTech API Ready)</p>
        </div>
    `;
}
