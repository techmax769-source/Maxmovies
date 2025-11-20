import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Timeout

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();

        } catch (error) {
            console.warn('API Failed:', error);
            showToast('Connection unstable. Using Offline Data.', 'error');
            return this.mockFetch(endpoint);
        }
    },

    async search(query, page = 1, type = 'movie') {
        // 1. Get Raw Data
        const data = await this.fetch(`/search/${query}?page=${page}&type=${type}`);
        
        // 2. ADAPTER: Translate GiftedTech format to App format
        // API Structure: { results: { items: [ ... ] } }
        if (data && data.results && Array.isArray(data.results.items)) {
            
            const cleanResults = data.results.items.map(item => {
                // IMAGE FIX: Check 'cover.url', then 'thumbnail', then 'poster'
                let finalImage = 'assets/placeholder.jpg';
                if (item.cover && item.cover.url) finalImage = item.cover.url;
                else if (item.thumbnail) finalImage = item.thumbnail;
                else if (item.poster) finalImage = item.poster;

                // ID FIX: Check 'subjectId', then 'id'
                const finalId = item.subjectId || item.id;

                // YEAR FIX: Extract "2025" from "2025-11-05"
                let finalYear = 'N/A';
                if (item.releaseDate) finalYear = item.releaseDate.split('-')[0];
                else if (item.year) finalYear = item.year;

                // TYPE FIX: API uses numbers (2 = movie?)
                // We treat everything as 'movie' unless specified otherwise to be safe
                const finalType = (item.subjectType === 1 || item.type === 'series') ? 'series' : 'movie';

                return {
                    id: finalId,
                    title: item.title || 'Untitled',
                    year: finalYear,
                    type: finalType,
                    poster: finalImage,
                    rating: item.imdbRatingValue || item.rating || 'N/A'
                };
            });

            return { results: cleanResults };
        }
        
        return data;
    },

    async getInfo(id) {
        // The /info endpoint likely returns the same "GiftedTech" structure.
        // We pass it through, but the UI needs to handle the fields.
        const data = await this.fetch(`/info/${id}`);
        
        // If data is wrapped in 'data' or 'result', unwrap it here
        if(data && data.result) return data.result;
        
        return data;
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
