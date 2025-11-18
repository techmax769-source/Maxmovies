export const state = {
    mockMode: localStorage.getItem('mockMode') === 'true',
    settings: JSON.parse(localStorage.getItem('settings')) || {
        quality: 'auto',
        lang: 'en',
        dataSaver: false
    },
    watchlist: JSON.parse(localStorage.getItem('watchlist')) || [],
    history: JSON.parse(localStorage.getItem('history')) || []
};

export const toggleMockMode = () => {
    state.mockMode = !state.mockMode;
    localStorage.setItem('mockMode', state.mockMode);
    window.location.reload();
};

export const addToHistory = (item) => {
    state.history = [item, ...state.history.filter(i => i.id !== item.id)].slice(0, 20);
    localStorage.setItem('history', JSON.stringify(state.history));
};
