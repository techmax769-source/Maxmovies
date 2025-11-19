import { api } from './api.js';
import { initPlayer, destroyPlayer } from './player.js';
import { startDownload } from './downloads.js';
import { createCard, renderLoader, showToast } from './ui.js';
import { db } from './storage.js';
import { state, addToHistory } from './state.js';

const container = document.getElementById('app-container');

export const router = async () => {
  try { destroyPlayer(); } catch (e) {}

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

    // FIX: Use data.results.items per API documentation
    const list = data &&
      data.results &&
      Array.isArray(data.results.items)
      ? data.results.items
      : [];

    if (!list.length) {
      console.warn("API returned invalid list:", data);
      grid.innerHTML = `
        <div class="p-1 text-center" style="grid-column: 1/-1;">
          <p>No content found.</p>
          <small style="color:gray">Try again or check query.</small>
          <br><br>
          <button class="btn" onclick="window.location.reload()">Retry</button>
        </div>
      `;
      return;
    }

    list.forEach(item => {
      grid.appendChild(createCard(item));
    });

  } catch (err) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = `
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

        const list = data &&
          data.results &&
          Array.isArray(data.results.items)
          ? data.results.items
          : [];

        if (list.length > 0) {
          list.forEach(item => grid.appendChild(createCard(item)));
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
    if (!info || !info.results || !info.results.subject) {
      container.innerHTML = '<div class="p-1 text-center">Content not found or API Error</div>';
      return;
    }

    const subject = info.results.subject;

    addToHistory({ id: subject.subjectId, title: subject.title, poster: subject.cover?.url });

    const bgImage = subject.cover?.url || '';

    container.innerHTML = `
      <div class="info-header" style="background: linear-gradient(to top, #141414 10%, transparent), url(${bgImage}) center/cover; height: 350px; position: relative;">
        <div style="position:absolute; bottom:0; width:100%; padding: 20px;">
          <h1>${subject.title || 'Unknown Title'}</h1>
          <p>${subject.releaseDate || ''}</p>
        </div>
      </div>
      <div class="p-1">
        <p>${subject.description || 'No description available.'}</p>
        <div class="flex gap-1 m-1">
          <button id="playBtn" class="btn">▶ Play</button>
          <button id="downloadBtn" class="btn btn-secondary">⬇ Download</button>
        </div>
      </div>
    `;

    document.getElementById('playBtn').onclick = () => {
      window.location.hash = `#player/${id}`;
    };

    document.getElementById('downloadBtn').onclick = async () => {
      showToast('Fetching source...', 'info');
      try {
        const source = await api.getSources(id);
        if (source && source.results && Array.isArray(source.results)) {
          startDownload({ id: info.id, title: subject.title, poster: subject.cover?.url }, source.results[0].download_url);
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

    const list = sources && Array.isArray(sources.results) ? sources.results : [];

    if (!list.length) {
      container.innerHTML = '<div class="p-1 center" style="height:100vh">No Video Sources Found</div>';
      return;
    }

    const hlsSource = list.find(s => s.download_url && s.download_url.includes('.m3u8')) || list[0];
    initPlayer(document.getElementById('player-mount'), hlsSource.download_url, '');

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
      if (item && item.blob) {
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
      <p>Version: 1.1.0 (Fixed)</p>
    </div>
  `;
}
