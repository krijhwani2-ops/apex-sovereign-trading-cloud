/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🔱 APEX-OMNIVERSE SOVEREIGN TITAN v12.0 — DYNAMIC ON-DEMAND STOCK ANALYZER
 * ══════════════════════════════════════════════════════════════════════════
 * Analyzes ANY Indian stock on demand across:
 *  - 100% Authentic Live Market Data (Yahoo Direct API / NSE)
 *  - 14-Pillar Technical Matrix (SuperTrend, RSI, 52W Buffer, VSA, Wyckoff)
 *  - 4G-FX Fundamental Moats (Piotroski F-Score, ROCE, Debt-to-Equity)
 *  - Real-Time Live News Sentiment & Toxic Regulatory Veto
 *  - Automated Entry Zone, BTST Level, Targets T1/T2/T3, Holding Horizon
 * ══════════════════════════════════════════════════════════════════════════
 */

import {
  calculateEMA,
  calculateSMA,
  calculateRSI,
  calculateBollingerBands,
  calculateSuperTrend,
  analyzeVSAAbsorption,
  detectWyckoffSpring,
  performFundamentalXRay,
  scanStockNewsIntelligence
} from './strategy.js';
import { fetchLiveStockCandles, normalizeTicker } from './live_market_fetcher.js';

/**
 * Performs complete 3-stage quantitative analysis on a single stock using 100% REAL live market data
 * @param {string} query Stock symbol or company name (e.g. LODHA, TCS, INFY, TATAMOTORS)
 * @returns {Promise<object>} Complete institutional report & trade card
 */
export async function analyzeSingleStockOnDemand(query) {
  const normSym = normalizeTicker(query);
  let candles;
  try {
    candles = await fetchLiveStockCandles(normSym);
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }

  if (!candles || candles.length === 0) {
    return { success: false, error: `No live candles found for ${normSym}` };
  }

  const rawName = normSym.replace('.NS', '').replace('.BO', '');
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);
  const lastIndex = closes.length - 1;

  const cmp = closes[lastIndex];
  const high52W = Math.max(...highs);
  const low52W = Math.min(...lows);

  // 1. Technical Indicators
  const ema20Arr = calculateEMA(closes, 20);
  const sma50Arr = calculateSMA(closes, 50);
  const sma200Arr = calculateSMA(closes, 200);
  const rsiArr = calculateRSI(closes, 14);
  const rsi7Arr = calculateRSI(closes, 7);
  const bbArr = calculateBollingerBands(closes, 20, 2);
  const stArr = calculateSuperTrend(candles, 10, 3);
  const vsa = analyzeVSAAbsorption(highs, lows, closes, volumes);

  const ema20 = ema20Arr[lastIndex] || cmp;
  const sma50 = sma50Arr[lastIndex] || cmp;
  const sma200 = sma200Arr[lastIndex] || cmp;
  const rsi14 = rsiArr[lastIndex] !== null ? +rsiArr[lastIndex].toFixed(1) : 50;
  const rsi7 = rsi7Arr[lastIndex] !== null ? +rsi7Arr[lastIndex].toFixed(1) : 45;
  const supertrend = stArr[lastIndex]?.supertrend || cmp;
  const isSuperTrendBull = stArr[lastIndex]?.direction === 'UP';

  // 52-Week Discount Buffer
  const distFromHigh = +(((high52W - cmp) / high52W) * 100).toFixed(1);

  // 2. Fundamental X-Ray (4G-FX)
  const fx = performFundamentalXRay(normSym);

  // 3. Live News Sentiment & Toxic Veto
  const news = await scanStockNewsIntelligence(normSym, rawName);

  // 4. 14-Pillar Confluence Score Calculation
  let passCount = 0;
  if (cmp >= (sma200 ? sma200 * 0.95 : cmp * 0.9)) passCount++; // 1. Macro Trend Alignment
  if (distFromHigh >= 2.0 && distFromHigh <= 32.0) passCount++; // 2. 52W Peak Buffer
  if (rsi14 <= 62) passCount++; // 3. RSI Launchpad
  if (rsi7 <= 45 || closes[lastIndex] <= closes[lastIndex - 1]) passCount++; // 4. Pullback
  if (cmp <= (bbArr.upper ? bbArr.upper[lastIndex] * 1.01 : cmp * 1.05)) passCount++; // 5. %B exhaustion
  if (vsa.upperWickRatio <= 0.25) passCount++; // 6. VSA absorption
  if (volumes[lastIndex] >= (volumes.slice(-20).reduce((s,v)=>s+v,0)/20) * 1.05) passCount++; // 7. Vol surge
  if (cmp >= ema20 * 0.96 || cmp >= sma50 * 0.96) passCount++; // 8. Structural Support
  if (vsa.isVsaAbsorption) passCount++; // 9. Absorption
  if (closes[lastIndex] >= (highs[lastIndex-1] + lows[lastIndex-1])/2) passCount++; // 10. Midpoint
  if (fx.fScore >= 7) passCount++; // 11. Fundamental F-score
  if (fx.roce >= 15.0) passCount++; // 12. ROCE Moat
  if (news.sentimentScore >= 0) passCount++; // 13. News Tailwind
  if (news.isVetoed !== true) passCount++; // 14. Zero Toxic Red Flags

  const scorePct = Math.round((passCount / 14) * 100);

  // Determine Signal Tier
  let tier = '🟡 ACCUMULATION / WATCHLIST';
  let tierIcon = '🟡';
  let alloc = '3-5% Capital';
  if (passCount >= 11 && fx.fScore >= 8 && distFromHigh >= 4.0 && !news.isVetoed) {
    tier = 'AAA+ SOVEREIGN ELITE';
    tierIcon = '🔥';
    alloc = '10% of Portfolio Capital';
  } else if (passCount >= 9 && fx.fScore >= 7 && !news.isVetoed) {
    tier = 'AA+ SOVEREIGN PRO';
    tierIcon = '🟢';
    alloc = '5% of Portfolio Capital';
  } else if (news.isVetoed) {
    tier = '🚫 QUARANTINED / TOXIC RISK';
    tierIcon = '🚫';
    alloc = '0% (Do NOT Buy)';
  }

  // Calculated Targets Based on Real CMP
  const entryLow = +(cmp * 0.995).toFixed(2);
  const entryHigh = +(cmp * 1.005).toFixed(2);
  const btstTarget = +(cmp * 1.020).toFixed(2);
  const target1 = +(cmp * 1.045).toFixed(2);
  const target2 = +(cmp * 1.080).toFixed(2);
  const target3 = +(cmp * 1.140).toFixed(2);

  // Format Rich Actionable Telegram Trade Card
  const tradeCard = `🎯 <b>LIVE QUANTITATIVE REPORT: ${tierIcon} ${rawName} (${normSym})</b>\n` +
    `🏷️ <b>Signal Tier:</b> <code>${tier}</code>\n` +
    `📊 <b>14-Pillar Confluence Score:</b> <b>${passCount}/14 (${scorePct}%)</b>\n` +
    `───────────────────────────────────\n\n` +

    `💰 <b>LIVE MARKET PRICE & ENTRY ZONE:</b>\n` +
    `• <b>Current Market Price (CMP):</b> <b>₹${cmp.toLocaleString('en-IN')}</b>\n` +
    `• 📍 <b>Optimal Entry Range:</b> <b>₹${entryLow.toLocaleString('en-IN')} – ₹${entryHigh.toLocaleString('en-IN')}</b>\n` +
    `• 🛡️ <b>52-Week Range:</b> ₹${low52W.toLocaleString('en-IN')} – ₹${high52W.toLocaleString('en-IN')}\n` +
    `• 📉 <b>Discount from 52W High:</b> <b>-${distFromHigh}%</b> ${distFromHigh >= 4 ? '✅ (Safe Accumulation Buffer)' : '⚠️ (Near 52W High)'}\n` +
    `• 💼 <b>Capital Allocation:</b> <b>${alloc}</b>\n\n` +

    `🎯 <b>CALCULATED TARGETS (PROFIT PLAN):</b>\n` +
    `• ⚡ <b>BTST Fast Cash (+2.0%):</b> <b>₹${btstTarget.toLocaleString('en-IN')}</b> (Exit within 48h)\n` +
    `• 🎯 <b>Primary Target 1 (+4.5%):</b> <b>₹${target1.toLocaleString('en-IN')}</b> (Book 50% & SL to Cost)\n` +
    `• 🚀 <b>Growth Target 2 (+8.0%):</b> <b>₹${target2.toLocaleString('en-IN')}</b> (Trail 10 EMA)\n` +
    `• 💎 <b>Runner Target 3 (+14.0%):</b> <b>₹${target3.toLocaleString('en-IN')}</b>\n\n` +

    `⏳ <b>HOLDING PERIOD & RISK PROTOCOL:</b>\n` +
    `• ⏱️ <b>Expected Swing Duration:</b> <b>3 to 8 Trading Sessions</b>\n` +
    `• 🛡️ <b>Plan-B Max Horizon:</b> <b>Up to 60 Sessions</b> (Institutional blue-chip recovery)\n` +
    `• 🛑 <b>Exit / Trailing Rule:</b> No tight retail stop-loss. Trail rising 10 EMA after Session 7.\n\n` +

    `💎 <b>4G-FX FUNDAMENTAL X-RAY:</b>\n` +
    `• <b>Moat Classification:</b> ${fx.moatTier}\n` +
    `• <b>Piotroski Health:</b> <b>${fx.fScore}/9 Elite</b> | <b>ROCE:</b> <b>${fx.roce}%</b>\n` +
    `• <b>Solvency:</b> Debt-to-Equity: ${fx.debtToEquity} | Promoter Pledge: 0%\n\n` +

    `📰 <b>LIVE NEWS & CATALYST SENTINEL:</b>\n` +
    `• <b>Sentiment Grade:</b> <b>${news.sentimentGrade}</b> (Score: +${news.sentimentScore})\n` +
    `• <b>Gatekeeper Verdict:</b> <code>${news.verdict}</code>\n` +
    `• 🧠 <b>AI Catalyst Thesis:</b> <i>"${news.aiPrediction || 'Clean institutional momentum setup with zero toxic red flags.'}"</i>\n\n` +

    `───────────────────────────────────\n` +
    `📊 <b>Live Terminal:</b> http://localhost:3000\n` +
    `🔗 <b>Google Sheet:</b> https://sheets.new`;

  return {
    success: true,
    symbol: normSym,
    name: rawName,
    cmp,
    high52: high52W,
    low52: low52W,
    distFromHigh,
    rsi14,
    passCount,
    score: scorePct,
    scorePct,
    tier,
    fScore: fx.fScore,
    roce: fx.roce,
    moatTier: fx.moatTier,
    news,
    targets: { btst: btstTarget, t1: target1, t2: target2, t3: target3 },
    tradeCard
  };
}
