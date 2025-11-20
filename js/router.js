import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
import { state, addToHistory } from './state.js'; 

const container = document.getElementById('app-container');

export const router = async () => {
    // 1. Cleanup video player when switching pages to save memory
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
        <div class="hero p-1"><h1>Trending Action</h1></div>
        <div id="${gridId}" class="media-grid"></div>
    `;
    renderLoader(document.getElementById(gridId));

    try {
        // We search 'action' because we know this works with your API
        const data = await api.search('action', 1, 'movie'); 
        const grid = document.getElementById(gridId);
        grid.innerHTML = ''; 

        // STRICT CHECK: Ensure we have a list
        if (!data || !data.results || !Array.isArray(data.results) || data.results.length === 0) {
            console.warn("Home: No data found", data);
            grid.innerHTML = `
                <div class="p-1 text-center" style="grid-column: 1/-1;">
                    <p>No movies found.</p>
                    <small style="color:gray">Server might be busy.</small>
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
        // PRINT ERROR ON SCREEN FOR MOBILE DEBUGGING
        document.getElementById(gridId).innerHTML = `
            <div class="p-1" style="color: red; word-break: break-all;">
                <h3>❌ Error Loading Home</h3>
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
        const rawInfo = await api.getInfo(id);
        
        // Some APIs wrap info in 'data' or 'result'
        const info = rawInfo.result || rawInfo.data || rawInfo;

        if (!info) {
            container.innerHTML = '<div class="p-1 text-center">Content details not found.</div>';
            return;
        }

        // --- DATA ADAPTER FOR INFO PAGE ---
        // Maps API fields to UI fields safely
        const title = info.title || info.name || 'Unknown Title';
        const desc = info.description || info.plot || 'No description available.';
        
        // Image Logic: Check cover.url (API), thumbnail, then poster
        let poster = 'assets/placeholder.jpg';
        if (info.cover && info.cover.url) poster = info.cover.url;
        else if (info.thumbnail) poster = info.thumbnail;
        else if (info.poster) poster = info.poster;

        // Year Logic: "2025-11-05" -> "2025"
        let year = info.year || 'N/A';
        if (info.releaseDate) year = info.releaseDate.split('-')[0];

        // Rating Logic
        const rating = info.imdbRatingValue || info.rating || 'N/A';

        // Save to History
        addToHistory({ id: id, title: title, poster: poster });

        container.innerHTML = `
            <div class="info-header" style="background: linear-gradient(to top, #141414 10%, transparent), url(${poster}) center/cover; height: 350px; position: relative;">
                <div style="position:absolute; bottom:0; width:100%; padding: 20px;">
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
                
                ${(info.subjectType === 1 || info.type === 'series') ? `
                    <br><h3>Episodes</h3>
                    <div class="flex flex-col gap-1">
                        <button class="btn-secondary w-full text-center" onclick="location.hash='#player/${id}/1/1'">Season 1 Ep 1</button>
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('playBtn').onclick = () => {
            // Handle Series vs Movie navigation
            // API uses subjectType: 1 = Series, 2 = Movie (usually)
            if(info.subjectType === 1 || info.type === 'series') {
                 window.location.hash = `#player/${id}/1/1`;
            } else {
                 window.location.hash = `#player/${id}`;
            }
        };

        document.getElementById('downloadBtn').onclick = async () => {
            showToast('Fetching source...', 'info');
            try {
                const source = await api.getSources(id);
                // Check 'sources' OR 'results'
                const validSources = source.sources || source.results || [];
                
                if(validSources.length > 0) {
                    // Check 'url' OR 'download_url'
                    const downloadUrl = validSources[0].url || validSources[0].download_url;
                    if(downloadUrl) {
                        startDownload({id: id, title: title, poster: poster}, downloadUrl);
                    } else {
                        showToast('Source URL missing', 'error');
                    }
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
        const validSources = sources.sources || sources.results || [];
        
        if (!validSources || validSources.length === 0) {
            container.innerHTML = `
                <div class="p-1 center flex-col" style="height:100vh">
                    <p>No Video Sources Found</p>
                    <button class="btn" onclick="history.back()">Go Back</button>
                </div>`;
            return;
        }

        // Priority: M3U8 (HLS) -> MP4
        // Check both 'url' and 'download_url' keys
        const hlsSource = validSources.find(s => (s.url || s.download_url).includes('.m3u8')) || validSources[0];
        const finalUrl = hlsSource.url || hlsSource.download_url;

        initPlayer(document.getElementById('player-mount'), finalUrl, '');

    } catch (e) {
        container.innerHTML = `<div class="p-1 center" style="height:100vh; color:red">Stream Error: ${e.message}</div>`;
    }
}

async function renderDownloads() {
    try {
        const items = await db.getAll();
        // FIX: Safe check (items || []) prevents "map" errors
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
    // FIX: Uses imported state safely
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
            <p>Version: 1.4.0 (API Compatible)</p>
        </div>
    `;
}
