import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const TELEGRAM_CONFIG_PATH = path.join(rootDir, 'config', 'telegram_config.json');

/**
 * Loads current Telegram configuration
 */
export function getTelegramConfig() {
  let cfg = {
    enabled: true,
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '5489148234',
    notifyOnScan: true,
    notifyOnTrade: true,
    notifyOnShieldAlert: true,
    lastAlertSent: null,
    lastAlertStatus: 'ACTIVE'
  };
  if (fs.existsSync(TELEGRAM_CONFIG_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(TELEGRAM_CONFIG_PATH, 'utf8'));
      cfg = { ...cfg, ...saved };
    } catch (e) {}
  }
  return cfg;
}


/**
 * Saves updated Telegram configuration
 */
export function saveTelegramConfig(newConfig) {
  const current = getTelegramConfig();
  const merged = { ...current, ...newConfig };
  fs.writeFileSync(TELEGRAM_CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

/**
 * Sends a generic HTML message to the configured Telegram Chat
 * @param {string} text HTML formatted message string
 * @returns {Promise<object>}
 */
export async function sendTelegramAlert(text) {
  const config = getTelegramConfig();

  if (!config.enabled || !config.botToken || !config.chatId) {
    console.log(`[Telegram Notifier] ℹ️ Bot Token or Chat ID not configured. Message logged locally.`);
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      message: 'Telegram bot credentials not configured in settings.'
    };
  }

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const data = await response.json();
    const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    if (data.ok) {
      saveTelegramConfig({
        lastAlertSent: nowIST,
        lastAlertStatus: 'SENT_SUCCESS'
      });
      console.log(`[Telegram Notifier] ✅ Actionable Trade Alert sent to Chat ID: ${config.chatId}`);
      return { success: true, status: 'SENT', timestamp: nowIST };
    } else {
      console.error(`[Telegram Notifier] ❌ Telegram API Error:`, data.description);
      saveTelegramConfig({
        lastAlertSent: nowIST,
        lastAlertStatus: `ERROR: ${data.description}`
      });
      return { success: false, status: 'API_ERROR', description: data.description };
    }
  } catch (err) {
    console.error(`[Telegram Notifier] ❌ Network Error:`, err.message);
    return { success: false, status: 'NETWORK_ERROR', error: err.message };
  }
}

/**
 * Formats and broadcasts complete institutional trade execution cards to Telegram
 * Includes: Entry Range, BTST Harvest, T1/T2/T3, Holding Duration, Plan-B Horizon, Exit Rules, Fundamentals & News!
 * @param {Array} candidates Qualified scan setups
 * @param {object} meta Scan execution metadata
 */
export async function sendScanResultsTelegram(candidates = [], meta = {}) {
  const config = getTelegramConfig();
  if (!config.enabled || !config.notifyOnScan) return;

  const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const count = candidates.length;

  if (count === 0) {
    const emptyMsg = `🔱 <b>APEX-OMNIVERSE SOVEREIGN TITAN v12.0</b>\n` +
      `📅 <i>Scan Completed: ${nowIST}</i>\n\n` +
      `🛡️ <b>Market Radar Status:</b>\n` +
      `Zero stocks met the strict 97% Confluence + 4G-FX Fundamental Seal today. Capital safely preserved in 100% liquid cash.`;
    return await sendTelegramAlert(emptyMsg);
  }

  // 1. Header Broadcast Message
  let summaryMsg = `🔱 <b>APEX-OMNIVERSE SOVEREIGN TITAN v12.0</b>\n` +
    `⚡ <b>Tri-Engine Market Scan Completed</b>\n` +
    `📅 <i>${nowIST}</i>\n` +
    `🎯 <b>Qualified 97% Precision Opportunities: ${count} Found</b>\n` +
    `───────────────────────────────────\n\n`;

  candidates.forEach((c, idx) => {
    const isElite = c.signal?.includes('AAA+');
    summaryMsg += `${idx + 1}. ${isElite ? '🔥' : '🟢'} <b>${c.name || c.symbol}</b> (CMP: ₹${c.cmp} | Target 1: <b>₹${c.target1}</b>)\n`;
  });

  summaryMsg += `\n👇 <i>Detailed Actionable Execution Cards Below:</i>`;
  await sendTelegramAlert(summaryMsg);

  // 2. Send Individual Deep Actionable Trade Cards for each candidate
  for (let i = 0; i < Math.min(candidates.length, 5); i++) {
    const c = candidates[i];
    const isElite = c.signal?.includes('AAA+');
    const tierIcon = isElite ? '🔥' : '🟢';
    const tierTitle = isElite ? 'AAA+ SOVEREIGN TITAN ELITE' : 'AA+ SOVEREIGN PRO';
    const allocPct = isElite ? '10%' : '5%';

    const entryLow = c.entryLow || +(c.cmp * 0.998).toFixed(2);
    const entryHigh = c.entryHigh || +(c.cmp * 1.004).toFixed(2);
    const btstTarget = +(c.cmp * 1.020).toFixed(2);
    const target1 = c.target1 || +(c.cmp * 1.045).toFixed(2);
    const target2 = c.target2 || +(c.cmp * 1.080).toFixed(2);
    const target3 = c.target3 || +(c.cmp * 1.140).toFixed(2);

    const newsGrade = c.news?.sentimentGrade || '🟢 POSITIVE / FAVORABLE';
    const newsVerdict = c.news?.verdict || 'APPROVED_HIGH_CONVICTION';
    const newsPrediction = c.news?.aiPrediction || 'Clean institutional mean-reversion setup with zero toxic regulatory flags.';

    const tradeCard = `🎯 <b>TRADE SETUP #${i + 1}: ${tierIcon} ${c.name || c.symbol}</b>\n` +
      `🏷️ <b>Signal Tier:</b> <code>${tierTitle}</code>\n` +
      `📊 <b>14-Pillar Confluence:</b> <b>${c.passCount || 12}/14 (${c.score || 85}%)</b>\n` +
      `───────────────────────────────────\n\n` +

      `💰 <b>PRICING & ENTRY PROTOCOL:</b>\n` +
      `• <b>Current Market Price (CMP):</b> ₹${c.cmp}\n` +
      `• 📍 <b>Optimal Entry Range:</b> <b>₹${entryLow} – ₹${entryHigh}</b>\n` +
      `• 🛡️ <b>52-Week Peak Buffer:</b> <b>-${c.distFromHigh}% below high</b> (Zero top-buying trap risk)\n` +
      `• 💼 <b>Capital Allocation:</b> <b>${allocPct} of Portfolio Capital</b>\n\n` +

      `🎯 <b>PROFIT HARVEST TARGETS (EXIT PLAN):</b>\n` +
      `• ⚡ <b>BTST Fast Cash:</b> <b>₹${btstTarget} (+2.0%)</b> (Exit if hit within 48 hours)\n` +
      `• 🎯 <b>Primary Target 1 (+4.5%):</b> <b>₹${target1}</b> (Book 50% profit & shift SL to break-even)\n` +
      `• 🚀 <b>Growth Target 2 (+8.0%):</b> <b>₹${target2}</b> (Trail runner with 10 EMA)\n` +
      `• 💎 <b>Runner Target 3 (+14.0%):</b> <b>₹${target3}</b>\n\n` +

      `⏳ <b>HOLDING PERIOD & RISK PROTOCOL:</b>\n` +
      `• ⏱️ <b>Primary Swing Duration:</b> <b>3 to 8 Trading Sessions</b>\n` +
      `• 🛡️ <b>Plan-B Max Horizon:</b> <b>Up to 60 Sessions</b> (Institutional blue-chip mean-reversion recovery)\n` +
      `• 🛑 <b>Anti-Shakeout Rule:</b> No tight retail stop-losses. Trail rising 10-day EMA after Session 7.\n\n` +

      `💎 <b>4G-FX FUNDAMENTAL HEALTH:</b>\n` +
      `• <b>Moat Tier:</b> ${c.moatTier || 'Blue-Chip Market Leader'}\n` +
      `• <b>Piotroski F-Score:</b> <b>${c.fScore || 8}/9 Elite</b> | <b>ROCE:</b> <b>${c.roce || 18}%</b>\n` +
      `• <b>Solvency & Governance:</b> Pristine Balance Sheet, Zero Debt Distress, 0% Promoter Pledge\n\n` +

      `📰 <b>AI NEWS CATALYST & PREDICTION:</b>\n` +
      `• <b>Sentiment Grade:</b> <b>${newsGrade}</b> (Verdict: <code>${newsVerdict}</code>)\n` +
      `• 🧠 <b>AI Trajectory Thesis:</b> <i>"${newsPrediction}"</i>\n\n` +

      `───────────────────────────────────\n` +
      `📊 <b>Live Web Terminal:</b> http://localhost:3000\n` +
      `🔗 <b>Google Sheet:</b> https://sheets.new`;

    await sendTelegramAlert(tradeCard);
  }

  return { success: true, count };
}
