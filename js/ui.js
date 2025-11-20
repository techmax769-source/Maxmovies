export const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    // Mobile-friendly toast styling
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

export const createCard = (item) => {
    const div = document.createElement('div');
    div.className = 'card';
    
    // IMAGE FIXER: 
    // 1. Check if poster exists
    // 2. If it is 'N/A' or null, use placeholder
    let imgUrl = item.poster;
    if (!imgUrl || imgUrl === 'N/A' || imgUrl === '') {
        imgUrl = 'https://via.placeholder.com/300x450?text=No+Image';
    }

    div.innerHTML = `
        <div style="position: relative; width: 100%; padding-top: 150%;">
            <img src="${imgUrl}" 
                 alt="${item.title}" 
                 loading="lazy" 
                 style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
                 onerror="this.src='https://via.placeholder.com/300x450?text=Error'">
        </div>
        <div class="card-info">
            <div class="card-title">${item.title || 'Untitled'}</div>
            <div class="card-year">${item.year || ''} • ${item.type || 'Movie'}</div>
        </div>
    `;
    
    if (item.id) {
        div.onclick = () => window.location.hash = `#info/${item.id}`;
    }
    return div;
};

export const renderLoader = (container) => {
    if (!container) return;
    container.innerHTML = `
        <div class="flex center w-full" style="height:200px; justify-content:center; align-items:center;">
            <div class="skeleton" style="width:50px; height:50px; border-radius:50%;"></div>
        </div>
    `;
};
