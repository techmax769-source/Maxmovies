import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();

        } catch (error) {
            console.warn('API Error, switching to fallback:', error);
            showToast('Connection unstable. Using Offline Data.', 'error');
            return this.mockFetch(endpoint);
        }
    },

    async search(query, page = 1, type = 'movie') {
        // Fetch raw data
        const data = await this.fetch(`/search/${query}?page=${page}&type=${type}`);
        
        // --- CRITICAL FIX BASED ON YOUR LOG ---
        // The log showed: { results: { items: [ ... ] } }
        if (data && data.results && Array.isArray(data.results.items)) {
            // We map the data to a standard format our app understands
            return { 
                results: data.results.items.map(item => ({
                    id: item.id || item.url, // Fallback if ID is missing
                    title: item.title,
                    year: item.year || item.release_date,
                    type: type,
                    // Try ALL common names for posters
                    poster: item.poster || item.poster_path || item.image || item.img || item.thumbnail,
                    rating: item.rating || 'N/A'
                }))
            };
        }
        
        return data;
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

    async mockFetch(endpoint) {
        await new Promise(r => setTimeout(r, 500));
        try {
            if (endpoint.includes('/search')) return await (await fetch('./mock/search.json')).json();
            if (endpoint.includes('/info')) return await (await fetch('./mock/info.json')).json();
            if (endpoint.includes('/sources')) return await (await fetch('./mock/sources.json')).json();
        } catch (e) { return {}; }
    }
};
