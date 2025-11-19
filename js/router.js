import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
// FIX 1: Import 'state' directly at the top so we don't mess up imports later
import { state, addToHistory } from './state.js'; 

const container = document.getElementById('app-container');

export const router = async () => {
    try {
        destroyPlayer(); 
    } catch (e) { console.log('Player cleanup ignored'); }

    const hash = window.location.hash.slice(1) || 'home';
    const params = hash.split('/');
    const route = params[0];

    window.scrollTo(0,0);

    if (route === 'home') return renderHome();
    if (route === 'search') return renderSearch();
    if (route === 'info') return renderInfo(params[1]);
    if (route === 'player') return renderPlayerPage(params[1], params[2], params[3]);
    if (route === 'downloads') return renderDownloads();
    if (route === 'library') return renderLibrary();
    if (route === 'settings') return renderSettings();
};

// --- Page Renderers ---

async function renderHome() {
    const gridId = 'trending-grid';
    container.innerHTML = `
        <div class="hero p-1"><h1>Trending Now</h1></div>
        <div id="${gridId}" class="media-grid"></div>
    `;
    renderLoader(document.getElementById(gridId));

    try {
        const data = await api.search('action', 1, 'movie'); 
        const grid = document.getElementById(gridId);
        grid.innerHTML = ''; 

        if (!data || !data.results || data.results.length === 0) {
            grid.innerHTML = `
                <div class="p-1 text-center" style="grid-column: 1/-1;">
                    <p>No content found.</p>
                    <button class="btn" onclick="window.location.reload()">Retry Connection</button>
                </div>
            `;
            return;
        }

        data.results.forEach(item => grid.appendChild(createCard(item)));
    } catch (err) {
        console.error("Render Error:", err);
        document.getElementById(gridId).innerHTML = '<p class="p-1">App Error. See console.</p>';
    }
}

async function renderSearch() {
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
            if (!query) return;
            
            const grid = document.getElementById('search-results');
            renderLoader(grid);
            
            const data = await api.search(query);
            grid.innerHTML = '';
            
            if(data.results) {
                data.results.forEach(item => grid.appendChild(createCard(item)));
            } else {
                grid.innerHTML = '<p>No results found</p>';
            }
        }, 500); 
    });
}

async function renderInfo(id) {
    renderLoader(container);
    const info = await api.getInfo(id);
    
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
        if(info.type === 'movie' || !info.type) window.location.hash = `#player/${id}`;
    };

    document.getElementById('downloadBtn').onclick = async () => {
        showToast('Fetching source...', 'info');
        const source = await api.getSources(id);
        if(source.sources && source.sources.length > 0) {
            startDownload({id: info.id, title: info.title, poster: info.poster}, source.sources[0].url);
        } else {
            showToast('No download source found', 'error');
        }
    };
}

async function renderPlayerPage(id, season, episode) {
    container.innerHTML = `<div id="player-mount" style="width:100%; height:100vh; background:black;"></div>`;
    showToast('Loading Stream...', 'info');
    
    const sources = await api.getSources(id, season, episode);
    
    if (!sources.sources || !sources.sources.length) {
        container.innerHTML = '<div class="p-1 center" style="height:100vh">No Video Sources Found</div>';
        return;
    }

    const hlsSource = sources.sources.find(s => s.url.includes('.m3u8')) || sources.sources[0];
    initPlayer(document.getElementById('player-mount'), hlsSource.url, '');
}

async function renderDownloads() {
    const items = await db.getAll();
    // FIX 2: Added (items || []) to prevent crash if items is undefined
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
        const items = await db.getAll();
        const item = items.find(i => i.id === id);
        if(item && item.blob) {
            const url = URL.createObjectURL(item.blob);
            container.innerHTML = `<div id="player-mount" style="height:100vh"></div>`;
            initPlayer(document.getElementById('player-mount'), url, item.poster);
        } else {
            showToast('File corrupted', 'error');
        }
    };
}

async function renderLibrary() {
    // FIX 3: Removed incorrect dynamic import. Using the top-level 'state' import.
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

async function renderSettings() {
    container.innerHTML = `
        <div class="p-1">
            <h2>Settings</h2>
            <button class="btn btn-secondary" onclick="localStorage.clear(); location.reload()">Reset App Data</button>
        </div>
    `;
}
