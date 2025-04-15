import axios from "axios";
import { log } from "./vite";

// List of all country codes to cycle through
const ALL_COUNTRIES = [
  "ae", "ar", "at", "au", "be", "bg", "br", "ca", "ch", "cn", "co", "cu", "cz",
  "de", "eg", "fr", "gb", "gr", "hk", "hu", "id", "ie", "il", "in", "it", "jp",
  "kr", "lt", "lv", "ma", "mx", "my", "ng", "nl", "no", "nz", "ph", "pl", "pt",
  "ro", "rs", "ru", "sa", "se", "sg", "si", "sk", "th", "tr", "tw", "ua", "us",
  "ve", "za"
];

// Store last fetch times to respect rate limits
let lastNewsApiFetch = 0;
let lastNewsroomFetch = 0;
let currentCountryIndex = 0;

/**
 * Fetches news from the Flask server for a specific country
 */
async function fetchNewsForCountry(country: string): Promise<void> {
  try {
    log(`Background fetch: Getting news for country ${country.toUpperCase()}`, "background");
    const response = await axios.get(`http://172.31.128.8:5001/fetch-news?country=${country}`);
    log(`Background fetch: Successfully fetched ${response.data?.articles?.length || 0} articles for ${country.toUpperCase()}`, "background");
  } catch (error) {
    log(`Background fetch: Error fetching news for country ${country}: ${error instanceof Error ? error.message : String(error)}`, "background");
  }
}

/**
 * Fetches news from the Newsroom API via Flask server
 */
async function fetchNewsFromNewsroom(): Promise<void> {
  try {
    log("Background fetch: Getting news from Newsroom API", "background");
    const response = await axios.get("http://172.31.128.8:5001/fetch-newsroom");
    log(`Background fetch: Successfully fetched ${response.data?.articles?.length || 0} articles from Newsroom`, "background");
  } catch (error) {
    log(`Background fetch: Error fetching from Newsroom: ${error instanceof Error ? error.message : String(error)}`, "background");
  }
}

/**
 * Initiates the background fetching process
 */
export function startBackgroundFetching(): void {
  log("Starting background news fetching service", "background");

  // Check the Flask server health first
  checkFlaskServerHealth();

  // Run the News API fetcher every minute (60000ms)
  setInterval(() => {
    const now = Date.now();
    
    // Respect rate limit: ensure at least 60 seconds between News API fetches
    if (now - lastNewsApiFetch >= 60000) {
      const country = ALL_COUNTRIES[currentCountryIndex];
      fetchNewsForCountry(country);
      
      // Move to the next country in the cycle
      currentCountryIndex = (currentCountryIndex + 1) % ALL_COUNTRIES.length;
      lastNewsApiFetch = now;
    }
  }, 60000);

  // Run the Newsroom API fetcher every minute (60000ms)
  setInterval(() => {
    const now = Date.now();
    
    // Respect rate limit: ensure at least 60 seconds between Newsroom API fetches
    if (now - lastNewsroomFetch >= 60000) {
      fetchNewsFromNewsroom();
      lastNewsroomFetch = now;
    }
  }, 60000);

  // Initial fetch to start right away
  fetchNewsForCountry(ALL_COUNTRIES[currentCountryIndex]);
  currentCountryIndex = (currentCountryIndex + 1) % ALL_COUNTRIES.length;
  lastNewsApiFetch = Date.now();
  
  fetchNewsFromNewsroom();
  lastNewsroomFetch = Date.now();
}

/**
 * Checks if the Flask server is running
 */
async function checkFlaskServerHealth(): Promise<void> {
  try {
    const response = await axios.get("http://172.31.128.8:5001/health");
    log("Flask server is running: " + response.data, "background");
  } catch (error) {
    log("Error connecting to Flask server. Background fetching may not work properly.", "background");
    log("Flask server error: " + (error instanceof Error ? error.message : String(error)), "background");
  }
}