const db = require('../config/db');

class CommodityLotService {
    constructor() {
        this.cache = new Map(); // cleanSymbol -> { lot_size, usdinr_value, category }
        this.isLoaded = false;
    }

    async load() {
        try {
            const [rows] = await db.query('SELECT symbol, category, lot_size, usdinr_value FROM commodity_forex_crypto_lot_sizes');
            this.cache.clear();
            for (const row of rows) {
                const clean = this.cleanSymbol(row.symbol);
                this.cache.set(clean, {
                    symbol: row.symbol,
                    category: (row.category || '').toUpperCase(),
                    lot_size: parseFloat(row.lot_size || 1),
                    usdinr_value: parseFloat(row.usdinr_value || 95.1)
                });
            }
            this.isLoaded = true;
            console.log(`💼 Commodity/Forex Lot Sizes loaded: ${this.cache.size} symbols cached.`);
        } catch (err) {
            console.error('❌ Error loading commodity/forex lot sizes:', err.message);
        }
    }

    cleanSymbol(symbol) {
        if (!symbol) return '';
        let clean = symbol.toUpperCase();
        const prefixes = ['COMMODITY:', 'FOREX:', 'CRYPTO:', 'MCX:', 'NSE:', 'NFO:', 'COMEX:'];
        let changed = true;
        while (changed) {
            changed = false;
            for (const p of prefixes) {
                if (clean.startsWith(p)) {
                    clean = clean.substring(p.length);
                    changed = true;
                }
            }
        }
        return clean;
    }

    getLotInfo(symbol) {
        if (!symbol) return null;
        const clean = this.cleanSymbol(symbol);
        return this.cache.get(clean) || null;
    }

    /**
     * Checks if a symbol or market type belongs to COMMODITY category from the DB config
     */
    isCommodityScrip(symbol, marketType) {
        const info = this.getLotInfo(symbol);
        if (info) {
            const cat = (info.category || '').toUpperCase();
            if (cat === 'COMMODITY' || cat === 'FOREX' || cat === 'CRYPTO') {
                return true;
            }
        }
        const mType = (marketType || '').toUpperCase();
        return mType === 'COMMODITY' || mType === 'FOREX' || mType === 'CRYPTO';
    }

    /**
     * Calculate PnL for COMMODITY based on DB stored lot size and USDINR
     */
    calculatePnL(symbol, type, entryPrice, cmp, qty) {
        const info = this.getLotInfo(symbol);
        // Fallback defaults if not in DB
        const lotSize = info ? info.lot_size : 1;
        let baseUsdInr = info ? info.usdinr_value : 95.1;

        // Try to get live USDINR rate from MarketDataService
        try {
            const marketDataService = require('./MarketDataService');
            if (marketDataService && marketDataService.prices) {
                const liveUsdInr = marketDataService.prices['FOREX:USD/INR'] || marketDataService.prices['FOREX:USDINR'];
                if (liveUsdInr) {
                    baseUsdInr = parseFloat(liveUsdInr.ltp || (liveUsdInr.ask ? liveUsdInr.ask / 0.9 : (liveUsdInr.bid ? liveUsdInr.bid / 1.1 : baseUsdInr)));
                }
            }
        } catch (e) {
            // Silently fall back to DB stored value
        }

        const cmpNum = parseFloat(cmp || 0);
        const entryNum = parseFloat(entryPrice || 0);
        const qtyNum = parseFloat(qty || 0);

        let pnlUsd = 0;
        if (type.toUpperCase() === 'BUY') {
            pnlUsd = (cmpNum - entryNum) * lotSize * qtyNum;
        } else {
            pnlUsd = (entryNum - cmpNum) * lotSize * qtyNum;
        }

        // Client rule:
        // Profit (pnlUsd > 0) -> use 10% lower USD/INR rate (baseUsdInr * 0.90)
        // Loss (pnlUsd <= 0) -> use 10% higher USD/INR rate (baseUsdInr * 1.10)
        let usdInrVal = baseUsdInr;
        if (pnlUsd > 0) {
            usdInrVal = baseUsdInr * 0.90;
        } else {
            usdInrVal = baseUsdInr * 1.10;
        }

        const pnlInr = pnlUsd * usdInrVal;
        return {
            pnlUsd,
            pnlInr,
            lotSize,
            usdInr: usdInrVal
        };
    }
}

module.exports = new CommodityLotService();
