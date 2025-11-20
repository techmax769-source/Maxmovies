import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    async fetch(endpoint) {
        // If user manually turned on Mock Mode, use it.
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            // Give the API 15 seconds to respond
            const timeoutId = setTimeout(() => controller.abort(), 15000); 

            console.log(`Fetching: ${BASE_URL}${endpoint}`); // Debug log
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();

        } catch (error) {
            console.error('API Failed:', error);
            showToast('Network error. Showing Offline Data.', 'error');
            return this.mockFetch(endpoint); // Fallback to "Cyber Dystopia" if real API fails
        }
    },

    async search(query, page = 1, type = 'movie') {
        // 1. Fetch the raw data from GiftedTech
        const data = await this.fetch(`/search/${query}?page=${page}&type=${type}`);
        
        // 2. CHECK & TRANSLATE (The Fix)
        // The API puts the list inside: data.results.items
        if (data && data.results && Array.isArray(data.results.items)) {
            console.log("GiftedTech Data Found, Translating...");
            return { 
                results: data.results.items.map(item => {
                    // 1. Fix Image
                    let img = 'assets/placeholder.jpg';
                    if (item.cover && item.cover.url) img = item.cover.url;
                    else if (item.thumbnail) img = item.thumbnail;

                    // 2. Fix Year (from "2025-11-05" to "2025")
                    let year = item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A';

                    // 3. Fix Type (API uses numbers: 2=Movie)
                    let mediaType = 'movie';
                    if (item.subjectType === 1) mediaType = 'series';

                    return {
                        id: item.subjectId,   // CRITICAL: Maps subjectId -> id
                        title: item.title,
                        year: year,
                        type: mediaType,
                        poster: img,          // CRITICAL: Maps cover.url -> poster
                        rating: item.imdbRatingValue || 'N/A'
                    };
                })
            };
        }
        
        // If data format is standard (or fallback), return as is
        return data;
    },

    async getInfo(id) {
        // Pass through for now
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
        // This functions loads "Cyber Dystopia" from your local files
        await new Promise(r => setTimeout(r, 500));
        try {
            if (endpoint.includes('/search')) return await (await fetch('./mock/search.json')).json();
            if (endpoint.includes('/info')) return await (await fetch('./mock/info.json')).json();
            if (endpoint.includes('/sources')) return await (await fetch('./mock/sources.json')).json();
        } catch (e) { return {}; }
    }
};
