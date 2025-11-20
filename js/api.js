import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            // Increased timeout to 15s as these APIs can be slow
            const timeoutId = setTimeout(() => controller.abort(), 15000); 

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            return await response.json();

        } catch (error) {
            console.warn('API Error, switching to fallback:', error);
            // Only show toast if it's a real user interaction, not background fetch
            if(!endpoint.includes('auto')) showToast('Connection issue. Using Offline Data.', 'error');
            return this.mockFetch(endpoint);
        }
    },

    async search(query, page = 1, type = 'movie') {
        // 1. Fetch the raw data
        const data = await this.fetch(`/search/${query}?page=${page}&type=${type}`);
        
        // 2. MAP THE DATA (This is where the fix is)
        // Your JSON showed the movies are inside data.results.items
        if (data && data.results && Array.isArray(data.results.items)) {
            return { 
                results: data.results.items.map(item => {
                    // Extract Year from "2025-11-05"
                    let year = 'N/A';
                    if (item.releaseDate) {
                        year = item.releaseDate.split('-')[0];
                    }

                    // Extract Image safely
                    let posterImage = 'assets/placeholder.jpg';
                    if (item.cover && item.cover.url) {
                        posterImage = item.cover.url;
                    } else if (item.thumbnail) {
                        posterImage = item.thumbnail;
                    }

                    return {
                        // MAP 'subjectId' -> 'id'
                        id: item.subjectId || item.id, 
                        
                        // MAP 'title' -> 'title'
                        title: item.title,
                        
                        // MAP 'releaseDate' -> 'year'
                        year: year,
                        
                        // MAP 'subjectType' -> 'type' (Guessing: 2=Movie, 1=Series)
                        type: item.subjectType === 2 ? 'movie' : 'series',
                        
                        // MAP 'cover.url' -> 'poster'
                        poster: posterImage,
                        
                        // MAP 'imdbRatingValue' -> 'rating'
                        rating: item.imdbRatingValue || 'N/A'
                    };
                })
            };
        }
        
        // Fallback for Mock Data or if structure changes
        return data;
    },

    async getInfo(id) {
        // Note: You might need to update this once we see the /info/{id} JSON response
        // For now, we assume it might return similar fields
        const data = await this.fetch(`/info/${id}`);
        
        // If the info response wraps data in 'result' or similar, handle it here
        // returning strictly what the UI expects
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
