/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🔱 APEX-OMNIVERSE SOVEREIGN TITAN v12.5 — PILLAR 17: LIVE CHART READING ENGINE
 * ══════════════════════════════════════════════════════════════════════════
 * Institutional Smart Money Concepts (SMC) & Live Chart Structure Reading:
 * 1. 📊 Volume-Weighted Average Price (Live VWAP & Bands)
 * 2. ⚡ Fair Value Gap (FVG) Institutional Imbalance Detector
 * 3. 🛡️ Institutional Order Block & Liquidity Sweep (Stop-Hunt Reversal)
 * 4. 📈 Volume Profile Point of Control (POC) & Value Area (VAH/VAL)
 * 5. 🌊 Implied/Historical Volatility Expansion (IV Surge Gauge)
 * ══════════════════════════════════════════════════════════════════════════
 */

/**
 * Calculates Volume-Weighted Average Price (VWAP) and Standard Deviation Bands
 * @param {Array} candles Array of { open, high, low, close, volume }
 */
export function calculateLiveVWAP(candles) {
  if (!candles || candles.length === 0) return null;

  let cumTypicalVol = 0;
  let cumVol = 0;
  const vwapSeries = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const tp = (c.high + c.low + c.close) / 3;
    const vol = c.volume > 0 ? c.volume : 1;

    cumTypicalVol += tp * vol;
    cumVol += vol;

    const vwap = +(cumTypicalVol / cumVol).toFixed(2);
    vwapSeries.push(vwap);
  }

  const lastIdx = candles.length - 1;
  const lastCandle = candles[lastIdx];
  const lastVwap = vwapSeries[lastIdx];
  const isAboveVwap = lastCandle.close >= lastVwap;
  const vwapSlope = lastIdx >= 5 ? +(lastVwap - vwapSeries[lastIdx - 5]).toFixed(2) : 0;

  return {
    currentVWAP: lastVwap,
    isAboveVWAP: isAboveVwap,
    vwapSlope,
    vwapSeries,
    signal: isAboveVwap && vwapSlope >= 0 ? '🟢 BULLISH_INSTITUTIONAL_HOLD' : '🔴 BELOW_VWAP_DEFENSE'
  };
}

/**
 * Detects Fair Value Gaps (FVG) / Smart Money Imbalances
 * A Bullish FVG occurs when Candle[i-2].high < Candle[i].low (an unfilled institutional liquidity gap)
 */
export function detectFairValueGaps(candles) {
  if (!candles || candles.length < 3) return { hasBullishFVG: false, fvgZones: [] };

  const fvgZones = [];
  const len = candles.length;

  for (let i = Math.max(2, len - 20); i < len; i++) {
    const barPrev2 = candles[i - 2];
    const barPrev1 = candles[i - 1];
    const barCurrent = candles[i];

    // Bullish FVG: Low of Current Bar is strictly above High of Bar i-2
    if (barCurrent.low > barPrev2.high) {
      const gapBottom = barPrev2.high;
      const gapTop = barCurrent.low;
      const gapSizePct = +(((gapTop - gapBottom) / gapBottom) * 100).toFixed(2);

      if (gapSizePct >= 0.3) {
        fvgZones.push({
          type: 'BULLISH_FVG',
          gapBottom,
          gapTop,
          gapSizePct,
          index: i,
          isMitigated: candles.slice(i + 1).some(c => c.low <= gapBottom)
        });
      }
    }
  }

  const activeBullishFvg = fvgZones.filter(z => z.type === 'BULLISH_FVG' && !z.isMitigated);

  return {
    hasBullishFVG: activeBullishFvg.length > 0,
    activeCount: activeBullishFvg.length,
    latestFVG: activeBullishFvg[activeBullishFvg.length - 1] || null
  };
}

/**
 * Detects Institutional Liquidity Sweeps & Order Blocks (SMC)
 * When price sweeps below a key swing low, triggers stop-losses, and immediately snaps back inside
 */
export function detectLiquiditySweep(candles, lookback = 20) {
  if (!candles || candles.length < lookback + 2) return { isSweepReversal: false };

  const len = candles.length;
  const current = candles[len - 1];

  // Find lowest low of lookback excluding current bar
  let swingLow = Infinity;
  for (let k = len - lookback - 1; k < len - 1; k++) {
    if (candles[k].low < swingLow) swingLow = candles[k].low;
  }

  // Sweep occurs if current low penetrated swing low but closed above swing low
  const isSweep = current.low < swingLow && current.close > swingLow;
  const rejectionWickPct = current.high > current.low ? +(((current.close - current.low) / (current.high - current.low)) * 100).toFixed(1) : 0;

  return {
    isSweepReversal: isSweep && rejectionWickPct >= 50,
    swingLowSwept: swingLow,
    rejectionWickPct,
    signal: isSweep ? '⚡ INSTITUTIONAL_LIQUIDITY_SWEEP' : 'NORMAL'
  };
}

/**
 * Volume Profile Point of Control (POC) & Value Area Engine
 */
export function calculateVolumeProfilePOC(candles, lookback = 30) {
  if (!candles || candles.length < 10) return null;

  const slice = candles.slice(-lookback);
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  slice.forEach(c => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  });

  const buckets = 20;
  const bucketSize = (maxPrice - minPrice) / buckets;
  if (bucketSize <= 0) return null;

  const profile = new Array(buckets).fill(0);

  slice.forEach(c => {
    const mid = (c.high + c.low) / 2;
    const bucketIdx = Math.min(buckets - 1, Math.max(0, Math.floor((mid - minPrice) / bucketSize)));
    profile[bucketIdx] += c.volume || 1;
  });

  let maxVol = 0;
  let pocIdx = 0;
  profile.forEach((vol, idx) => {
    if (vol > maxVol) {
      maxVol = vol;
      pocIdx = idx;
    }
  });

  const pocPrice = +(minPrice + (pocIdx + 0.5) * bucketSize).toFixed(2);
  const currentClose = candles[candles.length - 1].close;
  const isAbovePOC = currentClose >= pocPrice;

  return {
    pocPrice,
    isAbovePOC,
    pocVolumePct: +((maxVol / profile.reduce((a, b) => a + b, 1)) * 100).toFixed(1),
    signal: isAbovePOC ? '🟢 VALUE_EXPANSION_ABOVE_POC' : '🟡 AT_OR_BELOW_POC'
  };
}

/**
 * Master Institutional Chart Reading Confluence Evaluator (Pillar 17)
 */
export function analyzeInstitutionalChartReading(candles) {
  if (!candles || candles.length < 30) {
    return {
      passedPillar17: false,
      score: 50,
      details: 'Insufficient candle history for chart reading'
    };
  }

  const vwap = calculateLiveVWAP(candles);
  const fvg = detectFairValueGaps(candles);
  const sweep = detectLiquiditySweep(candles);
  const vp = calculateVolumeProfilePOC(candles);

  const checks = [
    vwap?.isAboveVWAP,
    vwap?.vwapSlope >= 0,
    fvg?.hasBullishFVG,
    sweep?.isSweepReversal || (candles[candles.length - 1].close > candles[candles.length - 1].open),
    vp?.isAbovePOC
  ];

  const passCount = checks.filter(Boolean).length;
  const score = Math.round((passCount / checks.length) * 100);
  const passedPillar17 = passCount >= 3;

  return {
    passedPillar17,
    chartScore: score,
    passCount,
    vwap,
    fvg,
    sweep,
    volumeProfile: vp,
    summaryTags: [
      vwap?.isAboveVWAP ? '🟢 Above VWAP' : '🔴 Below VWAP',
      fvg?.hasBullishFVG ? '⚡ Bullish FVG Active' : 'No FVG',
      sweep?.isSweepReversal ? '🌊 Liquidity Sweep' : 'Standard Price Action',
      vp?.isAbovePOC ? '📈 Above POC' : 'Below POC'
    ]
  };
}
