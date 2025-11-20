export const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'error' ? '#d32f2f' : '#333'};
        color: white; 
        padding: 12px 20px; 
        margin: 10px; 
        border-radius: 50px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4); 
        animation: fade 0.3s; 
        z-index: 9999;
        font-size: 14px;
        text-align: center;
    `;
    
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};


/* ============================================================
   CARD COMPONENT — CLEANED + FIXED FOR GIFTEDTECH API
============================================================ */
export const createCard = (item) => {
    const div = document.createElement('div');
    div.className = 'card';

    // GiftedTech always returns a full image URL in item.poster
    let imgUrl = item.poster;

    // If missing image → fallback placeholder
    if (!imgUrl || imgUrl === 'N/A' || imgUrl.trim() === '') {
        imgUrl = 'https://via.placeholder.com/300x450?text=No+Image';
    }

    div.innerHTML = `
        <div style="position: relative; width: 100%; padding-top: 150%; background: #222;">
            <img src="${imgUrl}"
                 alt="${item.title}"
                 loading="lazy"
                 style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
                 onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=Image+Error'">
        </div>
        <div class="card-info">
            <div class="card-title">${item.title || 'Untitled'}</div>
            <div class="card-year">${item.year || ''}</div>
        </div>
    `;

    // Clicking -> navigate to info page
    if (item.id) {
        div.onclick = () => {
            window.location.hash = `#info/${item.id}`;
        };
    }

    return div;
};


/* ============================================================
   LOADER SPINNER
============================================================ */
export const renderLoader = (container) => {
    if (!container) return;
    container.innerHTML = `
        <div class="flex center w-full" style="height:200px; justify-content:center; align-items:center;">
            <div class="skeleton" style="width:50px; height:50px; border-radius:50%;"></div>
        </div>
    `;
};
