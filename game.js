/**
 * MONETARY STATE - THE TOTAL GLOBAL ECONOMY BUILD V1.0.2
 * Features: Integrated Persistence (Save/Load), Top-Right Time Controller, 
 * Initial Loading Screen, and Territory Markers.
 * FIXED: Load save functionality
 */

let gameState = {
    playerCountry: null,
    selectedCountry: null,
    inGame: false,
    isPaused: false,
    territories: [],
    gameDate: new Date(2026, 0, 1),
    gameSpeed: 1,
    treasury: 0,
    gdp: 0,
    saveData: JSON.parse(localStorage.getItem('monetary_state_save')) || null,
    newsHeadlines: [],
    newsIndex: 0,
    diplomaticRelations: {},
    happiness: 100,
    warWith: [],
    viewingCountry: null,
    resourceCapacity: {},  // { "Natural Gas & Oil": 1_000_000, ... } tonnes per category
    resourceStock: {}      // { "Natural Gas & Oil": { "Oil": 420000, ... }, ... }
};

const MAX_TREASURY = 9_000_000_000;

const realWorldData = {
    "United States": 31821, "China": 20651, "Germany": 5328, "India": 4506,
    "Japan": 4464, "United Kingdom": 4226, "France": 3559, "Italy": 2702,
    "Russia": 2509, "Canada": 2421, "Brazil": 2293, "Spain": 2042,
    "Mexico": 2031, "Australia": 1948, "South Korea": 1937, "Turkey": 1580,
    "Indonesia": 1550, "Netherlands": 1410, "Saudi Arabia": 1320, "Poland": 1110,
    "Switzerland": 1070, "Taiwan": 971, "Belgium": 761, "Ireland": 750,
    "Sweden": 712, "Argentina": 668, "Israel": 666, "Singapore": 606,
    "Austria": 604, "United Arab Emirates": 601, "Thailand": 561, "Norway": 548,
    "Philippines": 533, "Bangladesh": 519, "Vietnam": 511, "Malaysia": 505,
    "Denmark": 500, "Colombia": 462, "Hong Kong": 447, "Romania": 445,
    "South Africa": 444, "Czechia": 417, "Pakistan": 411, "Egypt": 400,
    "Iran": 376, "Portugal": 365, "Chile": 363, "Finland": 336,
    "Nigeria": 334, "Peru": 327, "Kazakhstan": 320, "Greece": 305,
    "Algeria": 285, "New Zealand": 281, "Iraq": 274, "Hungary": 270,
    "Qatar": 239, "Ukraine": 224, "Cuba": 202, "Morocco": 196,
    "Slovakia": 168, "Kuwait": 163, "Uzbekistan": 159, "Bulgaria": 142,
    "Kenya": 141, "Dominican Republic": 138, "Ecuador": 135, "Guatemala": 130,
    "Puerto Rico": 129, "Ethiopia": 126, "Ghana": 113.49, "Croatia": 113.13,
    "Serbia": 112, "Ivory Coast": 111, "Angola": 110, "Costa Rica": 109.14,
    "Oman": 109, "Luxembourg": 108, "Lithuania": 105, "Sri Lanka": 99,
    "Panama": 96, "Tanzania": 95, "Uruguay": 91.64, "Belarus": 91,
    "DR Congo": 88, "Slovenia": 86, "Azerbaijan": 80.02, "Venezuela": 80,
    "Turkmenistan": 77, "Uganda": 72, "Cameroon": 68, "Myanmar": 65,
    "Tunisia": 60, "Jordan": 59, "Bolivia": 57, "Zimbabwe": 55.43,
    "Macao": 55, "Latvia": 52, "Paraguay": 51.67, "Cambodia": 51.51
};

let gdpRanking = [];
let lastTick = performance.now();
let dayAccumulator = 0;
let lastYear = gameState.gameDate.getFullYear();

function renderClock() {
    const el = document.getElementById("game-clock");
    if (!el) return;
    el.innerText = gameState.gameDate
        .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
        .toUpperCase();
}

function buildGdpRanking() {
    gdpRanking = [...gameState.territories]
        .filter(c => typeof c.gdp === "number")
        .sort((a, b) => b.gdp - a.gdp)
        .map((c, index) => ({ name: c.name.common, gdp: c.gdp, rank: index < 100 ? index + 1 : "100+" }));
}

function getCountryRank(countryName) {
    const entry = gdpRanking.find(c => c.name === countryName);
    if (!entry) return "100+";
    return entry.rank;
}

function restoreTerritoriesGDP(savedList) {
    if (!savedList) return;
    const map = new Map(savedList.map(t => [t.name, t.gdp]));
    gameState.territories.forEach(c => { if (map.has(c.name.common)) c.gdp = map.get(c.name.common); });
}

function getCountryGDP(country) {
    const name = country.name.common;
    if (realWorldData[name] !== undefined) return Math.floor(realWorldData[name] * 1000);
    return Math.floor((country.population / 1_000_000) * 5000);
}

function renderTreasury() {
    const el = document.getElementById('money-display');
    if (!el) return;
    if (gameState.treasury >= MAX_TREASURY) {
        el.innerText = "💰 TREASURY: MAX (≈9 QUADRILLION)";
    } else {
        el.innerText = `💰 TREASURY: ${formatMoney(gameState.treasury)}`;
    }
}

function assignRealGDP() {
    gameState.territories.forEach(c => {
        const name = c.name.common;
        if (realWorldData[name] !== undefined) {
            c.gdp = Math.floor(realWorldData[name] * 1000);
        } else {
            c.gdp = Math.floor((c.population / 1_000_000) * 5000);
        }
    });
}

function calculateStartingTreasury(gdp, rank) {
    let treasuryMultiplier;
    if (rank <= 5)        treasuryMultiplier = 0.40 + (6 - rank) * 0.02;
    else if (rank <= 10)  treasuryMultiplier = 0.30 + (11 - rank) * 0.01;
    else if (rank <= 20)  treasuryMultiplier = 0.25 + (21 - rank) * 0.005;
    else if (rank <= 50)  treasuryMultiplier = 0.15 + (51 - rank) * 0.003;
    else if (rank <= 100) treasuryMultiplier = 0.08 + (101 - rank) * 0.0014;
    else                  treasuryMultiplier = 0.05 + Math.random() * 0.03;
    return Math.floor(gdp * treasuryMultiplier);
}

function selectLocation(data) {
    if (data.name.common === "Antarctica") return;
    if (!gameState.territories.includes(data)) console.warn("Selected country not from territories array");

    gameState.selectedCountry = data;
    if (typeof data.gdp !== "number" || data.gdp <= 0) data.gdp = getCountryGDP(data);
    gameState.gdp = data.gdp;

    buildGdpRanking();
    const rank = getCountryRank(data.name.common);
    const numericRank = typeof rank === 'number' ? rank : 100;
    gameState.treasury = calculateStartingTreasury(gameState.gdp, numericRank);
    renderTreasury();

    document.getElementById('country-name-small').innerText = data.name.common.toUpperCase();
    document.getElementById('country-flag').src = `https://flagcdn.com/w160/${data.cca2.toLowerCase()}.png`;
    document.getElementById('rank-display').innerText = `🏆 GDP RANK: #${rank}`;
    document.getElementById('pop-display').innerText = `👥 Pop: ${data.population.toLocaleString()}`;

    const coords = projection([data.latlng[1], data.latlng[0]]);
    svg.transition().duration(1000).call(
        zoom.transform,
        d3.zoomIdentity.translate(window.innerWidth / 2, window.innerHeight / 2).scale(6).translate(-coords[0], -coords[1])
    );
}

function addToTreasury(amount) {
    gameState.treasury = Math.min(gameState.treasury + amount, MAX_TREASURY);
}

function formatMoney(value) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)} Trillion`;
    if (value >= 1_000)     return `$${(value / 1_000).toFixed(2)} Billion`;
    return `$${value.toFixed(2)} Million`;
}

function formatTonnes(t) {
    if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(2)}M t`;
    if (t >= 1_000)     return `${(t / 1_000).toFixed(1)}K t`;
    return `${Math.floor(t).toLocaleString()} t`;
}

// ============================================================
// RESOURCE STORAGE & PRICING
// ============================================================
const RESOURCE_CATEGORIES_TRADABLE = ["Natural Gas & Oil", "Minerals & Ores", "Non-metal", "Agriculture"];
const DEFAULT_CAPACITY = 1_000_000; // 1 million tonnes per category

// Price in $M per tonne (game money units)
const RESOURCE_PRICE_PER_TONNE = {
    // Natural Gas & Oil
    "Natural Gas": 0.00040, "Oil": 0.00060, "Coal": 0.00008,
    // Minerals & Ores
    "Lithium": 0.03000, "Cobalt": 0.05000, "Nickel": 0.01400,
    "Graphite": 0.00100, "Rare-earth": 0.10000, "Iron": 0.00010,
    "Copper": 0.00900, "Aluminum": 0.00200, "Manganese": 0.00030,
    "Quartz": 0.00005, "Potash": 0.00030, "Phosphorus": 0.00040,
    "Sulfur": 0.00008, "Gold": 60.0, "Silver": 0.80,
    "Platinum": 30.0, "Silicon": 0.00200, "Tantalum": 0.15000,
    "Tellurium": 0.06000, "Diamond": 500.0, "Uranium": 0.12000,
    // Non-metal
    "Sand": 0.000010, "Gravel": 0.000010, "Limestone": 0.000015,
    "Clay": 0.000020, "Gypsum": 0.000030, "Marble": 0.000500,
    "Granite": 0.000300, "Salt": 0.000040, "Carbon": 0.002000,
    // Agriculture
    "Water": 0.000001, "Vegetation": 0.000200, "Meat": 0.004000
};

function initResourceStorage() {
    for (const category of RESOURCE_CATEGORIES_TRADABLE) {
        if (!gameState.resourceCapacity[category]) {
            gameState.resourceCapacity[category] = DEFAULT_CAPACITY;
        }
        if (!gameState.resourceStock[category]) {
            gameState.resourceStock[category] = {};
        }
        economyState.resources[category].forEach(item => {
            if (gameState.resourceStock[category][item] === undefined) {
                const pct = (economyState.values[category]?.[item]?.percent ?? 0) / 100;
                gameState.resourceStock[category][item] = Math.max(0, Math.floor(pct * gameState.resourceCapacity[category]));
            } else {
                // Ensure existing stock is non-negative
                gameState.resourceStock[category][item] = Math.max(0, gameState.resourceStock[category][item]);
            }
        });
    }
}

function getCategoryUsed(category) {
    const stock = gameState.resourceStock[category];
    if (!stock) return 0;
    return Object.values(stock).reduce((s, v) => s + Math.max(0, v), 0); // Ensure each value is non-negative
}

// Validate and clean resource data to prevent negatives
function validateResourceData() {
    for (const category of RESOURCE_CATEGORIES_TRADABLE) {
        // Ensure capacity is positive
        if (!gameState.resourceCapacity[category] || gameState.resourceCapacity[category] < 0) {
            gameState.resourceCapacity[category] = DEFAULT_CAPACITY;
        }
        
        // Ensure all stock values are non-negative
        if (gameState.resourceStock[category]) {
            for (const item in gameState.resourceStock[category]) {
                if (gameState.resourceStock[category][item] < 0) {
                    console.warn(`Fixed negative stock for ${category}/${item}: ${gameState.resourceStock[category][item]} → 0`);
                    gameState.resourceStock[category][item] = 0;
                }
            }
        }
        
        // Ensure all percent values are non-negative
        if (economyState.values[category]) {
            for (const item in economyState.values[category]) {
                if (economyState.values[category][item].percent < 0) {
                    console.warn(`Fixed negative percent for ${category}/${item}: ${economyState.values[category][item].percent}% → 0%`);
                    economyState.values[category][item].percent = 0;
                }
            }
        }
    }
}

// Sync % display from actual stock numbers
function syncResourcePercents(category) {
    const total = getCategoryUsed(category);
    if (total <= 0) {
        // All zero – set all to 0
        economyState.resources[category].forEach(item => {
            if (economyState.values[category]?.[item]) {
                economyState.values[category][item].change = -economyState.values[category][item].percent;
                economyState.values[category][item].percent = 0;
            }
        });
        return;
    }
    
    // Calculate new percentages
    economyState.resources[category].forEach(item => {
        if (economyState.values[category]?.[item]) {
            const stock = gameState.resourceStock[category][item] || 0;
            const newPct = Math.max(0, Math.round((stock / total) * 100)); // Ensure non-negative
            const oldPct = economyState.values[category][item].percent;
            economyState.values[category][item].change = newPct - oldPct;
            economyState.values[category][item].percent = newPct;
        }
    });
    
    // Fix rounding drift - distribute the difference
    const items = economyState.resources[category];
    const sum = items.reduce((s, item) => s + (economyState.values[category]?.[item]?.percent ?? 0), 0);
    
    if (sum !== 100) {
        const diff = 100 - sum;
        // Find the item with the highest stock to adjust
        let maxItem = items[0];
        let maxStock = gameState.resourceStock[category][maxItem] || 0;
        
        items.forEach(item => {
            const stock = gameState.resourceStock[category][item] || 0;
            if (stock > maxStock) {
                maxStock = stock;
                maxItem = item;
            }
        });
        
        if (economyState.values[category]?.[maxItem]) {
            const oldPct = economyState.values[category][maxItem].percent;
            const newPct = Math.max(0, oldPct + diff); // Ensure non-negative
            economyState.values[category][maxItem].percent = newPct;
        }
    }
}
function tick() {
    try {
        const now = performance.now();
        const delta = now - lastTick;
        lastTick = now;

        if (delta > 5000) console.warn("Large time gap detected:", delta, "ms");
        if (!gameState.inGame || gameState.isPaused) return;

        dayAccumulator += (delta / 1000) * gameState.gameSpeed;

        while (dayAccumulator >= 1) {
            gameState.gameDate.setDate(gameState.gameDate.getDate() + 1);
            dayAccumulator--;

            const clockEl = document.getElementById("game-clock");
            if (clockEl) {
                clockEl.innerText = gameState.gameDate
                    .toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                    .toUpperCase();
            }

            const currentYear = gameState.gameDate.getFullYear();

            if (currentYear !== lastYear) {
                lastYear = currentYear;

                const growth = Math.floor(gameState.gdp * 0.03);
                gameState.gdp += growth;
                if (gameState.selectedCountry) gameState.selectedCountry.gdp = gameState.gdp;

                gameState.territories.forEach(c => {
                    if (c !== gameState.selectedCountry && typeof c.gdp === "number")
                        c.gdp += Math.floor(c.gdp * 0.015);
                });

                const gdpIncome = Math.floor(gameState.gdp * 0.02);
                addToTreasury(gdpIncome);

                updateHappiness();
                if (gameState.happiness <= 0) { triggerGameOver(); return; }

                buildGdpRanking();
                updateHud();
                renderTreasury();
                renderEconomyUI();

                if (gameState.inGame && gameState.selectedCountry) {
                    const growthPercent = ((growth / (gameState.gdp - growth)) * 100).toFixed(1);
                    gameState.newsHeadlines.push(`📊 ${gameState.selectedCountry.name.common} GDP grows ${growthPercent}% — Annual income: ${formatMoney(gdpIncome)}`);
                    if (gameState.newsHeadlines.length > 20) gameState.newsHeadlines.shift();
                }
            }
        }
    } catch (error) {
        console.error("ERROR in tick:", error);
        gameState.isPaused = true;
        alert("A game error occurred and the game has been paused. Check the console (F12) for details.");
    }
}

function gameLoop() { tick(); requestAnimationFrame(gameLoop); }

// Watchdog – auto-fix stuck time
let lastDateCheck = new Date();
let lastDateValue = null;
setInterval(() => {
    if (gameState.inGame && !gameState.isPaused) {
        const cur = gameState.gameDate.toISOString();
        if (cur === lastDateValue) {
            if (Date.now() - lastDateCheck.getTime() > 10000) {
                console.error("TIME STUCK DETECTED – resetting time tracking");
                lastTick = performance.now();
                dayAccumulator = 0;
            }
        } else {
            lastDateValue = cur;
            lastDateCheck = new Date();
        }
    }
}, 5000);

gameLoop();

// ============================================================
// DOM READY
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    const saveWindow = document.getElementById("save-window");
    if (gameState.saveData && saveWindow) {
        saveWindow.style.display = "block";
        document.getElementById("save-country").textContent = gameState.saveData.countryName;
        if (gameState.saveData.lastSaved) {
            document.getElementById("save-date").textContent =
                new Date(gameState.saveData.lastSaved).toLocaleString("en-US", {
                    month: "short", day: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
                });
        }
        const loadBtn = document.getElementById("load-save-btn");
        if (loadBtn) {
            loadBtn.onclick = null;
            loadBtn.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation();
                saveWindow.style.display = "none";
                startSimulation(true);
            });
        }
    }
});

// ============================================================
// ECONOMY STATE
// ============================================================
const economyState = {
    inflation: 2,
    unemployment: 3,
    resources: {
        "Natural Gas & Oil": ["Natural Gas", "Oil", "Coal"],
        "Minerals & Ores": [
            "Lithium", "Cobalt", "Nickel", "Graphite", "Rare-earth",
            "Iron", "Copper", "Aluminum", "Manganese", "Quartz",
            "Potash", "Phosphorus", "Sulfur", "Gold", "Silver",
            "Platinum", "Silicon", "Tantalum", "Tellurium", "Diamond", "Uranium"
        ],
        "Non-metal": ["Sand", "Gravel", "Limestone", "Clay", "Gypsum", "Marble", "Granite", "Salt", "Carbon"],
        "Agriculture": ["Water", "Vegetation", "Meat"],
        "Labor": ["Male (Adult)", "Female (Adult)", "Children"],
        "Supply": ["Electricity", "Water", "Waste"]
    },
    values: {}
};

// ============================================================
// ECONOMY FUNCTIONS
// ============================================================
function initEconomy() {
    for (const category in economyState.resources) {
        const items = economyState.resources[category];
        economyState.values[category] = {};

        if (category === "Supply") {
            items.forEach(item => {
                if (item === "Electricity" || item === "Water") {
                    economyState.values[category][item] = { percent: 100, change: 0 };
                } else {
                    // Waste: random 1-100%
                    economyState.values[category][item] = { percent: Math.floor(Math.random() * 100) + 1, change: 0 };
                }
            });
            continue;
        }

        // Randomize and normalize to 100% for all other categories
        const randomValues = items.map(() => Math.random() * 100);
        const total = randomValues.reduce((a, b) => a + b, 0);
        items.forEach((item, i) => {
            economyState.values[category][item] = {
                percent: Math.round((randomValues[i] / total) * 100),
                change: 0
            };
        });

        // Fix rounding to ensure exactly 100%
        let currentTotal = items.reduce((s, item) => s + economyState.values[category][item].percent, 0);
        if (currentTotal !== 100) economyState.values[category][items[0]].percent += (100 - currentTotal);
    }
}

// Only called by trade actions – resources never drift on their own
function updateEconomy() { renderEconomyUI(); }

function applyResourceChange(category, item, delta) {
    if (!economyState.values[category]?.[item]) return;
    const data = economyState.values[category][item];
    const oldPercent = data.percent;
    data.percent = Math.max(0, Math.min(100, data.percent + delta));
    data.change = data.percent - oldPercent;

    if (category !== "Supply") {
        const items = Object.keys(economyState.values[category]);
        const others = items.filter(i => i !== item);
        const otherTotal = others.reduce((s, i) => s + economyState.values[category][i].percent, 0);
        const newOtherTotal = 100 - data.percent;
        if (otherTotal > 0) {
            others.forEach(i => {
                const od = economyState.values[category][i];
                const old = od.percent;
                od.percent = Math.max(1, Math.round((od.percent / otherTotal) * newOtherTotal));
                od.change = od.percent - old;
            });
            let t = data.percent + others.reduce((s, i) => s + economyState.values[category][i].percent, 0);
            if (t !== 100) {
                economyState.values[category][others[others.length - 1]].percent += (100 - t);
            }
        }
    }
    renderEconomyUI();
}

function renderEconomyUI() {
    try {
        const container = document.getElementById("scroll-engine");
        if (!container) return;

        container.querySelectorAll('.category-section, .cat-head').forEach(el => el.remove());

        const resourcesHeader = document.createElement("h3");
        resourcesHeader.className = "cat-head";
        resourcesHeader.innerText = "RESOURCES:";
        const closeBtn = container.querySelector('.big-neon-btn');
        closeBtn ? container.insertBefore(resourcesHeader, closeBtn) : container.appendChild(resourcesHeader);

        for (const category in economyState.values) {
            const section = document.createElement("div");
            section.className = "category-section";

            const title = document.createElement("h3");
            title.className = "cat-head";
            title.innerText = category.toUpperCase();

            const list = document.createElement("ul");
            list.className = "res-list";

            for (const item in economyState.values[category]) {
                const data = economyState.values[category][item];
                
                // Ensure percent is never negative (safety check)
                const displayPercent = Math.max(0, data.percent || 0);
                const displayChange = data.change || 0;
                
                let color = "#aaa";
                if (item === "Waste") {
                    if (displayChange > 0) color = "#ff4444";
                    if (displayChange < 0) color = "#00ff41";
                } else {
                    if (displayChange > 0) color = "#00ff41";
                    if (displayChange < 0) color = "#ff4444";
                }
                const li = document.createElement("li");
                li.innerHTML = `${item}: ${displayPercent}% <span style="color:${color}">(${displayChange > 0 ? "+" : ""}${displayChange}%)</span>`;
                list.appendChild(li);
            }

            section.appendChild(title);
            section.appendChild(list);
            closeBtn ? container.insertBefore(section, closeBtn) : container.appendChild(section);
        }
    } catch (error) {
        console.error("Error in renderEconomyUI:", error);
    }
}

// ============================================================
// NEWS SYSTEM
// ============================================================
const newsTemplates = {
    economic: [
        "💹 {country} GDP grows {percent}% this quarter",
        "📊 {country} reports {trend} economic indicators",
        "💼 {country} unemployment rate {direction} to {percent}%",
        "🏦 Central Bank of {country} adjusts interest rates",
        "💰 {country} treasury reserves reach ${amount}B",
        "📈 {country} stock market hits {trend} levels",
        "🏭 Manufacturing sector in {country} shows {trend} growth",
        "💱 {country} currency {direction} against major indices",
        "📉 {country} inflation drops to {percent}%",
        "💵 {country} foreign investment surges {percent}%"
    ],
    trade: [
        "🌐 {country} signs major trade deal with {partner}",
        "📦 {country} exports surge by {percent}%",
        "🚢 {country} opens new trade routes",
        "🤝 {country} strengthens economic ties with {partner}",
        "⚖️ {country} renegotiates trade agreements",
        "🛫 {country}-{partner} trade volume hits record high",
        "🔄 {country} diversifies trade partnerships",
        "📊 {country} trade surplus reaches ${amount}B"
    ],
    resources: [
        "⛽ {resource} prices {direction} in {country}",
        "⚡ {country} boosts {resource} production by {percent}%",
        "💎 Major {resource} reserves discovered in {country}",
        "🏗️ {country} invests in {resource} infrastructure",
        "♻️ {country} focuses on sustainable {resource} management",
        "🌾 {country} becomes leading {resource} exporter",
        "⚒️ {country} mining sector expands {percent}%"
    ],
    global: [
        "🌍 Global markets react to {country} policy changes",
        "🗳️ {country} announces major economic reforms",
        "🏛️ {country} leaders meet for economic summit",
        "📢 {country} unveils {amount}B stimulus package",
        "🎯 {country} sets ambitious {year} growth targets",
        "🌏 {country} joins international economic alliance",
        "🔔 {country} hosts global finance conference"
    ],
    technology: [
        "🚀 {country} leads in tech innovation index",
        "💻 {country} invests ${amount}B in digital infrastructure",
        "🤖 AI sector booms in {country}",
        "📱 {country} becomes tech manufacturing hub",
        "🔬 {country} breakthrough in renewable technology",
        "⚙️ {country} launches national tech initiative"
    ],
    international: [
        "🌐 {country} and {partner} strengthen bilateral ties",
        "✈️ {country} tourism from {partner} increases {percent}%",
        "🎓 {country}-{partner} education exchange program expands",
        "🏥 {country} provides aid to {partner}",
        "🤝 {country} and {partner} collaborate on infrastructure",
        "📡 {country} partners with {partner} on technology",
        "🌍 {country} delegation visits {partner}",
        "💼 {country} businesses expand into {partner} market"
    ],
    markets: [
        "📈 {country} attracts ${amount}B in foreign investment",
        "🏢 Major corporations relocate to {country}",
        "💹 {country} bond market shows {trend} performance",
        "🎲 {country} financial sector reforms implemented",
        "💎 {country} luxury goods market grows {percent}%",
        "🏪 {country} retail sales surge by {percent}%"
    ]
};

function generateNews() {
    if (!gameState.selectedCountry || gameState.territories.length === 0) return "Loading global economic data...";

    const usePlayer = Math.random() < 0.6;
    let country = gameState.selectedCountry.name.common;

    if (!usePlayer) {
        const others = gameState.territories
            .filter(t => t.name.common !== "Antarctica" && t.name.common !== country && t.gdp > 100000)
            .sort((a, b) => b.gdp - a.gdp).slice(0, 50);
        if (others.length > 0) country = others[Math.floor(Math.random() * others.length)].name.common;
    }

    const categories = Object.keys(newsTemplates);
    const category = categories[Math.floor(Math.random() * categories.length)];
    const template = newsTemplates[category][Math.floor(Math.random() * newsTemplates[category].length)];

    const percent   = (Math.random() * 5 + 0.5).toFixed(1);
    const amount    = (Math.random() * 500 + 50).toFixed(0);
    const year      = gameState.gameDate.getFullYear();
    const trends    = ["strong", "positive", "stable", "robust", "promising"];
    const directions= ["rises", "increases", "improves", "strengthens"];
    const trend     = trends[Math.floor(Math.random() * trends.length)];
    const direction = directions[Math.floor(Math.random() * directions.length)];

    const partners  = gameState.territories
        .filter(t => t.name.common !== country && t.name.common !== "Antarctica" && t.gdp > 100000)
        .sort((a, b) => b.gdp - a.gdp).slice(0, 30);
    const partner   = partners[Math.floor(Math.random() * partners.length)]?.name.common || "Global Partners";

    // Exclude Labor category from resource news
    const resCats   = Object.keys(economyState.resources).filter(c => c !== "Labor");
    const resCat    = resCats[Math.floor(Math.random() * resCats.length)];
    const resource  = economyState.resources[resCat][Math.floor(Math.random() * economyState.resources[resCat].length)];

    return template
        .replace(/{country}/g, country).replace(/{percent}/g, percent)
        .replace(/{amount}/g, amount).replace(/{trend}/g, trend)
        .replace(/{direction}/g, direction).replace(/{partner}/g, partner)
        .replace(/{resource}/g, resource).replace(/{year}/g, year);
}

function initNewsSystem() {
    const newsWindow  = document.getElementById('news-window');
    const newsContent = document.getElementById('news-content');
    if (newsWindow && newsContent) {
        newsWindow.style.display = 'block';
        newsContent.textContent = "Economic systems initializing...";
        newsContent.style.animation = 'scrollNews 15s linear infinite';
    }
    gameState.newsHeadlines = [];
    for (let i = 0; i < 10; i++) gameState.newsHeadlines.push(generateNews());
    setTimeout(updateNewsTicker, 2000);
}

function updateNewsTicker() {
    const newsContent = document.getElementById('news-content');
    if (!newsContent || !gameState.inGame) return;
    if (!gameState.newsHeadlines.length) return;

    const headline = gameState.newsHeadlines[gameState.newsIndex];
    newsContent.style.animation = 'fadeOut 0.5s ease-out';
    setTimeout(() => {
        newsContent.textContent = headline;
        newsContent.style.animation = 'scrollNews 20s linear infinite';
    }, 500);

    gameState.newsIndex = (gameState.newsIndex + 1) % gameState.newsHeadlines.length;
    if (Math.random() < 0.3) {
        gameState.newsHeadlines.push(generateNews());
        if (gameState.newsHeadlines.length > 20) gameState.newsHeadlines.shift();
    }
}

setInterval(() => { if (gameState.inGame && !gameState.isPaused) updateNewsTicker(); }, 30000);

// ============================================================
// SIMULATION START
// ============================================================
const sortedList = Object.keys(realWorldData).sort((a, b) => realWorldData[b] - realWorldData[a]);
let g, projection, path, svg, zoom;

async function startSimulation(isLoad) {
    console.log("startSimulation:", isLoad);
    gameState.inGame = false;

    const overlay  = document.getElementById('loading-overlay');
    const barFill  = document.getElementById('loading-bar-fill');
    const menuScreen = document.getElementById('menu-screen');
    if (menuScreen) menuScreen.style.display = 'none';
    document.getElementById('viewport').style.display = 'block';
    if (overlay)  overlay.style.display = 'flex';
    if (barFill)  barFill.style.width = "10%";

    if (!svg) {
        svg = d3.select("#viewport").append("svg")
            .attr("width", window.innerWidth).attr("height", window.innerHeight);
        g = svg.append("g");
        zoom = d3.zoom().scaleExtent([1, 15]).on("zoom", e => g.attr("transform", e.transform));
        svg.call(zoom);
        projection = d3.geoMercator()
            .scale(window.innerWidth / 6.5)
            .translate([window.innerWidth / 2, window.innerHeight * 0.5]);
        path = d3.geoPath().projection(projection);

        if (barFill) barFill.style.width = "40%";

        const world = await d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson");
        const resp  = await fetch('https://restcountries.com/v3.1/all?fields=name,latlng,cca2,population');
        gameState.territories = await resp.json();

        if (!isLoad)                              assignRealGDP();
        else if (gameState.saveData?.territoriesGDP) restoreTerritoriesGDP(gameState.saveData.territoriesGDP);
        else                                      assignRealGDP();

        buildGdpRanking();
        if (barFill) barFill.style.width = "70%";

        // Land paths
        g.selectAll("path").data(world.features).enter().append("path")
            .attr("d", path)
            .attr("class", d => d.properties.name === "Antarctica" ? "land antarctica" : "land")
            .on("click", (e, d) => {
                if (d.properties.name === "Antarctica") { e.stopPropagation(); return; }
                const nameMap = { "USA": "United States", "United States of America": "United States" };
                const searchName = nameMap[d.properties.name] || d.properties.name;
                const c = gameState.territories.find(t => t.name.common === searchName || t.name.official === searchName);
                if (c) {
                    if (gameState.inGame) showCountryInfo(c);
                    else selectLocation(c);
                }
            });

        // Territory pins
        g.selectAll("circle")
            .data(gameState.territories.filter(d => d.latlng?.length === 2 && d.name.common !== "Antarctica"))
            .enter().append("circle")
            .attr("cx", d => projection([d.latlng[1], d.latlng[0]])[0])
            .attr("cy", d => projection([d.latlng[1], d.latlng[0]])[1])
            .attr("r", 3).attr("class", "territory-pin")
            .on("click", (e, d) => {
                e.stopPropagation(); e.preventDefault();
                if (d.name.common === "Antarctica") return;
                if (gameState.inGame) showCountryInfo(d);
                else selectLocation(d);
            });
    }

    setTimeout(() => {
        if (barFill) barFill.style.width = "100%";
        if (overlay) overlay.style.display = 'none';
        document.getElementById('viewport').style.display = 'block';
        lastTick = performance.now();
        dayAccumulator = 0;

        if (isLoad && gameState.saveData) {
            gameState.gameDate = new Date(gameState.saveData.date);
            lastYear = gameState.gameDate.getFullYear();
            initEconomy();
            renderEconomyUI();

            gameState.selectedCountry = gameState.territories.find(c => c.name.common === gameState.saveData.countryName);
            if (!gameState.selectedCountry) {
                alert("Could not find saved country. Starting new game.");
                randomizeJump();
                document.getElementById('tactical-hud').style.display = 'block';
                document.getElementById('main-action-btn').innerText = "ENTER STATE";
                document.getElementById('main-action-btn').style.display = 'block';
                return;
            }

            gameState.gdp      = gameState.saveData.gdp;
            gameState.treasury = gameState.saveData.treasury;
            gameState.selectedCountry.gdp = gameState.gdp;
            gameState.happiness = gameState.saveData.happiness ?? 100;
            gameState.warWith   = gameState.saveData.warWith   ?? [];
            gameState.resourceCapacity = gameState.saveData.resourceCapacity ?? {};
            gameState.resourceStock    = gameState.saveData.resourceStock    ?? {};
            initResourceStorage(); // fills in any missing entries
            validateResourceData(); // clean up any negative values
            validateResourceData(); // clean up any negative values

            buildGdpRanking();
            const rank = getCountryRank(gameState.selectedCountry.name.common);
            document.getElementById('country-name-small').innerText = gameState.selectedCountry.name.common.toUpperCase();
            document.getElementById('country-flag').src = `https://flagcdn.com/w160/${gameState.selectedCountry.cca2.toLowerCase()}.png`;
            document.getElementById('rank-display').innerText = `🏆 GDP RANK: #${rank}`;
            document.getElementById('pop-display').innerText  = `👥 Pop: ${gameState.selectedCountry.population.toLocaleString()}`;
            renderTreasury();
            renderHappiness();

            document.getElementById('tactical-hud').style.display = 'block';
            document.getElementById('temporal-engine').style.display = 'block';
            document.getElementById('left-wing-stack')?.classList.add('in-game');
            renderClock();
            initNewsSystem();

            const manageBtn = document.getElementById('main-action-btn');
            manageBtn.innerText = "MANAGE STATE";
            manageBtn.style.display = 'block';
            manageBtn.onclick = openManagement;

            document.getElementById('hud-actions').innerHTML =
                `<button class="big-neon-btn" style="border-color:#00ffff;color:#00ffff;" onclick="saveAndExit()">💾 SAVE & EXIT</button>`;

            gameState.inGame   = true;
            gameState.isPaused = false;
            lastTick = performance.now();
            dayAccumulator = 0;

        } else {
            gameState.gameDate = new Date(2026, 0, 1);
            lastYear = gameState.gameDate.getFullYear();
            initEconomy();
            renderEconomyUI();
            randomizeJump();
            document.getElementById('tactical-hud').style.display = 'block';
            const manageBtn = document.getElementById('main-action-btn');
            manageBtn.innerText = "ENTER STATE";
            manageBtn.style.display = 'block';
        }
    }, 600);
}

// ============================================================
// HANDLE ACTION (ENTER STATE / MANAGE STATE)
// ============================================================
window.handleAction = () => {
    if (!gameState.selectedCountry) { alert("No country selected!"); return; }

    if (!gameState.inGame) {
        document.getElementById('tactical-hud').style.display = 'none';
        document.getElementById('main-action-btn').style.display = 'none';
        document.getElementById('loading-overlay').style.display = 'flex';
        document.getElementById('loading-text').innerText = "SYNCHRONIZING ECONOMY...";

        setTimeout(() => {
            gameState.gdp = gameState.selectedCountry.gdp;
            const rank = getCountryRank(gameState.selectedCountry.name.common);
            gameState.treasury = calculateStartingTreasury(gameState.gdp, typeof rank === 'number' ? rank : 100);
            renderTreasury();

            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById('tactical-hud').style.display = 'block';
            document.getElementById('temporal-engine').style.display = 'block';
            document.getElementById('left-wing-stack')?.classList.add('in-game');
            renderClock();
            initNewsSystem();

            document.getElementById('hud-actions').innerHTML =
                `<button class="big-neon-btn" style="border-color:#00ffff;color:#00ffff;" onclick="saveAndExit()">💾 SAVE & EXIT</button>`;

            const manageBtn = document.getElementById('main-action-btn');
            manageBtn.innerText = "MANAGE STATE";
            manageBtn.style.display = 'block';
            manageBtn.onclick = openManagement;

            gameState.happiness = 100;
            gameState.warWith   = [];
            gameState.resourceCapacity = {};
            gameState.resourceStock    = {};
            initResourceStorage();
            validateResourceData();
            renderHappiness();

            gameState.inGame   = true;
            gameState.isPaused = false;
            lastTick = performance.now();
            dayAccumulator = 0;
        }, 1200);
    } else {
        openManagement();
    }
};

// ============================================================
// SAVE & EXIT
// ============================================================
window.saveAndExit = () => {
    const data = {
        countryName:       gameState.selectedCountry.name.common,
        date:              gameState.gameDate.toISOString(),
        lastSaved:         new Date().toISOString(),
        treasury:          gameState.treasury,
        gdp:               gameState.gdp,
        territoriesGDP:    gameState.territories.map(t => ({ name: t.name.common, gdp: t.gdp })),
        happiness:         gameState.happiness,
        warWith:           gameState.warWith || [],
        resourceCapacity:  gameState.resourceCapacity,
        resourceStock:     gameState.resourceStock
    };
    localStorage.setItem('monetary_state_save', JSON.stringify(data));
    location.reload();
};

window.randomizeJump = () => {
    const valid = gameState.territories.filter(t => t.name.common !== "Antarctica");
    const r = valid[Math.floor(Math.random() * valid.length)];
    if (r) selectLocation(r);
};

// ============================================================
// MANAGEMENT WINDOW
// ============================================================
window.openManagement = () => {
    if (!gameState.inGame || !gameState.selectedCountry) return;
    document.getElementById('manage-country').innerText = gameState.selectedCountry.name.common.toUpperCase();
    renderEconomyUI();
    document.getElementById('management-window').style.display = "flex";
    const actionWin = document.getElementById('action-window');
    if (actionWin) actionWin.style.display = "flex";
    const manageBtn = document.getElementById('main-action-btn');
    if (manageBtn) manageBtn.style.display = "none";
};

window.closeManage = () => {
    document.getElementById("management-window").style.display = "none";
    const actionWin = document.getElementById("action-window");
    if (actionWin) actionWin.style.display = "none";
    const manageBtn = document.getElementById('main-action-btn');
    if (manageBtn) { manageBtn.style.display = "block"; manageBtn.innerText = "MANAGE STATE"; }
};

window.closeActionWindow = () => {
    const actionWin = document.getElementById("action-window");
    if (actionWin) actionWin.style.display = "none";
    const manageBtn = document.getElementById('main-action-btn');
    if (manageBtn) { manageBtn.style.display = "block"; manageBtn.innerText = "MANAGE STATE"; }
};

// ============================================================
// DIPLOMACY
// ============================================================
function initDiplomaticRelations(countryName) {
    if (!gameState.diplomaticRelations[countryName]) {
        gameState.diplomaticRelations[countryName] = {
            relationScore: Math.floor(Math.random() * 41) - 20,
            tradeEstablished: false,
            tradeVolume: 0
        };
    }
    return gameState.diplomaticRelations[countryName];
}

function getRelationshipStatus(score) {
    if (score === -100) return "⚔️ WAR";
    if (score >= 50)    return "🤝 ALLY";
    if (score >= 25)    return "💚 CLOSE FRIEND";
    if (score >= 10)    return "😊 FRIEND";
    if (score >= -10)   return "😐 NEUTRAL";
    if (score >= -25)   return "🤨 UNCOOPERATIVE";
    if (score >= -50)   return "😠 TENSE";
    if (score >= -99)   return "💢 ENEMY";
    return "⚔️ WAR";
}

function getRelationshipColor(score) {
    if (score === -100) return "#ff0000";
    if (score >= 50)    return "#00ff41";
    if (score >= 25)    return "#00dd33";
    if (score >= 10)    return "#88ff88";
    if (score >= -10)   return "#aaaaaa";
    if (score >= -25)   return "#ffaa00";
    if (score >= -50)   return "#ff6600";
    if (score >= -99)   return "#ff3333";
    return "#ff0000";
}

window.showCountryInfo = (country) => {
    if (!gameState.inGame || !gameState.selectedCountry) return;
    if (country.name.common === gameState.selectedCountry.name.common) { openManagement(); return; }

    document.getElementById('tactical-hud').style.display = 'none';
    document.getElementById('country-info-panel').style.display = 'block';

    const relations = initDiplomaticRelations(country.name.common);
    buildGdpRanking();
    const rank = getCountryRank(country.name.common);

    document.getElementById('info-country-name').innerText = country.name.common.toUpperCase();
    document.getElementById('info-country-flag').src = `https://flagcdn.com/w160/${country.cca2.toLowerCase()}.png`;
    document.getElementById('info-rank').innerText = `#${rank}`;
    document.getElementById('info-gdp').innerText = formatMoney(country.gdp || 0);
    document.getElementById('info-population').innerText = country.population.toLocaleString();

    const statusText  = getRelationshipStatus(relations.relationScore);
    const statusColor = getRelationshipColor(relations.relationScore);
    document.getElementById('relation-status').innerHTML =
        `<span style="color:${statusColor};font-weight:bold;">${statusText} (${relations.relationScore})</span>`;
    document.getElementById('trade-volume').innerText =
        relations.tradeEstablished ? formatMoney(relations.tradeVolume) : "No Trade Agreement";

    gameState.viewingCountry = country;
};

window.returnToOwnCountry = () => {
    const infoPanel = document.getElementById('country-info-panel');
    if (infoPanel) infoPanel.style.display = 'none';
    const tacticalHud = document.getElementById('tactical-hud');
    if (tacticalHud) tacticalHud.style.display = 'block';
    gameState.viewingCountry = null;
};

window.closeCountryInfo = () => returnToOwnCountry();

window.improveRelations = () => {
    if (!gameState.viewingCountry) return;
    const cost = 50000;
    if (gameState.treasury < cost) { alert("Insufficient funds! Need $50B to improve relations."); return; }

    const countryName = gameState.viewingCountry.name.common;
    const relations   = gameState.diplomaticRelations[countryName];
    if (relations.relationScore === -100) { alert("Cannot improve relations during wartime!"); return; }

    gameState.treasury -= cost;
    renderTreasury();

    const oldScore = relations.relationScore;
    relations.relationScore = Math.min(100, relations.relationScore + 10);

    if (oldScore === -100) {
        gameState.warWith = gameState.warWith.filter(c => c !== countryName);
        gameState.happiness = Math.min(100, gameState.happiness + 5);
        renderHappiness();
    }
    if (relations.relationScore >= 50) { gameState.happiness = Math.min(100, gameState.happiness + 2); renderHappiness(); }

    const statusText  = getRelationshipStatus(relations.relationScore);
    const statusColor = getRelationshipColor(relations.relationScore);
    document.getElementById('relation-status').innerHTML =
        `<span style="color:${statusColor};font-weight:bold;">${statusText} (${relations.relationScore})</span>`;
    gameState.newsHeadlines.push(`🤝 ${gameState.selectedCountry.name.common} improves diplomatic ties with ${countryName}`);
    alert(`Relations improved!\nNew status: ${statusText} (${relations.relationScore})`);
};

window.establishTrade = () => {
    if (!gameState.viewingCountry) return;
    const cost = 100000;
    if (gameState.treasury < cost) { alert("Insufficient funds! Need $100B."); return; }

    const countryName = gameState.viewingCountry.name.common;
    const relations   = gameState.diplomaticRelations[countryName];
    if (relations.tradeEstablished) { alert("Trade agreement already exists!"); return; }
    if (relations.relationScore < 10) { alert("Need at least Friend status (+10) to trade."); return; }

    gameState.treasury -= cost;
    renderTreasury();

    relations.tradeEstablished = true;
    relations.tradeVolume = Math.floor((gameState.gdp + (gameState.viewingCountry.gdp || 100000)) * 0.01);
    document.getElementById('trade-volume').innerText = formatMoney(relations.tradeVolume);
    gameState.newsHeadlines.push(`📦 ${gameState.selectedCountry.name.common} signs trade deal with ${countryName}`);
    alert(`Trade established! Annual volume: ${formatMoney(relations.tradeVolume)}`);
};

window.worsenRelations = () => {
    if (!gameState.viewingCountry) return;
    const countryName = gameState.viewingCountry.name.common;
    const relations   = gameState.diplomaticRelations[countryName];
    if (!confirm(`Worsen relations with ${countryName}? (-15 points)`)) return;

    relations.relationScore = Math.max(-100, relations.relationScore - 15);

    if (relations.tradeEstablished && relations.relationScore < 0) {
        relations.tradeEstablished = false;
        relations.tradeVolume = 0;
        document.getElementById('trade-volume').innerText = "No Trade Agreement";
        alert("Trade agreement cancelled due to poor relations!");
    }

    const statusText  = getRelationshipStatus(relations.relationScore);
    const statusColor = getRelationshipColor(relations.relationScore);
    document.getElementById('relation-status').innerHTML =
        `<span style="color:${statusColor};font-weight:bold;">${statusText} (${relations.relationScore})</span>`;

    if (relations.relationScore === -100) {
        if (!gameState.warWith) gameState.warWith = [];
        if (!gameState.warWith.includes(countryName)) gameState.warWith.push(countryName);
        gameState.happiness = Math.max(0, gameState.happiness - 15);
        renderHappiness();
        gameState.newsHeadlines.push(`⚔️ ${gameState.selectedCountry.name.common} declares WAR on ${countryName}!`);
        alert(`⚔️ WAR DECLARED with ${countryName}!\n\n⚠️ Citizen happiness -15%!`);
    } else {
        gameState.newsHeadlines.push(`💢 ${gameState.selectedCountry.name.common} tensions rise with ${countryName}`);
        alert(`Relations worsened!\nNew status: ${statusText} (${relations.relationScore})`);
    }
};

// ============================================================
// HUD / HAPPINESS
// ============================================================
function updateHud() {
    if (!gameState.selectedCountry) return;
    buildGdpRanking();
    const rank = getCountryRank(gameState.selectedCountry.name.common);
    const rankEl = document.getElementById('rank-display');
    if (rankEl) rankEl.innerText = `🏆 GDP RANK: #${rank}`;
    renderHappiness();
}

function renderHappiness() {
    const happiness = Math.max(0, Math.min(100, gameState.happiness));
    const gaugeEl = document.getElementById('happiness-gauge');
    if (gaugeEl) gaugeEl.style.display = 'block';

    const percentEl = document.getElementById('happiness-percent');
    const barEl     = document.getElementById('happiness-bar');
    if (percentEl) percentEl.innerText = `${happiness}%`;
    if (barEl) {
        barEl.style.width = `${happiness}%`;
        barEl.style.background =
            happiness <= 20 ? '#ff0000' :
            happiness <= 40 ? '#ff6600' :
            happiness <= 60 ? '#ffaa00' : '#00ff41';
    }

    const warningOverlay = document.getElementById('warning-overlay');
    const warningMessage = document.getElementById('warning-message');
    if (happiness <= 20 && happiness > 0) {
        warningOverlay?.classList.add('active');
        warningMessage?.classList.add('active');
    } else {
        warningOverlay?.classList.remove('active');
        warningMessage?.classList.remove('active');
    }
}

function updateHappiness() {
    let change = 0;
    const treasuryRatio = gameState.treasury / gameState.gdp;
    if (treasuryRatio < 0.1)  change -= 5;
    else if (treasuryRatio > 0.4) change += 2;
    if (gameState.warWith?.length > 0) change -= 10 * gameState.warWith.length;
    const r = Math.random();
    if (r < 0.1) change -= 3;
    else if (r < 0.2) change += 3;
    change -= 1; // base drift
    gameState.happiness = Math.max(0, Math.min(100, gameState.happiness + change));
}

function triggerGameOver() {
    gameState.isPaused = true;
    gameState.inGame   = false;
    const atWar = gameState.warWith?.length > 0;
    let message;
    if (atWar) {
        const enemy = gameState.warWith[Math.floor(Math.random() * gameState.warWith.length)];
        const msgs = [
            `YOUR COUNTRY HAS BEEN OCCUPIED BY ${enemy.toUpperCase()}!`,
            `A NUKE HAS EXPLODED IN YOUR TERRITORY!`,
            `YOU WERE CAUGHT AS A PRISONER OF WAR!`
        ];
        message = "YOU FAILED: " + msgs[Math.floor(Math.random() * msgs.length)];
    } else {
        const msgs = [
            "A RIOT HAS SUCCEEDED AND YOU GOT THROWN OUT!",
            "A COUP HAS SUCCEEDED IN TAKING OVER YOUR GOVERNMENT!",
            "YOU GOT ASSASSINATED BY THE HATERS!"
        ];
        message = "YOU FAILED: " + msgs[Math.floor(Math.random() * msgs.length)];
    }
    const screen = document.getElementById('game-over-screen');
    const msgEl  = document.getElementById('game-over-message');
    if (msgEl)  msgEl.innerText = message;
    if (screen) screen.classList.add('active');
    gameState.newsHeadlines.push(`💀 ${gameState.selectedCountry.name.common} government has fallen!`);
}

// ============================================================
// TIME CONTROLS
// ============================================================
function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    document.getElementById('pause-btn').innerText = gameState.isPaused ? "▶" : "⏸";
    if (!gameState.isPaused) { lastTick = performance.now(); dayAccumulator = 0; }
}

function adjustSpeed(delta) {
    const s = gameState.gameSpeed + delta;
    if (s >= 1 && s <= 5) {
        gameState.gameSpeed = s;
        document.querySelectorAll('.speed-bar').forEach((b, i) => b.classList.toggle('active', i < s));
    }
}

window.addEventListener("resize", () => {
    if (!projection || !svg) return;
    projection.scale(window.innerWidth / 6.5).translate([window.innerWidth / 2, window.innerHeight * 0.5]);
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
});

// ============================================================
// ACTION WINDOW BUTTONS
// ============================================================
window.manageMilitary  = () => alert("⚔️ MILITARY\n\nComing soon!");
window.createGroup     = () => alert("👥 CREATE GROUP\n\nComing soon!");
window.viewTaxGraph    = () => alert("📊 TAX GRAPH\n\nComing soon!");
window.manageSanctions = () => alert("🚫 SANCTIONS\n\nComing soon!");
window.buildService    = () => openBuildService();
window.openGovernment  = () => openGovernmentWindow();

// ============================================================
// GOVERNMENT WINDOW
// ============================================================
function openGovernmentWindow() {
    const existing = document.getElementById('government-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'government-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.95);
        z-index:12000; display:flex; flex-direction:column;
        font-family:'Courier New',monospace; color:#00ff41;`;

    // Calculate some stats
    const totalCapacity = RESOURCE_CATEGORIES_TRADABLE.reduce((sum, cat) => 
        sum + (gameState.resourceCapacity[cat] || DEFAULT_CAPACITY), 0);
    const totalUsed = RESOURCE_CATEGORIES_TRADABLE.reduce((sum, cat) => 
        sum + getCategoryUsed(cat), 0);
    const utilization = totalCapacity > 0 ? ((totalUsed / totalCapacity) * 100).toFixed(1) : 0;
    
    // Relations summary
    const allRelations = Object.keys(gameState.diplomaticRelations);
    const allies = allRelations.filter(c => gameState.diplomaticRelations[c].relationScore >= 50);
    const enemies = allRelations.filter(c => gameState.diplomaticRelations[c].relationScore <= -50);
    const atWar = gameState.warWith?.length || 0;

    overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;
        padding:18px 30px;border-bottom:3px solid #00dd99;flex-shrink:0;">
        <h2 style="margin:0;color:#00dd99;font-size:1.8em;letter-spacing:3px;">🏛️ GOVERNMENT</h2>
        <span style="color:#aaa;">${gameState.selectedCountry?.name.common.toUpperCase()}</span>
        <button onclick="closeGovernment()"
            style="background:#000;border:2px solid #ff4444;color:#ff4444;
                   padding:8px 20px;cursor:pointer;font-family:monospace;font-size:1em;letter-spacing:2px;">
            ✕ CLOSE
        </button>
    </div>
    <div style="overflow-y:auto;flex:1;padding:30px 40px;">
        
        <!-- Overview Section -->
        <div class="gov-section">
            <h3 class="gov-section-title">📊 NATIONAL OVERVIEW</h3>
            <div class="gov-info-grid">
                <div class="gov-info-item">
                    <span class="gov-label">💰 Treasury:</span>
                    <span class="gov-value">${formatMoney(gameState.treasury)}</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">📈 GDP:</span>
                    <span class="gov-value">${formatMoney(gameState.gdp)}</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">🏆 World Rank:</span>
                    <span class="gov-value">#${getCountryRank(gameState.selectedCountry?.name.common)}</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">👥 Population:</span>
                    <span class="gov-value">${gameState.selectedCountry?.population.toLocaleString()}</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">😊 Happiness:</span>
                    <span class="gov-value" style="color:${gameState.happiness >= 60 ? '#00ff41' : gameState.happiness >= 40 ? '#ffaa00' : '#ff4444'}">${gameState.happiness}%</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">📅 Date:</span>
                    <span class="gov-value">${gameState.gameDate.toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'})}</span>
                </div>
            </div>
        </div>

        <!-- Resource Storage Overview -->
        <div class="gov-section">
            <h3 class="gov-section-title">📦 RESOURCE STORAGE</h3>
            <div class="gov-info-grid">
                <div class="gov-info-item">
                    <span class="gov-label">Total Capacity:</span>
                    <span class="gov-value">${formatTonnes(totalCapacity)}</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">Total Used:</span>
                    <span class="gov-value">${formatTonnes(totalUsed)}</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">Utilization:</span>
                    <span class="gov-value" style="color:${utilization > 80 ? '#ff8844' : '#00ff41'}">${utilization}%</span>
                </div>
            </div>
            <div style="margin-top:15px;">
                ${RESOURCE_CATEGORIES_TRADABLE.map(cat => {
                    const cap = gameState.resourceCapacity[cat] || DEFAULT_CAPACITY;
                    const used = getCategoryUsed(cat);
                    const pct = ((used / cap) * 100).toFixed(1);
                    return `
                    <div style="margin-bottom:8px;">
                        <div style="display:flex;justify-content:space-between;font-size:0.9em;margin-bottom:3px;">
                            <span style="color:#aaa;">${cat}</span>
                            <span style="color:#666;">${formatTonnes(used)} / ${formatTonnes(cap)} (${pct}%)</span>
                        </div>
                        <div style="background:#001100;height:8px;border-radius:4px;overflow:hidden;">
                            <div style="background:#00ff41;height:100%;width:${pct}%;transition:width 0.3s;"></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <!-- Diplomatic Relations -->
        <div class="gov-section">
            <h3 class="gov-section-title">🌍 DIPLOMATIC RELATIONS</h3>
            <div class="gov-info-grid">
                <div class="gov-info-item">
                    <span class="gov-label">🤝 Allies:</span>
                    <span class="gov-value">${allies.length}</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">💢 Enemies:</span>
                    <span class="gov-value" style="color:${enemies.length > 0 ? '#ff8844' : '#00ff41'}">${enemies.length}</span>
                </div>
                <div class="gov-info-item">
                    <span class="gov-label">⚔️ Wars:</span>
                    <span class="gov-value" style="color:${atWar > 0 ? '#ff0000' : '#00ff41'}">${atWar}</span>
                </div>
            </div>
            ${atWar > 0 ? `
                <div style="margin-top:15px;padding:12px;background:#200000;border:1px solid #ff0000;border-radius:4px;">
                    <div style="color:#ff4444;font-weight:bold;margin-bottom:8px;">⚔️ ACTIVE CONFLICTS:</div>
                    ${gameState.warWith.map(c => `<div style="color:#ff8844;font-size:0.9em;">• ${c}</div>`).join('')}
                </div>
            ` : ''}
        </div>

        <!-- Quick Actions -->
        <div class="gov-section">
            <h3 class="gov-section-title">⚡ QUICK ACTIONS</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <button onclick="saveAndExit()" class="gov-action-btn" style="border-color:#00ddff;color:#00ddff;">
                    💾 SAVE & EXIT
                </button>
                <button onclick="closeGovernment();openTradeWindow('buy')" class="gov-action-btn" style="border-color:#00ddff;color:#00ddff;">
                    🛒 BUY RESOURCES
                </button>
                <button onclick="closeGovernment();openTradeWindow('sell')" class="gov-action-btn" style="border-color:#00ff41;color:#00ff41;">
                    💰 SELL RESOURCES
                </button>
                <button onclick="closeGovernment();openBuildService()" class="gov-action-btn" style="border-color:#ffaa00;color:#ffaa00;">
                    🏗️ BUILD SERVICE
                </button>
            </div>
        </div>

        <div style="margin-top:30px;padding:20px;background:#001100;border:1px solid #003300;border-radius:6px;text-align:center;">
            <p style="color:#666;font-size:0.9em;margin:0;">
                💡 More government features coming in <b style="color:#00ff41;">v1.2.0</b>: Tax policies, budget allocation, social programs, and more!
            </p>
        </div>
    </div>`;

    document.body.appendChild(overlay);
    injectGovernmentCSS();
}

function injectGovernmentCSS() {
    if (document.getElementById('gov-css')) return;
    const s = document.createElement('style');
    s.id = 'gov-css';
    s.textContent = `
    .gov-section {
        margin-bottom: 30px;
        padding: 20px;
        background: #000d00;
        border: 1px solid #003300;
        border-radius: 8px;
    }
    .gov-section-title {
        color: #00dd99;
        font-size: 1.3em;
        margin: 0 0 18px 0;
        padding-bottom: 10px;
        border-bottom: 2px solid #003300;
    }
    .gov-info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
    }
    .gov-info-item {
        display: flex;
        justify-content: space-between;
        padding: 10px 14px;
        background: #000000;
        border: 1px solid #002200;
        border-radius: 4px;
    }
    .gov-label {
        color: #888;
        font-size: 0.9em;
    }
    .gov-value {
        color: #00ff41;
        font-weight: bold;
        font-size: 1em;
    }
    .gov-action-btn {
        background: #000;
        border: 2px solid;
        padding: 12px 20px;
        cursor: pointer;
        font-family: monospace;
        font-size: 1em;
        font-weight: bold;
        letter-spacing: 1px;
        transition: all 0.2s;
    }
    .gov-action-btn:hover {
        filter: brightness(1.4);
        transform: translateY(-2px);
    }
    `;
    document.head.appendChild(s);
}

window.closeGovernment = () => {
    const el = document.getElementById('government-overlay');
    if (el) el.remove();
};

// ============================================================
// TRADE WINDOW (BUY & SELL)
// ============================================================
let currentTradeMode = 'buy';

function openTradeWindow(mode) {
    currentTradeMode = mode;
    const existing = document.getElementById('trade-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'trade-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.95);
        z-index:12000; display:flex; flex-direction:column;
        font-family:'Courier New',monospace; color:#00ff41;`;

    const isBuy    = mode === 'buy';
    const accent   = isBuy ? '#00ddff' : '#00ff41';
    const title    = isBuy ? '🛒 BUY RESOURCES' : '💰 SELL RESOURCES';
    const btnLabel = isBuy ? 'BUY' : 'SELL';

    let categoriesHTML = '';
    for (const category of RESOURCE_CATEGORIES_TRADABLE) {
        const capacity  = gameState.resourceCapacity[category] || DEFAULT_CAPACITY;
        const used      = getCategoryUsed(category);
        const freeSpace = capacity - used;

        let rowsHTML = '';
        economyState.resources[category].forEach(item => {
            const price = RESOURCE_PRICE_PER_TONNE[item] ?? 0;
            if (price === 0) return;

            const stock   = gameState.resourceStock[category]?.[item] ?? 0;
            const pct     = economyState.values[category]?.[item]?.percent ?? 0;
            const maxQty  = isBuy
                ? Math.min(freeSpace, price > 0 ? Math.floor(gameState.treasury / price) : 0)
                : stock;
            const safeId  = `${category}||${item}`.replace(/\s/g,'_').replace(/&/g,'AND');
            const pricePer1k = (price * 1000).toFixed(price >= 0.1 ? 2 : price >= 0.001 ? 4 : 6);

            rowsHTML += `
            <div class="trade-row" id="row-${safeId}">
                <div class="trade-row-left">
                    <span class="trade-item-name">${item}</span>
                    <span class="trade-item-meta">
                        ${isBuy
                            ? `Free: <b>${formatTonnes(freeSpace)}</b>`
                            : `Stock: <b>${formatTonnes(stock)}</b>`}
                        &nbsp;|&nbsp; $${pricePer1k}M / 1K t
                    </span>
                </div>
                <div class="trade-row-right">
                    <input type="number" id="qty-${safeId}" min="0" max="${maxQty}" step="1000"
                        value="0" oninput="updateTradeCost('${safeId}','${mode}')"
                        style="width:130px;background:#000;border:1px solid ${accent};
                               color:${accent};padding:5px 8px;font-family:monospace;font-size:1em;">
                    <span id="cost-${safeId}" class="trade-cost-label">$0</span>
                    <button onclick="executeTrade('${category}','${item}','${mode}','${safeId}')"
                        class="trade-exec-btn" style="border-color:${accent};color:${accent};">
                        ${btnLabel}
                    </button>
                </div>
            </div>`;
        });

        if (!rowsHTML) continue;

        categoriesHTML += `
        <div class="trade-cat-block">
            <div class="trade-cat-header">
                <span>${category.toUpperCase()}</span>
                <span class="trade-cat-cap">
                    📦 ${formatTonnes(used)} / ${formatTonnes(capacity)} used
                    &nbsp;|&nbsp; Free: ${formatTonnes(Math.max(0, freeSpace))}
                </span>
            </div>
            ${rowsHTML}
        </div>`;
    }

    overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;
        padding:18px 30px;border-bottom:3px solid ${accent};flex-shrink:0;">
        <h2 style="margin:0;color:${accent};font-size:1.8em;letter-spacing:3px;">${title}</h2>
        <span style="color:#aaa;font-size:1em;">💰 Treasury: ${formatMoney(gameState.treasury)}</span>
        <button onclick="closeTrade()"
            style="background:#000;border:2px solid #ff4444;color:#ff4444;
                   padding:8px 20px;cursor:pointer;font-family:monospace;font-size:1em;letter-spacing:2px;">
            ✕ CLOSE
        </button>
    </div>
    <div id="trade-body" style="overflow-y:auto;flex:1;padding:20px 30px;">
        ${categoriesHTML}
    </div>`;

    document.body.appendChild(overlay);
    injectTradeCSS();
}

function injectTradeCSS() {
    if (document.getElementById('trade-css')) return;
    const s = document.createElement('style');
    s.id = 'trade-css';
    s.textContent = `
    .trade-cat-block {
        margin-bottom: 28px;
        border: 1px solid #003300;
        border-radius: 6px;
        overflow: hidden;
    }
    .trade-cat-header {
        background: #001a00;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        font-size: 1em;
        font-weight: bold;
        color: #00ff41;
        border-bottom: 1px solid #003300;
    }
    .trade-cat-cap { color: #aaa; font-size: 0.9em; font-weight: normal; }
    .trade-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        border-bottom: 1px solid #001500;
    }
    .trade-row:last-child { border-bottom: none; }
    .trade-row:hover { background: #000d00; }
    .trade-row-left { display: flex; flex-direction: column; gap: 3px; }
    .trade-item-name { color: #00ff41; font-size: 1.05em; font-weight: bold; }
    .trade-item-meta { color: #666; font-size: 0.85em; }
    .trade-row-right { display: flex; align-items: center; gap: 10px; }
    .trade-cost-label {
        min-width: 120px;
        color: #aaa;
        font-size: 0.9em;
        text-align: right;
    }
    .trade-exec-btn {
        background: #000;
        border: 2px solid;
        padding: 6px 16px;
        cursor: pointer;
        font-family: monospace;
        font-size: 0.95em;
        font-weight: bold;
        letter-spacing: 2px;
        transition: all 0.2s;
    }
    .trade-exec-btn:hover { filter: brightness(1.4); }
    `;
    document.head.appendChild(s);
}

window.updateTradeCost = (safeId, mode) => {
    const input  = document.getElementById(`qty-${safeId}`);
    const costEl = document.getElementById(`cost-${safeId}`);
    if (!input || !costEl) return;

    const parts  = safeId.replace(/_/g,' ').split('||');
    const item   = parts.slice(1).join('||').replace(/AND/g,'&');
    const tonnes = parseFloat(input.value) || 0;
    const price  = RESOURCE_PRICE_PER_TONNE[item] ?? 0;
    const total  = tonnes * price;
    const isBuy  = mode === 'buy';

    if (total > 0) {
        costEl.innerText  = (isBuy ? '−' : '+') + formatMoney(total);
        costEl.style.color = isBuy ? '#ff8844' : '#00ff41';
    } else {
        costEl.innerText  = '$0';
        costEl.style.color = '#aaa';
    }
};

window.executeTrade = (category, item, mode, safeId) => {
    const input  = document.getElementById(`qty-${safeId}`);
    if (!input) return;
    const tonnes = Math.floor(parseFloat(input.value) || 0);
    if (tonnes <= 0) { alert("Enter a valid amount of tonnes first!"); return; }

    const price   = RESOURCE_PRICE_PER_TONNE[item] ?? 0;
    const cost    = tonnes * price;
    const isBuy   = mode === 'buy';

    if (isBuy) {
        if (gameState.treasury < cost) {
            alert(`❌ Not enough funds!\nNeed: ${formatMoney(cost)}\nYou have: ${formatMoney(gameState.treasury)}`);
            return;
        }
        const capacity  = gameState.resourceCapacity[category] || DEFAULT_CAPACITY;
        const used      = getCategoryUsed(category);
        const free      = capacity - used;
        if (tonnes > free) {
            alert(`❌ Not enough storage!\nFree space: ${formatTonnes(free)}\nYou tried to buy: ${formatTonnes(tonnes)}`);
            return;
        }
        gameState.treasury -= cost;
        gameState.resourceStock[category][item] = (gameState.resourceStock[category][item] || 0) + tonnes;
        syncResourcePercents(category);
        renderTreasury();
        renderEconomyUI();
        gameState.newsHeadlines.push(`🛒 ${gameState.selectedCountry.name.common} bought ${formatTonnes(tonnes)} of ${item} for ${formatMoney(cost)}`);
        alert(`✅ Purchased ${formatTonnes(tonnes)} of ${item}\nCost: ${formatMoney(cost)}`);

    } else {
        const stock = gameState.resourceStock[category]?.[item] ?? 0;
        if (tonnes > stock) {
            alert(`❌ You only have ${formatTonnes(stock)} of ${item} in storage!`);
            return;
        }
        gameState.treasury = Math.min(gameState.treasury + cost, MAX_TREASURY);
        gameState.resourceStock[category][item] -= tonnes;
        syncResourcePercents(category);
        renderTreasury();
        renderEconomyUI();
        gameState.newsHeadlines.push(`💰 ${gameState.selectedCountry.name.common} sold ${formatTonnes(tonnes)} of ${item} for ${formatMoney(cost)}`);
        alert(`✅ Sold ${formatTonnes(tonnes)} of ${item}\nRevenue: ${formatMoney(cost)}`);
    }

    // Refresh the window so all values update
    closeTrade();
    openTradeWindow(mode);
};

window.closeTrade = () => {
    const el = document.getElementById('trade-overlay');
    if (el) el.remove();
};

window.sellResources = () => openTradeWindow('sell');
window.buyResources  = () => openTradeWindow('buy');

// ============================================================
// BUILD SERVICE (stub + capacity upgrades)
// ============================================================
function openBuildService() {
    const existing = document.getElementById('build-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'build-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.95);
        z-index:12000; display:flex; flex-direction:column;
        font-family:'Courier New',monospace; color:#00ff41;`;

    let upgradesHTML = '';
    for (const category of RESOURCE_CATEGORIES_TRADABLE) {
        const cap      = gameState.resourceCapacity[category] || DEFAULT_CAPACITY;
        const level    = Math.round(cap / DEFAULT_CAPACITY); // 1 = base, 2 = 2M, etc.
        const upgCost  = level * 500_000; // $500B * level
        upgradesHTML += `
        <div class="build-row">
            <div class="build-info">
                <span class="build-cat">${category}</span>
                <span class="build-meta">
                    Current capacity: <b>${formatTonnes(cap)}</b>
                    &nbsp;|&nbsp; Level ${level}
                    &nbsp;→&nbsp; Upgrade to <b>${formatTonnes(cap + DEFAULT_CAPACITY)}</b>
                </span>
            </div>
            <div class="build-action">
                <span style="color:#ffaa00;margin-right:12px;">Cost: ${formatMoney(upgCost)}</span>
                <button onclick="upgradeCapacity('${category}')"
                    style="background:#000;border:2px solid #ffaa00;color:#ffaa00;
                           padding:7px 18px;cursor:pointer;font-family:monospace;
                           font-size:0.95em;font-weight:bold;letter-spacing:2px;">
                    UPGRADE
                </button>
            </div>
        </div>`;
    }

    overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;
        padding:18px 30px;border-bottom:3px solid #ffaa00;flex-shrink:0;">
        <h2 style="margin:0;color:#ffaa00;font-size:1.8em;letter-spacing:3px;">🏗️ BUILD SERVICE</h2>
        <span style="color:#aaa;">💰 Treasury: ${formatMoney(gameState.treasury)}</span>
        <button onclick="closeBuildService()"
            style="background:#000;border:2px solid #ff4444;color:#ff4444;
                   padding:8px 20px;cursor:pointer;font-family:monospace;font-size:1em;letter-spacing:2px;">
            ✕ CLOSE
        </button>
    </div>
    <div style="overflow-y:auto;flex:1;padding:20px 30px;">
        <p style="color:#aaa;margin-bottom:24px;font-size:0.95em;">
            Upgrade your resource storage capacity. Each upgrade adds <b style="color:#ffaa00">+1 Million tonnes</b>
            to that category. Upgrades allow you to hold more stock for trading.
        </p>
        <div id="build-upgrades">${upgradesHTML}</div>
        <hr style="border-color:#003300;margin:30px 0;">
        <p style="color:#555;text-align:center;">More construction options coming in future updates...</p>
    </div>`;

    document.body.appendChild(overlay);

    const s = document.createElement('style');
    s.id = 'build-css';
    s.textContent = `
    .build-row {
        display:flex; justify-content:space-between; align-items:center;
        padding:14px 18px; border:1px solid #002800; border-radius:6px;
        margin-bottom:12px; background:#000d00;
    }
    .build-row:hover { background:#001500; }
    .build-info { display:flex; flex-direction:column; gap:4px; }
    .build-cat  { color:#ffaa00; font-size:1.05em; font-weight:bold; }
    .build-meta { color:#888; font-size:0.88em; }
    .build-action { display:flex; align-items:center; }
    `;
    if (!document.getElementById('build-css')) document.head.appendChild(s);
}

window.upgradeCapacity = (category) => {
    const cap     = gameState.resourceCapacity[category] || DEFAULT_CAPACITY;
    const level   = Math.round(cap / DEFAULT_CAPACITY);
    const cost    = level * 500_000;

    if (gameState.treasury < cost) {
        alert(`❌ Not enough funds!\nNeed: ${formatMoney(cost)}\nYou have: ${formatMoney(gameState.treasury)}`);
        return;
    }
    if (!confirm(`Upgrade ${category} storage?\n+1M tonnes for ${formatMoney(cost)}`)) return;

    gameState.treasury -= cost;
    gameState.resourceCapacity[category] = cap + DEFAULT_CAPACITY;
    renderTreasury();
    gameState.newsHeadlines.push(`🏗️ ${gameState.selectedCountry.name.common} expanded ${category} storage to ${formatTonnes(gameState.resourceCapacity[category])}`);
    alert(`✅ Upgraded!\n${category} capacity is now ${formatTonnes(gameState.resourceCapacity[category])}`);

    // Refresh build window
    closeBuildService();
    openBuildService();
};

window.closeBuildService = () => {
    const el = document.getElementById('build-overlay');
    if (el) el.remove();
};

window.giveUp = () => {
    if (!confirm("Are you sure you want to give up?\n\nYou will resign from being president and the game will end.")) return;
    gameState.isPaused = true;
    gameState.inGame   = false;
    const screen = document.getElementById('game-over-screen');
    const msgEl  = document.getElementById('game-over-message');
    if (msgEl)  msgEl.innerText = "YOU GAVE UP: YOU RESIGNED FROM BEING A PRESIDENT";
    if (screen) screen.classList.add('active');
    gameState.newsHeadlines.push(`📰 ${gameState.selectedCountry.name.common} president has resigned from office!`);
};

// ============================================================
// CHANGELOG
// ============================================================
const changelogVersions = [
    {
        version: "v1.1.0 alpha - 1st Major Update",
        changes: [
            "💰 Added buying & selling resources features",
            "➖ Fixing negative resources issue",
            "More coming soon in future updates!"
        ]
    },
    {
        version: "v1.0.2 - Fixing the scrolling issue",
        changes: [
            "⬇️ Fixed the scrolling issue in the management window",
            "📊 Rewrote new mechanics for resources"
        ]
    },
    {
        version: "v1.0.1 - Economy & UI Update",
        changes: [
            "📄 Recreated news system with improved logic",
            "📊 Fixed the resources system to be more realistic"
        ]
    },
    {
        version: "v1.0.0 - Initial Release",
        changes: [
            "🌍 100+ countries with real GDP data",
            "💰 Rank-based starting treasury system",
            "📊 Dynamic economy with resources, inflation, unemployment",
            "🕐 Time controls (pause, 1x-5x speed)",
            "🗺️ Interactive world map",
            "💾 Save and load functionality",
            "🎮 Management window with scrollable resources",
            "🎨 Full-width news bar design",
            "🎯 Country selection system"
        ]
    }
];

let currentChangelogIndex = 0;

function renderChangelogVersion() {
    const version = changelogVersions[currentChangelogIndex];
    const display = document.getElementById('changelog-display');
    if (!display) return;

    display.innerHTML = `<h2>${version.version}</h2><ul>${version.changes.map(c => `<li>${c}</li>`).join('')}</ul>`;

    const currentNum = document.getElementById('current-version-num');
    const totalNum   = document.getElementById('total-versions');
    if (currentNum) currentNum.innerText = currentChangelogIndex + 1;
    if (totalNum)   totalNum.innerText   = changelogVersions.length;

    const prevBtn = document.getElementById('prev-version-btn');
    const nextBtn = document.getElementById('next-version-btn');
    if (prevBtn) prevBtn.disabled = currentChangelogIndex === 0;
    if (nextBtn) nextBtn.disabled = currentChangelogIndex === changelogVersions.length - 1;
}

window.openChangelog = () => {
    document.getElementById('menu-screen')?.style.setProperty('display', 'none');
    const cl = document.getElementById('changelog-menu');
    if (cl) cl.style.display = 'flex';
    currentChangelogIndex = 0;
    renderChangelogVersion();
};

window.closeChangelog = () => {
    document.getElementById('changelog-menu').style.display = 'none';
    const ms = document.getElementById('menu-screen');
    if (ms) ms.style.display = 'flex';
};

window.nextVersion = () => {
    if (currentChangelogIndex < changelogVersions.length - 1) { currentChangelogIndex++; renderChangelogVersion(); }
};

window.previousVersion = () => {
    if (currentChangelogIndex > 0) { currentChangelogIndex--; renderChangelogVersion(); }
};