import { state } from './state.js';
import { showToast } from './ui.js';

const BASE_URL = "https://movieapi.giftedtech.co.ke/api";

export const api = {
  async fetch(endpoint) {
    if (state.mockMode) return this.mockFetch(endpoint);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error("API Error " + response.status);

      return await response.json();
    } catch (err) {
      console.warn("API Error:", err);
      showToast("Network issue — using offline data", "error");
      return this.mockFetch(endpoint);
    }
  },

  async search(query) {
    const q = encodeURIComponent(query);
    // According to docs: GET /api/search/{query}
    const data = await this.fetch(`/search/${q}`);

    // Validate structure
    const items = (data && data.results && Array.isArray(data.results.items))
      ? data.results.items
      : [];

    // Map items
    const normalized = items.map(item => this.normalizeItem(item));
    return { results: normalized };
  },

  async getInfo(id) {
    const data = await this.fetch(`/info/${id}`);

    // According to docs: data.results.subject
    if (data && data.results && data.results.subject) {
      return this.normalizeItem(data.results.subject);
    }
    return null;
  },

  async getSources(id, season = null, episode = null) {
    // Docs: /api/sources/{id}?season=...&episode=...
    let url = `/sources/${id}`;
    if (season && episode) {
      url += `?season=${season}&episode=${episode}`;
    }
    const data = await this.fetch(url);

    // According to docs: the response is `results` array
    // The docs “Download Sources” section shows response with key "results".
    if (data && Array.isArray(data.results)) {
      return data.results.map(src => ({
        quality: src.quality,
        download: src.download_url,
        stream: src.download_url || src.stream_url,
        size: src.size,
        format: src.format
      }));
    }

    return [];
  },

  normalizeItem(item) {
    let poster = "assets/placeholder.jpg";
    if (item.cover && item.cover.url) {
      poster = item.cover.url;
    } else if (item.poster) {
      poster = item.poster;
    } else if (item.image) {
      poster = item.image;
    }

    let year = "N/A";
    if (item.releaseDate) {
      year = item.releaseDate.split("-")[0];
    } else if (item.year) {
      year = item.year;
    }

    const finalType = (item.subjectType === 1 || item.type === "series")
      ? "series" : "movie";

    return {
      id: item.subjectId || item.id,
      title: item.title || "Untitled",
      year,
      type: finalType,
      poster,
      description: item.description || item.plot || "",
      rating: item.imdbRatingValue || item.rating || "N/A"
    };
  },

  async mockFetch(endpoint) {
    await new Promise(r => setTimeout(r, 400));

    try {
      if (endpoint.includes("search")) {
        return await (await fetch("./mock/search.json")).json();
      }
      if (endpoint.includes("info")) {
        return await (await fetch("./mock/info.json")).json();
      }
      if (endpoint.includes("sources")) {
        return await (await fetch("./mock/sources.json")).json();
      }
    } catch (e) {
      return {};
    }
  }
};
