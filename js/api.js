import { state } from './state.js';
import { showToast } from './ui.js';

// Ensure this URL is correct. 
// NOTE: Some GiftedTech servers require 'http' instead of 'https' if SSL is invalid.
const BASE_URL = "https://movieapi.giftedtech.co.ke/api";

export const api = {
  async fetch(endpoint) {
    if (state.mockMode) return this.mockFetch(endpoint);

    try {
      const controller = new AbortController();
      // Increased timeout to 20s because scraper APIs can be slow
      const timeout = setTimeout(() => controller.abort(), 20000); 

      console.log(`Fetching: ${BASE_URL}${endpoint}`); // DEBUG LOG

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        signal: controller.signal,
        headers: {
          // Essential headers for these APIs
          "Accept": "application/json",
          // If you are in a Browser/WebView, do not set User-Agent manually here (it's forbidden).
          // If this is Node/React Native, un-comment the line below:
          // "User-Agent": "GiftedMovieApp/1.0" 
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // This logs the ACTUAL server error (e.g., 404 or 403)
        console.error(`Server Error: ${response.status} on ${endpoint}`);
        throw new Error("Server Error " + response.status);
      }

      const json = await response.json();
      return json;

    } catch (err) {
      // LOG THE REAL ERROR so you can see it in Console/Logcat
      console.error("CRITICAL API ERROR:", err);
      
      showToast(`Connection failed: ${err.message}`, "error");
      
      // Only fall back to mock if it's strictly a search/home request
      // Otherwise, we want to know it failed.
      return this.mockFetch(endpoint);
    }
  },

  async search(query) {
    const q = encodeURIComponent(query);
    const data = await this.fetch(`/search/${q}`);
    const items = (data && data.results && Array.isArray(data.results.items))
      ? data.results.items
      : [];
    return { results: items.map(item => this.normalizeItem(item)) };
  },

  async getInfo(id) {
    // FIX 1: Changed /info/ to /movie/details/ and added fallback for series
    // Try movie endpoint first
    let data = await this.fetch(`/movie/details/${id}`);
    
    // If movie endpoint returns nothing or error, try series (if your logic allows)
    if (!data || !data.results) {
       console.log("Not found in movies, trying series endpoint...");
       data = await this.fetch(`/series/details/${id}`);
    }

    // Check for 'subject' (API specific) OR just the root 'results' object
    const subject = (data && data.results && data.results.subject) 
                    ? data.results.subject 
                    : (data && data.results) ? data.results : null;

    if (subject) {
      return this.normalizeItem(subject);
    }
    
    console.error("Parsing Error: Could not find movie details in response", data);
    return null;
  },

  async getSources(id, season = null, episode = null) {
    let url = `/sources/${id}`;
    if (season && episode) {
      url += `?season=${season}&episode=${episode}`;
    }

    const data = await this.fetch(url);

    // FIX 2: Robust checking. 
    // Sometimes API returns { success: false, msg: "No source" }
    if (data && data.success === false) {
        console.warn("API reported no sources:", data);
        return [];
    }

    if (data && Array.isArray(data.results)) {
      return data.results.map(src => ({
        quality: src.quality || "HD",
        download: src.download_url,
        // We prioritize download_url as it's often the direct MP4
        stream: src.download_url || src.stream_url, 
        size: src.size || "N/A",
        format: src.format || "mp4"
      }));
    }

    return [];
  },

  normalizeItem(item) {
    // Safe handling if item is null
    if (!item) return null;

    let poster = "assets/placeholder.jpg";
    if (item.cover && item.cover.url) poster = item.cover.url;
    else if (item.poster) poster = item.poster;
    else if (item.image) poster = item.image;

    let year = "N/A";
    if (item.releaseDate) year = item.releaseDate.split("-")[0];
    else if (item.year) year = item.year;

    // Fix for trailer extraction
    let trailer = "";
    if (item.trailer && item.trailer.url) trailer = item.trailer.url;
    else if (item.video) trailer = item.video;

    return {
      id: item.subjectId || item.id,
      title: item.title || "Untitled",
      year,
      type: (item.subjectType === 1 || item.type === "series") ? "series" : "movie",
      poster,
      description: item.description || item.plot || "",
      rating: item.imdbRatingValue || item.rating || "N/A",
      trailer: trailer, // Added trailer support
      actors: item.actors || [] // Added actors support
    };
  },

  async mockFetch(endpoint) {
    // Keep your existing mock logic here
    await new Promise(r => setTimeout(r, 400));
    try {
      if (endpoint.includes("search")) return await (await fetch("./mock/search.json")).json();
      if (endpoint.includes("details") || endpoint.includes("info")) return await (await fetch("./mock/info.json")).json();
      if (endpoint.includes("sources")) return await (await fetch("./mock/sources.json")).json();
    } catch (e) { return {}; }
  }
};
