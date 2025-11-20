import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = "https://movieapi.giftedtech.co.ke/api";

export const api = {

    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.warn("API Failed:", error);

            if (!endpoint.includes("auto")) {
                showToast("Connection issue. Using Offline Data.", "error");
            }

            return this.mockFetch(endpoint);
        }
    },

    // -----------------------------
    // 1. SEARCH (Corrected Endpoint)
    // -----------------------------
    async search(query) {
        const encodedQuery = encodeURIComponent(query);
        const data = await this.fetch(`/search/${encodedQuery}`);

        if (data && data.results && Array.isArray(data.results.items)) {
            return {
                results: data.results.items.map(item => this.normalizeItem(item))
            };
        }

        return { results: [] };
    },

    // -----------------------------
    // 2. INFO (Corrected)
    // -----------------------------
    async getInfo(id) {
        const data = await this.fetch(`/info/${id}`);

        if (data && data.results && data.results.subject) {
            return this.normalizeItem(data.results.subject);
        }

        return null;
    },

    // -----------------------------
    // 3. SOURCES (Corrected)
    // -----------------------------
    async getSources(id) {
        return this.fetch(`/sources/${id}`);
    },

    // -----------------------------
    // Normalize GiftedTech Movie Data
    // -----------------------------
    normalizeItem(item) {
        // Image fix (covers all possibilities)
        let img = "assets/placeholder.jpg";

        if (item.cover) img = item.cover;
        if (item.cover?.url) img = item.cover.url;
        if (item.poster) img = item.poster;
        if (item.thumbnail) img = item.thumbnail;

        const finalId = item.subjectId || item.id;

        // Fix year
        let finalYear = "N/A";
        if (item.releaseDate) finalYear = item.releaseDate.split("-")[0];
        if (item.year) finalYear = item.year;

        const finalType =
            item.subjectType === 1 || item.type === "series"
                ? "series"
                : "movie";

        return {
            id: finalId,
            title: item.title || "Untitled",
            year: finalYear,
            type: finalType,
            poster: img,
            description: item.description || item.plot || "",
            rating: item.imdbRatingValue || item.rating || "N/A"
        };
    },

    // -----------------------------
    // Offline mock data fallback
    // -----------------------------
    async mockFetch(endpoint) {
        await new Promise(r => setTimeout(r, 500));

        try {
            if (endpoint.includes("/search"))
                return await (await fetch("./mock/search.json")).json();

            if (endpoint.includes("/info"))
                return await (await fetch("./mock/info.json")).json();

            if (endpoint.includes("/sources"))
                return await (await fetch("./mock/sources.json")).json();

        } catch (e) {
            return {};
        }
    }
};
