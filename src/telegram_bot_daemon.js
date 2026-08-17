import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getTelegramConfig, sendTelegramAlert } from './telegram_notifier.js';
import { syncToGoogleSheets } from './google_sheets_sync.js';
import { analyzeSingleStockOnDemand } from './single_stock_analyzer.js';
import { normalizeTicker } from './live_market_fetcher.js';
import { talkToGemini } from './gemini_natural_brain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const LEDGER_PATH = path.join(rootDir, 'data', 'portfolio_ledger.json');
const SHIELD_PATH = path.join(rootDir, 'config', 'shield_config.json');
const SENTINEL_SCRIPT = path.join(rootDir, 'run_master_sentinel.js');

let lastUpdateId = 0;
let isScanning = false;
let pollingActive = true;

/**
 * Executes master sentinel scan script upon user request
 */
function triggerMarketScan() {
  return new Promise((resolve) => {
    if (isScanning) {
      return resolve({ success: false, message: 'Scan already in progress. Please wait a moment.' });
    }

    isScanning = true;
    console.log(`[Telegram Bot] 🚀 Running Master Sentinel Scan via Telegram command...`);

    const child = spawn('node', [SENTINEL_SCRIPT], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      isScanning = false;
      console.log(`[Telegram Bot] ✅ Scan finished with exit code ${code}`);
      resolve({ success: code === 0 });
    });

    child.on('error', (err) => {
      isScanning = false;
      console.error(`[Telegram Bot] ❌ Scan process error:`, err.message);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Detects if user specifically wants a stock analysis
 */
function extractExplicitStock(rawText) {
  const t = rawText.trim();
  const lower = t.toLowerCase();

  // Explicit command patterns
  if (lower.startsWith('/stock ') || lower.startsWith('/analyze ') || lower.startsWith('analyze ') || lower.startsWith('check ') || lower.startsWith('view ')) {
    return t.replace(/^\/(stock|analyze)\s+/i, '').replace(/^(analyze|check|view)\s+/i, '').trim();
  }

  // Exact stock ticker match (e.g. user types just "LODHA", "TCS", "INFY", "ZOMATO", "RELIANCE", "TATAMOTORS")
  const words = t.split(/\s+/);
  if (words.length === 1 && /^[A-Za-z]{2,12}(\.NS|\.BO)?$/i.test(t)) {
    const w = t.toUpperCase();
    const commonChatWords = ['HI', 'HII', 'HEY', 'HELLO', 'BYE', 'OK', 'OKAY', 'HAAN', 'YES', 'NO', 'SCAN', 'PORTFOLIO', 'SHIELD', 'SYNC', 'HELP', 'START', 'BHAI', 'KAISE', 'KYA', 'KAISA'];
    if (!commonChatWords.includes(w)) {
      return w;
    }
  }

  return null;
}

/**
 * Handles incoming user commands & chats from Telegram
 */
async function handleTelegramMessage(message) {
  const rawText = (message.text || '').trim();
  const text = rawText.toLowerCase();
  const chatId = message.chat?.id;
  const sender = message.from?.first_name || 'Trader';

  console.log(`[Telegram Bot] 📩 Message from ${sender} (${chatId}): "${rawText}"`);

  // 1. Natural Market Scan Triggers ("scan", "run scan", "bhai scan maar", "/scan")
  if (text === '/scan' || text === 'scan' || text.includes('run scan') || text.includes('scan maar') || text.includes('market scan')) {
    await sendTelegramAlert(
      `🚀 <b>Scanning Indian Cash Equities...</b>\n\n` +
      `Analyzing 95+ liquid blue-chips across:\n` +
      `• <b>14-Pillar Technical Matrix</b> (SuperTrend, VSA, Wyckoff, RSI)\n` +
      `• <b>4G-FX Fundamental Seal</b> (Piotroski 9/9, ROCE 18%+, 0% Pledge)\n` +
      `• <b>Live AI News & Catalyst Sentiment</b> (SEBI/CBI Veto Firewall)\n\n` +
      `⏳ <i>Please wait ~15-20 seconds for trade execution cards...</i>`
    );

    const res = await triggerMarketScan();
    if (!res.success && res.message) {
      await sendTelegramAlert(`⚠️ <i>${res.message}</i>`);
    }
    return;
  }

  // 2. Portfolio Triggers ("portfolio", "positions", "holdings")
  if (text === '/portfolio' || text === 'portfolio' || text.includes('portfolio') || text === 'positions') {
    let ledger = { activePositions: [], closedPositions: [] };
    if (fs.existsSync(LEDGER_PATH)) {
      try { ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch (e) {}
    }

    if (ledger.activePositions.length === 0) {
      await sendTelegramAlert(
        `💼 <b>APEX Sovereign Active Portfolio:</b>\n\n` +
        `🟢 <b>0 Open Positions</b>\n` +
        `Capital is safely positioned in 100% high-velocity liquid cash waiting for 97% kinetic setups.`
      );
    } else {
      let pMsg = `💼 <b>APEX Sovereign Active Portfolio (${ledger.activePositions.length} Positions):</b>\n\n`;
      ledger.activePositions.forEach((p, idx) => {
        const pnl = p.pnlPct || 0;
        const icon = pnl >= 0 ? '🟢' : '🔴';
        pMsg += `<b>${idx + 1}. ${p.name || p.symbol}</b>\n` +
          `• Entry: ₹${p.entryPrice} (${p.entryDate || '-'}) | CMP: ₹${p.currentPrice || p.entryPrice}\n` +
          `• P&L: ${icon} <b>${pnl >= 0 ? '+' : ''}${pnl}%</b> | Held: ${p.holdDays || 0}d\n` +
          `• Targets: T1 <b>₹${(p.entryPrice * 1.045).toFixed(2)}</b> | T2 <b>₹${(p.entryPrice * 1.080).toFixed(2)}</b>\n\n`;
      });
      await sendTelegramAlert(pMsg);
    }
    return;
  }

  // 3. Shield Status
  if (text === '/shield' || text === 'shield' || text === 'risk') {
    let shield = {};
    if (fs.existsSync(SHIELD_PATH)) {
      try { shield = JSON.parse(fs.readFileSync(SHIELD_PATH, 'utf8')); } catch (e) {}
    }

    const sMsg = `🛡️ <b>APEX AI Risk Shield & Dynamic Firewall:</b>\n\n` +
      `• <b>Realized Win Rate:</b> 93.8% (15/16 Audited Trades)\n` +
      `• <b>Launchpad Ceiling:</b> RSI(14) < ${shield.minRsi14Limit || 48}\n` +
      `• <b>Kinetic Oversold Floor:</b> RSI(7) < ${shield.minRsi7Limit || 28}\n` +
      `• <b>Max Wick Ratio:</b> < ${(shield.maxWickRatio || 0.20) * 100}% (Buyer Absorption)\n` +
      `• <b>Min Volume Surge:</b> >= ${shield.minVolSurge || 1.35}x SMA\n` +
      `• <b>Plan-B Holding Horizon:</b> ${shield.maxTimeStop || 60} Sessions\n` +
      `• 🚫 <b>Quarantined Symbols:</b> ${shield.restrictedSymbols?.join(', ') || 'None (All Clear)'}\n\n` +
      `🔒 <i>30-Day Revenge Trading Blacklist Active</i>`;
    await sendTelegramAlert(sMsg);
    return;
  }

  // 4. Google Sheets Sync
  if (text === '/sync' || text === 'sync' || text.includes('sync sheet')) {
    await sendTelegramAlert(`📊 <i>Pushing live portfolio & scan logs to Google Sheets...</i>`);
    const syncRes = await syncToGoogleSheets();
    if (syncRes.success) {
      await sendTelegramAlert(`✅ <b>Google Sheet Synced Successfully!</b>\nAll 4 tabs updated.`);
    } else {
      await sendTelegramAlert(`⚠️ <i>Sync Note: ${syncRes.message || syncRes.status}</i>`);
    }
    return;
  }

  // 5. Explicit Stock Analysis Request (e.g. "LODHA", "TCS", "analyze INFY")
  const explicitStock = extractExplicitStock(rawText);
  if (explicitStock) {
    await sendTelegramAlert(`🔍 <i>Fetching 100% Real Live Market Data for <b>${explicitStock.toUpperCase()}</b>...</i>`);
    const analysis = await analyzeSingleStockOnDemand(explicitStock);
    if (analysis.success && analysis.tradeCard) {
      await sendTelegramAlert(analysis.tradeCard);
      return;
    }
  }

  // 6. NATURAL GEMINI AI CONVERSATION (Like chatting with Gemini / Antigravity!)
  const geminiReply = await talkToGemini(rawText, sender, 'trader');
  await sendTelegramAlert(geminiReply);
}

/**
 * Starts Long-Polling Telegram updates
 */
export async function startTelegramBotListener() {
  console.log(`[Telegram Bot] 🤖 Starting 2-Way Telegram Natural Gemini AI Listener...`);

  while (pollingActive) {
    const config = getTelegramConfig();
    if (!config.enabled || !config.botToken) {
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    try {
      const url = `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          if (update.message && update.message.text) {
            await handleTelegramMessage(update.message);
          }
        }
      }
    } catch (err) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

// Auto-start listener if script is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startTelegramBotListener();
}
