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

// 1. UPDATED TIMEFRAMES
const TIMEFRAMES = { 
  "15M": "15m", 
  "30M": "30m", 
  "45M": "1h", // Binance fallback
  "1H": "1h", 
  "4H": "4h", 
  "1D": "1d",
  "1W": "1w", // Weekly
  "1M": "1M"  // Monthly
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  if (!isLoggedIn) return <LoginGate onAuth={(v) => v === "123456" && setIsLoggedIn(true)} />;
  return <Dashboard />;
}

/* ================= DASHBOARD V6 (MOBILE READY) ================= */
function Dashboard() {
  const chartContainerRef = useRef(null);
  const seriesInstance = useRef(null);
  const sessionSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null); 
  const linesRef = useRef([]); 
  const fibLinesRef = useRef([]); 

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1000);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1000);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [currentTheme, setCurrentTheme] = useState("SYSTEM");
  const theme = THEMES[currentTheme];

  const [pair, setPair] = useState("BTCUSDT");
  const [tf, setTf] = useState("4H");
  const [showReport, setShowReport] = useState(false);
  const [ticker, setTicker] = useState({});
  const [newsIndex, setNewsIndex] = useState(0);

  // 📐 MANUAL FIB STATE
  const [manualFib, setManualFib] = useState({ high: "", low: "", active: false });
  
  // 🔔 ALERT STATE
  const [alertPrice, setAlertPrice] = useState("");
  const [isAlertSet, setIsAlertSet] = useState(false);

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

  const NEWS = [
    { title: "CPI Data Exceeds Forecast", impact: "HIGH", url: "#", source: "ForexFactory" },
    { title: "BTC 4H Close above 50 EMA", impact: "MED", url: "#", source: "TradingView" },
    { title: "Gold Demand Spikes on Geopolitics", impact: "HIGH", url: "#", source: "Bloomberg" },
    { title: "Fed Chair Powell Speaks Today", impact: "HIGH", url: "#", source: "CNBC" },
    { title: "Solana Network Upgrade Complete", impact: "LOW", url: "#", source: "Coindesk" }
  ];

  // 🔄 LIVE TICKER & ALERT LOGIC
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/price");
        const data = await res.json();
        const map = {};
        data.forEach(d => map[d.symbol] = parseFloat(d.price));
        setTicker(map);

        // --- 🔔 PRICE ALERT CHECK ---
        if (isAlertSet && alertPrice && map[pair]) {
          const current = map[pair];
          const target = parseFloat(alertPrice);
          if (Math.abs(current - target) / target < 0.001) {
             sendPhoneNotification(`PRICE ALERT: ${pair} reached $${current}`);
             setIsAlertSet(false); 
             alert(`🚀 PRICE ALERT! ${pair} hit ${target}`);
          }
        }
      } catch(e) {}
    };
    fetchMarket();
    const t = setInterval(fetchMarket, 2000); 
    const n = setInterval(() => setNewsIndex(p => (p+1)%NEWS.length), 5000);
    return () => { clearInterval(t); clearInterval(n); };
  }, [pair, isAlertSet, alertPrice]);

  // 📲 NOTIFICATION FUNCTION
  const sendPhoneNotification = (msg) => {
    if (Notification.permission === "granted") {
      new Notification("WAIDA Analysis Alert", { body: msg });
    }
    console.log("SENDING PHONE NOTIFICATION:", msg); 
  };

  /* ================= CHART ENGINE ================= */
  useEffect(() => {
    if (!chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = "";

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: theme.panel }, textColor: theme.text },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      width: chartContainerRef.current.clientWidth,
      height: isMobile ? 500 : 750, 
      rightPriceScale: { borderColor: theme.border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: theme.border },
    });

    const sessionSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "left", color: "transparent", priceFormat: { type: "volume" }, scaleMargins: { top: 0, bottom: 0 },
    });
    sessionSeriesRef.current = sessionSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: theme.subText,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume_scale', 
    });
    
    chart.priceScale('volume_scale').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: theme.green, downColor: theme.red, borderVisible: false, wickUpColor: theme.green, wickDownColor: theme.red,
    });
    seriesInstance.current = series;

    // 2. 5-YEAR DATA FETCH CONFIG
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const startTime = fiveYearsAgo.getTime();

    fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${TIMEFRAMES[tf]}&limit=1000&startTime=${startTime}`)
      .then(r=>r.json())
      .then(data => {
        if(!Array.isArray(data)) return;
        const candles = data.map(x => ({ time: x[0]/1000, open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
        
        const volumeData = data.map(x => ({
          time: x[0] / 1000,
          value: parseFloat(x[5]),
          color: parseFloat(x[4]) >= parseFloat(x[1]) ? `${theme.green}80` : `${theme.red}80`, 
        }));

        series.setData(candles);
        volumeSeries.setData(volumeData); 
        
        analyzeMarket(candles, series);
        drawSessions(candles, sessionSeries);
      });

    const resize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chart.remove(); };
  }, [pair, tf, currentTheme, isMobile, manualFib.active]); 

  /* ================= 🧠 ANALYSIS LOGIC ================= */
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

  const detectPattern = (candles) => {
    if (candles.length < 3) return "Insufficient Data";
    const c0 = candles[candles.length - 1]; const c1 = candles[candles.length - 2]; const c2 = candles[candles.length - 3]; 
    const isGreen = (c) => c.close > c.open; const isRed = (c) => c.close < c.open;
    const body = (c) => Math.abs(c.close - c.open); const avgBody = (body(c0) + body(c1) + body(c2)) / 3;

    if (isRed(c2) && body(c2) > avgBody && body(c1) < body(c2) * 0.5 && isGreen(c0) && c0.close > (c2.open + c2.close) / 2) return "Morning Star (Bullish Reversal) ☀️";
    if (isGreen(c2) && body(c2) > avgBody && body(c1) < body(c2) * 0.5 && isRed(c0) && c0.close < (c2.open + c2.close) / 2) return "Evening Star (Bearish Reversal) 🌑";
    if (isGreen(c2) && isGreen(c1) && isGreen(c0) && c0.close > c1.close && c1.close > c2.close) return "3 White Soldiers (Momentum) 🚀";
    if (isRed(c2) && isRed(c1) && isRed(c0) && c0.close < c1.close && c1.close < c2.close) return "3 Black Crows (Crash) 📉";
    if (c0.high < c1.high && c0.low > c1.low) return "Inside Bar (Potential Breakout) ⚠️";
    if (isGreen(c0) && isRed(c1) && c0.close > c1.open && c0.open < c1.close) return "Bullish Engulfing";
    if (isRed(c0) && isGreen(c1) && c0.close < c1.open && c0.open > c1.close) return "Bearish Engulfing";
    return "Continuation";
  };

  const analyzeMarket = (candles, series) => {
    const last = candles[candles.length - 1];
    const subset = candles.slice(-50);
    let high = Math.max(...subset.map(c => c.high));
    let low = Math.min(...subset.map(c => c.low));
    
    if (manualFib.active && manualFib.high && manualFib.low) {
      high = parseFloat(manualFib.high);
      low = parseFloat(manualFib.low);
    }

    const ema = subset.slice(-20).reduce((a,b)=>a+b.close,0)/20;
    const trend = last.close > ema ? "BULLISH" : "BEARISH";
    const pattern = detectPattern(candles);
    
    linesRef.current.forEach(l => series.removePriceLine(l));
    linesRef.current = [];
    linesRef.current.push(series.createPriceLine({ price: low, color: theme.green, lineWidth: 2, lineStyle: LineStyle.Dotted, title: "SWING LOW" }));
    linesRef.current.push(series.createPriceLine({ price: high, color: theme.red, lineWidth: 2, lineStyle: LineStyle.Dotted, title: "SWING HIGH" }));

    drawFibonacci(series, high, low, trend);

    const range = high - low;
    const gpPrice = trend === "BULLISH" ? high - (range * 0.618) : low + (range * 0.618);
    const distToGp = Math.abs(last.close - gpPrice);
    let fibStatus = distToGp < (range * 0.05) ? "IN GOLDEN POCKET (0.618)" : "No Confluence";
    
    const risk = range * 0.2;
    const sl = trend === "BULLISH" ? last.close - risk : last.close + risk;
    const tp = trend === "BULLISH" ? last.close + (risk * 2) : last.close - (risk * 2);
    
    const narrativeText = `Price is currently ${trend}. Pattern: ${pattern}. ` + (fibStatus.includes("GOLDEN") ? "Reacting to Golden Pocket." : "");

    setIntel({
      price: last.close,
      trend,
      structure: { support: low, resistance: high },
      fib: { level: fibStatus, label: "0.618" },
      pattern,
      zones: { entry: last.close, tp, sl },
      session: getSessionName(),
      narrative: { bias: trend, context: narrativeText, strategy: "Follow trend bias." }
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
      
      {/* 📑 RESTORED FULL REPORT MODAL */}
      <AnimatePresence>
        {showReport && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", padding: "10px" }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: isMobile ? "100%" : "1000px", height: isMobile ? "90vh" : "650px", background: theme.cardBg, borderRadius: "20px", border: `1px solid ${theme.border}`, display: "flex", flexDirection: isMobile ? "column" : "row", overflowY: isMobile ? "auto" : "hidden" }}
            >
              {/* LEFT: BLUEPRINT & PARAMETERS (Restored) */}
              <div style={{ background: theme.bg, borderRight: isMobile ? "none" : `1px solid ${theme.border}`, borderBottom: isMobile ? `1px solid ${theme.border}` : "none", padding: "30px", display: "flex", flexDirection: "column", minHeight: isMobile ? "auto" : "100%" }}>
                <div style={{ fontSize: "12px", color: theme.subText, letterSpacing: "2px", fontWeight: "bold", marginBottom: "20px" }}>STRATEGIC BLUEPRINT</div>
                
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

              {/* RIGHT: NARRATIVE (Restored) */}
              <div style={{ padding: "30px", flex: 1, display: "flex", flexDirection: "column" }}>
                <h2 style={{color: theme.text, marginBottom: "20px"}}>Analysis Report</h2>
                <div style={{ marginBottom: "20px" }}>
                   <h3 style={{ fontSize: "16px", color: theme.text, marginBottom: "10px" }}>Technical Narrative</h3>
                   <p style={{ fontSize: "14px", lineHeight: "1.6", color: theme.subText }}>{intel.narrative.context}</p>
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
                <button onClick={() => setShowReport(false)} style={{ marginTop: "auto", padding: "15px", background: theme.primary, color: "#fff", border: "none", borderRadius: "8px", width: "100%", fontWeight: "bold" }}>Close Report</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth: "1600px", width: "100%", margin: "0 auto", padding: isMobile ? "10px" : "20px" }}>
        
        {/* TOP BAR */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "15px", marginBottom: "20px" }}>
           <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
             <div style={{ background: theme.panel, padding: "0 20px", height: "50px", display: "flex", alignItems: "center", borderRadius: "12px", border: `1px solid ${theme.border}`, fontWeight: "900", color: theme.primary, fontSize: "16px", whiteSpace: "nowrap" }}>
               WAIDA <span style={{color: theme.text, marginLeft: "6px"}}>Pro</span>
             </div>
             {/* 3. LIVE PRICE DISPLAY */}
             <div style={{ flex: 1, background: theme.panel, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", border: `1px solid ${theme.border}`, fontSize: "18px", fontWeight: "bold" }}>
                <span style={{color: theme.subText, fontSize: "12px", marginRight: "8px"}}>{pair}</span>
                <span style={{color: (ticker[pair] > intel.price) ? theme.green : theme.red}}>${ticker[pair]?.toLocaleString() || "..."}</span>
             </div>
           </div>
           
           {/* News */}
           <div style={{ flex: 1, background: theme.panel, borderRadius: "12px", border: `1px solid ${theme.border}`, padding: "0 15px", height: "50px", display: "flex", alignItems: "center", gap: "15px", overflow: "hidden" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: theme.text }}>{NEWS[newsIndex].title}</span>
           </div>
        </div>

        <div style={{ display: isMobile ? "flex" : "grid", gridTemplateColumns: "1fr 360px", flexDirection: "column", gap: "20px" }}>
          
          {/* CHART */}
          <div style={{ height: isMobile ? "520px" : "770px", background: theme.panel, borderRadius: "12px", border: `1px solid ${theme.border}`, padding: "10px", position: "relative", overflow: "hidden" }}>
             <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10, display: "flex", gap: "8px", flexWrap: "wrap", right: "10px" }}>
                <select value={pair} onChange={e=>setPair(e.target.value)} style={{ padding: "6px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.panel, color: theme.text, fontWeight: "bold", fontSize: "11px", flex: isMobile ? 1 : "unset" }}>
                   {Object.keys(PAIRS).map(p => <option key={p} value={p}>{PAIRS[p]}</option>)}
                </select>
                <div style={{ background: theme.panel, borderRadius: "6px", border: `1px solid ${theme.border}`, display: "flex", overflow: "scroll" }}>
                   {Object.keys(TIMEFRAMES).map(t => <button key={t} onClick={()=>setTf(t)} style={{ padding: "6px 10px", border: "none", background: tf===t?theme.primary:"transparent", color: tf===t?"#fff":theme.subText, fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap" }}>{t}</button>)}
                </div>
             </div>
             <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />
          </div>

          {/* SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
             
             {/* KEY INTEL */}
             <div style={{ background: theme.panel, padding: "20px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: theme.subText, marginBottom: "15px" }}>LIVE INTELLIGENCE</div>
                <InfoRow label="Pattern" val={intel.pattern} color={theme.text} theme={theme} />
                <InfoRow label="Trend" val={intel.trend} color={intel.trend==="BULLISH"?theme.green:theme.red} theme={theme} />
             </div>

             {/* 4. PRICE ALERT & NOTIFICATION PANEL */}
             <div style={{ background: theme.panel, padding: "20px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: theme.subText, marginBottom: "15px" }}>PRICE ALERT (AUTO NOTIFY)</div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <input 
                      type="number" 
                      placeholder="Target Price" 
                      value={alertPrice}
                      onChange={(e) => { setAlertPrice(e.target.value); setIsAlertSet(false); }} 
                      style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: "11px" }} 
                    />
                </div>
                <button 
                  onClick={() => { setIsAlertSet(!isAlertSet); if(!isAlertSet) alert(`Alert set for $${alertPrice}`); }}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: isAlertSet ? theme.green : theme.subText, color: "#fff", fontWeight: "bold", fontSize: "11px", cursor: "pointer" }}
                >
                  {isAlertSet ? "ALERT ACTIVE 🔔" : "SET ALERT"}
                </button>
             </div>

             {/* MANUAL FIB */}
             <div style={{ background: theme.panel, padding: "20px", borderRadius: "12px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: theme.subText, marginBottom: "15px" }}>MANUAL FIBONACCI</div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <input type="number" placeholder="High" value={manualFib.high} onChange={(e) => setManualFib({...manualFib, high: e.target.value, active: false})} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: "11px" }} />
                    <input type="number" placeholder="Low" value={manualFib.low} onChange={(e) => setManualFib({...manualFib, low: e.target.value, active: false})} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: "11px" }} />
                </div>
                <button onClick={() => setManualFib({ ...manualFib, active: !manualFib.active })} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "none", background: manualFib.active ? theme.gold : theme.subText, color: "#fff", fontWeight: "bold", fontSize: "11px", cursor: "pointer" }}>{manualFib.active ? "DISABLE" : "APPLY"}</button>
             </div>

             {/* BUTTONS */}
             <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                <button onClick={() => setShowReport(true)} style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "none", background: theme.text, color: theme.bg, fontWeight: "bold", fontSize: "13px" }}>GENERATE REPORT</button>
                <div style={{ display: "flex", gap: "5px" }}>
                   {Object.keys(THEMES).map(k => (
                      <button key={k} onClick={()=>setCurrentTheme(k)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: currentTheme===k?theme.primary:"transparent", color: currentTheme===k?(theme.bg==="#000000"?"#000":"#fff"):theme.subText, fontSize: "10px", fontWeight: "bold" }}>{THEMES[k].name}</button>
                   ))}
                </div>
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
  return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}><div style={{background:"#fff", padding:"40px", borderRadius:"16px", boxShadow:"0 10px 30px rgba(0,0,0,0.05)", textAlign:"center"}}><h3 style={{margin:"0 0 20px 0"}}>WAIDA Analysis</h3><input type="password" placeholder="Passcode (123456)" onChange={(e) => onAuth(e.target.value)} style={{ padding: "10px", fontSize: "16px", borderRadius: "6px", border: "1px solid #ccc", outline: "none", textAlign: "center" }} /></div></div>;
}