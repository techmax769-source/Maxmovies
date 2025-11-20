import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = 'https://movieapi.giftedtech.co.ke/api';

export const api = {
    /*********************
     *  BASE FETCH
     *********************/
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`API Error ${response.status}`);

            const data = await response.json();

            // Convert GiftedTech API into predictable structure
            return this.normalizeResponse(endpoint, data);

        } catch (error) {
            console.warn("Network timeout → Using mock mode", error);
            showToast("Network slow. Switched to Offline Mode.", "error");
            return this.mockFetch(endpoint);
        }
    },

    /*********************
     *  NORMALIZER
     *********************/
    normalizeResponse(endpoint, data) {
        try {
            // ------------------------
            // ⭐ REAL API STRUCTURE ⭐
            // ------------------------
            //
            // Search:
            // data.results.items = [...]
            //
            // Info:
            // data.results.subject = {...}
            //
            // Sources:
            // data.results = [...]
            //

            // --- SEARCH ---
            if (endpoint.includes('/search')) {
                const items =
                    data?.results?.items ??
                    data?.results ??
                    [];

                return {
                    results: Array.isArray(items) ? items : []
                };
            }

            // --- INFO ---
            if (endpoint.includes('/info')) {
                const subject =
                    data?.results?.subject ??
                    data?.subject ??
                    {};

                return {
                    results: { subject }
                };
            }

            // --- SOURCES ---
            if (endpoint.includes('/sources')) {
                const list =
                    data?.results ??
                    data?.sources ??
                    [];

                return {
                    results: Array.isArray(list) ? list : []
                };
            }

        } catch (e) {
            console.error("Normalize failed:", e);
        }

        return { results: [] };
    },

    /*********************
     *  PUBLIC API
     *********************/
    async search(query, page = 1, type = "movie") {
        return this.fetch(`/search/${query}?page=${page}&type=${type}`);
    },

    async getInfo(id) {
        return this.fetch(`/info/${id}`);
    },

    async getSources(id, season = null, episode = null) {
        let url = `/sources/${id}`;
        if (season && episode) url += `?season=${season}&episode=${episode}`;
        return this.fetch(url);
    },

    /*********************
     *  MOCK FALLBACK
     *********************/
    async mockFetch(endpoint) {
        await new Promise(r => setTimeout(r, 300));

        try {
            // --- SEARCH ---
            if (endpoint.includes('/search')) {
                const res = await fetch('./mock/search.json');
                const j = await res.json();

                const items =
                    j?.results?.items ??
                    j?.results ??
                    j?.data ??
                    (Array.isArray(j) ? j : []);

                return {
                    results: Array.isArray(items) ? items : []
                };
            }

            // --- INFO ---
            if (endpoint.includes('/info')) {
                const res = await fetch('./mock/info.json');
                const j = await res.json();

                const subject =
                    j?.results?.subject ??
                    j ??
                    {};

                return { results: { subject } };
            }

            // --- SOURCES ---
            if (endpoint.includes('/sources')) {
                const res = await fetch('./mock/sources.json');
                const j = await res.json();

                const list =
                    j?.results ??
                    j?.sources ??
                    (Array.isArray(j) ? j : []);

                const clean = list.map(s => ({
                    ...s,
                    download_url: s.download_url || s.url || ""
                }));

                return { results: clean };
            }

        } catch (e) {
            console.error("Mock load failed:", e);
            return { results: [] };
        }

        return { results: [] };
    }
};
