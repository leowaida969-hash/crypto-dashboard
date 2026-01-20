import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineStyle } from "lightweight-charts";
import { motion, AnimatePresence } from "framer-motion";

/* ================= THEME ENGINE V6 ================= */
const THEMES = {
  SYSTEM: {
    name: "System",
    bg: "#f8fafc", panel: "#ffffff", text: "#0f172a", subText: "#64748b",
    border: "#e2e8f0", primary: "#2563eb", green: "#16a34a", red: "#dc2626",
    grid: "#f1f5f9", cardBg: "#ffffff", gold: "#d97706"
  },
  DARK: {
    name: "Dark",
    bg: "#0f172a", panel: "#1e293b", text: "#f8fafc", subText: "#94a3b8",
    border: "#334155", primary: "#3b82f6", green: "#22c55e", red: "#ef4444",
    grid: "#1e293b", cardBg: "#1e293b", gold: "#fbbf24"
  },
  MIDNIGHT: {
    name: "Midnight",
    bg: "#000000", panel: "#111111", text: "#e5e5e5", subText: "#888888",
    border: "#333333", primary: "#d4af37", green: "#d4af37", red: "#8b0000",
    grid: "#1a1a1a", cardBg: "#111111", gold: "#d4af37"
  }
};

const PAIRS = { 
  BTCUSDT: "BITCOIN", 
  ETHUSDT: "ETHEREUM", 
  SOLUSDT: "SOLANA", 
  PAXGUSDT: "GOLD (XAU)" 
};

const TIMEFRAMES = { 
  "15M": "15m", // Mapped to 15m (Binance standard)
  "30M": "30m", 
  "1H": "1h", 
  "4H": "4h", 
  "1D": "1d" 
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  if (!isLoggedIn) return <LoginGate onAuth={(v) => v === "123456" && setIsLoggedIn(true)} />;
  return <Dashboard />;
}

/* ================= DASHBOARD V6 ================= */
function Dashboard() {
  const chartContainerRef = useRef(null);
  const seriesInstance = useRef(null);
  const sessionSeriesRef = useRef(null);
  const linesRef = useRef([]); 
  const fibLinesRef = useRef([]); 

  const [currentTheme, setCurrentTheme] = useState("SYSTEM");
  const theme = THEMES[currentTheme];

  const [pair, setPair] = useState("BTCUSDT");
  const [tf, setTf] = useState("4H");
  const [showReport, setShowReport] = useState(false);
  const [ticker, setTicker] = useState({});
  const [newsIndex, setNewsIndex] = useState(0);
  
  // 🧠 MASTER INTELLIGENCE STATE
  const [intel, setIntel] = useState({
    price: 0,
    trend: "SCANNING",
    structure: { support: 0, resistance: 0, breakout: false },
    fib: { level: "None", label: "--" },
    pattern: "None Detected",
    zones: { entry: 0, tp: 0, sl: 0 },
    session: "Processing...",
    narrative: { bias: "Neutral", context: "Scanning...", strategy: "Wait for data" }
  });

  // 📰 SMART NEWS FEED
  const NEWS = [
    { title: "CPI Data Exceeds Forecast", impact: "HIGH", url: "#", source: "ForexFactory" },
    { title: "BTC 4H Close above 50 EMA", impact: "MED", url: "#", source: "TradingView" },
    { title: "Gold Demand Spikes on Geopolitics", impact: "HIGH", url: "#", source: "Bloomberg" },
    { title: "Fed Chair Powell Speaks Today", impact: "HIGH", url: "#", source: "CNBC" },
    { title: "Solana Network Upgrade Complete", impact: "LOW", url: "#", source: "Coindesk" }
  ];

  // 🔄 LIVE TICKER
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/price");
        const data = await res.json();
        const map = {};
        data.forEach(d => map[d.symbol] = parseFloat(d.price));
        setTicker(map);
      } catch(e) {}
    };
    fetchMarket();
    const t = setInterval(fetchMarket, 5000);
    const n = setInterval(() => setNewsIndex(p => (p+1)%NEWS.length), 5000);
    return () => { clearInterval(t); clearInterval(n); };
  }, []);

  /* ================= CHART ENGINE ================= */
  useEffect(() => {
    if (!chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = "";

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: theme.panel }, textColor: theme.text },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      width: chartContainerRef.current.clientWidth,
      height: 600,
      rightPriceScale: { borderColor: theme.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: theme.border },
    });

    const sessionSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "left", color: "transparent", priceFormat: { type: "volume" }, scaleMargins: { top: 0, bottom: 0 },
    });
    sessionSeriesRef.current = sessionSeries;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: theme.green, downColor: theme.red, borderVisible: false, wickUpColor: theme.green, wickDownColor: theme.red,
    });
    seriesInstance.current = series;

    fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${TIMEFRAMES[tf]}&limit=200`)
      .then(r=>r.json())
      .then(data => {
        const candles = data.map(x => ({ time: x[0]/1000, open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
        series.setData(candles);
        analyzeMarket(candles, series);
        drawSessions(candles, sessionSeries);
      });

    const resize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chart.remove(); };
  }, [pair, tf, currentTheme]);

  /* ================= 🧠 ANALYSIS LOGIC ================= */
  
  // 1. FIBONACCI PAINTER
  const drawFibonacci = (series, high, low, trend) => {
    fibLinesRef.current.forEach(l => series.removePriceLine(l));
    fibLinesRef.current = [];
    const diff = high - low;
    const levels = [0, 0.382, 0.5, 0.618, 0.786, 1];

    levels.forEach(level => {
      let price = trend === "BULLISH" ? high - (diff * level) : low + (diff * level);
      const isGolden = level === 0.618 || level === 0.786;
      const line = series.createPriceLine({
        price: price,
        color: isGolden ? theme.gold : theme.subText,
        lineWidth: isGolden ? 2 : 1,
        lineStyle: isGolden ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Fib ${level}`,
      });
      fibLinesRef.current.push(line);
    });
  };

  // 2. 🛡️ ADVANCED PATTERN DETECTOR (UPDATED)
  const detectPattern = (candles) => {
    if (candles.length < 3) return "Insufficient Data";

    const c0 = candles[candles.length - 1]; // Latest
    const c1 = candles[candles.length - 2]; 
    const c2 = candles[candles.length - 3]; 

    const isGreen = (c) => c.close > c.open;
    const isRed = (c) => c.close < c.open;
    const body = (c) => Math.abs(c.close - c.open);
    const range = (c) => c.high - c.low;
    const avgBody = (body(c0) + body(c1) + body(c2)) / 3;

    // --- TIER 1: COMPLEX 3-CANDLE PATTERNS ---
    // Morning Star
    if (isRed(c2) && body(c2) > avgBody && body(c1) < body(c2) * 0.5 && isGreen(c0) && c0.close > (c2.open + c2.close) / 2) 
      return "Morning Star (Bullish Reversal) ☀️";
    
    // Evening Star
    if (isGreen(c2) && body(c2) > avgBody && body(c1) < body(c2) * 0.5 && isRed(c0) && c0.close < (c2.open + c2.close) / 2) 
      return "Evening Star (Bearish Reversal) 🌑";

    // 3 White Soldiers
    if (isGreen(c2) && isGreen(c1) && isGreen(c0) && c0.close > c1.close && c1.close > c2.close && body(c0) > avgBody * 0.8) 
      return "3 White Soldiers (Momentum) 🚀";

    // 3 Black Crows
    if (isRed(c2) && isRed(c1) && isRed(c0) && c0.close < c1.close && c1.close < c2.close && body(c0) > avgBody * 0.8) 
      return "3 Black Crows (Crash) 📉";

    // --- TIER 2: 2-CANDLE PATTERNS ---
    // Inside Bar
    if (c0.high < c1.high && c0.low > c1.low) return "Inside Bar (Potential Breakout) ⚠️";
    // Engulfing
    if (isGreen(c0) && isRed(c1) && c0.close > c1.open && c0.open < c1.close) return "Bullish Engulfing";
    if (isRed(c0) && isGreen(c1) && c0.close < c1.open && c0.open > c1.close) return "Bearish Engulfing";

    // --- TIER 3: SINGLE CANDLE PATTERNS ---
    const wickUp = c0.high - Math.max(c0.open, c0.close);
    const wickDown = Math.min(c0.open, c0.close) - c0.low;

    if (wickDown > body(c0) * 2 && wickUp < body(c0)) return "Bullish Hammer 🔨";
    if (wickUp > body(c0) * 2 && wickDown < body(c0)) return "Shooting Star 🌠";
    if (body(c0) < range(c0) * 0.1) return "Doji (Indecision) 🤷";
    
    return "Continuation";
  };

  // 3. MAIN ANALYST
  const analyzeMarket = (candles, series) => {
    const last = candles[candles.length - 1];
    const subset = candles.slice(-50);
    const high = Math.max(...subset.map(c => c.high));
    const low = Math.min(...subset.map(c => c.low));
    
    // Trend & Structure
    const ema = subset.slice(-20).reduce((a,b)=>a+b.close,0)/20;
    const trend = last.close > ema ? "BULLISH" : "BEARISH";
    
    // CALL NEW PATTERN DETECTOR
    const pattern = detectPattern(candles);
    
    // Draw S/R
    linesRef.current.forEach(l => series.removePriceLine(l));
    linesRef.current = [];
    linesRef.current.push(series.createPriceLine({ price: low, color: theme.green, lineWidth: 2, lineStyle: LineStyle.Dotted, title: "SWING LOW" }));
    linesRef.current.push(series.createPriceLine({ price: high, color: theme.red, lineWidth: 2, lineStyle: LineStyle.Dotted, title: "SWING HIGH" }));

    // Draw Fibs
    drawFibonacci(series, high, low, trend);

    // Fib Analysis
    const range = high - low;
    const gpPrice = trend === "BULLISH" ? high - (range * 0.618) : low + (range * 0.618);
    const distToGp = Math.abs(last.close - gpPrice);
    let fibStatus = "No Confluence";
    if (distToGp < (range * 0.05)) fibStatus = "IN GOLDEN POCKET (0.618)";
    
    // Strategy Logic
    const risk = range * 0.2;
    const sl = trend === "BULLISH" ? last.close - risk : last.close + risk;
    const tp = trend === "BULLISH" ? last.close + (risk * 2) : last.close - (risk * 2);
    
    // UPDATED NARRATIVE LOGIC
    let patternBias = "Neutral";
    if (pattern.includes("Bullish") || pattern.includes("Soldiers") || pattern.includes("Hammer") || pattern.includes("Morning")) patternBias = "BULLISH";
    if (pattern.includes("Bearish") || pattern.includes("Crows") || pattern.includes("Shooting") || pattern.includes("Evening")) patternBias = "BEARISH";

    const narrativeText = `Price is currently ${trend} relative to the 20 EMA. ` + 
      (fibStatus.includes("GOLDEN") ? "We are reacting to a critical Golden Pocket (0.618) level. " : "Price is moving within the range. ") +
      `Market structure has printed a ${pattern}. ` +
      (patternBias !== "Neutral" && patternBias === trend ? "This pattern confirms the current trend momentum." : patternBias !== "Neutral" ? "This pattern suggests a potential reversal against the trend." : "");

    const suggestedAction = patternBias === "BULLISH" ? `Look for LONGS if price holds above $${last.low.toFixed(2)}` 
                          : patternBias === "BEARISH" ? `Look for SHORTS if price stays below $${last.high.toFixed(2)}`
                          : "Wait for clearer price action or breakout.";

    setIntel({
      price: last.close,
      trend,
      structure: { support: low, resistance: high },
      fib: { level: fibStatus, label: "0.618" },
      pattern,
      zones: { entry: last.close, tp, sl },
      session: getSessionName(),
      narrative: { 
        bias: trend, 
        context: narrativeText,
        strategy: suggestedAction
      }
    });
  };

  const getSessionName = () => {
    const h = new Date().getUTCHours();
    if (h >= 0 && h < 8) return "Asian Range";
    if (h >= 8 && h < 12) return "London Session";
    return "New York Session";
  };

  const drawSessions = (candles, sessionSeries) => {
    const data = candles.map(c => {
      const h = new Date(c.time * 1000).getUTCHours();
      let color = "transparent";
      if (h >= 0 && h < 8) color = theme.name === "Dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
      if (h >= 8 && h < 12) color = "rgba(234, 179, 8, 0.15)";
      if (h >= 13 && h < 17) color = "rgba(59, 130, 246, 0.15)";
      return { time: c.time, value: 100, color };
    });
    sessionSeries.setData(data);
  };

  return (
    <div style={{ background: theme.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: theme.text, transition: "0.3s" }}>
      
      {/* 📑 MASTER REPORT MODAL */}
      <AnimatePresence>
        {showReport && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: "1000px", height: "650px", background: theme.cardBg, borderRadius: "20px", border: `1px solid ${theme.border}`, display: "grid", gridTemplateColumns: "350px 1fr", overflow: "hidden" }}
            >
              {/* LEFT: VISUAL & DATA */}
              <div style={{ background: theme.bg, borderRight: `1px solid ${theme.border}`, padding: "30px", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "12px", color: theme.subText, letterSpacing: "2px", fontWeight: "bold", marginBottom: "20px" }}>STRATEGIC BLUEPRINT</div>
                
                {/* Visual Card */}
                <div style={{ background: theme.cardBg, borderRadius: "12px", border: `1px solid ${theme.border}`, padding: "20px", marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", color: theme.subText }}>TREND BIAS</span>
                    <span style={{ fontSize: "12px", fontWeight: "bold", color: intel.trend==="BULLISH"?theme.green:theme.red }}>{intel.trend}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", color: theme.subText }}>FIB STATUS</span>
                    <span style={{ fontSize: "12px", fontWeight: "bold", color: intel.fib.level.includes("GOLDEN")?theme.gold:theme.text }}>{intel.fib.level}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", color: theme.subText }}>PATTERN</span>
                    <span style={{ fontSize: "12px", fontWeight: "bold" }}>{intel.pattern}</span>
                  </div>
                </div>

                {/* Suggestions */}
                <div style={{ flex: 1 }}>
                   <div style={{ fontSize: "12px", color: theme.subText, marginBottom: "10px" }}>TRADE PARAMETERS</div>
                   <div style={{ padding: "15px", background: `${theme.green}15`, borderLeft: `4px solid ${theme.green}`, marginBottom: "10px", borderRadius: "4px" }}>
                     <div style={{ fontSize: "10px", color: theme.green, fontWeight: "bold" }}>TAKE PROFIT (TARGET)</div>
                     <div style={{ fontSize: "16px", fontWeight: "bold" }}>${intel.zones.tp.toFixed(2)}</div>
                   </div>
                   <div style={{ padding: "15px", background: `${theme.primary}15`, borderLeft: `4px solid ${theme.primary}`, marginBottom: "10px", borderRadius: "4px" }}>
                     <div style={{ fontSize: "10px", color: theme.primary, fontWeight: "bold" }}>ENTRY ZONE</div>
                     <div style={{ fontSize: "16px", fontWeight: "bold" }}>${intel.zones.entry.toFixed(2)}</div>
                   </div>
                   <div style={{ padding: "15px", background: `${theme.red}15`, borderLeft: `4px solid ${theme.red}`, borderRadius: "4px" }}>
                     <div style={{ fontSize: "10px", color: theme.red, fontWeight: "bold" }}>STOP LOSS (INVALIDATION)</div>
                     <div style={{ fontSize: "16px", fontWeight: "bold" }}>${intel.zones.sl.toFixed(2)}</div>
                   </div>
                </div>
              </div>

              {/* RIGHT: NARRATIVE & SUMMARY */}
              <div style={{ padding: "40px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "28px", color: theme.text }}>Analysis Report</h2>
                    <span style={{ color: theme.subText }}>Generated for {pair} on {tf} Timeframe</span>
                  </div>
                  <div style={{ background: theme.bg, padding: "8px 16px", borderRadius: "8px", border: `1px solid ${theme.border}`, fontWeight: "bold", color: theme.primary }}>
                    {intel.session}
                  </div>
                </div>

                <div style={{ marginBottom: "30px" }}>
                   <h3 style={{ fontSize: "16px", color: theme.text, marginBottom: "10px" }}>Technical Narrative</h3>
                   <p style={{ fontSize: "14px", lineHeight: "1.8", color: theme.subText }}>{intel.narrative.context}</p>
                </div>

                <div style={{ marginBottom: "30px" }}>
                   <h3 style={{ fontSize: "16px", color: theme.text, marginBottom: "10px" }}>Strategic Suggestion</h3>
                   <div style={{ padding: "20px", background: theme.bg, borderRadius: "12px", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: "15px" }}>
                      <div style={{ fontSize: "24px" }}>💡</div>
                      <div>
                        <div style={{ fontWeight: "bold", color: theme.text, marginBottom: "4px" }}>Recommended Action</div>
                        <div style={{ fontSize: "13px", color: theme.subText }}>{intel.narrative.strategy}</div>
                      </div>
                   </div>
                </div>

                <div style={{ marginTop: "auto", display: "flex", gap: "15px" }}>
                  <button onClick={() => setShowReport(false)} style={{ padding: "15px 30px", background: theme.primary, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", flex: 1 }}>Close Report</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🚀 MAIN LAYOUT */}
      <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "20px" }}>
        
        {/* TOP BAR: NEWS WIRE */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px", alignItems: "stretch" }}>
           {/* Logo */}
           <div style={{ background: theme.panel, padding: "0 30px", display: "flex", alignItems: "center", borderRadius: "12px", border: `1px solid ${theme.border}`, fontWeight: "900", color: theme.primary, fontSize: "18px" }}>
             MASTER <span style={{color: theme.text, marginLeft: "6px"}}>V6.1</span>
           </div>
           
           {/* News Ticker */}
           <div style={{ flex: 1, background: theme.panel, borderRadius: "12px", border: `1px solid ${theme.border}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: "15px", overflow: "hidden" }}>
              <div style={{ fontSize: "11px", fontWeight: "bold", background: theme.red, color: "#fff", padding: "4px 8px", borderRadius: "4px" }}>LIVE IMPACT NEWS</div>
              <motion.div 
                 key={newsIndex} 
                 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                 style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                 <span style={{ fontSize: "14px", fontWeight: "600", color: theme.text }}>{NEWS[newsIndex].title}</span>
                 <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: NEWS[newsIndex].impact==="HIGH"?theme.red:theme.green }}>{NEWS[newsIndex].impact} IMPACT</span>
                    <a href={NEWS[newsIndex].url} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: theme.primary, textDecoration: "none", fontWeight: "bold" }}>Read on {NEWS[newsIndex].source} →</a>
                 </div>
              </motion.div>
           </div>
           
           {/* Ticker */}
           <div style={{ background: theme.panel, padding: "0 20px", display: "flex", alignItems: "center", gap: "15px", borderRadius: "12px", border: `1px solid ${theme.border}`, fontSize: "13px", fontWeight: "bold" }}>
              <span style={{color: theme.green}}>BTC: ${ticker["BTCUSDT"]?.toFixed(0)}</span>
              <span style={{color: theme.gold}}>GOLD: ${ticker["PAXGUSDT"]?.toFixed(1)}</span>
           </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "20px" }}>
          
          {/* CHART */}
          <div style={{ height: "650px", background: theme.panel, borderRadius: "12px", border: `1px solid ${theme.border}`, padding: "10px", position: "relative" }}>
             {/* Toolbar */}
             <div style={{ position: "absolute", top: "20px", left: "20px", zIndex: 10, display: "flex", gap: "10px" }}>
                <select value={pair} onChange={e=>setPair(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.panel, color: theme.text, fontWeight: "bold", boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
                   {Object.keys(PAIRS).map(p => <option key={p} value={p}>{PAIRS[p]}</option>)}
                </select>
                <div style={{ background: theme.panel, borderRadius: "8px", border: `1px solid ${theme.border}`, display: "flex", overflow: "hidden" }}>
                   {Object.keys(TIMEFRAMES).map(t => <button key={t} onClick={()=>setTf(t)} style={{ padding: "8px 12px", border: "none", background: tf===t?theme.primary:"transparent", color: tf===t?"#fff":theme.subText, fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>{t}</button>)}
                </div>
             </div>

             <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />

             <div style={{ position: "absolute", bottom: "20px", left: "20px", display: "flex", gap: "15px", fontSize: "10px", fontWeight: "bold", color: theme.subText }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><div style={{width:"15px", height:"2px", background: theme.green}}></div> SUPPORT</span>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><div style={{width:"15px", height:"2px", background: theme.red}}></div> RESISTANCE</span>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><div style={{width:"15px", height:"2px", background: theme.gold}}></div> FIBONACCI</span>
             </div>
          </div>

          {/* SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
             
             {/* 1. KEY INTEL */}
             <div style={{ background: theme.panel, padding: "24px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: theme.subText, marginBottom: "15px" }}>LIVE INTELLIGENCE</div>
                
                <InfoRow label="Pattern" val={intel.pattern} color={intel.pattern.includes("Engulfing") ? theme.primary : theme.text} theme={theme} />
                <InfoRow label="Fib Level" val={intel.fib.level} color={intel.fib.level.includes("GOLDEN") ? theme.gold : theme.subText} theme={theme} />
                <InfoRow label="Trend" val={intel.trend} color={intel.trend==="BULLISH"?theme.green:theme.red} theme={theme} />
             </div>

             {/* 2. ZONES */}
             <div style={{ background: theme.panel, padding: "24px", borderRadius: "12px", border: `1px solid ${theme.border}`, flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: theme.subText, marginBottom: "15px" }}>KEY LEVELS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                   <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "13px", color: theme.subText }}>Breakout Resistance</span>
                      <span style={{ fontSize: "14px", fontWeight: "bold", color: theme.red }}>${intel.structure.resistance.toFixed(2)}</span>
                   </div>
                   <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "13px", color: theme.subText }}>Breakdown Support</span>
                      <span style={{ fontSize: "14px", fontWeight: "bold", color: theme.green }}>${intel.structure.support.toFixed(2)}</span>
                   </div>
                </div>

                <div style={{ marginTop: "20px", padding: "15px", background: theme.bg, borderRadius: "8px", borderLeft: `3px solid ${theme.primary}`, fontSize: "12px", color: theme.subText, lineHeight: "1.5" }}>
                   <strong>Narrative:</strong> {intel.narrative.strategy}
                </div>
             </div>

             {/* 3. ACTION */}
             <button onClick={() => setShowReport(true)} style={{ width: "100%", padding: "18px", borderRadius: "12px", border: "none", background: theme.text, color: theme.bg, fontWeight: "bold", cursor: "pointer", fontSize: "14px", boxShadow: "0 4px 15px rgba(0,0,0,0.1)" }}>
                GENERATE MASTER REPORT
             </button>

             {/* THEMES */}
             <div style={{ display: "flex", gap: "5px", marginTop: "auto" }}>
                {Object.keys(THEMES).map(k => (
                   <button key={k} onClick={()=>setCurrentTheme(k)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: currentTheme===k?theme.primary:"transparent", color: currentTheme===k?(theme.bg==="#000000"?"#000":"#fff"):theme.subText, fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>{THEMES[k].name}</button>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, val, color, theme }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "12px", borderBottom: `1px dashed ${theme.border}` }}>
      <span style={{ fontSize: "13px", color: theme.subText }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: "bold", color: color || theme.text }}>{val}</span>
    </div>
  );
}

function LoginGate({ onAuth }) {
  return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}><div style={{background:"#fff", padding:"40px", borderRadius:"16px", boxShadow:"0 10px 30px rgba(0,0,0,0.05)", textAlign:"center"}}><h3 style={{margin:"0 0 20px 0"}}>Master Analyst v6.0</h3><input type="password" placeholder="Passcode (123456)" onChange={(e) => onAuth(e.target.value)} style={{ padding: "10px", fontSize: "16px", borderRadius: "6px", border: "1px solid #ccc", outline: "none", textAlign: "center" }} /></div></div>;
}
