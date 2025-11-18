import { router } from './router.js';
import { toggleMockMode, state } from './state.js';

window.addEventListener('load', router);
window.addEventListener('hashchange', router);

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('SW Registered'))
        .catch(console.error);
}

// Mock Button Logic
const mockBtn = document.getElementById('mockToggleBtn');
mockBtn.style.color = state.mockMode ? 'var(--primary)' : 'white';
mockBtn.onclick = toggleMockMode;
