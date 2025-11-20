import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            // 15s timeout for slow networks
            const timeoutId = setTimeout(() => controller.abort(), 15000); 

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();

        } catch (error) {
            console.warn('API Failed:', error);
            // Only show error toast if it's not an auto-fetch
            if(!endpoint.includes('auto')) showToast('Connection issue. Using Offline Data.', 'error');
            return this.mockFetch(endpoint);
        }
    },

    // --- 1. SEARCH ADAPTER ---
    async search(query, page = 1, type = 'movie') {
        // Using the standard endpoint provided in your logs
        const data = await this.fetch(`/search/${query}?page=${page}&type=${type}`);
        
        // Fix based on your snippet: data.results.items
        if (data && data.results && Array.isArray(data.results.items)) {
            return { 
                results: data.results.items.map(item => this.normalizeItem(item))
            };
        }
        return data;
    },

    // --- 2. INFO ADAPTER ---
    async getInfo(id) {
        const data = await this.fetch(`/info/${id}`);

        // Fix based on your snippet: data.results.subject
        if (data && data.results && data.results.subject) {
            return this.normalizeItem(data.results.subject);
        }
        
        return data;
    },

    // --- 3. SOURCES ADAPTER ---
    async getSources(id, season = null, episode = null) {
        let url = `/sources/${id}`;
        if (season && episode) {
            url += `?season=${season}&episode=${episode}`;
        }
        return this.fetch(url);
    },

    // --- HELPER: Standardizes "GiftedTech" weird data to "MaxMovies" format ---
    normalizeItem(item) {
        // 1. Fix Image (Check cover.url first, as seen in your logs)
        let img = 'assets/placeholder.jpg';
        if (item.cover && item.cover.url) img = item.cover.url;
        else if (item.thumbnail) img = item.thumbnail;
        else if (item.poster) img = item.poster;

        // 2. Fix ID (Use subjectId)
        const finalId = item.subjectId || item.id;

        // 3. Fix Year (2025-11-05 -> 2025)
        let finalYear = 'N/A';
        if (item.releaseDate) finalYear = item.releaseDate.split('-')[0];
        else if (item.year) finalYear = item.year;

        // 4. Fix Type
        const finalType = (item.subjectType === 1 || item.type === 'series') ? 'series' : 'movie';

        return {
            id: finalId,
            title: item.title || 'Untitled',
            year: finalYear,
            type: finalType,
            poster: img,
            description: item.description || item.plot || '',
            rating: item.imdbRatingValue || item.rating || 'N/A'
        };
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
