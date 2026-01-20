import React, { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineStyle } from "lightweight-charts";
import { motion, AnimatePresence } from "framer-motion";

/* ================= THEME ENGINE V8 (Vivid Colors) ================= */
const THEMES = {
  SYSTEM: {
    name: "System",
    bg: "#f0f4f8", panel: "#ffffff", text: "#1e293b", subText: "#64748b",
    border: "#cbd5e1", primary: "#2563eb", green: "#10b981", red: "#ef4444",
    grid: "#e2e8f0", cardBg: "#ffffff", gold: "#d97706", accent: "#3b82f6"
  },
  DARK: {
    name: "Dark",
    bg: "#0b1121", panel: "#151e32", text: "#e2e8f0", subText: "#94a3b8",
    border: "#334155", primary: "#3b82f6", green: "#22c55e", red: "#f43f5e",
    grid: "#1e293b", cardBg: "#1e293b", gold: "#fbbf24", accent: "#60a5fa"
  },
  MIDNIGHT: {
    name: "Midnight",
    bg: "#000000", panel: "#121212", text: "#e5e5e5", subText: "#888888",
    border: "#2a2a2a", primary: "#d4af37", green: "#00ff9d", red: "#ff3b30",
    grid: "#1a1a1a", cardBg: "#111111", gold: "#d4af37", accent: "#ffd700"
  }
};

const PAIRS = { 
  BTCUSDT: "BITCOIN", 
  ETHUSDT: "ETHEREUM", 
  SOLUSDT: "SOLANA", 
  PAXGUSDT: "GOLD (XAU)" 
};

const TIMEFRAMES = { "1H": "1h", "4H": "4h", "1D": "1d" };

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { if ("Notification" in window) Notification.requestPermission(); }, []);
  if (!isLoggedIn) return <LoginGate onAuth={(v) => v === "123456" && setIsLoggedIn(true)} />;
  return <Dashboard />;
}

/* ================= DASHBOARD V8 ================= */
function Dashboard() {
  const chartContainerRef = useRef(null);
  const seriesInstance = useRef(null);
  const volumeSeriesRef = useRef(null); 
  const linesRef = useRef([]); 
  const fibLinesRef = useRef([]); 

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1000);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1000);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [currentTheme, setCurrentTheme] = useState("DARK");
  const theme = THEMES[currentTheme];

  const [pair, setPair] = useState("BTCUSDT");
  const [tf, setTf] = useState("4H");
  const [showReport, setShowReport] = useState(false);
  const [ticker, setTicker] = useState({});
  const [newsIndex, setNewsIndex] = useState(0);

  // 📐 MANUAL FIB & ALERTS
  const [showFibs, setShowFibs] = useState(true); 
  const [manualFib, setManualFib] = useState({ high: "", low: "", active: false });
  
  const [alertPrice, setAlertPrice] = useState("");
  const [isAlertSet, setIsAlertSet] = useState(false);
  const alertRef = useRef({ price: "", active: false });
  useEffect(() => { alertRef.current = { price: alertPrice, active: isAlertSet }; }, [alertPrice, isAlertSet]);

  // 🧠 INTELLIGENCE STATE
  const [intel, setIntel] = useState({
    price: 0,
    trend: "SCANNING",
    trendStrength: "Weak",
    rsi: 50,
    volatility: 0,
    structure: { support: 0, resistance: 0 },
    fib: { level: "No Confluence", label: "--" },
    pattern: "Scanning...",
    setup: { action: "WAIT", entry: 0, sl: 0, tp1: 0, tp2: 0, rr: 0 },
    confidence: 0,
    confirmations: [],
    narrative: "Initializing..."
  });

  const NEWS = [
    { title: "CPI Data Exceeds Forecast", impact: "HIGH" },
    { title: "Institutional Volume Spikes", impact: "MED" },
    { title: "Gold Reaches Key Liquidity Zone", impact: "HIGH" },
    { title: "Fed Chair Powell Speaks Today", impact: "HIGH" },
    { title: "Market Volatility Increasing", impact: "LOW" }
  ];

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch("https://api.binance.com/api/v3/ticker/price");
        const data = await res.json();
        const map = {};
        data.forEach(d => map[d.symbol] = parseFloat(d.price));
        setTicker(prev => ({ ...prev, ...map }));
      } catch(e) {}
    };
    fetchMarket();
    const n = setInterval(() => setNewsIndex(p => (p+1)%NEWS.length), 5000);
    return () => clearInterval(n);
  }, []);

  const sendPhoneNotification = (msg) => {
    if (Notification.permission === "granted") new Notification("WAIDA Alert", { body: msg });
  };

  /* ================= 🧠 INTELLIGENCE LOGIC ================= */
  const analyzeMarket = useCallback((candles, currentPrice) => {
    const series = seriesInstance.current;
    if (!series || candles.length < 50) return;

    const last = candles[candles.length - 1];
    const activePrice = currentPrice || last.close;
    const subset = candles.slice(-50);

    // 1. Trend & Structure
    let high = Math.max(...subset.map(c => c.high));
    let low = Math.min(...subset.map(c => c.low));
    
    if (manualFib.active && manualFib.high && manualFib.low) {
      high = parseFloat(manualFib.high);
      low = parseFloat(manualFib.low);
    }

    const ema20 = subset.slice(-20).reduce((a,b)=>a+b.close,0)/20;
    const ema50 = subset.slice(-50).reduce((a,b)=>a+b.close,0)/50;
    const trend = activePrice > ema50 ? "BULLISH" : "BEARISH";
    const trendStrength = Math.abs(ema20 - ema50) / activePrice > 0.005 ? "Strong" : "Weak";

    // 2. Momentum
    const gains = [], losses = [];
    for(let i=1; i<15; i++) {
        const diff = subset[subset.length-i].close - subset[subset.length-i-1].close;
        diff >= 0 ? gains.push(diff) : losses.push(Math.abs(diff));
    }
    const avgGain = gains.reduce((a,b)=>a+b,0)/14;
    const avgLoss = losses.reduce((a,b)=>a+b,0)/14;
    const rs = avgGain / (avgLoss || 1);
    const rsi = 100 - (100 / (1 + rs));

    // 3. Volatility
    const atr = subset.slice(-14).reduce((a,b) => a + (b.high - b.low), 0) / 14;

    // 4. Pattern
    const pattern = detectPattern(candles);

    // 5. Fibonacci Golden Zone Check
    const range = high - low;
    const fib50 = trend === "BULLISH" ? high - (range * 0.5) : low + (range * 0.5);
    const fib618 = trend === "BULLISH" ? high - (range * 0.618) : low + (range * 0.618);
    const zoneTop = Math.max(fib50, fib618);
    const zoneBottom = Math.min(fib50, fib618);
    const inGoldenZone = activePrice >= zoneBottom && activePrice <= zoneTop;
    const fibStatus = inGoldenZone ? "IN GOLDEN ZONE (50-61.8%)" : "Outside Key Zone";

    // 6. Confidence Scoring
    let confirmations = [];
    let score = 0;

    if (trend === "BULLISH") {
        if (activePrice > ema20) { score += 20; confirmations.push("Price above EMA 20"); }
        if (rsi > 40 && rsi < 70) { score += 20; confirmations.push("RSI Bullish Momentum"); }
        if (inGoldenZone) { score += 35; confirmations.push("Price in Golden Zone (0.5-0.618)"); }
        if (pattern.includes("Bullish")) { score += 30; confirmations.push(`Pattern: ${pattern}`); }
    } else {
        if (activePrice < ema20) { score += 20; confirmations.push("Price below EMA 20"); }
        if (rsi < 60 && rsi > 30) { score += 20; confirmations.push("RSI Bearish Momentum"); }
        if (inGoldenZone) { score += 35; confirmations.push("Price in Golden Zone (0.5-0.618)"); }
        if (pattern.includes("Bearish")) { score += 30; confirmations.push(`Pattern: ${pattern}`); }
    }

    const action = score > 65 ? (trend === "BULLISH" ? "LONG" : "SHORT") : "WAIT";
    const slDist = atr * 1.5; 
    const sl = trend === "BULLISH" ? activePrice - slDist : activePrice + slDist;
    const tp1 = trend === "BULLISH" ? activePrice + slDist : activePrice - slDist;
    const tp2 = trend === "BULLISH" ? activePrice + (slDist * 2.5) : activePrice - (slDist * 2.5);
    const rr = 2.5;

    // Structure Lines
    linesRef.current.forEach(l => series.removePriceLine(l));
    linesRef.current = [];
    if (!manualFib.active) {
       linesRef.current.push(series.createPriceLine({ price: low, color: theme.subText, lineWidth: 1, lineStyle: LineStyle.SparseDotted, title: "Swing Low", axisLabelVisible: false }));
       linesRef.current.push(series.createPriceLine({ price: high, color: theme.subText, lineWidth: 1, lineStyle: LineStyle.SparseDotted, title: "Swing High", axisLabelVisible: false }));
    }
    
    // Draw Fibs if toggled ON
    if (showFibs) {
        drawFibonacci(series, high, low, trend);
    } else {
        fibLinesRef.current.forEach(l => series.removePriceLine(l));
        fibLinesRef.current = [];
    }

    setIntel({
        price: activePrice,
        trend, trendStrength,
        rsi: rsi.toFixed(1),
        volatility: atr.toFixed(2),
        structure: { support: low, resistance: high },
        fib: { level: fibStatus, label: "0.618" },
        pattern,
        setup: { action, entry: activePrice, sl, tp1, tp2, rr },
        confidence: score,
        confirmations,
        narrative: `Trend is ${trend}. Price is ${inGoldenZone ? "INSIDE the Golden Zone (High Probability)" : "outside the Golden Zone"}. Look for ${trend === "BULLISH" ? "Bullish" : "Bearish"} patterns like Engulfing to confirm.`
    });

  }, [theme, manualFib, showFibs]);

  const detectPattern = (candles) => {
    if (candles.length < 3) return "None";
    const c0 = candles[candles.length - 1]; const c1 = candles[candles.length - 2]; 
    const isGreen = (c) => c.close > c.open; 
    const body = (c) => Math.abs(c.close - c.open); 
    
    if (!isGreen(c1) && isGreen(c0) && c0.close > c1.open && c0.open < c1.close) return "Bullish Engulfing";
    if (isGreen(c1) && !isGreen(c0) && c0.close < c1.open && c0.open > c1.close) return "Bearish Engulfing";
    
    const tail = (c) => Math.abs(Math.min(c.open, c.close) - c.low);
    const head = (c) => Math.abs(c.high - Math.max(c.open, c.close));
    if (tail(c0) > body(c0) * 2 && head(c0) < body(c0) * 0.5) return "Hammer (Rejection)";
    if (head(c0) > body(c0) * 2 && tail(c0) < body(c0) * 0.5) return "Shooting Star";
    return "Consolidation";
  };

  // ================= 🎨 "EASY TO KNOW" STYLE FIBONACCI =================
  const drawFibonacci = (series, high, low, trend) => {
    // Clear old lines
    fibLinesRef.current.forEach(l => series.removePriceLine(l));
    fibLinesRef.current = [];
    const diff = high - low;
    
    // Config: Level, Color, Label, IsImportant
    const levels = [
        { lvl: 0, color: "#ef4444", label: "0 (Start/Stop)", type: "solid" }, // RED
        { lvl: 0.236, color: "#ef4444", label: "0.236 (Take Profit Area)", type: "dashed" }, // RED
        { lvl: 0.382, color: "#f59e0b", label: "0.382 (Caution)", type: "dashed" }, // ORANGE
        { lvl: 0.5, color: "#22c55e", label: "0.5 (Confirm Buy)", type: "solid" }, // GREEN
        { lvl: 0.618, color: "#22c55e", label: "0.618 (GOLDEN POCKET)", type: "solid" }, // GREEN
        { lvl: 0.786, color: "#3b82f6", label: "0.786 (Deep Discount)", type: "dashed" }, // BLUE
        { lvl: 1, color: "#3b82f6", label: "1 (Low/Stop)", type: "solid" } // BLUE
    ];

    levels.forEach(cfg => {
      let price = trend === "BULLISH" ? high - (diff * cfg.lvl) : low + (diff * cfg.lvl);
      
      const isGolden = cfg.lvl === 0.5 || cfg.lvl === 0.618;
      
      const line = series.createPriceLine({
        price: price,
        color: cfg.color, // Vivid color from palette
        lineWidth: isGolden ? 3 : 1, // Thicker for "Easy to Know" zones
        lineStyle: cfg.type === "solid" ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: cfg.label, // Descriptive label
      });
      fibLinesRef.current.push(line);
    });
  };

  /* ================= CHART ENGINE ================= */
  useEffect(() => {
    if (!chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = "";
    
    // Auto-Size container
    const containerRect = chartContainerRef.current.getBoundingClientRect();

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: theme.panel }, textColor: theme.text },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      width: containerRect.width,
      height: containerRect.height,
      rightPriceScale: { borderColor: theme.border },
      timeScale: { borderColor: theme.border, timeVisible: true },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, { color: theme.subText, priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const series = chart.addSeries(CandlestickSeries, { upColor: theme.green, downColor: theme.red, borderVisible: false, wickUpColor: theme.green, wickDownColor: theme.red });
    seriesInstance.current = series;

    const interval = TIMEFRAMES[tf];
    let candleCache = [];
    fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=500`)
      .then(r=>r.json()).then(data => {
        if(!Array.isArray(data)) return;
        const candles = data.map(x => ({ time: x[0]/1000, open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
        candleCache = candles;
        const vol = data.map(x => ({ time: x[0]/1000, value: +x[5], color: +x[4]>=+x[1]? theme.green: theme.red }));
        series.setData(candles);
        volumeSeries.setData(vol);
        analyzeMarket(candles, candles[candles.length-1].close);
      });

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_${interval}`);
    ws.onmessage = (e) => {
      const { k } = JSON.parse(e.data);
      const price = parseFloat(k.c);
      const candle = { time: k.t/1000, open: +k.o, high: +k.h, low: +k.l, close: price };
      series.update(candle);
      volumeSeries.update({ time: k.t/1000, value: +k.v, color: price >= +k.o ? theme.green : theme.red });
      setTicker(p => ({ ...p, [pair]: price }));
      if (k.x) {
         candleCache.push(candle);
         if(candleCache.length > 500) candleCache.shift();
         analyzeMarket(candleCache, price);
      } else {
         setIntel(prev => ({ ...prev, price: price }));
      }
      if (alertRef.current.active && alertRef.current.price) {
         const t = parseFloat(alertRef.current.price);
         if (Math.abs(price - t) / t < 0.001) {
            sendPhoneNotification(`HIT: ${pair} @ $${price}`);
            setIsAlertSet(false); alert(`Target Hit: ${price}`);
         }
      }
    };

    const resize = () => {
        if (chartContainerRef.current) {
            const { width, height } = chartContainerRef.current.getBoundingClientRect();
            chart.applyOptions({ width, height });
        }
    };
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); ws.close(); chart.remove(); };
  }, [pair, tf, currentTheme, isMobile, manualFib.active, showFibs, analyzeMarket]);

  const formatPrice = (p) => !p ? "..." : p < 1 ? p.toFixed(6) : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ background: theme.bg, height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", color: theme.text, overflow: "hidden" }}>
      
      {/* REPORT MODAL */}
      <AnimatePresence>
        {showReport && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: "900px", maxHeight: "90vh", background: theme.panel, borderRadius: "24px", border: `1px solid ${theme.border}`, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}
            >
              <div style={{ padding: "24px 32px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.cardBg }}>
                 <div>
                    <h2 style={{ margin: 0, fontSize: "24px", color: theme.text }}>Strategic Blueprint</h2>
                    <span style={{ fontSize: "12px", color: theme.subText, letterSpacing: "1px" }}>AI-POWERED MARKET INTELLIGENCE</span>
                 </div>
                 <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "20px", fontWeight: "bold", color: intel.setup.action === "LONG" ? theme.green : intel.setup.action === "SHORT" ? theme.red : theme.gold }}>{intel.setup.action} {pair}</div>
                    <span style={{ fontSize: "12px", color: theme.subText }}>Confidence: {intel.confidence}%</span>
                 </div>
              </div>

              <div style={{ padding: "32px", overflowY: "auto", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "30px" }}>
                <div>
                   <h3 style={{ fontSize: "14px", color: theme.primary, letterSpacing: "1px", marginBottom: "16px" }}>01. MARKET CONTEXT</h3>
                   <div style={{ background: theme.bg, padding: "20px", borderRadius: "16px", border: `1px solid ${theme.border}` }}>
                      <ReportRow label="Market Trend" value={intel.trend} color={intel.trend==="BULLISH"?theme.green:theme.red} theme={theme} />
                      <ReportRow label="Momentum (RSI)" value={intel.rsi} color={theme.text} theme={theme} />
                      <ReportRow label="Volatility (ATR)" value={intel.volatility} color={theme.subText} theme={theme} />
                      <ReportRow label="Pattern Detected" value={intel.pattern} color={theme.gold} theme={theme} />
                   </div>
                   <h3 style={{ fontSize: "14px", color: theme.primary, letterSpacing: "1px", marginTop: "24px", marginBottom: "16px" }}>02. CONFIRMATIONS</h3>
                   <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {intel.confirmations.length > 0 ? intel.confirmations.map((c, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: theme.text }}>
                           <span style={{ color: theme.green }}>✔</span> {c}
                        </div>
                      )) : <span style={{fontSize: "13px", color: theme.subText}}>No strong confirmations yet.</span>}
                   </div>
                </div>
                <div>
                   <h3 style={{ fontSize: "14px", color: theme.primary, letterSpacing: "1px", marginBottom: "16px" }}>03. EXECUTION SETUP</h3>
                   <div style={{ background: theme.cardBg, borderRadius: "16px", border: `1px solid ${theme.border}`, overflow: "hidden" }}>
                      <div style={{ padding: "20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between" }}>
                         <span style={{ fontSize: "13px", color: theme.subText }}>ENTRY ZONE</span>
                         <span style={{ fontSize: "16px", fontWeight: "bold", color: theme.text }}>${formatPrice(intel.setup.entry)}</span>
                      </div>
                      <div style={{ padding: "20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", background: `${theme.red}10` }}>
                         <span style={{ fontSize: "13px", color: theme.red }}>STOP LOSS</span>
                         <span style={{ fontSize: "16px", fontWeight: "bold", color: theme.red }}>${formatPrice(intel.setup.sl)}</span>
                      </div>
                      <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", background: `${theme.green}10` }}>
                         <span style={{ fontSize: "13px", color: theme.green }}>TAKE PROFIT</span>
                         <div style={{ textAlign: "right" }}>
                           <div style={{ fontSize: "16px", fontWeight: "bold", color: theme.green }}>${formatPrice(intel.setup.tp1)}</div>
                           <div style={{ fontSize: "12px", color: theme.green, opacity: 0.8 }}>Ext: ${formatPrice(intel.setup.tp2)}</div>
                         </div>
                      </div>
                   </div>
                   <div style={{ marginTop: "20px", padding: "15px", background: theme.bg, borderRadius: "12px", fontSize: "13px", color: theme.subText, lineHeight: "1.5" }}>
                      <strong>Narrative:</strong> {intel.narrative}
                   </div>
                </div>
              </div>
              <div style={{ padding: "20px", borderTop: `1px solid ${theme.border}`, textAlign: "center" }}>
                 <button onClick={() => setShowReport(false)} style={{ padding: "12px 40px", background: theme.text, color: theme.bg, border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>Close Blueprint</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN LAYOUT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: "1600px", width: "100%", margin: "0 auto", padding: isMobile ? "10px" : "20px", overflow: "hidden" }}>
        
        {/* HEADER */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px", flexWrap: "wrap", flexShrink: 0 }}>
           <div style={{ flex: 1, minWidth: "280px", background: theme.panel, padding: "0 24px", height: "60px", borderRadius: "12px", border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: "900", color: theme.text, fontSize: "18px" }}>WAIDA <span style={{ color: theme.primary }}>PRO</span></div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: ticker[pair] > intel.setup.entry ? theme.green : theme.red }}>
                 ${formatPrice(ticker[pair])}
              </div>
           </div>
           <div style={{ flex: 2, background: theme.panel, borderRadius: "12px", border: `1px solid ${theme.border}`, padding: "0 20px", height: "60px", display: "flex", alignItems: "center", gap: "15px", overflow: "hidden" }}>
              <span style={{ fontSize: "11px", fontWeight: "bold", padding: "4px 8px", borderRadius: "4px", background: NEWS[newsIndex].impact==="HIGH"?theme.red:theme.primary, color: "#fff" }}>{NEWS[newsIndex].impact}</span>
              <span style={{ fontSize: "13px", fontWeight: "500", color: theme.text }}>{NEWS[newsIndex].title}</span>
           </div>
        </div>

        {/* CONTENT GRID */}
        <div style={{ flex: 1, display: isMobile ? "flex" : "grid", gridTemplateColumns: "1fr 380px", gap: "20px", flexDirection: "column", minHeight: 0 }}>
          
          {/* CHART AREA */}
          <div style={{ height: "100%", minHeight: isMobile ? "400px" : "auto", background: theme.panel, borderRadius: "16px", border: `1px solid ${theme.border}`, padding: "10px", position: "relative", display: "flex", flexDirection: "column" }}>
             <div style={{ position: "absolute", top: "15px", left: "15px", zIndex: 10, display: "flex", gap: "10px" }}>
                <select value={pair} onChange={e=>setPair(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.cardBg, color: theme.text, fontSize: "12px", fontWeight: "bold" }}>
                   {Object.keys(PAIRS).map(p => <option key={p} value={p}>{PAIRS[p]}</option>)}
                </select>
                <div style={{ background: theme.cardBg, borderRadius: "8px", border: `1px solid ${theme.border}`, display: "flex", overflow: "hidden" }}>
                   {Object.keys(TIMEFRAMES).map(t => <button key={t} onClick={()=>setTf(t)} style={{ padding: "8px 12px", border: "none", background: tf===t?theme.primary:"transparent", color: tf===t?"#fff":theme.subText, fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>{t}</button>)}
                </div>
             </div>
             <div ref={chartContainerRef} style={{ flex: 1, width: "100%" }} />
          </div>

          {/* SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto" }}>
             <div style={{ background: theme.panel, padding: "24px", borderRadius: "16px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: theme.subText, marginBottom: "20px", letterSpacing: "1px" }}>LIVE METRICS</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                   <StatBox label="RSI (14)" val={intel.rsi} theme={theme} />
                   <StatBox label="TREND" val={intel.trend} color={intel.trend==="BULLISH"?theme.green:theme.red} theme={theme} />
                   <StatBox label="PATTERN" val={intel.pattern} theme={theme} colSpan={2} />
                   <StatBox label="FIB ZONE" val={intel.fib.level} color={intel.fib.level.includes("GOLDEN")?theme.gold:theme.text} theme={theme} colSpan={2} />
                </div>
             </div>
             <div style={{ background: theme.panel, padding: "20px", borderRadius: "16px", border: `1px solid ${theme.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "bold", color: theme.subText }}>FIBONACCI LEVELS</span>
                    <button onClick={() => setShowFibs(!showFibs)} style={{ fontSize: "10px", padding: "4px 8px", borderRadius: "4px", border: "none", background: showFibs ? theme.primary : theme.subText, color: "#fff", cursor: "pointer" }}>
                        {showFibs ? "VISIBLE" : "HIDDEN"}
                    </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                     <input type="number" placeholder="High Price" value={manualFib.high} onChange={e => setManualFib({...manualFib, high: e.target.value, active: false})} style={{ padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: "11px" }} />
                     <input type="number" placeholder="Low Price" value={manualFib.low} onChange={e => setManualFib({...manualFib, low: e.target.value, active: false})} style={{ padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: "11px" }} />
                </div>
                <button onClick={() => setManualFib(p => ({...p, active: !p.active}))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${theme.primary}`, background: manualFib.active ? theme.primary : "transparent", color: manualFib.active ? "#fff" : theme.primary, fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>
                    {manualFib.active ? "USING MANUAL LEVELS" : "SWITCH TO MANUAL"}
                </button>
             </div>
             <div style={{ background: theme.panel, padding: "24px", borderRadius: "16px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "12px", fontWeight: "bold", color: theme.subText, marginBottom: "15px" }}>PRICE ALERT</div>
                <div style={{ display: "flex", gap: "10px" }}>
                    <input type="number" placeholder="Target Price" value={alertPrice} onChange={(e) => { setAlertPrice(e.target.value); setIsAlertSet(false); }} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }} />
                    <button onClick={() => { setIsAlertSet(!isAlertSet); }} style={{ padding: "10px 15px", borderRadius: "8px", border: "none", background: isAlertSet ? theme.green : theme.subText, color: "#fff", fontWeight: "bold", cursor: "pointer" }}>{isAlertSet ? "ON" : "SET"}</button>
                </div>
             </div>
             <div style={{ marginTop: "auto" }}>
                <button onClick={() => setShowReport(true)} style={{ width: "100%", padding: "18px", borderRadius: "12px", border: "none", background: theme.primary, color: "#fff", fontWeight: "bold", fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 15px rgba(37, 99, 235, 0.3)" }}>
                   GENERATE STRATEGIC REPORT
                </button>
             </div>
             <div style={{ display: "flex", gap: "10px", paddingBottom: "10px" }}>
                {Object.keys(THEMES).map(k => (
                   <button key={k} onClick={()=>setCurrentTheme(k)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: currentTheme===k?theme.text:"transparent", color: currentTheme===k?theme.bg:theme.subText, fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}>{THEMES[k].name}</button>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ReportRow = ({ label, value, color, theme }) => (
  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
    <span style={{ fontSize: "13px", color: theme.subText }}>{label}</span>
    <span style={{ fontSize: "13px", fontWeight: "bold", color: color }}>{value}</span>
  </div>
);

const StatBox = ({ label, val, color, theme, colSpan }) => (
  <div style={{ gridColumn: colSpan ? `span ${colSpan}` : "span 1", background: theme.bg, padding: "12px", borderRadius: "10px", border: `1px solid ${theme.border}` }}>
    <div style={{ fontSize: "10px", color: theme.subText, marginBottom: "4px" }}>{label}</div>
    <div style={{ fontSize: "14px", fontWeight: "bold", color: color || theme.text }}>{val}</div>
  </div>
);

function LoginGate({ onAuth }) {
  return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8" }}><div style={{background:"#fff", padding:"40px", borderRadius:"20px", boxShadow:"0 20px 40px rgba(0,0,0,0.05)", textAlign:"center"}}><h3 style={{margin:"0 0 20px 0", color: "#1e293b"}}>WAIDA Intelligence</h3><input type="password" placeholder="Passcode (123456)" onChange={(e) => onAuth(e.target.value)} style={{ padding: "12px", fontSize: "16px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", textAlign: "center", width: "200px" }} /></div></div>;
}
