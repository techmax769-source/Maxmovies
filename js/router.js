import { api } from './api.js';
import { ui } from './ui.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
import { addToHistory } from './state.js';

const container = document.getElementById('app-container');

export const router = async () => {
    destroyPlayer(); // Cleanup player if leaving page
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
    container.innerHTML = `
        <div class="hero p-1"><h1>Trending Now</h1></div>
        <div id="trending-grid" class="media-grid"></div>
    `;
    
    renderLoader(document.getElementById('trending-grid'));
    const data = await api.search('action', 1, 'movie'); // Default discovery
    
    const grid = document.getElementById('trending-grid');
    grid.innerHTML = '';
    data.results?.forEach(item => grid.appendChild(createCard(item)));
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
            const data = await api.search(query);
            const grid = document.getElementById('search-results');
            grid.innerHTML = '';
            data.results?.forEach(item => grid.appendChild(createCard(item)));
        }, 500); // Debounce
    });
}

async function renderInfo(id) {
    renderLoader(container);
    const info = await api.getInfo(id);
    
    if (!info.id) {
        container.innerHTML = '<div class="p-1 text-center">Content not found</div>';
        return;
    }

    addToHistory({ id: info.id, title: info.title, poster: info.poster });

    container.innerHTML = `
        <div class="info-header" style="background: url(${info.poster}) center/cover; height: 300px; position: relative;">
            <div style="position:absolute; bottom:0; background: linear-gradient(to top, #141414, transparent); width:100%; padding: 20px;">
                <h1>${info.title}</h1>
                <p>${info.year} • ${info.rating}</p>
            </div>
        </div>
        <div class="p-1">
            <p>${info.description}</p>
            <div class="flex gap-1 m-1">
                <button id="playBtn" class="btn">▶ Play</button>
                <button id="downloadBtn" class="btn btn-secondary">⬇ Download</button>
            </div>
            
            ${info.type === 'TV Series' ? `
                <h3>Episodes</h3>
                <div id="episodes-list" class="flex flex-col gap-1">
                     <!-- Logic to list seasons/episodes would go here -->
                     <button class="btn-secondary w-full text-center" onclick="location.hash='#player/${id}/1/1'">Season 1 Ep 1</button>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('playBtn').onclick = () => {
        if(info.type === 'movie') window.location.hash = `#player/${id}`;
        // Series logic handles clicking episodes
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
    container.innerHTML = `<div id="player-mount"></div>`;
    const sources = await api.getSources(id, season, episode);
    
    if (!sources.sources || !sources.sources.length) {
        container.innerHTML = '<div class="p-1">No Video Sources Found</div>';
        return;
    }

    // Prefer HLS, fallback to MP4
    const hlsSource = sources.sources.find(s => s.url.includes('.m3u8')) || sources.sources[0];
    
    initPlayer(document.getElementById('player-mount'), hlsSource.url, '');
}

async function renderDownloads() {
    const items = await db.getAll();
    container.innerHTML = `
        <div class="p-1">
            <h2>Downloads</h2>
            ${items.length === 0 ? '<p>No downloads yet.</p>' : ''}
            <div class="media-grid">
                ${items.map(item => `
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
        const url = URL.createObjectURL(item.blob);
        container.innerHTML = `<div id="player-mount"></div>`;
        initPlayer(document.getElementById('player-mount'), url, item.poster);
    };
}

async function renderLibrary() {
    const { history } = await import('./state.js');
    container.innerHTML = `
        <div class="p-1">
            <h2>Recently Watched</h2>
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
            <button class="btn btn-secondary" onclick="localStorage.clear(); location.reload()">Reset App</button>
        </div>
    `;
}
