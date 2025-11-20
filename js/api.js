import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = "https://movieapi.giftedtech.co.ke/api";

export const api = {

    // -----------------------------
    // Universal Fetch
    // -----------------------------
    async fetch(endpoint) {
        if (state.mockMode) return this.mockFetch(endpoint);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${BASE_URL}${endpoint}`, {
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error("API Error " + response.status);
            }

            return await response.json();
        } catch (err) {
            console.warn("API Error:", err);
            showToast("Network Issue — using offline data", "error");
            return this.mockFetch(endpoint);
        }
    },

    // -----------------------------
    // SEARCH  —  /search?query=
    // -----------------------------
    async search(query) {
        const q = encodeURIComponent(query);

        const data = await this.fetch(`/search?query=${q}`);

        if (!data || !data.results) return { results: [] };

        return {
            results: data.results.map(item => this.normalizeItem(item))
        };
    },

    // -----------------------------
    // INFO  —  /info?id=
    // -----------------------------
    async getInfo(id) {
        const data = await this.fetch(`/info?id=${id}`);

        if (!data || !data.results) return null;

        return this.normalizeItem(data.results);
    },

    // -----------------------------
    // SOURCES  —  /watch?id=
    // -----------------------------
    async getSources(id) {
        const data = await this.fetch(`/watch?id=${id}`);

        if (!data || !data.sources) return { sources: [] };

        return data.sources;
    },

    // -----------------------------
    //  NORMALIZATION FOR UI
    // -----------------------------
    normalizeItem(item) {

        // --- Image Handling ---
        let poster = "assets/placeholder.jpg";
        if (item.poster) poster = item.poster;
        if (item.cover) poster = item.cover;
        if (item.image) poster = item.image;

        // --- Year Fix ---
        let year = "N/A";
        if (item.year) year = item.year;
        if (item.releaseDate) year = item.releaseDate.split("-")[0];

        return {
            id: item.id,
            title: item.title || "Untitled",
            year,
            type: item.type || "movie",
            poster,
            description: item.description || item.plot || "",
            rating: item.rating || item.imdbRating || "N/A"
        };
    },

    // -----------------------------
    // MOCK DATA (Offline mode)
    // -----------------------------
    async mockFetch(endpoint) {
        await new Promise(r => setTimeout(r, 400));

        try {
            if (endpoint.includes("search"))
                return await (await fetch("./mock/search.json")).json();

            if (endpoint.includes("info"))
                return await (await fetch("./mock/info.json")).json();

            if (endpoint.includes("watch"))
                return await (await fetch("./mock/sources.json")).json();

        } catch (e) {
            return {};
        }
    }
};
