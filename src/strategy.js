import yahooFinance from 'yahoo-finance2';

/**
 * Calculates Simple Moving Average (SMA)
 * @param {number[]} data - Array of prices
 * @param {number} period - SMA period
 * @returns {number[]} Array of SMA values matching the input index
 */
export function calculateSMA(data, period) {
  const sma = new Array(data.length).fill(null);
  if (data.length < period) return sma;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  sma[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    sum = sum - data[i - period] + data[i];
    sma[i] = sum / period;
  }
  return sma;
}

/**
 * Calculates Exponential Moving Average (EMA)
 * @param {number[]} data - Array of prices
 * @param {number} period - EMA period
 * @returns {number[]} Array of EMA values matching the input index
 */
export function calculateEMA(data, period) {
  const ema = new Array(data.length).fill(null);
  if (data.length < period) return ema;

  // Initialize with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  let currentEma = sum / period;
  ema[period - 1] = currentEma;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    currentEma = (data[i] - currentEma) * multiplier + currentEma;
    ema[i] = currentEma;
  }
  return ema;
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's smoothing technique
 * @param {number[]} data - Array of close prices
 * @param {number} period - RSI period (default 14)
 * @returns {number[]} Array of RSI values matching the input index
 */
export function calculateRSI(data, period = 14) {
  const rsi = new Array(data.length).fill(null);
  if (data.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  // First RSI calculation
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi[period] = 100 - 100 / (1 + rs);
  }

  // Wilder's smoothing for subsequent values
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    let currentGain = 0;
    let currentLoss = 0;
    if (diff > 0) {
      currentGain = diff;
    } else {
      currentLoss = -diff;
    }

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  return rsi;
}

/**
 * Calculates Average True Range (ATR)
 * @param {object[]} candles - Array of OHLCV candles ({high, low, close})
 * @param {number} period - ATR period (default 14)
 * @returns {number[]} Array of ATR values matching the input index
 */
export function calculateATR(candles, period = 14) {
  const atr = new Array(candles.length).fill(null);
  if (candles.length <= period) return atr;

  const tr = new Array(candles.length).fill(0);
  tr[0] = candles[0].high - candles[0].low;

  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prevC = candles[i - 1].close;
    
    tr[i] = Math.max(
      h - l,
      Math.abs(h - prevC),
      Math.abs(l - prevC)
    );
  }

  // First ATR is SMA of TR
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    trSum += tr[i];
  }
  let currentAtr = trSum / period;
  atr[period] = currentAtr;

  // Subsequent ATR values (Wilder's smoothing)
  for (let i = period + 1; i < candles.length; i++) {
    currentAtr = (currentAtr * (period - 1) + tr[i]) / period;
    atr[i] = currentAtr;
  }

  return atr;
}

/**
 * Generates realistic synthetic stock data for testing and rate-limit fallbacks.
 * Uses a random walk model with a positive trend drift (to test uptrend swing signals).
 */
export function generateMockData(symbol, startDate, endDate) {
  console.warn(`[Fallback] Generating realistic simulated stock data for ${symbol}.`);
  const data = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Choose sensible starting price depending on the symbol
  let price = 150.0;
  if (symbol.includes('TATASTEEL')) price = 190.0;
  else if (symbol.includes('TCS')) price = 3400.0;
  else if (symbol.includes('RELIANCE')) price = 2400.0;
  else if (symbol.includes('INFY')) price = 1450.0;
  else if (symbol.includes('HDFCBANK')) price = 1600.0;
  else if (symbol.includes('AAPL')) price = 220.0;
  else if (symbol.includes('MSFT')) price = 415.0;
  else if (symbol.includes('NVDA')) price = 125.0;
  else if (symbol.includes('TSLA')) price = 210.0;

  let currentPrice = price;
  const rawDate = new Date(start);

  for (let i = 0; i <= diffDays; i++) {
    const dayOfWeek = rawDate.getDay();
    // Only generate weekday trading sessions
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Normal distribution random walk using Box-Muller transform
      const drift = 0.08; // 0.08% daily upward trend drift
      const volatility = 1.6; // 1.6% daily deviation
      
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      
      const dailyReturn = drift + z * volatility;
      const prevClose = currentPrice;
      currentPrice = prevClose * (1 + dailyReturn / 100);

      // Construct realistic High, Low, and Open relative to Close
      const open = prevClose * (1 + (Math.random() - 0.5) * 0.4 / 100);
      const high = Math.max(open, currentPrice) * (1 + Math.random() * 1.3 / 100);
      const low = Math.min(open, currentPrice) * (1 - Math.random() * 1.3 / 100);
      const volume = Math.floor(2000000 + Math.random() * 8000000);

      data.push({
        date: new Date(rawDate),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(currentPrice.toFixed(2)),
        volume: volume,
        isSimulated: true
      });
    }
    rawDate.setDate(rawDate.getDate() + 1);
  }

  return data;
}

/**
 * Fetches and formats stock historical data. Falls back to generating synthetic
 * data if the Yahoo Finance API is unavailable or rate limited.
 * @param {string} symbol - Ticker symbol
 * @param {Date} startDate - Start Date
 * @param {Date} endDate - End Date
 * @returns {Promise<object[]>} Array of formatted daily candles
 */
export async function getHistoricalData(symbol, startDate, endDate) {
  try {
    const queryOptions = {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d',
    };
    
    const result = await yahooFinance.chart(symbol, queryOptions);
    if (!result || !result.quotes || result.quotes.length === 0) {
      throw new Error(`No data returned for symbol: ${symbol}`);
    }
    
    // Sort chronologically and filter out invalid rows
    return result.quotes
      .filter(bar => bar.close !== undefined && bar.high !== undefined && bar.low !== undefined)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (error) {
    console.error(`Error fetching live data for ${symbol}: ${error.message}. Using synthetic fallback data.`);
    return generateMockData(symbol, startDate, endDate);
  }
}

/**
 * Scans a list of stocks to find currently active swing signals
 * @param {string[]} symbols - Array of tickers
 * @returns {Promise<object[]>} Array of tickers with their signal status
 */
export async function scanStocks(symbols) {
  const scanResults = [];
  const endDate = new Date();
  // Fetch ~350 days of data to make sure 200 SMA has enough warm-up buffer
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 365);

  for (const symbol of symbols) {
    try {
      const data = await getHistoricalData(symbol, startDate, endDate);
      if (data.length < 200) {
        scanResults.push({ symbol, status: 'INSUFFICIENT_DATA', error: 'Less than 200 days of historical data' });
        continue;
      }

      const closes = data.map(d => d.close);
      const sma200 = calculateSMA(closes, 200);
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      const rsi = calculateRSI(closes, 14);
      const atr = calculateATR(data, 14);

      const len = data.length;
      const lastIndex = len - 1;

      // Extract current parameters
      const currentClose = data[lastIndex].close;
      const currentOpen = data[lastIndex].open;
      const currentHigh = data[lastIndex].high;
      const currentLow = data[lastIndex].low;
      const currentSma200 = sma200[lastIndex];
      const currentEma20 = ema20[lastIndex];
      const currentEma50 = ema50[lastIndex];
      const currentRsi = rsi[lastIndex];
      const currentAtr = atr[lastIndex];

      // Check filters
      const isAbove200SMA = currentClose > currentSma200;
      const isEmaBullish = currentEma20 > currentEma50;
      const inUptrend = isAbove200SMA && isEmaBullish;

      // Check pullback: did RSI dip below 43 in the last 5 days?
      let recentPullback = false;
      let minRsiInPullback = 100;
      for (let i = Math.max(0, lastIndex - 5); i < lastIndex; i++) {
        if (rsi[i] !== null && rsi[i] < 43) {
          recentPullback = true;
          if (rsi[i] < minRsiInPullback) {
            minRsiInPullback = rsi[i];
          }
        }
      }

      // Check entry trigger:
      // 1. We are in an uptrend.
      // 2. We had a recent pullback (RSI dipped below 43).
      // 3. Current day is green, and either current RSI crosses back above 40, or price bounces off the 20 EMA / 50 EMA.
      const isGreenDay = currentClose > currentOpen;
      const rsiReversal = currentRsi > 40 && rsi[lastIndex - 1] <= 40;
      const emaSupportBounce = currentLow <= currentEma20 * 1.01 && currentClose > currentEma20;
      
      const hasSignal = inUptrend && recentPullback && isGreenDay && (rsiReversal || emaSupportBounce);

      let action = 'HOLD';
      let entryPrice = null;
      let stopLoss = null;
      let takeProfit = null;
      let riskRewardRatio = 2.0;

      if (hasSignal) {
        action = 'BUY';
        entryPrice = parseFloat(currentClose.toFixed(2));
        // Stop loss: Close - 2 * ATR
        const slAmount = 2 * currentAtr;
        stopLoss = parseFloat((entryPrice - slAmount).toFixed(2));
        const risk = entryPrice - stopLoss;
        takeProfit = parseFloat((entryPrice + risk * riskRewardRatio).toFixed(2));
      }

      scanResults.push({
        symbol,
        date: data[lastIndex].date,
        action,
        currentPrice: parseFloat(currentClose.toFixed(2)),
        sma200: currentSma200 ? parseFloat(currentSma200.toFixed(2)) : null,
        ema20: currentEma20 ? parseFloat(currentEma20.toFixed(2)) : null,
        ema50: currentEma50 ? parseFloat(currentEma50.toFixed(2)) : null,
        rsi: currentRsi ? parseFloat(currentRsi.toFixed(2)) : null,
        atr: currentAtr ? parseFloat(currentAtr.toFixed(2)) : null,
        entryPrice,
        stopLoss,
        takeProfit,
        inUptrend,
        recentPullback,
        minRsiInPullback: recentPullback ? parseFloat(minRsiInPullback.toFixed(2)) : null
      });

    } catch (error) {
      console.error(`Error scanning ${symbol}:`, error);
      scanResults.push({ symbol, action: 'ERROR', error: error.message });
    }
  }

  return scanResults;
}

/**
 * Backtests the swing strategy on a specific stock
 * @param {string} symbol - Ticker symbol
 * @param {Date} startDate - Backtest start date
 * @param {Date} endDate - Backtest end date
 * @param {number} initialCapital - Starting account balance (default 10,000)
 * @returns {Promise<object>} Backtest statistics and trade history
 */
export async function backtestStock(symbol, startDate, endDate, initialCapital = 10000) {
  try {
    // Fetch a bit more data before the start date to populate indicators (200 SMA needs ~10 months of data beforehand)
    const dataStart = new Date(startDate);
    dataStart.setMonth(dataStart.getMonth() - 10);
    
    const data = await getHistoricalData(symbol, dataStart, endDate);
    if (data.length < 200) {
      throw new Error(`Insufficient historical data for backtesting ${symbol}. Need at least 200 days.`);
    }

    const closes = data.map(d => d.close);
    const sma200 = calculateSMA(closes, 200);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const rsi = calculateRSI(closes, 14);
    const atr = calculateATR(data, 14);

    const trades = [];
    let capital = initialCapital;
    let position = null; // { entryPrice, entryDate, sl, tp, shares, risk }
    const equityCurve = [];

    // Find the first index where the actual backtest period starts
    const testStartIndex = data.findIndex(bar => new Date(bar.date) >= new Date(startDate));
    if (testStartIndex === -1) {
      throw new Error(`No data found in the specified backtest range for ${symbol}`);
    }

    // Walk through historical data from testStartIndex to the end
    for (let i = testStartIndex; i < data.length; i++) {
      const bar = data[i];
      const dateStr = new Date(bar.date).toISOString().split('T')[0];

      // Re-evaluate indicators at this index
      const currentClose = bar.close;
      const currentOpen = bar.open;
      const currentHigh = bar.high;
      const currentLow = bar.low;
      
      const currentSma200 = sma200[i];
      const currentEma20 = ema20[i];
      const currentEma50 = ema50[i];
      const currentRsi = rsi[i];
      const currentAtr = atr[i];

      // Check if indicator calculations are warmed up
      if (!currentSma200 || !currentEma20 || !currentEma50 || !currentRsi || !currentAtr) {
        equityCurve.push({ date: dateStr, equity: capital });
        continue;
      }

      // Check active trade exits
      if (position) {
        let exitTriggered = false;
        let exitPrice = 0;
        let exitReason = '';

        // Stop Loss check
        if (currentLow <= position.sl) {
          exitTriggered = true;
          exitPrice = position.sl;
          exitReason = 'STOP_LOSS';
          // Account for gap downs below SL
          if (currentOpen < position.sl) {
            exitPrice = currentOpen;
          }
        } 
        // Take Profit check
        else if (currentHigh >= position.tp) {
          exitTriggered = true;
          exitPrice = position.tp;
          exitReason = 'TAKE_PROFIT';
          // Account for gap ups above TP
          if (currentOpen > position.tp) {
            exitPrice = currentOpen;
          }
        }

        if (exitTriggered) {
          const rawReturn = exitPrice - position.entryPrice;
          const percentageReturn = (rawReturn / position.entryPrice) * 100;
          const cashReturn = position.shares * rawReturn;
          capital += cashReturn;

          trades.push({
            ticker: symbol,
            entryDate: position.entryDate,
            exitDate: dateStr,
            entryPrice: position.entryPrice,
            exitPrice: parseFloat(exitPrice.toFixed(2)),
            shares: position.shares,
            returnPct: parseFloat(percentageReturn.toFixed(2)),
            profit: parseFloat(cashReturn.toFixed(2)),
            reason: exitReason
          });

          position = null;
        }
      }

      // Check trade entries (only if we don't have an active position)
      if (!position) {
        const isAbove200SMA = currentClose > currentSma200;
        const isEmaBullish = currentEma20 > currentEma50;
        const inUptrend = isAbove200SMA && isEmaBullish;

        // Pullback: RSI below 43 within last 5 bars
        let recentPullback = false;
        for (let j = Math.max(0, i - 5); j < i; j++) {
          if (rsi[j] !== null && rsi[j] < 43) {
            recentPullback = true;
            break;
          }
        }

        const isGreenDay = currentClose > currentOpen;
        const rsiReversal = currentRsi > 40 && rsi[i - 1] <= 40;
        const emaSupportBounce = currentLow <= currentEma20 * 1.01 && currentClose > currentEma20;

        const hasSignal = inUptrend && recentPullback && isGreenDay && (rsiReversal || emaSupportBounce);

        if (hasSignal) {
          const entryPrice = currentClose;
          const slAmount = 2 * currentAtr;
          const sl = entryPrice - slAmount;
          const tp = entryPrice + (entryPrice - sl) * 2.0; // 1:2 R:R

          // Risk Management: Risk 2% of current account size per trade
          const maxRiskCash = capital * 0.02;
          const riskPerShare = entryPrice - sl;
          
          if (riskPerShare > 0) {
            const shares = Math.floor(maxRiskCash / riskPerShare);
            const totalCost = shares * entryPrice;

            // Make sure we have enough capital to buy these shares
            if (shares > 0 && totalCost <= capital) {
              position = {
                entryPrice: parseFloat(entryPrice.toFixed(2)),
                entryDate: dateStr,
                sl: parseFloat(sl.toFixed(2)),
                tp: parseFloat(tp.toFixed(2)),
                shares: shares,
                risk: parseFloat(riskPerShare.toFixed(2))
              };
            }
          }
        }
      }

      // Calculate current equity (including open position value if any)
      let currentEquity = capital;
      if (position) {
        const openPnl = position.shares * (currentClose - position.entryPrice);
        currentEquity += openPnl;
      }
      equityCurve.push({
        date: dateStr,
        equity: parseFloat(currentEquity.toFixed(2)),
        price: parseFloat(currentClose.toFixed(2))
      });
    }

    // Force close any open position at the very end of backtest for accounting
    if (position) {
      const finalBar = data[data.length - 1];
      const finalClose = finalBar.close;
      const finalDate = new Date(finalBar.date).toISOString().split('T')[0];
      const rawReturn = finalClose - position.entryPrice;
      const percentageReturn = (rawReturn / position.entryPrice) * 100;
      const cashReturn = position.shares * rawReturn;
      capital += cashReturn;

      trades.push({
        ticker: symbol,
        entryDate: position.entryDate,
        exitDate: finalDate,
        entryPrice: position.entryPrice,
        exitPrice: parseFloat(finalClose.toFixed(2)),
        shares: position.shares,
        returnPct: parseFloat(percentageReturn.toFixed(2)),
        profit: parseFloat(cashReturn.toFixed(2)),
        reason: 'FORCED_CLOSE'
      });
      position = null;
      equityCurve[equityCurve.length - 1].equity = parseFloat(capital.toFixed(2));
    }

    // Compile Statistics
    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.profit > 0);
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    const totalProfit = trades.reduce((acc, t) => t.profit > 0 ? acc + t.profit : acc, 0);
    const totalLoss = trades.reduce((acc, t) => t.profit < 0 ? acc + Math.abs(t.profit) : acc, 0);
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;

    const netProfit = capital - initialCapital;
    const returnOnInvestment = (netProfit / initialCapital) * 100;

    // Calculate maximum drawdown
    let peak = initialCapital;
    let maxDrawdown = 0;
    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const drawdown = ((peak - point.equity) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      symbol,
      initialCapital,
      finalCapital: parseFloat(capital.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      roi: parseFloat(returnOnInvestment.toFixed(2)),
      totalTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      trades,
      equityCurve
    };

  } catch (error) {
    console.error(`Backtest error for ${symbol}:`, error);
    throw error;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Re-exports for Enhanced Quantitative Analysis Engines
// ══════════════════════════════════════════════════════════════════════════
export * from './technical_analysis.js';
export * from './fundamental_xray.js';
export * from './news_catalyst_scanner.js';


