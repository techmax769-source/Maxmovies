import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const response = await fetch(`${BASE_URL}${endpoint}`);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(error);
            showToast('Network error. Switching to Mock data.', 'error');
            return this.mockFetch(endpoint); // Fallback
        }
    },

    async search(query, page = 1, type = 'movie') {
        // endpoint: /api/search/{query}?page={page}&type={movie|serie}
        return this.fetch(`/search/${query}?page=${page}&type=${type}`);
    },

    async getInfo(id) {
        // endpoint: /api/info/{id}
        return this.fetch(`/info/${id}`);
    },

    async getSources(id, season = null, episode = null) {
        let url = `/sources/${id}`;
        if (season && episode) {
            url += `?season=${season}&episode=${episode}`;
        }
        return this.fetch(url);
    },

    // ... inside js/api.js

    // Mock Data Handler
    async mockFetch(endpoint) {
        await new Promise(r => setTimeout(r, 500)); // Simulate latency
        
        // FIX: Use standard fetch instead of import assert
        // Note: Paths are relative to index.html, not this js file
        try {
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
            console.error("Mock data missing:", e);
            return {};
        }
        
        return {};
    }
};
