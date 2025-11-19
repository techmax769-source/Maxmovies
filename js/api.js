import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);

            const data = await response.json();
            return data;

        } catch (error) {
            console.warn("Network error, using mock data...");
            showToast("Network issue. Using offline data.", "error");
            return this.mockFetch(endpoint);
        }
    },

    // --- CORRECT DATA CALLS FOR GIFTEDTECH API ---
    async search(query, page = 1, type = "movie") {
        return this.fetch(`/search/${query}?page=${page}&type=${type}`);
    },

    async getInfo(id) {
        return this.fetch(`/info/${id}`);
    },

    async getSources(id, season = null, episode = null) {
        return this.fetch(`/sources/${id}`);
    },

    // --- MOCK DATA (unchanged except paths) ---
    async mockFetch(endpoint) {
        await new Promise(r => setTimeout(r, 400));

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
            console.error("Mock load failed:", e);
            return { results: { items: [] } };
        }

        return { results: { items: [] } };
    }
};
