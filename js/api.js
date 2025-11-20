import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            return data;

        } catch (error) {
            console.warn('API Error, switching to fallback:', error);
            showToast('Connection unstable. Check internet.', 'error');
            return this.mockFetch(endpoint);
        }
    },

    async search(query, page = 1, type = 'movie') {
        // 1. Fetch raw data
        const data = await this.fetch(`/search/${query}?page=${page}&type=${type}`);
        
        // 2. ADAPTER: Fix GiftedTech JSON Structure
        // The API puts movies inside data.results.items, but our app expects data.results to be the array.
        if (data && data.results && data.results.items) {
            return { results: data.results.items };
        }
        
        return data; // Return as is if structure is different
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
        } catch (e) {
            return {};
        }
    }
};
