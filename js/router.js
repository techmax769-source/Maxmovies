import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
import { state, addToHistory } from './state.js';

console.log('%c[Router] Debug build active', 'color: #4af; font-weight: bold');

const container = document.getElementById('app-container');

export const router = async () => {
    console.log('[Router] Triggered. Current hash:', window.location.hash);

    try {
        destroyPlayer();
        console.log('[Router] Player destroyed successfully');
    } catch (e) {
        console.log('[Router] Player cleanup ignored:', e);
    }

    const hash = window.location.hash.slice(1) || 'home';
    const params = hash.split('/');
    const route = params[0];

    console.log('[Router] Route:', route, 'Params:', params);

    window.scrollTo(0, 0);

    try {
        if (route === 'home') return renderHome();
        if (route === 'search') return renderSearch();
        if (route === 'info') return renderInfo(params[1]);
        if (route === 'player') return renderPlayerPage(params[1], params[2], params[3]);
        if (route === 'downloads') return renderDownloads();
        if (route === 'library') return renderLibrary();
        if (route === 'settings') return renderSettings();
    } catch (err) {
        console.error('[Router] Page render failed:', err);
    }
};


// --- UPDATED renderHome (your version) ---

async function renderHome() {
    console.log('[Home] Rendering home page');

    const gridId = 'trending-grid';
    container.innerHTML = `
        <div class="hero p-1"><h1>Trending Now</h1></div>
        <div id="${gridId}" class="media-grid"></div>
    `;
    renderLoader(document.getElementById(gridId));

    try {
        // Fetch data
        console.log('[Home] Fetching trending content...');
        const data = await api.search('action', 1, 'movie');
        console.log('[Home] API Response:', data);

        const grid = document.getElementById(gridId);
        grid.innerHTML = '';

        // --- FIX YOU REQUESTED ---
        if (!data || !data.results || !Array.isArray(data.results) || data.results.length === 0) {
            console.error("Bad Data Received:", data);
            grid.innerHTML = `
                <div class="p-1 text-center" style="grid-column: 1/-1;">
                    <p>No content found.</p>
                    <small style="color:grey">
                        Server returned: ${data && data.results ? typeof data.results : 'Nothing'}
                    </small>
                    <br><br>
                    <button class="btn" onclick="window.location.reload()">Retry</button>
                </div>
            `;
            return;
        }

        // If valid, render results
        data.results.forEach(item => {
            grid.appendChild(createCard(item));
        });

    } catch (err) {
        console.error("Render Error:", err);
        document.getElementById(gridId).innerHTML = `
            <div class="p-1" style="color: red;">
                <h3>Error</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}


// --- Page Renderers (unchanged debug versions) ---

async function renderSearch() {
    console.log('[Search] Render search page');

    container.innerHTML = `
        <div class="p-1">
            <input type="text" id="searchInput" class="search-bar" placeholder="Search movies...">
            <div id="search-results" class="media-grid"></div>
        </div>
    `;

    const input = document.getElementById('searchInput');
    let timeout;

    input.addEventListener('input', (e) => {
        clearTimeout(timeout);

        timeout = setTimeout(async () => {
            const query = e.target.value;
            console.log('[Search] Query:', query);

            if (!query) return;

            const grid = document.getElementById('search-results');
            renderLoader(grid);

            try {
                const data = await api.search(query);
                console.log('[Search] Results:', data);

                grid.innerHTML = '';

                if (data.results) {
                    data.results.forEach(item => grid.appendChild(createCard(item)));
                } else {
                    grid.innerHTML = `<p>No results found</p>`;
                }
            } catch (err) {
                console.error('[Search] Error:', err);
                grid.innerHTML = `<p>Error loading results.</p>`;
            }

        }, 500);
    });
}

async function renderInfo(id) {
    console.log('[Info] Rendering info for ID:', id);

    renderLoader(container);
    try {
        const info = await api.getInfo(id);
        console.log('[Info] API response:', info);

        if (!info || !info.id) {
            container.innerHTML = '<div class="p-1 text-center">Content not found</div>';
            return;
        }

        addToHistory({ id: info.id, title: info.title, poster: info.poster });

        container.innerHTML = `
            <div class="info-header" style="background: linear-gradient(to top, #141414 10%, transparent), url(${info.poster}) center/cover; height: 350px; position: relative;">
                <div style="position:absolute; bottom:0; width:100%; padding: 20px;">
                    <h1>${info.title}</h1>
                    <p>${info.year || ''} • ${info.rating || ''}</p>
                </div>
            </div>
            <div class="p-1">
                <p>${info.description || 'No description available.'}</p>
                <div class="flex gap-1 m-1">
                    <button id="playBtn" class="btn">▶ Play</button>
                    <button id="downloadBtn" class="btn btn-secondary">⬇ Download</button>
                </div>

                ${info.type === 'TV Series' || info.type === 'series' ? `
                    <h3>Episodes</h3>
                    <div class="flex flex-col gap-1">
                         <button class="btn-secondary w-full text-center" onclick="location.hash='#player/${id}/1/1'">Season 1 Ep 1</button>
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('playBtn').onclick = () => {
            console.log('[Info] Play clicked');
            if (info.type === 'movie' || !info.type) {
                window.location.hash = `#player/${id}`;
            }
        };

        document.getElementById('downloadBtn').onclick = async () => {
            console.log('[Info] Download clicked');
            showToast('Fetching source...', 'info');

            const source = await api.getSources(id);
            console.log('[Info] Source response:', source);

            if (source.sources?.length > 0) {
                startDownload(
                    { id: info.id, title: info.title, poster: info.poster },
                    source.sources[0].url
                );
            } else {
                showToast('No download source found', 'error');
            }
        };

    } catch (err) {
        console.error('[Info] Error:', err);
        container.innerHTML = `<p>Error loading info.</p>`;
    }
}

async function renderPlayerPage(id, season, episode) {
    console.log('[Player] Start player with ID:', id, 'Season:', season, 'Episode:', episode);

    container.innerHTML = `<div id="player-mount" style="width:100%; height:100vh; background:black;"></div>`;
    showToast('Loading Stream...', 'info');

    try {
        const sources = await api.getSources(id, season, episode);
        console.log('[Player] Sources:', sources);

        if (!sources.sources || !sources.sources.length) {
            container.innerHTML = '<div class="p-1 center" style="height:100vh">No Video Sources Found</div>';
            return;
        }

        const hlsSource = sources.sources.find(s => s.url.includes('.m3u8')) || sources.sources[0];

        initPlayer(document.getElementById('player-mount'), hlsSource.url, '');

    } catch (err) {
        console.error('[Player] Error:', err);
        container.innerHTML = `<p>Error loading player.</p>`;
    }
}

async function renderDownloads() {
    console.log('[Downloads] Rendering');

    const items = await db.getAll();
    console.log('[Downloads] Items:', items);

    container.innerHTML = `
        <div class="p-1">
            <h2>Downloads</h2>
            ${(!items || items.length === 0) ? '<p>No downloads yet.</p>' : ''}
            <div class="media-grid">
                ${(items || []).map(item => `
                    <div class="card" onclick="playOffline('${item.id}')">
                        <img src="${item.poster}" style="opacity:0.7">
                        <div class="card-info"><div class="card-title">${item.title}</div></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    window.playOffline = async (id) => {
        console.log('[Downloads] Play offline ID:', id);

        const items = await db.getAll();
        const item = items.find(i => i.id === id);

        if (item?.blob) {
            const url = URL.createObjectURL(item.blob);
            container.innerHTML = `<div id="player-mount" style="height:100vh"></div>`;
            initPlayer(document.getElementById('player-mount'), url, item.poster);
        } else {
            console.warn('[Downloads] Corrupted file');
            showToast('File corrupted', 'error');
        }
    };
}

async function renderLibrary() {
    console.log('[Library] Rendering history');

    const history = state.history || [];
    console.log('[Library] History:', history);

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

async function renderSettings() {
    console.log('[Settings] Rendering');

    container.innerHTML = `
        <div class="p-1">
            <h2>Settings</h2>
            <button class="btn btn-secondary" onclick="localStorage.clear(); location.reload()">Reset App Data</button>
        </div>
    `;
}


// --- GLOBAL FAILSAFE DEBUG ERROR HANDLER ---
window.addEventListener('error', (e) => {
    console.error('[Global Error]', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[Global Promise Rejection]', e.reason);
});
