import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { scanStocks, backtestStock } from './src/strategy.js';
import { syncToGoogleSheets, getSheetsConfig, saveSheetsConfig, prepareSyncPayload } from './src/google_sheets_sync.js';
import { startTelegramBotListener } from './src/telegram_bot_daemon.js';
import { startDevBot } from './antigravity_dev_bot.js';




const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const LEDGER_PATH = path.join(__dirname, 'data', 'portfolio_ledger.json');
const SHIELD_PATH = path.join(__dirname, 'config', 'shield_config.json');
const SCAN_HISTORY_PATH = path.join(__dirname, 'data', 'scan_history.json');
const REPORT_PATH = 'C:\\Users\\admin\\.gemini\\antigravity\\brain\\aba57e98-899a-4c66-82a0-907257668a7e\\master_sentinel_report.md';

let isScanRunning = false;

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/dashboard/summary — Executive KPIs & System Health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/dashboard/summary', (req, res) => {
  try {
    let ledger = { activePositions: [], closedPositions: [] };
    if (fs.existsSync(LEDGER_PATH)) {
      try { ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch (e) {}
    }

    let scanHistory = [];
    if (fs.existsSync(SCAN_HISTORY_PATH)) {
      try { scanHistory = JSON.parse(fs.readFileSync(SCAN_HISTORY_PATH, 'utf8')); } catch (e) {}
    }

    let shield = {};
    if (fs.existsSync(SHIELD_PATH)) {
      try { shield = JSON.parse(fs.readFileSync(SHIELD_PATH, 'utf8')); } catch (e) {}
    }

    const sheetsConfig = getSheetsConfig();

    const closed = ledger.closedPositions || [];
    const totalTrades = closed.length;
    const wins = closed.filter(p => p.profitCash > 0).length;
    const losses = closed.filter(p => p.profitCash <= 0).length;
    const winRate = totalTrades > 0 ? +((wins / totalTrades) * 100).toFixed(1) : 100;
    const totalRealizedProfit = closed.reduce((s, p) => s + (p.profitCash || 0), 0);

    const grossProfit = closed.filter(p => p.profitCash > 0).reduce((s, p) => s + p.profitCash, 0);
    const grossLoss = Math.abs(closed.filter(p => p.profitCash < 0).reduce((s, p) => s + p.profitCash, 0));
    const profitFactor = grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : 99.9;

    const latestScan = scanHistory.length > 0 ? scanHistory[scanHistory.length - 1] : null;

    res.json({
      success: true,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      kpis: {
        winRate,
        totalTrades,
        wins,
        losses,
        profitFactor,
        totalRealizedProfit: +totalRealizedProfit.toFixed(2),
        activePositionsCount: (ledger.activePositions || []).length,
        quarantinedCount: (shield.restrictedSymbols || []).length,
        lastScanDate: latestScan ? latestScan.date : 'N/A',
        lastScanCandidatesCount: latestScan ? (latestScan.candidates || []).length : 0,
        planBHorizon: shield.maxTimeStop || 45,
        isScanRunning
      },
      sheetsSync: {
        enabled: sheetsConfig.enabled,
        lastSyncTime: sheetsConfig.lastSyncTime,
        lastSyncStatus: sheetsConfig.lastSyncStatus,
        hasWebhook: !!(sheetsConfig.webhookUrl && sheetsConfig.webhookUrl.startsWith('http'))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/portfolio — Active Positions with Live Calculated Targets
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/portfolio', (req, res) => {
  try {
    let ledger = { activePositions: [], closedPositions: [] };
    if (fs.existsSync(LEDGER_PATH)) {
      try { ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch (e) {}
    }

    const positions = (ledger.activePositions || []).map(p => ({
      ...p,
      target1: +(p.entryPrice * 1.045).toFixed(2),
      target2: +(p.entryPrice * 1.080).toFixed(2),
      btstTarget: +(p.entryPrice * 1.020).toFixed(2)
    }));

    res.json({ success: true, count: positions.length, data: positions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/scans/history — Date-Wise Historical Scans ("Kis Date Ko Kya Scan Hua")
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/scans/history', (req, res) => {
  try {
    let scanHistory = [];
    if (fs.existsSync(SCAN_HISTORY_PATH)) {
      try { scanHistory = JSON.parse(fs.readFileSync(SCAN_HISTORY_PATH, 'utf8')); } catch (e) {}
    }

    const { date, tier } = req.query;
    let filtered = [...scanHistory];

    if (date) {
      filtered = filtered.filter(s => s.date === date);
    }

    // Available scan dates list for dropdown selector
    const availableDates = scanHistory.map(s => ({
      date: s.date,
      timestamp: s.timestamp,
      count: s.qualifiedCount || (s.candidates || []).length
    })).reverse();

    res.json({
      success: true,
      availableDates,
      totalScanDays: scanHistory.length,
      data: filtered.reverse()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/trades/closed — Trade Success History ("Kitne Stock Success Hue")
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/trades/closed', (req, res) => {
  try {
    let ledger = { activePositions: [], closedPositions: [] };
    if (fs.existsSync(LEDGER_PATH)) {
      try { ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch (e) {}
    }

    const closed = ledger.closedPositions || [];
    const wins = closed.filter(p => p.profitCash > 0);
    const losses = closed.filter(p => p.profitCash <= 0);

    const avgHoldDays = closed.length > 0
      ? +(closed.reduce((s, p) => s + (p.holdDays || 0), 0) / closed.length).toFixed(1)
      : 0;

    const avgWinPct = wins.length > 0
      ? +(wins.reduce((s, p) => s + (p.profitPct || 0), 0) / wins.length).toFixed(2)
      : 0;

    const avgLossPct = losses.length > 0
      ? +(losses.reduce((s, p) => s + Math.abs(p.profitPct || 0), 0) / losses.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      metrics: {
        totalTrades: closed.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        winRate: closed.length > 0 ? +((wins.length / closed.length) * 100).toFixed(1) : 100,
        avgHoldDays,
        avgWinPct,
        avgLossPct
      },
      trades: closed
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/shield/status — Live AI Risk Shield Policy & Blacklists
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/shield/status', (req, res) => {
  try {
    let shield = {
      minRsi14Limit: 48,
      minRsi7Limit: 28,
      maxBBPercentB: 0.28,
      maxWickRatio: 0.20,
      minVolSurge: 1.35,
      minGatePass: 9,
      maxTimeStop: 60,
      restrictedSymbols: ['CHOLAFIN.NS'],
      reasoning: []
    };

    if (fs.existsSync(SHIELD_PATH)) {
      try { shield = JSON.parse(fs.readFileSync(SHIELD_PATH, 'utf8')); } catch (e) {}
    }

    res.json({ success: true, shield });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /api/scan/trigger — Trigger Real-Time Master Sentinel Market Scan
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/scan/trigger', (req, res) => {
  if (isScanRunning) {
    return res.status(409).json({ success: false, message: 'Scan already in progress.' });
  }

  isScanRunning = true;
  console.log(`[API Trigger] 🚀 Initiating Master Sentinel live scan...`);

  const child = spawn('node', ['run_master_sentinel.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  child.on('close', (code) => {
    isScanRunning = false;
    console.log(`[API Trigger] ✅ Master Sentinel scan finished with exit code ${code}`);
  });

  res.json({
    success: true,
    message: 'Master Sentinel scan initiated in the background. Data will refresh shortly.',
    status: 'RUNNING'
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/shield/enhance — Trigger AI Risk Shield Recalibration
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/shield/enhance', (req, res) => {
  const child = spawn('node', ['run_adaptive_enhancer.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  child.on('close', (code) => {
    let shield = {};
    if (fs.existsSync(SHIELD_PATH)) {
      try { shield = JSON.parse(fs.readFileSync(SHIELD_PATH, 'utf8')); } catch (e) {}
    }
    res.json({
      success: true,
      message: 'AI Accuracy Enhancer executed successfully.',
      shield
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/sync/sheets — Push Live Data to Google Sheets
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/sync/sheets', async (req, res) => {
  try {
    const result = await syncToGoogleSheets();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET & POST /api/sync/config — Google Sheets Webhook Settings
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/sync/config', (req, res) => {
  res.json({ success: true, config: getSheetsConfig() });
});

app.post('/api/sync/config', (req, res) => {
  try {
    const { webhookUrl, enabled, autoSyncOnScan } = req.body;
    const updated = saveSheetsConfig({
      webhookUrl: webhookUrl !== undefined ? webhookUrl.trim() : undefined,
      enabled: enabled !== undefined ? enabled : true,
      autoSyncOnScan: autoSyncOnScan !== undefined ? autoSyncOnScan : true
    });
    res.json({ success: true, config: updated, message: 'Google Sheets configuration updated!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. GET & POST /api/telegram/config & POST /api/telegram/test — Telegram Bot Alerts
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/telegram/config', (req, res) => {
  res.json({ success: true, config: getTelegramConfig() });
});

app.post('/api/telegram/config', (req, res) => {
  try {
    const { botToken, chatId, enabled, notifyOnScan } = req.body;
    const updated = saveTelegramConfig({
      botToken: botToken !== undefined ? botToken.trim() : undefined,
      chatId: chatId !== undefined ? chatId.trim() : undefined,
      enabled: enabled !== undefined ? enabled : true,
      notifyOnScan: notifyOnScan !== undefined ? notifyOnScan : true
    });
    res.json({ success: true, config: updated, message: 'Telegram Bot settings saved!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/telegram/test', async (req, res) => {
  try {
    const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const msg = `🔱 <b>APEX-OMNIVERSE SOVEREIGN TITAN v12.0</b>\n` +
      `⚡ <b>Telegram Bot Test Alert Successful!</b>\n\n` +
      `📅 Timestamp: <i>${nowIST}</i>\n` +
      `🛡️ Status: Real-time scan and trade alerts are now actively linked to your Telegram chat!\n` +
      `📊 Web Dashboard: <code>http://localhost:3000</code>`;

    const result = await sendTelegramAlert(msg);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// 10. GET /api/stock/chart/:symbol — Interactive Candle & Indicator Chart Data
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/stock/chart/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 250);

    const data = await scanStocks ? await (async () => {
      const { getHistoricalData, calculateSMA, calculateEMA, calculateRSI, calculateBollingerBands } = await import('./src/strategy.js');
      const raw = await getHistoricalData(symbol, startDate, endDate);
      const closes = raw.map(d => d.close);
      const sma200 = calculateSMA(closes, 200);
      const sma50 = calculateSMA(closes, 50);
      const ema20 = calculateEMA(closes, 20);
      const rsi14 = calculateRSI(closes, 14);
      const bb = calculateBollingerBands(closes, 20, 2.0);

      const formatted = raw.map((d, idx) => ({
        date: new Date(d.date).toISOString().split('T')[0],
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        sma200: sma200[idx],
        sma50: sma50[idx],
        ema20: ema20[idx],
        rsi14: rsi14[idx],
        bbUpper: bb[idx]?.upper,
        bbLower: bb[idx]?.lower
      }));
      return formatted;
    })() : [];

    res.json({ success: true, symbol, count: data.length, candles: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET /api/export/csv/:tab — One-Click CSV Sheet Exporter
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/export/csv/:tab', (req, res) => {
  try {
    const tab = req.params.tab;
    const payload = prepareSyncPayload();
    let csvContent = '';
    let filename = `APEX_${tab}_${new Date().toISOString().split('T')[0]}.csv`;

    if (tab === 'portfolio') {
      csvContent = 'Symbol,Company Name,Entry Date,Entry Price,Current Price,PnL %,Days Held,Trade Stage,Target 1 (+4.5%),Target 2 (+8.0%),Action Plan\n';
      payload.activePositions.forEach(p => {
        csvContent += `"${p.symbol}","${p.name}","${p.entryDate}",${p.entryPrice},${p.currentPrice},"${p.pnlPct}%",${p.daysHeld},"${p.stage}",${p.target1},${p.target2},"${p.actionPlan}"\n`;
      });
    } else if (tab === 'scans') {
      csvContent = 'Scan Date,Symbol,Company Name,Signal Tier,CMP,52W Buffer,14-Pillar Score,F-Score,ROCE %,Moat Tier,RSI(14),Vol Surge,News Sentiment,News Verdict,Target 1,Target 2\n';
      payload.scanHistory.forEach(s => {
        csvContent += `"${s.scanDate}","${s.symbol}","${s.name}","${s.signalTier}",${s.cmp},"${s.distFrom52W}","${s.confluenceScore}","${s.fScore}","${s.roce}","${s.moatTier}",${s.rsi14},"${s.volSurge}","${s.newsSentiment}","${s.newsVerdict}",${s.target1},${s.target2}\n`;
      });
    } else if (tab === 'closed') {
      csvContent = 'Symbol,Company Name,Entry Date,Exit Date,Entry Price,Exit Price,Realized Return %,Cash PnL,Outcome,Exit Reason\n';
      payload.closedTrades.forEach(t => {
        csvContent += `"${t.symbol}","${t.name}","${t.entryDate}","${t.exitDate}",${t.entryPrice},${t.exitPrice},"${t.gainPct}%",${t.cashPnL},"${t.outcome}","${t.exitReason}"\n`;
      });
    } else if (tab === 'shield') {
      csvContent = 'System Setting / Rule,Active Value,Operational Detail\n';
      payload.aiShield.forEach(r => {
        csvContent += `"${r.setting}","${r.value}","${r.detail}"\n`;
      });
    } else {
      return res.status(400).send('Invalid tab name. Use portfolio, scans, closed, or shield.');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n${'═'.repeat(74)}`);
  console.log(`🚀  APEX-OMNIVERSE SOVEREIGN TITAN v12.0 — DASHBOARD SERVER RUNNING`);
  console.log(`👉  Local Dashboard: http://localhost:${PORT}`);
  console.log(`📊  Google Sheets Live Sync Engine: Ready`);
  console.log(`🤖  Telegram Bot Command Listener: Ready`);
  console.log(`${'═'.repeat(74)}\n`);

  // Start 2-way Trading & Gemini AI listener
  startTelegramBotListener();

  // Start Dedicated Antigravity Dev & Coding Bot
  startDevBot();
});


