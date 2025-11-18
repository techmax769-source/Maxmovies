import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    async fetch(endpoint) {
        // 1. If Mock Mode is ON, skip the network entirely
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            // 2. Add a 5-second timeout. 
            // If the API doesn't answer in 5s, we cancel it and show mock data.
            // This fixes the "Blank Screen" issue on slow connections.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId); // Clear timeout if successful

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();

        } catch (error) {
            console.warn('Network error or Timeout. Switching to Mock data.', error);
            showToast('Network issue. Switched to Offline Mode.', 'error');
            return this.mockFetch(endpoint); // Automatic Fallback
        }
    },

    async search(query, page = 1, type = 'movie') {
        return this.fetch(`/search/${query}?page=${page}&type=${type}`);
    },

    async getInfo(id) {
        return this.fetch(`/info/${id}`);
    },

    async getSources(id, season = null, episode = null) {
        let url = `/sources/${id}`;
        if (season && episode) {
            url += `?season=${season}&episode=${episode}`;
        }
        return this.fetch(url);
    },

    // FIXED MOCK DATA HANDLER
    async mockFetch(endpoint) {
        // Simulate a short loading delay so you see the skeleton loader
        await new Promise(r => setTimeout(r, 500)); 
        
        try {
            // We check the requested endpoint and return the local JSON file
            // Note: Paths are relative to index.html
            if (endpoint.includes('/search')) {
                const res = await fetch('./mock/search.json');
                return await res.json();
            }
            if (endpoint.includes('/info')) {
                const res = await fetch('./mock/info.json');
                return await res.json();
            }
            if (endpoint.includes('/sources')) {
                const res = await fetch('./mock/sources.json');
                return await res.json();
            }
        } catch (e) {
            console.error("Mock data load failed. Check /mock/ folder.", e);
            return {};
        }
        
        return {};
    }
};
