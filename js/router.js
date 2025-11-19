import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
// FIX: Import state correctly to avoid undefined history errors
import { state, addToHistory } from './state.js'; 

const container = document.getElementById('app-container');

export const router = async () => {
    // Try to cleanup video player when switching pages
    try {
        destroyPlayer(); 
    } catch (e) { 
        console.log('Player cleanup ignored'); 
    }

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

        // FIX: Strict check to ensure data.results is actually an Array (List)
        // This prevents "data.results.forEach is not a function" error
        if (!data || !data.results || !Array.isArray(data.results) || data.results.length === 0) {
            console.warn("API returned invalid data:", data);
            grid.innerHTML = `
                <div class="p-1 text-center" style="grid-column: 1/-1;">
                    <p>No content found.</p>
                    <small style="color:gray">Try clicking the Satellite 📡 icon.</small>
                    <br><br>
                    <button class="btn" onclick="window.location.reload()">Retry</button>
                </div>
            `;
            return;
        }

        data.results.forEach(item => grid.appendChild(createCard(item)));

    } catch (err) {
        console.error("Render Error:", err);
        // PRINT ERROR ON SCREEN FOR MOBILE DEBUGGING
        document.getElementById(gridId).innerHTML = `
            <div class="p-1" style="color: red; word-break: break-all;">
                <h3>❌ Error</h3>
                <p>${err.message}</p>
            </div>
        `;
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
            
            try {
                const data = await api.search(query);
                grid.innerHTML = '';
                
                if(data && data.results && Array.isArray(data.results) && data.results.length > 0) {
                    data.results.forEach(item => grid.appendChild(createCard(item)));
                } else {
                    grid.innerHTML = '<p class="p-1">No results found</p>';
                }
            } catch (err) {
                grid.innerHTML = '<p class="p-1" style="color:red">Search failed</p>';
            }
        }, 500); 
    });
}

async function renderInfo(id) {
    renderLoader(container);
    try {
        const info = await api.getInfo(id);
        
        if (!info || !info.id) {
            container.innerHTML = '<div class="p-1 text-center">Content not found or API Error</div>';
            return;
        }

        addToHistory({ id: info.id, title: info.title, poster: info.poster });

        const bgImage = info.poster || '';
        
        container.innerHTML = `
            <div class="info-header" style="background: linear-gradient(to top, #141414 10%, transparent), url(${bgImage}) center/cover; height: 350px; position: relative;">
                <div style="position:absolute; bottom:0; width:100%; padding: 20px;">
                    <h1>${info.title || 'Unknown Title'}</h1>
                    <p>${info.year || ''} • ${info.rating || ''}</p>
                </div>
            </div>
            <div class="p-1">
                <p>${info.description || 'No description available.'}</p>
                <div class="flex gap-1 m-1">
                    <button id="playBtn" class="btn">▶ Play</button>
                    <button id="downloadBtn" class="btn btn-secondary">⬇ Download</button>
                </div>
                
                ${(info.type === 'TV Series' || info.type === 'series') ? `
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
            try {
                const source = await api.getSources(id);
                if(source && source.sources && source.sources.length > 0) {
                    startDownload({id: info.id, title: info.title, poster: info.poster}, source.sources[0].url);
                } else {
                    showToast('No download source found', 'error');
                }
            } catch (e) {
                showToast('Error fetching download source', 'error');
            }
        };
    } catch (e) {
        container.innerHTML = `<div class="p-1">Error loading info: ${e.message}</div>`;
    }
}

async function renderPlayerPage(id, season, episode) {
    container.innerHTML = `<div id="player-mount" style="width:100%; height:100vh; background:black;"></div>`;
    showToast('Loading Stream...', 'info');
    
    try {
        const sources = await api.getSources(id, season, episode);
        
        if (!sources || !sources.sources || !sources.sources.length) {
            container.innerHTML = '<div class="p-1 center" style="height:100vh">No Video Sources Found</div>';
            return;
        }

        const hlsSource = sources.sources.find(s => s.url.includes('.m3u8')) || sources.sources[0];
        initPlayer(document.getElementById('player-mount'), hlsSource.url, '');
    } catch (e) {
        container.innerHTML = `<div class="p-1 center" style="height:100vh; color:red">Stream Error: ${e.message}</div>`;
    }
}

async function renderDownloads() {
    try {
        const items = await db.getAll();
        // FIX: Safe check (items || []) to prevent map error
        const safeItems = items || [];

        container.innerHTML = `
            <div class="p-1">
                <h2>Downloads</h2>
                ${safeItems.length === 0 ? '<p>No downloads yet.</p>' : ''}
                <div class="media-grid">
                    ${safeItems.map(item => `
                        <div class="card" onclick="playOffline('${item.id}')">
                            <img src="${item.poster}" style="opacity:0.7">
                            <div class="card-info"><div class="card-title">${item.title}</div></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        window.playOffline = async (id) => {
            const allItems = await db.getAll();
            const item = allItems.find(i => i.id === id);
            if(item && item.blob) {
                const url = URL.createObjectURL(item.blob);
                container.innerHTML = `<div id="player-mount" style="height:100vh"></div>`;
                initPlayer(document.getElementById('player-mount'), url, item.poster);
            } else {
                showToast('File corrupted or missing', 'error');
            }
        };
    } catch (e) {
        container.innerHTML = `<div class="p-1">Error loading downloads: ${e.message}</div>`;
    }
}

async function renderLibrary() {
    // FIX: Use the state imported at the top, handle undefined history
    const history = state.history || [];

    container.innerHTML = `
        <div class="p-1">
            <h2>Recently Watched</h2>
            ${history.length === 0 ? '<p>No history yet.</p>' : ''}
            <div class="media-grid">
                 ${history.map(item => `
                    <div class="card" onclick="location.hash='#info/${item.id}'">
                        <img src="${item.poster || ''}">
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
            <br><br>
            <p>Version: 1.1.0 (Fixed)</p>
        </div>
    `;
}
