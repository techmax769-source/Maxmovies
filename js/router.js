import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
import { state, addToHistory } from './state.js'; 

const container = document.getElementById('app-container');

export const router = async () => {
    // 1. Cleanup video player when switching pages
    try {
        destroyPlayer(); 
    } catch (e) { 
        console.log('Player cleanup ignored'); 
    }

    // 2. Handle Routing
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
        <div class="hero p-1"><h1>New Releases</h1></div>
        <div id="${gridId}" class="media-grid"></div>
    `;
    renderLoader(document.getElementById(gridId));

    try {
        // Search for "2024" to get recent movies
        // (The API adapter we wrote in api.js handles the nested structure)
        const data = await api.search('2024', 1, 'movie'); 
        const grid = document.getElementById(gridId);
        grid.innerHTML = ''; 

        // STRICT CHECK: Ensure we have a list
        if (!data || !data.results || !Array.isArray(data.results) || data.results.length === 0) {
            console.warn("Home: No data found", data);
            grid.innerHTML = `
                <div class="p-1 text-center" style="grid-column: 1/-1;">
                    <p>No trending content found.</p>
                    <small style="color:gray">Try searching manually.</small>
                    <br><br>
                    <button class="btn" onclick="window.location.reload()">Retry</button>
                </div>
            `;
            return;
        }

        // Render cards
        data.results.forEach(item => grid.appendChild(createCard(item)));

    } catch (err) {
        console.error("Render Error:", err);
        document.getElementById(gridId).innerHTML = `
            <div class="p-1" style="color: red;">
                <h3>Error Loading Home</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

async function renderSearch() {
    container.innerHTML = `
        <div class="p-1">
            <input type="text" id="searchInput" class="search-bar" placeholder="Search movies & series...">
            <div id="search-results" class="media-grid"></div>
        </div>
    `;
    
    const input = document.getElementById('searchInput');
    let timeout;
    
    input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const query = e.target.value.trim();
        
        if (!query) return;

        timeout = setTimeout(async () => {
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
                grid.innerHTML = `<p class="p-1" style="color:red">Search Error: ${err.message}</p>`;
            }
        }, 800); // Debounce 800ms
    });
}

async function renderInfo(id) {
    renderLoader(container);
    try {
        const info = await api.getInfo(id);
        
        if (!info || !info.id) {
            container.innerHTML = '<div class="p-1 text-center">Content details not found.</div>';
            return;
        }

        // Save to History
        addToHistory({ id: info.id, title: info.title, poster: info.poster });

        // Handle background image safely
        const bgImage = (info.poster && info.poster !== 'N/A') ? info.poster : 'https://via.placeholder.com/300x450';
        
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
                        <!-- Add more episodes logic here if API supports it -->
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('playBtn').onclick = () => {
            // If it's a series, default to S1 E1, else just Movie ID
            if(info.type === 'TV Series' || info.type === 'series') {
                window.location.hash = `#player/${id}/1/1`;
            } else {
                window.location.hash = `#player/${id}`;
            }
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
            container.innerHTML = `
                <div class="p-1 center flex-col" style="height:100vh">
                    <p>No Video Sources Found</p>
                    <button class="btn" onclick="history.back()">Go Back</button>
                </div>`;
            return;
        }

        // Priority: M3U8 (HLS) -> MP4 -> First Available
        const hlsSource = sources.sources.find(s => s.url.includes('.m3u8')) || sources.sources[0];
        initPlayer(document.getElementById('player-mount'), hlsSource.url, '');

    } catch (e) {
        container.innerHTML = `<div class="p-1 center" style="height:100vh; color:red">Stream Error: ${e.message}</div>`;
    }
}

async function renderDownloads() {
    try {
        const items = await db.getAll();
        const safeItems = items || [];

        container.innerHTML = `
            <div class="p-1">
                <h2>Downloads</h2>
                ${safeItems.length === 0 ? '<p>No downloaded movies yet.</p>' : ''}
                <div class="media-grid">
                    ${safeItems.map(item => `
                        <div class="card" onclick="playOffline('${item.id}')">
                            <img src="${item.poster || 'assets/placeholder.jpg'}" style="opacity:0.7">
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
            <p>Version: 1.2.0 (Stable)</p>
        </div>
    `;
}
