/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🔱 APEX-OMNIVERSE SOVEREIGN TITAN v12.0 — ADVANCED TECHNICAL ANALYSIS ENGINE
 * ══════════════════════════════════════════════════════════════════════════
 * Comprehensive institutional-grade technical indicators and quantitative math:
 *  - SuperTrend (ATR Volatility Trailing Bands)
 *  - MACD (Fast 12, Slow 26, Signal 9) & Histogram Momentum
 *  - Stochastic RSI (Wilder smoothed RSI + Stoch %K / %D)
 *  - Anchored VWAP (Volume Weighted Average Price from swing anchors)
 *  - ADX (Average Directional Index) & Directional Movement (+DI / -DI)
 *  - Bollinger Bands (%B, Bandwidth, Squeeze Detection)
 *  - TTM Squeeze Momentum (Bollinger inside Keltner Channel)
 *  - On-Balance Volume (OBV) & Institutional Accumulation Trend
 *  - Relative Strength (Mansfield RS vs Benchmark Index)
 *  - Wyckoff Spring & Liquidity Sweep Detection
 *  - Volume Spread Analysis (VSA) Wick Ratio & Absorption Bars
 * ══════════════════════════════════════════════════════════════════════════
 */

import { calculateSMA, calculateEMA, calculateRSI, calculateATR } from './strategy.js';

/**
 * SuperTrend Indicator
 * @param {object[]} candles - OHLCV data
 * @param {number} period - ATR period (default 10)
 * @param {number} multiplier - ATR multiplier (default 3.0)
 * @returns {object[]} Array of { supertrend, direction: 'UP' | 'DOWN', upperBand, lowerBand }
 */
export function calculateSuperTrend(candles, period = 10, multiplier = 3.0) {
  const result = new Array(candles.length).fill(null);
  const atr = calculateATR(candles, period);

  let prevUpper = null;
  let prevLower = null;
  let prevTrend = 1; // 1 = UP, -1 = DOWN
  let prevSuperTrend = null;

  for (let i = 0; i < candles.length; i++) {
    if (i < period || atr[i] === null) continue;

    const hl2 = (candles[i].high + candles[i].low) / 2;
    let basicUpper = hl2 + multiplier * atr[i];
    let basicLower = hl2 - multiplier * atr[i];

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (prevUpper !== null && prevLower !== null) {
      finalUpper = (basicUpper < prevUpper || candles[i - 1].close > prevUpper) ? basicUpper : prevUpper;
      finalLower = (basicLower > prevLower || candles[i - 1].close < prevLower) ? basicLower : prevLower;
    }

    let currentTrend = prevTrend;
    if (prevSuperTrend !== null) {
      if (prevTrend === 1 && candles[i].close < finalLower) {
        currentTrend = -1;
      } else if (prevTrend === -1 && candles[i].close > finalUpper) {
        currentTrend = 1;
      }
    }

    const supertrend = currentTrend === 1 ? finalLower : finalUpper;

    result[i] = {
      supertrend: parseFloat(supertrend.toFixed(2)),
      direction: currentTrend === 1 ? 'UP' : 'DOWN',
      upperBand: parseFloat(finalUpper.toFixed(2)),
      lowerBand: parseFloat(finalLower.toFixed(2))
    };

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevTrend = currentTrend;
    prevSuperTrend = supertrend;
  }

  return result;
}

/**
 * Moving Average Convergence Divergence (MACD)
 * @param {number[]} closes - Close prices
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal EMA period (default 9)
 * @returns {object[]} Array of { macd, signal, histogram, bullishCross, bearishCross }
 */
export function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const result = new Array(closes.length).fill(null);
  const fastEma = calculateEMA(closes, fastPeriod);
  const slowEma = calculateEMA(closes, slowPeriod);

  const rawMacdLine = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (fastEma[i] !== null && slowEma[i] !== null) {
      rawMacdLine[i] = fastEma[i] - slowEma[i];
    }
  }

  // Filter valid MACD values to calculate signal EMA
  const validMacdStart = rawMacdLine.findIndex(v => v !== null);
  if (validMacdStart === -1) return result;

  const validMacdValues = rawMacdLine.slice(validMacdStart);
  const signalEmaValid = calculateEMA(validMacdValues, signalPeriod);

  for (let i = validMacdStart; i < closes.length; i++) {
    const idxInValid = i - validMacdStart;
    const macdVal = rawMacdLine[i];
    const signalVal = signalEmaValid[idxInValid];

    if (macdVal !== null && signalVal !== null) {
      const histogram = macdVal - signalVal;
      const prev = result[i - 1];
      const bullishCross = prev && prev.histogram <= 0 && histogram > 0;
      const bearishCross = prev && prev.histogram >= 0 && histogram < 0;

      result[i] = {
        macd: parseFloat(macdVal.toFixed(3)),
        signal: parseFloat(signalVal.toFixed(3)),
        histogram: parseFloat(histogram.toFixed(3)),
        bullishCross,
        bearishCross
      };
    }
  }

  return result;
}

/**
 * Stochastic RSI (%K and %D)
 * @param {number[]} closes - Close prices
 * @param {number} rsiPeriod - RSI calculation period (default 14)
 * @param {number} stochPeriod - Stoch lookback period (default 14)
 * @param {number} kPeriod - %K smoothing SMA (default 3)
 * @param {number} dPeriod - %D smoothing SMA (default 3)
 * @returns {object[]} Array of { stochRsi, k, d, isOversold, isOverbought, goldenCross }
 */
export function calculateStochRSI(closes, rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3) {
  const result = new Array(closes.length).fill(null);
  const rsi = calculateRSI(closes, rsiPeriod);

  const rawStochRsi = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i < rsiPeriod + stochPeriod) continue;
    const rsiSlice = rsi.slice(i - stochPeriod + 1, i + 1);
    if (rsiSlice.some(v => v === null)) continue;

    const minRsi = Math.min(...rsiSlice);
    const maxRsi = Math.max(...rsiSlice);
    const denom = maxRsi - minRsi;
    rawStochRsi[i] = denom === 0 ? 50 : ((rsi[i] - minRsi) / denom) * 100;
  }

  const validStart = rawStochRsi.findIndex(v => v !== null);
  if (validStart === -1) return result;

  const validStoch = rawStochRsi.slice(validStart);
  const kLineValid = calculateSMA(validStoch, kPeriod);
  const dLineValid = calculateSMA(kLineValid.map(v => v === null ? 0 : v), dPeriod);

  for (let i = validStart; i < closes.length; i++) {
    const idx = i - validStart;
    const k = kLineValid[idx];
    const d = dLineValid[idx];

    if (k !== null && d !== null) {
      const prev = result[i - 1];
      const goldenCross = prev && prev.k <= prev.d && k > d;
      result[i] = {
        stochRsi: parseFloat((rawStochRsi[i] || 50).toFixed(2)),
        k: parseFloat(k.toFixed(2)),
        d: parseFloat(d.toFixed(2)),
        isOversold: k < 20 && d < 20,
        isOverbought: k > 80 && d > 80,
        goldenCross
      };
    }
  }

  return result;
}

/**
 * Average Directional Index (ADX) & Directional Movement System (+DI, -DI)
 * @param {object[]} candles - OHLCV data
 * @param {number} period - ADX period (default 14)
 * @returns {object[]} Array of { adx, plusDI, minusDI, trendStrength, isBullishTrend }
 */
export function calculateADX(candles, period = 14) {
  const result = new Array(candles.length).fill(null);
  if (candles.length <= period * 2) return result;

  const tr = new Array(candles.length).fill(0);
  const plusDM = new Array(candles.length).fill(0);
  const minusDM = new Array(candles.length).fill(0);

  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const prevH = candles[i - 1].high;
    const prevL = candles[i - 1].low;
    const prevC = candles[i - 1].close;

    tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));

    const upMove = h - prevH;
    const downMove = prevL - l;

    if (upMove > downMove && upMove > 0) plusDM[i] = upMove;
    if (downMove > upMove && downMove > 0) minusDM[i] = downMove;
  }

  // Wilder smoothing for TR, +DM, -DM
  let smoothTR = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothPlusDM = plusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let smoothMinusDM = minusDM.slice(1, period + 1).reduce((a, b) => a + b, 0);

  const dx = new Array(candles.length).fill(null);

  for (let i = period + 1; i < candles.length; i++) {
    smoothTR = smoothTR - (smoothTR / period) + tr[i];
    smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDM[i];
    smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDM[i];

    const plusDI = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = plusDI + minusDI;
    const diDiff = Math.abs(plusDI - minusDI);
    dx[i] = diSum !== 0 ? (diDiff / diSum) * 100 : 0;
  }

  // Calculate ADX (SMA of DX over period)
  for (let i = period * 2; i < candles.length; i++) {
    const dxSlice = dx.slice(i - period + 1, i + 1);
    if (dxSlice.some(v => v === null)) continue;
    const adx = dxSlice.reduce((a, b) => a + b, 0) / period;

    const plusDI = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;

    let trendStrength = 'WEAK';
    if (adx >= 25 && adx < 50) trendStrength = 'STRONG';
    else if (adx >= 50) trendStrength = 'VERY_STRONG';

    result[i] = {
      adx: parseFloat(adx.toFixed(2)),
      plusDI: parseFloat(plusDI.toFixed(2)),
      minusDI: parseFloat(minusDI.toFixed(2)),
      trendStrength,
      isBullishTrend: plusDI > minusDI && adx >= 20
    };
  }

  return result;
}

/**
 * Bollinger Bands (%B, Bandwidth, Standard Deviations)
 * @param {number[]} closes - Array of prices
 * @param {number} period - BB period (default 20)
 * @param {number} multiplier - Standard deviation multiplier (default 2.0)
 * @returns {object[]} Array of { upper, middle, lower, percentB, bandwidth }
 */
export function calculateBollingerBands(closes, period = 20, multiplier = 2.0) {
  const bands = new Array(closes.length).fill(null);
  const sma = calculateSMA(closes, period);

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || sma[i] === null) continue;
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = mean + multiplier * stdDev;
    const lower = mean - multiplier * stdDev;
    const percentB = upper !== lower ? (closes[i] - lower) / (upper - lower) : 0.5;
    const bandwidth = mean !== 0 ? ((upper - lower) / mean) * 100 : 0;

    bands[i] = {
      upper: parseFloat(upper.toFixed(2)),
      middle: parseFloat(mean.toFixed(2)),
      lower: parseFloat(lower.toFixed(2)),
      percentB: parseFloat(percentB.toFixed(3)),
      bandwidth: parseFloat(bandwidth.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2))
    };
  }

  return bands;
}

/**
 * TTM Squeeze Momentum Indicator (John Carter Volatility Compression)
 * Identifies high-energy coiling when Bollinger Bands compress inside Keltner Channels.
 * @param {object[]} candles - OHLCV data
 * @param {number} bbPeriod - Bollinger Band period (20)
 * @param {number} kcPeriod - Keltner Channel period (20)
 * @param {number} kcMult - Keltner ATR multiplier (1.5)
 * @returns {object[]} Array of { isSqueezed, momentum, momentumTrend: 'INCREASING' | 'DECREASING' }
 */
export function calculateTTMSqueeze(candles, bbPeriod = 20, kcPeriod = 20, kcMult = 1.5) {
  const result = new Array(candles.length).fill(null);
  const closes = candles.map(c => c.close);
  const bb = calculateBollingerBands(closes, bbPeriod, 2.0);
  const atr = calculateATR(candles, kcPeriod);
  const ema = calculateEMA(closes, kcPeriod);

  for (let i = 0; i < candles.length; i++) {
    if (!bb[i] || !atr[i] || !ema[i]) continue;

    const kcUpper = ema[i] + kcMult * atr[i];
    const kcLower = ema[i] - kcMult * atr[i];

    // Squeeze is active when BB is completely inside Keltner Channels
    const isSqueezed = bb[i].upper <= kcUpper && bb[i].lower >= kcLower;

    // Linear regression momentum proxy (price distance from mean)
    const momentum = closes[i] - ((ema[i] + bb[i].middle) / 2);
    const prev = result[i - 1];
    const momentumTrend = (prev && momentum >= prev.momentum) ? 'INCREASING' : 'DECREASING';

    result[i] = {
      isSqueezed,
      momentum: parseFloat(momentum.toFixed(2)),
      momentumTrend,
      squeezeFired: prev && prev.isSqueezed && !isSqueezed && momentum > 0
    };
  }

  return result;
}

/**
 * On-Balance Volume (OBV) & Institutional Flow
 * @param {number[]} closes - Close prices
 * @param {number[]} volumes - Volumes
 * @returns {number[]} Array of OBV values
 */
export function calculateOBV(closes, volumes) {
  const obv = [volumes[0] || 0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
    else obv.push(obv[i - 1]);
  }
  return obv;
}

/**
 * Mansfield Relative Strength (RS) vs Benchmark Index (e.g. Nifty 50)
 * @param {number[]} stockCloses - Stock close prices
 * @param {number[]} benchCloses - Benchmark index close prices
 * @param {number} period - Base period for smoothing (52 weeks / 50 sessions)
 * @returns {number[]} Array of RS values (> 0 means outperforming benchmark)
 */
export function calculateRelativeStrength(stockCloses, benchCloses, period = 50) {
  const minLen = Math.min(stockCloses.length, benchCloses.length);
  const rs = new Array(minLen).fill(null);
  const baseRatio = [];

  for (let i = 0; i < minLen; i++) {
    if (benchCloses[i] > 0) baseRatio.push(stockCloses[i] / benchCloses[i]);
    else baseRatio.push(0);
  }

  const smaBaseRatio = calculateSMA(baseRatio, period);

  for (let i = period - 1; i < minLen; i++) {
    if (smaBaseRatio[i] > 0) {
      const mansfieldRs = ((baseRatio[i] / smaBaseRatio[i]) - 1) * 100;
      rs[i] = parseFloat(mansfieldRs.toFixed(2));
    }
  }

  return rs;
}

/**
 * Wyckoff Spring & Liquidity Grab Detector
 * Identifies false breakdown trap bars that sweep previous swing low and close strong.
 * @param {object[]} candles - OHLCV data
 * @param {number} index - Current candle index
 * @returns {object} { isSpring, sweptLevel, closeRatio }
 */
export function detectWyckoffSpring(candles, index) {
  if (index < 3) return { isSpring: false };
  const cur = candles[index];
  const prev = candles[index - 1];
  const prevLow = prev.low;

  // Candle pierced previous low but closed back inside/above the previous close
  const sweptLow = cur.low < prevLow;
  const heldClose = cur.close > prevLow;
  const greenBar = cur.close > cur.open;

  const isSpring = sweptLow && heldClose && (greenBar || cur.close >= prev.close * 0.998);

  return {
    isSpring,
    sweptLevel: prevLow,
    reboundStrength: parseFloat(((cur.close - cur.low) / (cur.high - cur.low || 1) * 100).toFixed(1))
  };
}

/**
 * Volume Spread Analysis (VSA) Reversal & Wick Absorption Check
 * @param {object} candle - Current candle { open, high, low, close, volume }
 * @param {number} avgVolume - 20-day average volume
 * @returns {object} { isCleanAbsorption, upperWickRatio, lowerWickRatio, volumeRatio }
 */
export function analyzeVSAAbsorption(candle, avgVolume) {
  const range = candle.high - candle.low;
  if (range <= 0) return { isCleanAbsorption: false, upperWickRatio: 0, lowerWickRatio: 0, volumeRatio: 1.0 };

  const bodyTop = Math.max(candle.open, candle.close);
  const bodyBottom = Math.min(candle.open, candle.close);

  const upperWick = candle.high - bodyTop;
  const lowerWick = bodyBottom - candle.low;

  const upperWickRatio = upperWick / range;
  const lowerWickRatio = lowerWick / range;
  const volumeRatio = avgVolume > 0 ? candle.volume / avgVolume : 1.0;

  // Clean absorption: Green candle, minimal upper rejection (wick <= 20%), strong volume
  const isCleanAbsorption = candle.close > candle.open && upperWickRatio <= 0.20 && volumeRatio >= 1.20;

  return {
    isCleanAbsorption,
    upperWickRatio: parseFloat(upperWickRatio.toFixed(3)),
    lowerWickRatio: parseFloat(lowerWickRatio.toFixed(3)),
    volumeRatio: parseFloat(volumeRatio.toFixed(2))
  };
}
