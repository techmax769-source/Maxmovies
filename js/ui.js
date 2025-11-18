export const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'error' ? '#d32f2f' : '#333'};
        color: white; padding: 12px; margin: 10px; border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3); animation: fade 0.3s;
    `;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

export const createCard = (item) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
        <img src="${item.poster || 'assets/placeholder.jpg'}" alt="${item.title}" loading="lazy">
        <div class="card-info">
            <div class="card-title">${item.title}</div>
            <div class="card-year">${item.year || 'N/A'} • ${item.type}</div>
        </div>
    `;
    div.onclick = () => window.location.hash = `#info/${item.id}`;
    return div;
};

export const renderLoader = (container) => {
    container.innerHTML = `<div class="flex center" style="height:200px"><div class="skeleton" style="width:100px; height:100px"></div></div>`;
};
