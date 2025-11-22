import { state } from './state.js';
import { showToast } from './ui.js';

/* IMPORTANT:
   Remove the trailing slash — makes URL building reliable.
*/
const BASE_URL = "https://movieapi.giftedtech.co.ke/api";

function joinUrl(base, path) {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

export const api = {

  /* ------------------------
     GENERIC FETCH WRAPPER
  ------------------------- */
  async fetch(endpoint) {
    if (state.mockMode) return this.mockFetch(endpoint);

    const url = joinUrl(BASE_URL, endpoint);
    console.log("%c[API] Request →", "color: dodgerblue; font-weight:bold", url);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Accept": "application/json"
        }
      });

      clearTimeout(timeout);

      console.log("[API] Status:", response.status);

      // Try to read body text anyway (if error)
      if (!response.ok) {
        let body = "";
        try { body = await response.text(); } catch (_) {}

        console.error(
          "%c[API ERROR RESPONSE]",
          "color:red;font-weight:bold",
          {
            status: response.status,
            statusText: response.statusText,
            url,
            body
          }
        );

        throw new Error("API Error " + response.status);
      }

      return await response.json();
    }

    catch (err) {
      console.error(
        "%c[API FETCH ERROR]",
        "color:red;font-weight:bold",
        err.message,
        err
      );

      if (err.name === "AbortError") {
        console.warn("Request aborted (timeout).");
      }

      showToast("Network issue — using offline data", "error");
      return this.mockFetch(endpoint);
    }
  },

  /* ------------------------
     SEARCH
  ------------------------- */
  async search(query) {
    const q = encodeURIComponent(query);
    const data = await this.fetch(`search/${q}`);

    const items = Array.isArray(data?.results?.items)
      ? data.results.items
      : [];

    return {
      results: items.map(item => this.normalizeItem(item))
    };
  },

  /* ------------------------
     INFO
  ------------------------- */
  async getInfo(id) {
    const data = await this.fetch(`info/${id}`);

    if (data?.results?.subject) {
      return this.normalizeItem(data.results.subject);
    }

    return null;
  },

  /* ------------------------
     SOURCES
  ------------------------- */
  async getSources(id, season = null, episode = null) {
    let endpoint = `sources/${id}`;

    if (season && episode) {
      endpoint += `?season=${season}&episode=${episode}`;
    }

    const data = await this.fetch(endpoint);

    if (!Array.isArray(data?.results)) return [];

    return data.results.map(src => ({
      id: src.id || null,
      quality: src.quality || "Unknown",
      size: src.size || null,
      format: src.format || null,

      stream: src.download_url || null,
      download: src.download_url || null,

      raw: src
    }));
  },

  /* ------------------------
     NORMALIZE ITEM
  ------------------------- */
  normalizeItem(item) {
    let poster =
      item?.cover?.url ||
      item?.thumbnail ||
      item?.poster ||
      item?.image ||
      "assets/placeholder.jpg";

    let year = "N/A";

    if (item.releaseDate) {
      year = item.releaseDate.split("-")[0];
    } else if (item.year) {
      year = item.year;
    }

    let finalType =
      item.subjectType === 2 || item.type === "series"
        ? "series"
        : "movie";

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

  /* ------------------------
     MOCK DATA
  ------------------------- */
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
      console.warn("Failed to load mock data", e);
      return {};
    }
  }
};
