import React, { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, LineSeries, LineStyle } from "lightweight-charts";
import { motion, AnimatePresence } from "framer-motion";

/* ================= THEME ENGINE V11 (WAIDA X) ================= */
const THEMES = {
  SYSTEM: {
    name: "System",
    bg: "#f1f5f9", panel: "#ffffff", text: "#0f172a", subText: "#64748b",
    border: "#e2e8f0", primary: "#3b82f6", green: "#10b981", red: "#ef4444",
    grid: "#f8fafc", cardBg: "#ffffff", gold: "#f59e0b"
  },
  DARK: {
    name: "Dark",
    bg: "#0f172a", panel: "#1e293b", text: "#f8fafc", subText: "#94a3b8",
    border: "#334155", primary: "#60a5fa", green: "#4ade80", red: "#f87171",
    grid: "#1e293b", cardBg: "#1e293b", gold: "#fbbf24"
  },
  MIDNIGHT: {
    name: "Midnight",
    bg: "#000000", panel: "#111111", text: "#e5e5e5", subText: "#888888",
    border: "#262626", primary: "#d4af37", green: "#00ff9d", red: "#ff3b30",
    grid: "#0a0a0a", cardBg: "#111111", gold: "#d4af37"
  }
};

/* ================= STRATEGY ENGINE ================= */
const STRATEGIES = {
  "1H": {
    fast: 20, slow: 50,
    title: "Day Trading / Intraday",
    desc: "Uses 20/50 EMA crossover to identify intraday momentum shifts.",
    bias: "Aggressive"
  },
  "4H": {
    fast: 50, slow: 200,
    title: "Swing Trading (Sweet Spot)",
    desc: "Primary trend (50) vs Long-term filter (200). Look for pullbacks to the 50 EMA.",
    bias: "Structural"
  },
  "1D": {
    fast: 50, slow: 200,
    title: "Position Trading",
    desc: "Institutional standard. Determines if asset is in a long-term bull or bear market.",
    bias: "Macro"
  },
  "1W": {
    fast: 21, slow: 50,
    title: "Long-Term Investing",
    desc: "21 EMA (Intermediate) vs 50 EMA (Structural). Identifies major cycle changes.",
    bias: "Investing"
  },
  "15m": { fast: 20, slow: 50, title: "Scalping", desc: "Short term momentum.", bias: "Fast" }
};

const AVAILABLE_PAIRS = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "BNBUSDT", name: "Binance Coin" },
  { symbol: "XRPUSDT", name: "Ripple" },
  { symbol: "ADAUSDT", name: "Cardano" },
  { symbol: "DOGEUSDT", name: "Dogecoin" },
  { symbol: "PAXGUSDT", name: "Gold (Pax)" },
  { symbol: "LINKUSDT", name: "Chainlink" },
  { symbol: "AVAXUSDT", name: "Avalanche" }
];

const TIMEFRAMES = { "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1w" };

// Helper: Calculate EMA
const calculateEMA = (data, period) => {
  const k = 2 / (period + 1);
  let emaArray = [];
  let ema = data[0].close; 
  
  for (let i = 0; i < data.length; i++) {
    const price = data[i].close;
    ema = (price * k) + (ema * (1 - k));
    if (i >= period) { 
        emaArray.push({ time: data[i].time, value: ema });
    }
  }
  return emaArray;
};

// Helper: Generate Sparkline Path
const generateSparkline = (data, width, height) => {
  if (!data || data.length === 0) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  
  return data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
  }).join(" ");
};

// Helper: Generate Pine Script
const getPineScript = (fast, slow, bias) => {
  return `//@version=5
strategy("WAIDA X - Institutional ${bias}", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=1)

// --- INPUTS ---
fastLen = input.int(${fast}, "Fast EMA")
slowLen = input.int(${slow}, "Slow EMA")
rsiLen = input.int(14, "RSI Length")
riskPerTrade = input.float(1.0, "Risk %")
rrRatio = input.float(2.0, "Risk:Reward")

// --- INDICATORS ---
emaFast = ta.ema(close, fastLen)
emaSlow = ta.ema(close, slowLen)
rsi = ta.rsi(close, rsiLen)

// --- LOGIC ---
trendBullish = close > emaSlow and emaFast > emaSlow
trendBearish = close < emaSlow and emaFast < emaSlow
pullbackBuy = trendBullish and close < emaFast and rsi < 55
pullbackSell = trendBearish and close > emaFast and rsi > 45

// --- EXECUTION ---
if (pullbackBuy)
    strategy.entry("Long", strategy.long)
    strategy.exit("Exit Long", "Long", loss=close*0.98, profit=close*1.04)

if (pullbackSell)
    strategy.entry("Short", strategy.short)
    strategy.exit("Exit Short", "Short", loss=close*1.02, profit=close*0.96)

// --- VISUALS ---
plot(emaFast, color=color.blue, title="Fast EMA")
plot(emaSlow, color=color.purple, title="Slow EMA")
`;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { if ("Notification" in window) Notification.requestPermission(); }, []);
  if (!isLoggedIn) return <LoginGate onAuth={(v) => v === "123456" && setIsLoggedIn(true)} />;
  return <Dashboard />;
}

/* ================= DASHBOARD V12 ================= */
function Dashboard() {
  const chartContainerRef = useRef(null);
  const seriesInstance = useRef(null);
  const volumeSeriesRef = useRef(null); 
  const emaFastRef = useRef(null); 
  const emaSlowRef = useRef(null); 
  const fibLinesRef = useRef([]); 
  const srLinesRef = useRef([]); // NEW: S/R Lines Ref
  
  // Data Refs for Signal Generator
  const candlesRef = useRef([]); 

  // Responsive & Layout State
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1000);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // App State
  const [currentTheme, setCurrentTheme] = useState("DARK");
  const theme = THEMES[currentTheme];
  const [pair, setPair] = useState("BTCUSDT");
  const [tf, setTf] = useState("4H");
  const [tickerData, setTickerData] = useState({ price: 0, change: 0, vol: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Strategy State
  const currentStrategy = STRATEGIES[tf] || STRATEGIES["1H"];

  // Search & Favorites
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState(["BTCUSDT", "ETHUSDT"]);
  const [showSearch, setShowSearch] = useState(false);

  // Indicators & Tools
  const [showFibs, setShowFibs] = useState(true);
  const [showEMA, setShowEMA] = useState(false);
  const [showSR, setShowSR] = useState(false); // NEW: Show S/R State
  const [manualFib, setManualFib] = useState({ high: "", low: "", active: false });
  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false); 
  
  // NEW: Decision Signal State
  const [showDecision, setShowDecision] = useState(false);
  const [decisionData, setDecisionData] = useState(null);

  // Alerts
  const [alertPrice, setAlertPrice] = useState("");
  const [isAlertSet, setIsAlertSet] = useState(false);
  const alertRef = useRef({ price: "", active: false });
  useEffect(() => { alertRef.current = { price: alertPrice, active: isAlertSet }; }, [alertPrice, isAlertSet]);

  // Intelligence
  const [intel, setIntel] = useState({
    trend: "SCANNING", rsi: 50, volatility: 0,
    fib: { level: "--" }, pattern: "--",
    setup: { action: "WAIT", entry: 0, sl: 0, tp1: 0 },
    confidence: 0, confirmations: [], narrative: "Loading..."
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1000);
      if(window.innerWidth < 1000) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sendPhoneNotification = (msg) => {
    if (Notification.permission === "granted") new Notification("WAIDA Alert", { body: msg });
  };

  const toggleFavorite = (p) => {
    if (favorites.includes(p)) setFavorites(favorites.filter(x => x !== p));
    else setFavorites([...favorites, p]);
  };

  /* ================= 🧠 CORE LOGIC ================= */
  const analyzeMarket = useCallback((candles, currentPrice) => {
    const series = seriesInstance.current;
    if (!series || candles.length < 250) return; 

    // Store for Generator
    candlesRef.current = candles;

    const subset = candles.slice(-250); 
    const last = candles[candles.length - 1];
    const activePrice = currentPrice || last.close;

    // High/Low
    let high = Math.max(...subset.slice(-50).map(c => c.high));
    let low = Math.min(...subset.slice(-50).map(c => c.low));
    
    if (manualFib.active && manualFib.high && manualFib.low) {
      high = parseFloat(manualFib.high);
      low = parseFloat(manualFib.low);
    }

    // Dynamic Indicators based on Strategy
    const emaFastVal = calculateEMA(subset, currentStrategy.fast).pop()?.value || 0;
    const emaSlowVal = calculateEMA(subset, currentStrategy.slow).pop()?.value || 0;

    // Logic: If Fast > Slow = Bullish bias
    const trend = activePrice > emaSlowVal ? "BULLISH" : "BEARISH";
    
    // RSI
    const gains = [], losses = [];
    for(let i=1; i<15; i++) {
        const diff = subset[subset.length-i].close - subset[subset.length-i-1].close;
        diff >= 0 ? gains.push(diff) : losses.push(Math.abs(diff));
    }
    const rs = (gains.reduce((a,b)=>a+b,0)/14) / (losses.reduce((a,b)=>a+b,0)/14 || 1);
    const rsi = 100 - (100 / (1 + rs));

    // Pattern
    const pattern = detectPattern(candles);

    /* 5. FIBONACCI GOLDEN ZONE CHECK */
    const range = high - low;
    const fib50 = trend === "BULLISH" ? high - (range * 0.5) : low + (range * 0.5);
    const fib618 = trend === "BULLISH" ? high - (range * 0.618) : low + (range * 0.618);
    const zoneTop = Math.max(fib50, fib618);
    const zoneBottom = Math.min(fib50, fib618);
    const inGoldenZone = activePrice >= zoneBottom && activePrice <= zoneTop;
    const fibStatus = inGoldenZone ? "IN GOLDEN ZONE (50-61.8%)" : "Outside Key Zone";

    // Scoring
    let score = 0;
    let confs = [];
    if (trend === "BULLISH") {
      if (activePrice > emaFastVal) { score+=20; confs.push(`Above EMA ${currentStrategy.fast}`); }
      if (emaFastVal > emaSlowVal) { score+=15; confs.push("EMA Cross Bullish"); }
      if (rsi > 40 && rsi < 70) { score+=20; confs.push("Bullish Momentum"); }
      if (inGoldenZone) { score+=35; confs.push("Golden Zone Support"); }
      if (pattern.includes("Bullish")) { score+=30; confs.push(pattern); }
    } else {
      if (activePrice < emaFastVal) { score+=20; confs.push(`Below EMA ${currentStrategy.fast}`); }
      if (emaFastVal < emaSlowVal) { score+=15; confs.push("EMA Cross Bearish"); }
      if (rsi < 60 && rsi > 30) { score+=20; confs.push("Bearish Momentum"); }
      if (inGoldenZone) { score+=35; confs.push("Golden Zone Resistance"); }
      if (pattern.includes("Bearish")) { score+=30; confs.push(pattern); }
    }

    // Draw Fibs
    if (showFibs) drawFibonacci(series, high, low, trend);
    else { fibLinesRef.current.forEach(l => series.removePriceLine(l)); fibLinesRef.current = []; }
    
    // Draw S/R (Called here to update on major changes or toggle)
    drawSupportResistance(series, candles);

    setIntel({
      trend, rsi: rsi.toFixed(1), volatility: (range/activePrice*100).toFixed(2),
      fib: { level: fibStatus }, 
      pattern,
      setup: { 
        action: score > 65 ? (trend==="BULLISH"?"LONG":"SHORT") : "WAIT",
        entry: activePrice, sl: trend==="BULLISH"?low:high, tp1: trend==="BULLISH"?high:low 
      },
      confidence: score, confirmations: confs,
      narrative: `Strategy: ${currentStrategy.title}. Trend is ${trend}.`
    });

  }, [theme, manualFib, showFibs, showSR, currentStrategy]); // Added showSR dependency

  /* ================= 🧱 SUPPORT & RESISTANCE ENGINE ================= */
  const drawSupportResistance = (series, candles) => {
    // 1. Clear existing lines
    srLinesRef.current.forEach(l => series.removePriceLine(l));
    srLinesRef.current = [];
    
    // 2. Guard Clauses
    if (!showSR || !candles || candles.length < 50) return;

    // 3. Logic: Find Fractals (Pivot High/Low) over period 20 (10 left, 10 right)
    // This identifies significant turning points
    const period = 20; 
    const levels = [];
    
    // Scan only visible history (optimization: last 300 candles)
    const scanStart = Math.max(0, candles.length - 300);
    
    for(let i = scanStart + period; i < candles.length - period; i++) {
        const cur = candles[i];
        
        // Check High Pivot
        let isHigh = true;
        for(let j = 1; j <= period; j++) {
            if(candles[i-j].high > cur.high || candles[i+j].high > cur.high) { isHigh = false; break; }
        }
        
        // Check Low Pivot
        let isLow = true;
        for(let j = 1; j <= period; j++) {
             if(candles[i-j].low < cur.low || candles[i+j].low < cur.low) { isLow = false; break; }
        }

        if(isHigh) levels.push({ price: cur.high, type: "R" });
        if(isLow) levels.push({ price: cur.low, type: "S" });
    }

    // 4. Clustering: Filter/Merge nearby levels
    // If levels are within 0.5% of each other, we only keep the first one to avoid noise.
    const uniqueLevels = [];
    levels.forEach(l => {
        // Check if a level already exists nearby
        const existing = uniqueLevels.find(u => Math.abs(u.price - l.price) / l.price < 0.005); 
        if(!existing) uniqueLevels.push(l);
    });

    // 5. Drawing
    uniqueLevels.forEach(l => {
        const line = series.createPriceLine({
            price: l.price,
            color: l.type === "R" ? theme.red : theme.green, // Theme-aware colors
            lineWidth: 1,
            lineStyle: LineStyle.Dashed, 
            axisLabelVisible: true,
            title: l.type === "R" ? "RES" : "SUP",
        });
        srLinesRef.current.push(line);
    });
  };

  const detectPattern = (candles) => {
    const c0 = candles[candles.length - 1]; const c1 = candles[candles.length - 2];
    const green = c => c.close > c.open;
    if (!green(c1) && green(c0) && c0.close > c1.open && c0.open < c1.close) return "Bullish Engulfing";
    if (green(c1) && !green(c0) && c0.close < c1.open && c0.open > c1.close) return "Bearish Engulfing";
    return "Consolidation";
  };

  const drawFibonacci = (series, high, low, trend) => {
    fibLinesRef.current.forEach(l => series.removePriceLine(l));
    fibLinesRef.current = [];
    const diff = high - low;
    const levels = [
        { lvl: 0, color: theme.subText, label: "0%", type: "dotted" },
        { lvl: 0.382, color: theme.subText, label: "38.2%", type: "dashed" },
        { lvl: 0.5, color: "#9ca3af", label: "50%", type: "solid" }, 
        { lvl: 0.618, color: "#fbbf24", label: "61.8% (Golden)", type: "solid" },
        { lvl: 0.786, color: "#3b82f6", label: "78.6%", type: "dashed" },
        { lvl: 1, color: theme.subText, label: "100%", type: "dotted" },
        { lvl: 1.618, color: theme.subText, label: "161.8%", type: "dashed" }
    ];

    levels.forEach(cfg => {
      let price = trend === "BULLISH" ? high - (diff * cfg.lvl) : low + (diff * cfg.lvl);
      fibLinesRef.current.push(series.createPriceLine({
        price, color: cfg.color, lineWidth: cfg.lvl===0.618?2:1, 
        lineStyle: cfg.type==="solid"?LineStyle.Solid:LineStyle.Dashed, 
        axisLabelVisible: true, title: cfg.label
      }));
    });

    // Golden Zone Fill
    const start = 0.5, end = 0.618, steps = 10;
    for(let i=0; i<=steps; i++) {
        let l = start + ((end-start)/steps)*i;
        let p = trend==="BULLISH"?high-(diff*l):low+(diff*l);
        fibLinesRef.current.push(series.createPriceLine({
            price: p, color: "rgba(251, 191, 36, 0.1)", lineWidth: 1, axisLabelVisible: false, title: ""
        }));
    }
  };

  /* ================= 🤖 AUTO-SCORING DECISION ENGINE ================= */
  const generateDecision = () => {
    const c = candlesRef.current;
    if(!c || c.length < 100) return;

    // --- 1. DATA EXTRACTION ---
    const last = c[c.length-1];
    const hour = new Date().getUTCHours();
    const isLondon = hour >= 8 && hour <= 16;
    const isNY = hour >= 13 && hour <= 21;
    const sessionActive = isLondon || isNY;
    const sessionName = isLondon && isNY ? "NY/London Overlap" : isLondon ? "London" : isNY ? "New York" : "Asian/Off-Hours";
    const rsiVal = parseFloat(intel.rsi);
    
    // --- 2. AUTO-SCORING FORMULA ---
    let buyScore = 0;
    let sellScore = 0;

    // A. HTF Structure (40 pts)
    if(intel.trend === "BULLISH") buyScore += 40; 
    else sellScore += 40;

    // B. Entry Zone (25 pts)
    const inGolden = intel.fib.level.includes("GOLDEN");
    if(inGolden) {
        if(intel.trend === "BULLISH") buyScore += 25; // Discount
        else sellScore += 25; // Premium
    }

    // C. Candle Quality (15 pts)
    const body = Math.abs(last.close - last.open);
    const range = last.high - last.low;
    const isGreen = last.close > last.open;
    const quality = range > 0 ? (body / range) >= 0.6 : false;
    
    if(quality) {
        if(isGreen) buyScore += 15; else sellScore += 15;
    } else {
        // Partial points for alignment
        if(isGreen) buyScore += 5; else sellScore += 5;
    }

    // D. Session Filter (10 pts)
    const sessionPoints = sessionActive ? 10 : 5;
    buyScore += sessionPoints; // Session applies to both as liquidity
    sellScore += sessionPoints;

    // E. Momentum (10 pts)
    if(rsiVal > 55) buyScore += 10;
    if(rsiVal < 45) sellScore += 10;

    // --- 3. FINAL DECISION ---
    const DECISION = buyScore >= sellScore ? "BUY" : "SELL";
    const CONFIDENCE = DECISION === "BUY" ? buyScore : sellScore;
    const FINAL_CONFIDENCE = Math.min(Math.max(CONFIDENCE, 30), 99); // Clamp 30-99

    // --- 4. EXECUTION DATA ---
    const lastPrice = last.close;
    // 1:2 RR Ratio
    const stopLoss = DECISION === "BUY" ? lastPrice * 0.99 : lastPrice * 1.01; // 1% Risk
    const takeProfit = DECISION === "BUY" ? lastPrice * 1.02 : lastPrice * 0.98; // 2% Reward
    
    // Generate Pine Script
    const script = getPineScript(currentStrategy.fast, currentStrategy.slow, DECISION);
    const sparklinePath = generateSparkline(c.slice(-100).map(x => x.close), 500, 80);

    setDecisionData({
        type: DECISION,
        buyScore,
        sellScore,
        confidence: FINAL_CONFIDENCE,
        session: sessionName,
        time: new Date().toISOString().split('T')[0] + " " + new Date().toLocaleTimeString(),
        pair: pair,
        tf: tf,
        entry: lastPrice.toFixed(2),
        stop: stopLoss.toFixed(2),
        target: takeProfit.toFixed(2),
        rr: "1:2",
        posSize: "1%",
        sparkline: sparklinePath,
        script: script
    });
    setShowDecision(true);
  };

  /* ================= 📊 CHART ENGINE ================= */
  useEffect(() => {
    setIsLoading(true);
    // Fetch 24h Ticker
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`)
      .then(r => r.json())
      .then(d => {
        setTickerData({ 
          price: parseFloat(d.lastPrice), 
          change: parseFloat(d.priceChangePercent), 
          vol: parseFloat(d.quoteVolume) 
        });
      });

    if (!chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = "";
    const rect = chartContainerRef.current.getBoundingClientRect();

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: theme.panel }, textColor: theme.text },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      width: rect.width, height: rect.height,
      rightPriceScale: { borderColor: theme.border },
      timeScale: { borderColor: theme.border, timeVisible: true },
    });

    const volSeries = chart.addSeries(HistogramSeries, { color: theme.subText, priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volSeries;

    const mainSeries = chart.addSeries(CandlestickSeries, { upColor: theme.green, downColor: theme.red, borderVisible: false, wickUpColor: theme.green, wickDownColor: theme.red });
    seriesInstance.current = mainSeries;

    // EMA Lines (Dynamic)
    const emaFastSeries = chart.addSeries(LineSeries, { color: theme.accent || theme.primary, lineWidth: 2, visible: showEMA });
    const emaSlowSeries = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 2, visible: showEMA });
    emaFastRef.current = emaFastSeries;
    emaSlowRef.current = emaSlowSeries;

    const interval = TIMEFRAMES[tf];
    let cache = [];

    fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=500`)
      .then(r=>r.json()).then(data => {
        setIsLoading(false);
        if(!Array.isArray(data)) return;
        const candles = data.map(x => ({ time: x[0]/1000, open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
        cache = candles;
        const vol = data.map(x => ({ time: x[0]/1000, value: +x[5], color: +x[4]>=+x[1]? theme.green: theme.red }));
        
        mainSeries.setData(candles);
        volSeries.setData(vol);
        
        if(showEMA) {
            emaFastSeries.setData(calculateEMA(candles, currentStrategy.fast));
            emaSlowSeries.setData(calculateEMA(candles, currentStrategy.slow));
        }

        analyzeMarket(candles, candles[candles.length-1].close);
      });

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_${interval}`);
    ws.onmessage = (e) => {
      const { k } = JSON.parse(e.data);
      const price = parseFloat(k.c);
      const candle = { time: k.t/1000, open: +k.o, high: +k.h, low: +k.l, close: price };
      
      mainSeries.update(candle);
      volSeries.update({ time: k.t/1000, value: +k.v, color: price >= +k.o ? theme.green : theme.red });
      setTickerData(prev => ({ ...prev, price })); 

      if (k.x) {
         cache.push(candle);
         if(cache.length > 500) cache.shift();
         
         if(showEMA) {
             emaFastRef.current.setData(calculateEMA(cache, currentStrategy.fast));
             emaSlowRef.current.setData(calculateEMA(cache, currentStrategy.slow));
         }
         analyzeMarket(cache, price);
      } else {
         setIntel(prev => ({ ...prev, price: price }));
      }
      
      // Alerts
      if (alertRef.current.active && alertRef.current.price) {
         if (Math.abs(price - parseFloat(alertRef.current.price))/price < 0.001) {
            sendPhoneNotification(`HIT: ${pair} @ ${price}`);
            setIsAlertSet(false); alert(`Target Hit: ${price}`);
         }
      }
    };

    const resize = () => { if(chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight }); };
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); ws.close(); chart.remove(); };
  }, [pair, tf, currentTheme, showEMA, showFibs, showSR, analyzeMarket, currentStrategy]);

  const formatPrice = (p) => !p ? "..." : p < 1 ? p.toFixed(6) : p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatVol = (v) => !v ? "..." : (v/1000000).toFixed(1) + "M";

  return (
    <div style={{ background: theme.bg, height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", color: theme.text, overflow: "hidden" }}>
      
      {/* 🟦 HEADER */}
      <div style={{ height: "80px", background: theme.panel, borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", padding: "0 20px", justifyContent: "space-between", flexShrink: 0, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", zIndex: 20 }}>
         
         {/* Logo & Pair */}
         <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{ fontWeight: "900", fontSize: "22px", letterSpacing: "-1px" }}>WAIDA <span style={{ color: theme.primary }}>X</span></div>
            
            <div style={{ position: "relative" }}>
               <div onClick={() => setShowSearch(!showSearch)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px", background: theme.bg, borderRadius: "8px", cursor: "pointer", border: `1px solid ${theme.border}` }}>
                  <span style={{ fontWeight: "bold" }}>{AVAILABLE_PAIRS.find(p=>p.symbol===pair)?.name || pair}</span>
                  <span style={{ fontSize: "12px", color: theme.subText }}>▼</span>
               </div>
               {showSearch && (
                 <div style={{ position: "absolute", top: "110%", left: 0, width: "240px", background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "10px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", zIndex: 100 }}>
                    <input autoFocus type="text" placeholder="Search..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{ width: "100%", padding: "8px", marginBottom: "10px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text }} />
                    <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                       {AVAILABLE_PAIRS.filter(p=>p.symbol.includes(searchQuery.toUpperCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                         <div key={p.symbol} onClick={() => { setPair(p.symbol); setShowSearch(false); }} style={{ padding: "8px", cursor: "pointer", borderRadius: "6px", fontSize: "13px", display: "flex", justifyContent: "space-between", hover: { background: theme.bg } }}>
                            <span>{p.name}</span> <span style={{color: theme.subText}}>{p.symbol}</span>
                         </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>

            <button onClick={() => toggleFavorite(pair)} title={favorites.includes(pair) ? "Remove Favorite" : "Add Favorite"} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: favorites.includes(pair) ? theme.gold : theme.subText }}>
               {favorites.includes(pair) ? "★" : "☆"}
            </button>
         </div>

         {/* 📈 Big Ticker Display */}
         <div style={{ display: "flex", alignItems: "center", gap: "30px", display: isMobile ? "none" : "flex" }}>
            <div style={{ textAlign: "right" }}>
               <div style={{ fontSize: "28px", fontWeight: "900", color: tickerData.change >= 0 ? theme.green : theme.red }}>${formatPrice(tickerData.price)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
               <div style={{ fontSize: "12px", color: theme.subText }}>24h Change</div>
               <div style={{ fontSize: "14px", fontWeight: "bold", color: tickerData.change >= 0 ? theme.green : theme.red }}>{tickerData.change >= 0 ? "+" : ""}{tickerData.change}%</div>
            </div>
         </div>

         <div style={{ display: "flex", gap: "10px" }}>
            {/* SETTINGS ICON */}
            <button onClick={() => setShowSettings(true)} style={{ padding: "8px", borderRadius: "8px", background: theme.bg, border: `1px solid ${theme.border}`, cursor: "pointer", color: theme.text }} title="Strategy Settings">
               ⚙️
            </button>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ padding: "8px 16px", borderRadius: "8px", background: theme.bg, border: `1px solid ${theme.border}`, cursor: "pointer", color: theme.text }}>
               {sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
            </button>
            <ThemeToggle current={currentTheme} set={setCurrentTheme} themes={THEMES} theme={theme} />
         </div>
      </div>

      {/* 🚧 MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* CHART AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
           {/* Chart Toolbar */}
           <div style={{ height: "40px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", padding: "0 10px", gap: "10px", background: theme.cardBg }}>
              {Object.keys(TIMEFRAMES).map(t => (
                 <button key={t} onClick={() => setTf(t)} style={{ padding: "4px 10px", borderRadius: "6px", background: tf===t ? theme.primary : "transparent", color: tf===t ? "#fff" : theme.subText, border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>{t}</button>
              ))}
              <div style={{ width: "1px", height: "20px", background: theme.border, margin: "0 5px" }} />
              {/* Dynamic Button Label */}
              <button onClick={() => setShowEMA(!showEMA)} style={{ fontSize: "12px", color: showEMA?theme.primary:theme.subText, background: "transparent", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                 EMA {currentStrategy.fast}/{currentStrategy.slow}
              </button>
              <button onClick={() => setShowFibs(!showFibs)} style={{ fontSize: "12px", color: showFibs?theme.primary:theme.subText, background: "transparent", border: "none", cursor: "pointer", fontWeight: "bold" }}>FIB LEVELS</button>
              <button onClick={() => setShowSR(!showSR)} style={{ fontSize: "12px", color: showSR?theme.primary:theme.subText, background: "transparent", border: "none", cursor: "pointer", fontWeight: "bold" }}>S/R LEVELS</button>
           </div>

           {/* Chart Canvas */}
           <div style={{ flex: 1, position: "relative" }}>
              {isLoading && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "10px 20px", borderRadius: "8px", zIndex: 50 }}>Scanning Market Data...</div>}
              <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />
           </div>
        </div>

        {/* 🎛 SIDEBAR */}
        {sidebarOpen && (
           <div style={{ width: isMobile ? "100%" : "360px", background: theme.panel, borderLeft: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", overflowY: "auto", position: isMobile ? "absolute" : "relative", height: "100%", zIndex: 40 }}>
              
              {/* Favorites Widget */}
              <div style={{ padding: "20px", borderBottom: `1px solid ${theme.border}` }}>
                 <div style={{ fontSize: "12px", fontWeight: "bold", color: theme.subText, marginBottom: "10px", letterSpacing: "1px" }}>WATCHLIST</div>
                 <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {favorites.length === 0 && <span style={{fontSize: "12px", color: theme.subText}}>Star pairs to add them here.</span>}
                    {favorites.map(f => (
                       <div key={f} onClick={() => setPair(f)} style={{ padding: "6px 12px", background: f===pair?theme.primary:theme.bg, color: f===pair?"#fff":theme.text, borderRadius: "6px", fontSize: "12px", cursor: "pointer", border: `1px solid ${theme.border}` }}>
                          {f.replace("USDT", "")}
                       </div>
                    ))}
                 </div>
              </div>

              {/* Live Intelligence */}
              <div style={{ padding: "20px", borderBottom: `1px solid ${theme.border}` }}>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "bold", color: theme.subText, letterSpacing: "1px" }}>AI INTELLIGENCE</div>
                    <div style={{ fontSize: "10px", color: theme.primary, background: "rgba(59, 130, 246, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>{currentStrategy.bias.toUpperCase()}</div>
                 </div>
                 
                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <StatBox label="Trend" val={intel.trend} color={intel.trend==="BULLISH"?theme.green:theme.red} theme={theme} />
                    <StatBox label="RSI" val={intel.rsi} theme={theme} />
                    <StatBox label="Pattern" val={intel.pattern} theme={theme} colSpan={2} />
                    <StatBox label="Fib Status" val={intel.fib.level} color={intel.fib.level.includes("GOLDEN")?theme.gold:theme.text} theme={theme} colSpan={2} />
                 </div>
                 
                 {/* 🔘 GENERATE SIGNAL BUTTON */}
                 <button 
                    onClick={generateDecision}
                    style={{ marginTop: "15px", width: "100%", padding: "12px", background: theme.primary, color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "12px", cursor: "pointer", boxShadow: "0 4px 10px rgba(59, 130, 246, 0.3)" }}
                 >
                    ⚡ GENERATE SIGNAL
                 </button>

                 <div style={{ marginTop: "15px", padding: "10px", background: theme.bg, borderRadius: "8px", fontSize: "12px", color: theme.subText, border: `1px solid ${theme.border}` }}>
                    <span style={{ fontWeight: "bold", color: theme.text }}>Strategy: </span>{currentStrategy.title} ({currentStrategy.fast}/{currentStrategy.slow})
                 </div>
              </div>

              {/* Manual Fib Controls */}
              <div style={{ padding: "20px", borderBottom: `1px solid ${theme.border}` }}>
                 <div style={{ fontSize: "12px", fontWeight: "bold", color: theme.subText, marginBottom: "10px" }}>MANUAL FIBONACCI</div>
                 <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                    <input type="number" placeholder="High" value={manualFib.high} onChange={e => setManualFib({...manualFib, high: e.target.value, active: false})} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: "12px" }} />
                    <input type="number" placeholder="Low" value={manualFib.low} onChange={e => setManualFib({...manualFib, low: e.target.value, active: false})} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: "12px" }} />
                 </div>
                 <button onClick={() => setManualFib(p => ({...p, active: !p.active}))} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${theme.primary}`, background: manualFib.active ? theme.primary : "transparent", color: manualFib.active ? "#fff" : theme.primary, fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>
                    {manualFib.active ? "USING MANUAL LEVELS" : "APPLY MANUAL LEVELS"}
                 </button>
              </div>

              {/* Price Alerts */}
              <div style={{ padding: "20px" }}>
                 <div style={{ fontSize: "12px", fontWeight: "bold", color: theme.subText, marginBottom: "10px" }}>PRICE ALERT</div>
                 <div style={{ display: "flex", gap: "10px" }}>
                    <input type="number" placeholder="Target Price" value={alertPrice} onChange={(e) => { setAlertPrice(e.target.value); setIsAlertSet(false); }} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: "12px" }} />
                    <button onClick={() => { setIsAlertSet(!isAlertSet); }} style={{ padding: "8px 12px", borderRadius: "6px", border: "none", background: isAlertSet ? theme.green : theme.subText, color: "#fff", fontWeight: "bold", cursor: "pointer" }}>{isAlertSet ? "ON" : "SET"}</button>
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* MODAL: Strategic Report */}
      <AnimatePresence>
        {showReport && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ background: theme.panel, padding: "40px", borderRadius: "20px", maxWidth: "600px", width: "90%", border: `1px solid ${theme.border}` }}>
                <h2>Strategic Blueprint</h2>
                <p style={{color: theme.subText}}>Detailed breakdown of the current market structure...</p>
                <button onClick={() => setShowReport(false)} style={{ marginTop: "20px", padding: "10px 20px", background: theme.text, color: theme.bg, border: "none", borderRadius: "8px", cursor: "pointer" }}>Close</button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Settings / Strategy Info */}
      <AnimatePresence>
        {showSettings && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} style={{ background: theme.panel, padding: "30px", borderRadius: "16px", maxWidth: "500px", width: "90%", border: `1px solid ${theme.border}`, color: theme.text }}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px"}}>
                   <h2 style={{margin: 0, fontSize: "20px"}}>Strategy Configuration</h2>
                   <button onClick={() => setShowSettings(false)} style={{background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: theme.subText}}>✕</button>
                </div>
                
                <div style={{ marginBottom: "20px", padding: "15px", background: theme.bg, borderRadius: "10px", border: `1px solid ${theme.border}` }}>
                   <div style={{ fontSize: "12px", color: theme.primary, fontWeight: "bold", marginBottom: "5px" }}>ACTIVE TIMEFRAME: {tf}</div>
                   <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "5px" }}>{currentStrategy.title}</div>
                   <div style={{ fontSize: "14px", color: theme.subText, lineHeight: "1.5" }}>{currentStrategy.desc}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                   <div style={{ padding: "15px", background: theme.cardBg, borderRadius: "10px", border: `1px solid ${theme.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: "12px", color: theme.subText }}>Fast EMA</div>
                      <div style={{ fontSize: "24px", fontWeight: "900", color: theme.primary }}>{currentStrategy.fast}</div>
                   </div>
                   <div style={{ padding: "15px", background: theme.cardBg, borderRadius: "10px", border: `1px solid ${theme.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: "12px", color: theme.subText }}>Slow EMA</div>
                      <div style={{ fontSize: "24px", fontWeight: "900", color: "#8b5cf6" }}>{currentStrategy.slow}</div>
                   </div>
                </div>

                <div style={{ marginTop: "20px", fontSize: "12px", color: theme.subText, textAlign: "center" }}>
                   * Settings automatically adjust based on selected timeframe conventions.
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔴 MODAL: WAIDA X GENERATOR (UPDATED V2) */}
      <AnimatePresence>
        {showDecision && decisionData && (
           <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <motion.div 
                 initial={{ opacity: 0, y: 50 }} 
                 animate={{ opacity: 1, y: 0 }} 
                 exit={{ opacity: 0, y: 50 }} 
                 style={{ 
                    background: "#0f172a", 
                    width: "100%", maxWidth: "550px", 
                    borderRadius: "16px", border: `1px solid ${theme.border}`, 
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", 
                    overflow: "hidden", fontFamily: "'Courier New', monospace", color: "#e2e8f0"
                 }}
              >
                 {/* Header */}
                 <div style={{ padding: "15px 20px", background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: "bold", fontSize: "14px", color: theme.primary }}>⚡ WAIDA X INTELLIGENCE</div>
                    <button onClick={() => setShowDecision(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "18px" }}>✕</button>
                 </div>

                 {/* Content - Scrollable */}
                 <div style={{ padding: "20px", maxHeight: "75vh", overflowY: "auto", fontSize: "12px", lineHeight: "1.6" }}>
                    
                    {/* 1. AUTO SCORE */}
                    <div style={{ marginBottom: "20px" }}>
                        <div style={{ color: theme.primary, borderBottom: "1px dashed #334155", paddingBottom: "2px", marginBottom: "10px", fontWeight: "bold" }}>1️⃣ AUTO SCORE</div>
                        <div style={{display: "flex", justifyContent: "space-between"}}><span>BUY Score:</span> <span style={{color: "#4ade80"}}>{decisionData.buyScore}/100</span></div>
                        <div style={{display: "flex", justifyContent: "space-between"}}><span>SELL Score:</span> <span style={{color: "#f87171"}}>{decisionData.sellScore}/100</span></div>
                        <div style={{display: "flex", justifyContent: "space-between"}}><span>Final Confidence:</span> <span style={{fontWeight: "bold"}}>{decisionData.confidence}%</span></div>
                    </div>

                    {/* 2. FINAL DECISION */}
                    <div style={{ padding: "15px", background: decisionData.type==="BUY" ? "rgba(74, 222, 128, 0.1)" : "rgba(248, 113, 113, 0.1)", border: `1px solid ${decisionData.type==="BUY"?"#4ade80":"#f87171"}`, borderRadius: "8px", textAlign: "center", marginBottom: "20px" }}>
                       <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>FINAL DECISION</div>
                       <div style={{ fontSize: "32px", fontWeight: "900", color: decisionData.type==="BUY"?"#4ade80":"#f87171", letterSpacing: "2px" }}>
                          {decisionData.type}
                       </div>
                    </div>

                    {/* 3. SPARKLINE */}
                    <div style={{ height: "40px", background: "rgba(0,0,0,0.2)", borderRadius: "4px", border: `1px solid #334155`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: "20px" }}>
                          <svg width="100%" height="100%" viewBox="0 0 500 80" preserveAspectRatio="none">
                             <path d={decisionData.sparkline} fill="none" stroke={decisionData.type === "BUY" ? theme.green : theme.red} strokeWidth="2" />
                          </svg>
                    </div>

                    {/* 4. BACKTEST DATA */}
                    <div style={{ marginBottom: "20px", background: "#1e293b", padding: "10px", borderRadius: "6px" }}>
                        <div style={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "5px" }}>BACKTEST DATA</div>
                        <div>Timestamp: {decisionData.time}</div>
                        <div>Symbol: {decisionData.pair} ({decisionData.tf})</div>
                        <div>Entry: {decisionData.entry}</div>
                        <div>Stop: {decisionData.stop}</div>
                        <div>Target: {decisionData.target}</div>
                        <div>RR: {decisionData.rr}</div>
                    </div>

                    {/* 5. BOT EXECUTION */}
                    <div style={{ marginBottom: "20px", background: "#1e293b", padding: "10px", borderRadius: "6px" }}>
                        <div style={{ color: "#94a3b8", fontWeight: "bold", marginBottom: "5px" }}>BOT EXECUTION</div>
                        <div>Direction: {decisionData.type}</div>
                        <div>Entry: {decisionData.entry}</div>
                        <div>Stop: {decisionData.stop}</div>
                        <div>Target: {decisionData.target}</div>
                        <div>Position Size: {decisionData.posSize}</div>
                    </div>

                    

                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>

    </div>
  );
}

const StatBox = ({ label, val, color, theme, colSpan }) => (
  <div style={{ gridColumn: colSpan ? `span ${colSpan}` : "span 1", background: theme.bg, padding: "12px", borderRadius: "10px", border: `1px solid ${theme.border}` }}>
    <div style={{ fontSize: "10px", color: theme.subText, marginBottom: "4px" }}>{label}</div>
    <div style={{ fontSize: "14px", fontWeight: "bold", color: color || theme.text }}>{val}</div>
  </div>
);

const ThemeToggle = ({ current, set, themes, theme }) => (
  <div style={{ display: "flex", background: theme.bg, borderRadius: "8px", padding: "4px", border: `1px solid ${theme.border}` }}>
    {Object.keys(themes).map(k => (
       <div key={k} onClick={() => set(k)} style={{ width: "20px", height: "20px", borderRadius: "4px", background: themes[k].bg, border: current===k ? `2px solid ${theme.primary}` : "1px solid transparent", cursor: "pointer", marginLeft: "4px" }} />
    ))}
  </div>
);

function LoginGate({ onAuth }) {
  return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}><div style={{background:"#fff", padding:"40px", borderRadius:"16px", boxShadow:"0 20px 50px rgba(0,0,0,0.1)", textAlign:"center"}}><h3 style={{margin:"0 0 20px 0", color: "#0f172a"}}>WAIDA X Access</h3><input type="password" placeholder="Passcode (123456)" onChange={(e) => onAuth(e.target.value)} style={{ padding: "12px", fontSize: "16px", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none", textAlign: "center", width: "200px" }} /></div></div>;
}