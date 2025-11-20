/* ============================================================
   TOAST SYSTEM — Improved Animation + Safer DOM
============================================================ */
export const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.style.cssText = `
        background: ${type === 'error' ? '#d32f2f' : '#222'};
        color: #fff;
        padding: 12px 20px;
        margin: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        font-size: 14px;
        animation: toastFadeIn 0.25s ease-out;
        opacity: 1;
        transition: opacity 0.35s ease;
        z-index: 9999;
    `;

    toast.innerText = message;
    container.appendChild(toast);

    // Auto-hide
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 350);
    }, 2500);
};


/* ============================================================
   CARD COMPONENT — Final GiftedMovie Version
============================================================ */
export const createCard = (item) => {
    const div = document.createElement('div');
    div.className = 'card';

    // GiftedMovie uses "poster" for image
    let imgUrl = item.poster;

    // Fallback image
    if (!imgUrl || imgUrl === "N/A" || imgUrl.trim() === "") {
        imgUrl = "https://via.placeholder.com/300x450?text=No+Image";
    }

    div.innerHTML = `
        <div class="card-img-wrapper">
            <img class="card-img"
                 src="${imgUrl}"
                 loading="lazy"
                 alt="${item.title || 'Untitled'}"
                 onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=Image+Error';">
        </div>

        <div class="card-info">
            <div class="card-title">${item.title || "Untitled"}</div>
            <div class="card-year">${item.year || ""}</div>
        </div>
    `;

    // Navigate to info page
    if (item.id) {
        div.onclick = () => {
            window.location.hash = `#info/${item.id}`;
        };
    }

    return div;
};


/* ============================================================
   LOADER — Centered Spinner
============================================================ */
export const renderLoader = (container) => {
    if (!container) return;

    container.innerHTML = `
        <div class="loader-container">
            <div class="loader-circle"></div>
        </div>
    `;
};
