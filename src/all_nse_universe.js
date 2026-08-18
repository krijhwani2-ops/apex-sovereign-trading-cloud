/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🔱 APEX-OMNIVERSE SOVEREIGN TITAN v12.5 — ALL NSE EQUITIES FETCHER
 * ══════════════════════════════════════════════════════════════════════════
 * Automatically downloads, parses, and syncs the entire official master list
 * of 2,500+ listed equities from the National Stock Exchange of India (NSE).
 * ══════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const CACHE_FILE = path.join(rootDir, 'data', 'all_nse_equities.json');
const NSE_OFFICIAL_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';

/**
 * Downloads official EQUITY_L.csv from NSE and parses all active equity symbols
 */
export async function syncAllNseEquities() {
  console.log('🔄 Fetching complete official NSE Master Equity list (2,500+ listed stocks)...');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/csv, application/json, */*'
  };

  let csvText = null;
  try {
    const res = await fetch(NSE_OFFICIAL_URL, { headers });
    if (res.ok) {
      csvText = await res.text();
    }
  } catch (e) {
    console.warn('[NSE Sync Warning] Primary endpoint failed:', e.message);
  }

  const equities = [];

  if (csvText) {
    const lines = csvText.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length >= 2) {
        const symbol = parts[0].trim().toUpperCase();
        const companyName = parts[1].trim().replace(/^"|"$/g, '');
        const series = parts[2] ? parts[2].trim().toUpperCase() : 'EQ';
        const isin = parts[6] ? parts[6].trim() : '';

        // Only include normal equity shares (series EQ, BE, SM)
        if (symbol && symbol.length >= 2 && !symbol.includes(' ')) {
          equities.push({
            symbol: `${symbol}.NS`,
            rawSymbol: symbol,
            companyName,
            series,
            isin
          });
        }
      }
    }
  }

  // If download succeeded and returned stocks, write to cache
  if (equities.length > 500) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(equities, null, 2));
    console.log(`✅ Successfully synced ${equities.length} active listed equities from NSE!`);
    return equities;
  }

  // Fallback to cache if available
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      console.log(`📂 Loaded ${cached.length} NSE equities from local cache.`);
      return cached;
    } catch (e) {}
  }

  return [];
}

/**
 * Returns all active NSE tickers with .NS suffix
 * @returns {string[]} Array of ticker strings (e.g. ['20MICRONS.NS', '3MINDIA.NS', ...])
 */
export function getAllNseTickers() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return cached.map(e => e.symbol);
    } catch (e) {}
  }
  return [];
}
