/* =========================================================
   JR TRADE — SCRIPT.JS
   Version optimisée — Dashboard + Wallet + Market + Trading
   ========================================================= */

(() => {
  "use strict";

  /* =========================================================
     CONFIGURATION
     ========================================================= */

  const CONFIG = {
    MGA_RATE: 2400,
    CACHE_KEY: "jr_trade_cache_v1",
    THEME_KEY: "jr-theme",
    TOAST_TIME: 2600,
    REQUEST_TIMEOUT: 12000
  };

  /* =========================================================
     SUPABASE CLIENT
     ========================================================= */

  let supabaseClient = window.supabaseClient || null;

  function getSupabase() {
    if (supabaseClient) return supabaseClient;

    if (
      !window.supabase ||
      !window.SUPABASE_URL ||
      !window.SUPABASE_PUBLISHABLE_KEY
    ) {
      throw new Error("Configuration Supabase introuvable.");
    }

    supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_PUBLISHABLE_KEY
    );

    window.supabaseClient = supabaseClient;

    return supabaseClient;
  }

  /* =========================================================
     STATE CENTRAL
     ========================================================= */

  const state = {
    user: null,
    session: null,

    assets: [],
    wallet: null,
    walletAssets: [],

    history: [],
    orders: [],

    selectedAsset: null,
    tradeSide: "buy",

    authModeSignup: false,

    loading: {
      session: false,
      wallet: false,
      market: false,
      history: false,
      orders: false
    },

    initialized: false,
    authListenerRegistered: false
  };

  /* =========================================================
     FALLBACK ASSETS
     ========================================================= */

  const fallbackAssets = [
    {
      id: null,
      symbol: "BTC",
      name: "Bitcoin",
      price_usd: 67420,
      change_24h: 5.24,
      icon: "₿"
    },
    {
      id: null,
      symbol: "ETH",
      name: "Ethereum",
      price_usd: 3528.4,
      change_24h: 3.18,
      icon: "Ξ"
    },
    {
      id: null,
      symbol: "SOL",
      name: "Solana",
      price_usd: 182.73,
      change_24h: -1.42,
      icon: "S"
    },
    {
      id: null,
      symbol: "USDT",
      name: "Tether",
      price_usd: 1,
      change_24h: 0.02,
      icon: "₮"
    }
  ];

  /* =========================================================
     DOM HELPERS
     ========================================================= */

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) => [
    ...document.querySelectorAll(selector)
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function setHTML(id, html) {
    const el = byId(id);
    if (el) el.innerHTML = html;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[char]
    );
  }

  /* =========================================================
     FORMATTERS
     ========================================================= */

  function money(value) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(number);
  }

  function number(value, decimals = 8) {
    return Number(value || 0).toLocaleString("en-US", {
      maximumFractionDigits: decimals
    });
  }

  function percentage(value) {
    const n = Number(value || 0);

    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  }

  function iconFor(symbol) {
    switch (symbol) {
      case "BTC":
        return "₿";
      case "ETH":
        return "Ξ";
      case "SOL":
        return "S";
      case "USDT":
        return "₮";
      default:
        return String(symbol || "?").charAt(0);
    }
  }

  /* =========================================================
     TOAST
     ========================================================= */

  function showToast(message) {
    const toast = byId("toast");

    if (!toast) {
      console.log(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(window.__jrToastTimer);

    window.__jrToastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, CONFIG.TOAST_TIME);
  }

  /* =========================================================
     AUTH MESSAGE
     ========================================================= */

  function setAuthMessage(message) {
    const el = byId("authMessage");
    if (el) el.textContent = message || "";
  }

  /* =========================================================
     THEME
     ========================================================= */

  function initTheme() {
    const savedTheme = localStorage.getItem(CONFIG.THEME_KEY);

    if (savedTheme === "light") {
      document.body.classList.add("light");

      const button = byId("themeToggle");

      if (button) {
        button.innerHTML = '<span>☾</span>Mode sombre';
      }
    }
  }

  function toggleTheme() {
    document.body.classList.toggle("light");

    const light = document.body.classList.contains("light");

    localStorage.setItem(
      CONFIG.THEME_KEY,
      light ? "light" : "dark"
    );

    const button = byId("themeToggle");

    if (button) {
      button.innerHTML = light
        ? '<span>☾</span>Mode sombre'
        : '<span>☼</span>Mode clair';
    }
  }

  /* =========================================================
     CACHE
     ========================================================= */

  function saveCache() {
    try {
      const data = {
        assets: state.assets,
        wallet: state.wallet,
        walletAssets: state.walletAssets,
        history: state.history,
        orders: state.orders,
        timestamp: Date.now()
      };

      localStorage.setItem(
        CONFIG.CACHE_KEY,
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn("Cache save error:", error);
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CONFIG.CACHE_KEY);

      if (!raw) return;

      const data = JSON.parse(raw);

      if (Array.isArray(data.assets) && data.assets.length) {
        state.assets = data.assets;
      }

      if (data.wallet) {
        state.wallet = data.wallet;
      }

      if (Array.isArray(data.walletAssets)) {
        state.walletAssets = data.walletAssets;
      }

      if (Array.isArray(data.history)) {
        state.history = data.history;
      }

      if (Array.isArray(data.orders)) {
        state.orders = data.orders;
      }
    } catch (error) {
      console.warn("Cache load error:", error);
    }
  }

  /* =========================================================
     FALLBACK INITIALIZATION
     ========================================================= */

  function useFallbackAssets() {
    if (!state.assets.length) {
      state.assets = [...fallbackAssets];
    }
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function goTo(page) {
    $$(".page").forEach((p) => {
      p.classList.remove("active");
    });

    const target = byId(`page-${page}`);

    if (target) {
      target.classList.add("active");
    }

    $$(".nav-item[data-page]").forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.page === page
      );
    });

    const sidebar = byId("sidebar");

    if (sidebar) {
      sidebar.classList.remove("open");
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* =========================================================
     MODAL WALLET RECEIVE
     ========================================================= */

  function openReceiveModal() {
    const modal = byId("modal");

    if (modal) {
      modal.classList.add("open");
    }
  }

  function closeReceiveModal() {
    const modal = byId("modal");

    if (modal) {
      modal.classList.remove("open");
    }
  }

  async function copyDemoAddress() {
    const address = "0xJRTradeDemo8f2c1A9d7A21";

    try {
      await navigator.clipboard.writeText(address);
      showToast("Adresse copiée.");
    } catch {
      showToast(`Adresse : ${address}`);
    }
  }

  /* =========================================================
     AUTH UI
     ========================================================= */

  function openAuth() {
    const modal = byId("authModal");

    if (modal) {
      modal.classList.remove("hidden");
    }
  }

  function closeAuth() {
    const modal = byId("authModal");

    if (modal) {
      modal.classList.add("hidden");
    }
  }

  function setAuthMode(signup) {
    state.authModeSignup = signup;

    setText(
      "authTitle",
      signup ? "Créer un compte" : "Connexion"
    );

    setText(
      "authSubtitle",
      signup
        ? "Créez votre compte JR Trade."
        : "Connectez-vous à votre compte JR Trade."
    );

    setText(
      "authSubmit",
      signup ? "Créer le compte" : "Se connecter"
    );

    setText(
      "authSwitch",
      signup
        ? "J’ai déjà un compte"
        : "Créer un compte"
    );

    const username = byId("authUsername");

    if (username) {
      username.style.display = signup
        ? "block"
        : "none";
    }

    setAuthMessage("");
  }

  /* =========================================================
     SESSION
     ========================================================= */

  async function getCurrentUser() {
    const client = getSupabase();

    const result = await client.auth.getUser();

    if (result.error) {
      throw result.error;
    }

    return result.data?.user || null;
  }

  async function loadSession() {
    if (state.loading.session) {
      return state.session;
    }

    state.loading.session = true;

    try {
      const client = getSupabase();

      const result = await client.auth.getSession();

      if (result.error) {
        throw result.error;
      }

      state.session = result.data?.session || null;
      state.user = state.session?.user || null;

      return state.session;
    } finally {
      state.loading.session = false;
    }
  }

  /* =========================================================
     PROFILE
     ========================================================= */

  async function loadProfile() {
    if (!state.user) return;

    setText(
      "accountEmail",
      state.user.email || "Non connecté"
    );

    const authEmail = byId("authEmail");

    if (authEmail) {
      authEmail.value = state.user.email || "";
    }

    try {
      const client = getSupabase();

      const result = await client
        .from("profiles")
        .select("display_name,username")
        .eq("id", state.user.id)
        .maybeSingle();

      if (result.error) {
        console.warn("Profile error:", result.error);
        return;
      }

      const name =
        result.data?.display_name ||
        result.data?.username ||
        "JR Trade User";

      const profileTitle = $(
        "#page-profile h1"
      );

      if (profileTitle) {
        profileTitle.textContent = name;
      }
    } catch (error) {
      console.warn("Profile loading error:", error);
    }
  }

  /* =========================================================
     ASSETS
     ========================================================= */

  async function loadAssets() {
    if (state.loading.market) return;

    state.loading.market = true;

    try {
      const client = getSupabase();

      const result = await client
        .from("assets")
        .select(
          "id,symbol,name,price_usd,change_24h"
        )
        .order("symbol");

      if (result.error) {
        throw result.error;
      }

      if (Array.isArray(result.data) && result.data.length) {
        state.assets = result.data.map((asset) => ({
          ...asset,
          price_usd: Number(asset.price_usd || 0),
          change_24h: Number(asset.change_24h || 0),
          icon: iconFor(asset.symbol)
        }));
      } else {
        useFallbackAssets();
      }

      saveCache();

      renderMarkets();
      renderPortfolio();
      updateTrade();
    } catch (error) {
      console.warn("Assets loading error:", error);

      useFallbackAssets();

      renderMarkets();
      renderPortfolio();
    } finally {
      state.loading.market = false;
    }
  }

  function findAsset(symbol) {
    return (
      state.assets.find(
        (asset) => asset.symbol === symbol
      ) ||
      fallbackAssets.find(
        (asset) => asset.symbol === symbol
      ) ||
      null
    );
  }

  function findAssetById(id) {
    return state.assets.find(
      (asset) => String(asset.id) === String(id)
    );
  }

  /* =========================================================
     MARKET RENDER
     ========================================================= */

  function renderMarkets() {
    const marketPreview = byId("marketPreview");

    if (marketPreview) {
      marketPreview.innerHTML = state.assets
        .map(
          (asset) => `
          <div class="market-row">
            <div class="coin-icon">
              ${escapeHTML(asset.icon || iconFor(asset.symbol))}
            </div>

            <div class="asset-name">
              <b>${escapeHTML(asset.name)}</b>
              <span>${escapeHTML(asset.symbol)}/USD</span>
            </div>

            <div class="asset-price">
              <b>${money(asset.price_usd)}</b>

              <span class="${
                Number(asset.change_24h) >= 0
                  ? "positive"
                  : "negative"
              }">
                ${percentage(asset.change_24h)}
              </span>
            </div>
          </div>
        `
        )
        .join("");
    }

    const marketTable = byId("marketTable");

    if (marketTable) {
      marketTable.innerHTML = state.assets
        .map(
          (asset) => `
          <div class="table-row">
            <div class="asset-name">
              <b>
                ${escapeHTML(
                  asset.icon || iconFor(asset.symbol)
                )}
                ${escapeHTML(asset.name)}
              </b>

              <span>${escapeHTML(asset.symbol)}</span>
            </div>

            <b>${money(asset.price_usd)}</b>

            <span class="${
              Number(asset.change_24h) >= 0
                ? "positive"
                : "negative"
            }">
              ${percentage(asset.change_24h)}
            </span>

            <button
              class="text-btn"
              data-trade-symbol="${escapeHTML(asset.symbol)}"
            >
              Trader →
            </button>
          </div>
        `
        )
        .join("");

      $$("#marketTable [data-trade-symbol]").forEach(
        (button) => {
          button.addEventListener("click", () => {
            const symbol =
              button.dataset.tradeSymbol;

            goTo("trade");
            setTradeAsset(symbol);
          });
        }
      );
    }
  }

  /* =========================================================
     WALLET DATA
     ========================================================= */

  async function loadWalletData() {
    if (!state.user) {
      state.wallet = null;
      state.walletAssets = [];
      return;
    }

    const client = getSupabase();

    const walletResult = await client
      .from("wallets")
      .select("id,balance_usd,created_at")
      .eq("user_id", state.user.id)
      .maybeSingle();

    if (walletResult.error) {
      throw walletResult.error;
    }

    state.wallet = walletResult.data || null;

    if (!state.wallet) {
      state.walletAssets = [];
      return;
    }

    const assetResult = await client
      .from("wallet_assets")
      .select("id,amount,asset_id")
      .eq("wallet_id", state.wallet.id);

    if (assetResult.error) {
      throw assetResult.error;
    }

    const rows = assetResult.data || [];

    const ids = [
      ...new Set(
        rows
          .map((row) => row.asset_id)
          .filter(Boolean)
      )
    ];

    let assetRows = [];

    if (ids.length) {
      const result = await client
        .from("assets")
        .select(
          "id,symbol,name,price_usd,change_24h"
        )
        .in("id", ids);

      if (result.error) {
        throw result.error;
      }

      assetRows = result.data || [];
    }

    const map = new Map(
      assetRows.map((asset) => [
        String(asset.id),
        asset
      ])
    );

    state.walletAssets = rows.map((row) => ({
      ...row,
      asset:
        map.get(String(row.asset_id)) || null
    }));

    saveCache();
  }

  /* =========================================================
     PORTFOLIO CALCULATION
     ========================================================= */

  function getPortfolio() {
    const cash = Number(
      state.wallet?.balance_usd || 0
    );

    const assets = state.walletAssets
      .map((row) => {
        const asset = row.asset || {};

        const amount = Number(row.amount || 0);
        const price = Number(
          asset.price_usd || 0
        );

        const value = amount * price;

        return {
          id: asset.id,
          symbol: asset.symbol,
          name: asset.name,
          price: price,
          change: Number(
            asset.change_24h || 0
          ),
          amount,
          value
        };
      })
      .filter((asset) => asset.amount > 0);

    const crypto = assets.reduce(
      (sum, asset) => sum + asset.value,
      0
    );

    const total = cash + crypto;

    const pnl = assets.reduce(
      (sum, asset) =>
        sum +
        asset.value *
          (asset.change / 100),
      0
    );

    return {
      cash,
      crypto,
      total,
      pnl,
      assets
    };
  }

  /* =========================================================
     PORTFOLIO RENDER
     ========================================================= */

  function renderPortfolio() {
    const portfolio = getPortfolio();

    const {
      cash,
      crypto,
      total,
      pnl,
      assets
    } = portfolio;

    setText(
      "portfolioValue",
      money(total)
    );

    setText(
      "portfolioMGA",
      `≈ ${Math.round(
        total * CONFIG.MGA_RATE
      ).toLocaleString("fr-FR")} MGA`
    );

    setText(
      "profitValue",
      `${pnl >= 0 ? "+" : ""}${money(pnl)}`
    );

    setText(
      "portfolioChange",
      percentage(
        total ? (pnl / total) * 100 : 0
      )
    );

    setText(
      "cashValue",
      money(cash)
    );

    setText(
      "cryptoValue",
      money(crypto)
    );

    setText(
      "performance24h",
      `${pnl >= 0 ? "+" : ""}${money(pnl)}`
    );

    setText(
      "walletCashMini",
      money(cash)
    );

    setText(
      "walletCryptoAdvanced",
      money(crypto)
    );

    setText(
      "walletTotalAdvanced",
      money(total)
    );

    setText(
      "walletPnLAdvanced",
      `${pnl >= 0 ? "+" : ""}${money(pnl)}`
    );

    setText(
      "walletCashAdvanced",
      `Liquidités : ${money(cash)}`
    );

    setText(
      "assetCount",
      String(assets.length)
    );

    setText(
      "assetCountLarge",
      `${assets.length} crypto`
    );

    setText(
      "walletAssetCount",
      `${assets.length} actif${
        assets.length > 1 ? "s" : ""
      }`
    );

    setText(
      "assetSymbols",
      assets.map(
        (asset) => asset.symbol
      ).join(" · ") || "Aucun actif"
    );

    renderAllocation(assets, total);
    renderPortfolioList(assets);
    renderAdvancedWalletList(assets);
    renderLegacyWallet(assets);

    const performanceBar =
      byId("performanceBarFill");

    if (performanceBar) {
      const percent =
        total > 0
          ? 50 + (pnl / total) * 500
          : 8;

      performanceBar.style.width =
        `${Math.min(
          100,
          Math.max(8, percent)
        )}%`;
    }
  }

  /* =========================================================
     ALLOCATION
     ========================================================= */

  function renderAllocation(assets, total) {
    const containers = [
      byId("allocationList"),
      byId("walletAllocation")
    ].filter(Boolean);

    containers.forEach((container) => {
      if (!assets.length) {
        container.innerHTML =
          '<div class="data-muted">Aucun actif détenu pour le moment.</div>';

        return;
      }

      container.innerHTML = assets
        .map((asset) => {
          const share =
            total > 0
              ? (asset.value / total) * 100
              : 0;

          return `
            <div class="allocation-item">

              <div>
                <div class="allocation-head">
                  <strong>
                    ${escapeHTML(
                      iconFor(asset.symbol)
                    )}
                    ${escapeHTML(
                      asset.symbol
                    )}
                  </strong>

                  <span>
                    ${share.toFixed(1)}%
                  </span>
                </div>

                <div class="data-muted">
                  ${escapeHTML(
                    asset.name || ""
                  )}
                  ·
                  ${number(
                    asset.amount
                  )}
                </div>

                <div class="allocation-track">
                  <div
                    class="allocation-fill"
                    style="width:${Math.min(
                      100,
                      share
                    )}%"
                  ></div>
                </div>
              </div>

              <strong>
                ${money(asset.value)}
              </strong>

            </div>
          `;
        })
        .join("");
    });
  }

  /* =========================================================
     PORTFOLIO LIST
     ========================================================= */

  function renderPortfolioList(assets) {
    const box = byId("portfolioList");

    if (!box) return;

    if (!assets.length) {
      box.innerHTML =
        '<div class="data-muted">Aucun actif détenu pour le moment.</div>';

      return;
    }

    box.innerHTML = assets
      .map(
        (asset) => `
        <div class="asset-row">

          <div class="coin-icon">
            ${escapeHTML(
              iconFor(asset.symbol)
            )}
          </div>

          <div class="asset-name">
            <b>
              ${escapeHTML(
                asset.name ||
                  asset.symbol
              )}
            </b>

            <span>
              ${number(asset.amount)}
              ${escapeHTML(
                asset.symbol
              )}
            </span>
          </div>

          <div class="asset-price">

            <b>
              ${money(asset.value)}
            </b>

            <span class="${
              asset.change >= 0
                ? "positive"
                : "negative"
            }">
              ${percentage(
                asset.change
              )}
            </span>

          </div>

        </div>
      `
      )
      .join("");
  }

  /* =========================================================
     ADVANCED WALLET LIST
     ========================================================= */

  function renderAdvancedWalletList(
    assets
  ) {
    const box =
      byId("walletAssetsMain");

    if (!box) return;

    if (!assets.length) {
      box.innerHTML =
        '<div class="data-muted">Aucun actif détenu pour le moment.</div>';

      return;
    }

    box.innerHTML = assets
      .map(
        (asset) => `
        <div class="asset-row">

          <div class="coin-icon">
            ${escapeHTML(
              iconFor(asset.symbol)
            )}
          </div>

          <div class="asset-name">
            <b>
              ${escapeHTML(
                asset.name ||
                  asset.symbol
              )}
            </b>

            <span>
              ${number(asset.amount)}
              ${escapeHTML(
                asset.symbol
              )}
            </span>
          </div>

          <div class="asset-price">

            <b>
              ${money(asset.value)}
            </b>

            <span class="${
              asset.change >= 0
                ? "positive"
                : "negative"
            }">
              ${percentage(
                asset.change
              )}
            </span>

          </div>

        </div>
      `
      )
      .join("");
  }

  /* =========================================================
     LEGACY WALLET
     ========================================================= */

  function renderLegacyWallet(
    assets
  ) {
    const box =
      byId("walletAssets");

    if (!box) return;

    if (!assets.length) {
      box.innerHTML =
        '<div class="data-muted">No crypto holdings yet. Your demo wallet is ready.</div>';

      return;
    }

    box.innerHTML = assets
      .map(
        (asset) => `
        <div class="asset-row">

          <div>
            <strong>
              ${escapeHTML(
                asset.symbol
              )}
            </strong>

            <div class="data-muted">
              ${escapeHTML(
                asset.name || ""
              )}
            </div>
          </div>

          <div class="asset-right">
            <strong>
              ${number(asset.amount)}
            </strong>

            <div class="data-muted">
              ${money(asset.value)}
            </div>
          </div>

        </div>
      `
      )
      .join("");
  }

  /* =========================================================
     WALLET LOADING
     ========================================================= */

  async function loadWallet() {
    if (state.loading.wallet) return;

    state.loading.wallet = true;

    try {
      if (!state.user) {
        setText(
          "walletBalance",
          "$0.00"
        );

        setText(
          "walletStatus",
          "Connectez-vous pour voir votre wallet."
        );

        state.wallet = null;
        state.walletAssets = [];

        renderPortfolio();

        return;
      }

      setText(
        "walletStatus",
        "Actualisation..."
      );

      await loadWalletData();

      const balance = Number(
        state.wallet?.balance_usd || 0
      );

      setText(
        "walletBalance",
        money(balance)
      );

      setText(
        "walletStatus",
        `Demo wallet • ${
          state.user.email || ""
        }`
      );

      renderPortfolio();
    } catch (error) {
      console.error(
        "Wallet error:",
        error
      );

      setText(
        "walletStatus",
        "Impossible de charger le wallet."
      );

      renderPortfolio();
    } finally {
      state.loading.wallet = false;
    }
  }

  /* =========================================================
     HISTORY
     ========================================================= */

  async function loadHistory() {
    if (!state.user) {
      state.history = [];
      renderHistory();
      return;
    }

    if (state.loading.history) return;

    state.loading.history = true;

    try {
      const client = getSupabase();

      const result = await client
        .from("transactions")
        .select(
          "id,type,amount_usd,quantity,status,created_at,assets(symbol)"
        )
        .eq("user_id", state.user.id)
        .order("created_at", {
          ascending: false
        });

      if (result.error) {
        throw result.error;
      }

      state.history = (
        result.data || []
      ).map((item) => ({
        type:
          item.type === "buy"
            ? "Achat"
            : item.type === "sell"
            ? "Vente"
            : item.type === "deposit"
            ? "Dépôt"
            : "Retrait",

        symbol:
          item.assets?.symbol || "—",

        amount_usd:
          Number(
            item.amount_usd || 0
          ),

        quantity:
          Number(
            item.quantity || 0
          ),

        status:
          item.status || "Confirmé",

        created_at:
          item.created_at
      }));

      saveCache();
      renderHistory();
    } catch (error) {
      console.warn(
        "History loading error:",
        error
      );

      renderHistory();
    } finally {
      state.loading.history = false;
    }
  }

  function renderHistory() {
    const box =
      byId("historyTable");

    if (!box) return;

    if (!state.history.length) {
      box.innerHTML =
        '<div class="empty-state">Aucune transaction pour le moment.</div>';

      return;
    }

    box.innerHTML = state.history
      .map(
        (item) => `
        <div class="table-row history-row">

          <span>
            ${escapeHTML(
              item.type
            )}
          </span>

          <b>
            ${escapeHTML(
              item.symbol
            )}
          </b>

          <span>
            ${money(
              item.amount_usd
            )}
          </span>

          <span class="pill positive">
            ${escapeHTML(
              item.status
            )}
          </span>

          <span>
            ${
              item.created_at
                ? new Date(
                    item.created_at
                  ).toLocaleDateString(
                    "fr-FR"
                  )
                : "—"
            }
          </span>

        </div>
      `
      )
      .join("");
  }

  /* =========================================================
     ORDERS
     ========================================================= */

  async function loadOrders() {
    const box =
      byId("ordersList");

    if (!state.user) {
      if (box) {
        box.textContent =
          "Connectez-vous pour voir vos ordres.";
      }

      return;
    }

    if (state.loading.orders) return;

    state.loading.orders = true;

    try {
      const client = getSupabase();

      const result = await client
        .from("orders")
        .select(
          "id,side,amount_usd,quantity,price_usd,status,created_at,assets(symbol)"
        )
        .eq("user_id", state.user.id)
        .order("created_at", {
          ascending: false
        })
        .limit(10);

      if (result.error) {
        throw result.error;
      }

      state.orders = result.data || [];

      if (!box) return;

      if (!state.orders.length) {
        box.innerHTML =
          '<div class="data-muted">Aucun ordre démo.</div>';

        return;
      }

      box.innerHTML = state.orders
        .map(
          (order) => `
          <div class="order-row">

            <div>
              <strong>
                ${escapeHTML(
                  String(
                    order.side ||
                      ""
                  ).toUpperCase()
                )}
                ${escapeHTML(
                  order.assets
                    ?.symbol || ""
                )}
              </strong>

              <div class="data-muted">
                ${
                  order.created_at
                    ? new Date(
                        order.created_at
                      ).toLocaleString()
                    : ""
                }
              </div>
            </div>

            <div class="order-right">

              <strong>
                ${money(
                  order.amount_usd
                )}
              </strong>

              <div class="data-muted">
                ${number(
                  order.quantity
                )}
              </div>

            </div>

          </div>
        `
        )
        .join("");
    } catch (error) {
      console.warn(
        "Orders loading error:",
        error
      );

      if (box) {
        box.innerHTML =
          '<div class="data-muted">Impossible de charger les ordres.</div>';
      }
    } finally {
      state.loading.orders = false;
    }
  }

  /* =========================================================
     TRADE
     ========================================================= */

  function setTradeAsset(symbol) {
    const select =
      byId("tradeAsset");

    if (select) {
      select.value = symbol;
    }

    const asset = findAsset(symbol);

    if (asset) {
      state.selectedAsset = asset;
    }

    updateTrade();
  }

  function updateTrade() {
    const select =
      byId("tradeAsset");

    const symbol =
      select?.value ||
      state.selectedAsset?.symbol ||
      state.assets[0]?.symbol;

    const asset = findAsset(symbol);

    if (!asset) return;

    state.selectedAsset = asset;

    setText(
      "tradePrice",
      money(asset.price_usd)
    );

    setText(
      "chartTitle",
      `${asset.symbol} / USD`
    );

    setText(
      "selectedAssetLabel",
      `${asset.name} (${asset.symbol})`
    );

    setText(
      "selectedAssetPrice",
      money(asset.price_usd)
    );

    const amount = Number(
      byId("tradeAmount")?.value ||
        byId("tradeUsd")?.value ||
        0
    );

    const quantity =
      asset.price_usd > 0
        ? amount / asset.price_usd
        : 0;

    setText(
      "tradeQuantity",
      `${number(
        quantity,
        asset.price_usd < 2
          ? 2
          : 8
      )} ${asset.symbol}`
    );

    setText(
      "tradeQuantityPreview",
      `Quantity: ${number(
        quantity
      )}`
    );
  }

  async function executeTrade() {
    if (!state.user) {
      showToast(
        "Connectez-vous d’abord."
      );
      return;
    }

    const asset =
      state.selectedAsset ||
      findAsset(
        byId("tradeAsset")?.value
      );

    if (!asset) {
      showToast(
        "Sélectionnez un actif."
      );
      return;
    }

    const amount = Number(
      byId("tradeAmount")?.value ||
        byId("tradeUsd")?.value ||
        0
    );

    if (!amount || amount <= 0) {
      showToast(
        "Entrez un montant valide."
      );
      return;
    }

    if (!asset.id) {
      showToast(
        "Actif Supabase introuvable."
      );
      return;
    }

    const side =
      state.tradeSide;

    const price =
      Number(asset.price_usd || 0);

    const quantity =
      amount / price;

    try {
      const client = getSupabase();

      const walletResult =
        await client
          .from("wallets")
          .select(
            "id,balance_usd"
          )
          .eq(
            "user_id",
            state.user.id
          )
          .maybeSingle();

      if (walletResult.error) {
        throw walletResult.error;
      }

      if (!walletResult.data) {
        throw new Error(
          "Wallet introuvable."
        );
      }

      const wallet =
        walletResult.data;

      const holdingResult =
        await client
          .from("wallet_assets")
          .select(
            "id,amount"
          )
          .eq(
            "wallet_id",
            wallet.id
          )
          .eq(
            "asset_id",
            asset.id
          )
          .maybeSingle();

      if (holdingResult.error) {
        throw holdingResult.error;
      }

      const currentCash =
        Number(
          wallet.balance_usd || 0
        );

      const currentAmount =
        Number(
          holdingResult.data
            ?.amount || 0
        );

      if (
        side === "buy" &&
        amount > currentCash
      ) {
        throw new Error(
          `Solde insuffisant. Disponible : ${money(
            currentCash
          )}`
        );
      }

      if (
        side === "sell" &&
        quantity >
          currentAmount + 1e-12
      ) {
        throw new Error(
          `Solde ${asset.symbol} insuffisant.`
        );
      }

      const newCash =
        side === "buy"
          ? currentCash - amount
          : currentCash + amount;

      const newAmount =
        side === "buy"
          ? currentAmount + quantity
          : Math.max(
              0,
              currentAmount - quantity
            );

      /* Mise à jour wallet */

      const walletUpdate =
        await client
          .from("wallets")
          .update({
            balance_usd:
              newCash
          })
          .eq(
            "id",
            wallet.id
          )
          .eq(
            "user_id",
            state.user.id
          );

      if (walletUpdate.error) {
        throw walletUpdate.error;
      }

      /* Mise à jour crypto */

      let holdingUpdate;

      if (holdingResult.data) {
        holdingUpdate =
          await client
            .from("wallet_assets")
            .update({
              amount:
                newAmount
            })
            .eq(
              "id",
              holdingResult.data.id
            );
      } else {
        holdingUpdate =
          await client
            .from("wallet_assets")
            .insert({
              wallet_id:
                wallet.id,
              asset_id:
                asset.id,
              amount:
                newAmount
            });
      }

      if (holdingUpdate.error) {
        throw holdingUpdate.error;
      }

      /* Order */

      const order =
        await client
          .from("orders")
          .insert({
            user_id:
              state.user.id,

            asset_id:
              asset.id,

            side,

            amount_usd:
              amount,

            quantity,

            price_usd:
              price,

            status:
              "completed"
          });

      if (order.error) {
        throw order.error;
      }

      /* Transaction */

      const transaction =
        await client
          .from("transactions")
          .insert({
            user_id:
              state.user.id,

            asset_id:
              asset.id,

            type:
              side,

            amount_usd:
              amount,

            quantity,

            status:
              "completed"
          });

      if (transaction.error) {
        throw transaction.error;
      }

      showToast(
        `${
          side === "buy"
            ? "Achat"
            : "Vente"
        } démo enregistré.`
      );

      const tradeAmount =
        byId("tradeAmount");

      const tradeUsd =
        byId("tradeUsd");

      if (tradeAmount) {
        tradeAmount.value = "";
      }

      if (tradeUsd) {
        tradeUsd.value = "";
      }

      updateTrade();

      await Promise.all([
        loadWallet(),
        loadHistory(),
        loadOrders()
      ]);

      goTo("dashboard");
    } catch (error) {
      console.error(
        "Trade error:",
        error
      );

      showToast(
        error.message ||
          "Erreur pendant le trade."
      );
    }
  }

  /* =========================================================
     AUTH ACTIONS
     ========================================================= */

  async function submitAuth(event) {
    event.preventDefault();

    const email =
      byId("authEmail")?.value
        .trim();

    const password =
      byId("authPassword")?.value ||
      "";

    if (!email || !password) {
      setAuthMessage(
        "Remplissez tous les champs."
      );
      return;
    }

    setAuthMessage(
      "Chargement..."
    );

    try {
      const client = getSupabase();

      if (state.authModeSignup) {
        const username =
          byId(
            "authUsername"
          )?.value.trim() || "";

        const result =
          await client.auth.signUp({
            email,
            password,
            options: {
              data: {
                username
              }
            }
          });

        if (result.error) {
          throw result.error;
        }

        if (!result.data.session) {
          setAuthMessage(
            "Compte créé. Vérifiez votre email si une confirmation est demandée."
          );

          return;
        }

        closeAuth();

        await refreshAfterAuth();
      } else {
        const result =
          await client.auth.signInWithPassword(
            {
              email,
              password
            }
          );

        if (result.error) {
          throw result.error;
        }

        closeAuth();

        await refreshAfterAuth();
      }
    } catch (error) {
      console.error(
        "Authentication error:",
        error
      );

      setAuthMessage(
        error.message ||
          "Erreur d’authentification."
      );
    }
  }

  async function signOut() {
    try {
      const client = getSupabase();

      const result =
        await client.auth.signOut();

      if (result.error) {
        throw result.error;
      }

      state.user = null;
      state.session = null;
      state.wallet = null;
      state.walletAssets = [];
      state.history = [];
      state.orders = [];

      renderPortfolio();

      openAuth();
      setAuthMode(false);

      showToast(
        "Déconnexion réussie."
      );
    } catch (error) {
      console.error(
        "Sign out error:",
        error
      );

      showToast(
        "Erreur lors de la déconnexion."
      );
    }
  }

  /* =========================================================
     AUTH REFRESH
     ========================================================= */

  async function refreshAfterAuth() {
    await loadSession();

    state.user =
      state.session?.user || null;

    if (!state.user) {
      openAuth();
      return;
    }

    closeAuth();

    await Promise.all([
      loadProfile(),
      loadAssets()
    ]);

    await Promise.all([
      loadWallet(),
      loadHistory(),
      loadOrders()
    ]);

    renderPortfolio();
  }

  /* =========================================================
     SEARCH
     ========================================================= */

  function searchMarkets(query) {
    const q =
      String(query || "")
        .toLowerCase()
        .trim();

    $$("#marketTable .table-row")
      .forEach((row) => {
        row.style.display =
          !q ||
          row.textContent
            .toLowerCase()
            .includes(q)
            ? ""
            : "none";
      });

    if (q) {
      goTo("markets");
    }
  }

  /* =========================================================
     HIDE BALANCES
     ========================================================= */

  function toggleBalances(hidden) {
    const ids = [
      "portfolioValue",
      "profitValue",
      "walletTotalAdvanced",
      "walletCashAdvanced",
      "walletCryptoAdvanced",
      "walletPnLAdvanced",
      "walletCashMini",
      "cashValue",
      "cryptoValue",
      "performance24h"
    ];

    ids.forEach((id) => {
      const el = byId(id);

      if (!el) return;

      if (hidden) {
        if (!el.dataset.originalValue) {
          el.dataset.originalValue =
            el.textContent;
        }

        el.textContent = "••••••";
      } else {
        el.dataset.originalValue = "";

        renderPortfolio();
      }
    });
  }

  /* =========================================================
     REFRESH ALL
     ========================================================= */

  let refreshInProgress = false;

  async function refreshAll() {
    if (refreshInProgress) {
      return;
    }

    refreshInProgress = true;

    try {
      await loadSession();

      state.user =
        state.session?.user || null;

      if (!state.user) {
        openAuth();
        setAuthMode(false);
        renderPortfolio();
        return;
      }

      await loadAssets();

      await Promise.all([
        loadWallet(),
        loadHistory(),
        loadOrders()
      ]);

      renderPortfolio();

      showToast(
        "Données actualisées."
      );
    } catch (error) {
      console.error(
        "Refresh error:",
        error
      );

      showToast(
        "Impossible d’actualiser les données."
      );
    } finally {
      refreshInProgress = false;
    }
  }

  /* =========================================================
     EVENT LISTENERS
     ========================================================= */

  function bindEvents() {
    /* Navigation */

    $$(".nav-item[data-page]").forEach(
      (item) => {
        item.addEventListener(
          "click",
          () => {
            goTo(
              item.dataset.page
            );
          }
        );
      }
    );

    /* Menu */

    const menu =
      byId("menuBtn");

    if (menu) {
      menu.addEventListener(
        "click",
        () => {
          const sidebar =
            byId("sidebar");

          if (sidebar) {
            sidebar.classList.toggle(
              "open"
            );
          }
        }
      );
    }

    /* Notifications */

    const notification =
      byId(
        "notificationBtn"
      );

    if (notification) {
      notification.addEventListener(
        "click",
        () => goTo("notifications")
      );
    }

    /* Theme */

    const theme =
      byId("themeToggle");

    if (theme) {
      theme.addEventListener(
        "click",
        toggleTheme
      );
    }

    /* Receive */

    const receive =
      byId("receiveBtn");

    if (receive) {
      receive.addEventListener(
        "click",
        openReceiveModal
      );
    }

    const modalClose =
      byId("modalClose");

    if (modalClose) {
      modalClose.addEventListener(
        "click",
        closeReceiveModal
      );
    }

    const modal =
      byId("modal");

    if (modal) {
      modal.addEventListener(
        "click",
        (event) => {
          if (
            event.target === modal
          ) {
            closeReceiveModal();
          }
        }
      );
    }

    /* Copy address */

    const copyAddress =
      byId("copyAddress");

    if (copyAddress) {
      copyAddress.addEventListener(
        "click",
        copyDemoAddress
      );
    }

    const modalCopy =
      byId("modalCopy");

    if (modalCopy) {
      modalCopy.addEventListener(
        "click",
        copyDemoAddress
      );
    }

    /* Auth switch */

    const authSwitch =
      byId("authSwitch");

    if (authSwitch) {
      authSwitch.addEventListener(
        "click",
        () =>
          setAuthMode(
            !state.authModeSignup
          )
      );
    }

    /* Auth form */

    const authForm =
      byId("authForm");

    if (authForm) {
      authForm.addEventListener(
        "submit",
        submitAuth
      );
    }

    /* Sign out */

    const signOut =
      byId("signOutBtn");

    if (signOut) {
      signOut.addEventListener(
        "click",
        signOut
      );
    }

    /* Trade side */

    $$("[data-side]").forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            state.tradeSide =
              button.dataset.side;

            $$("[data-side]")
              .forEach((item) => {
                item.classList.toggle(
                  "active",
                  item === button
                );
              });

            setText(
              "executeTrade",
              state.tradeSide === "buy"
                ? "Confirmer l’achat"
                : "Confirmer la vente"
            );
          }
        );
      }
    );

    /* Trade asset */

    const tradeAsset =
      byId("tradeAsset");

    if (tradeAsset) {
      tradeAsset.addEventListener(
        "change",
        updateTrade
      );
    }

    /* Trade amount */

    const tradeAmount =
      byId("tradeAmount");

    if (tradeAmount) {
      tradeAmount.addEventListener(
        "input",
        updateTrade
      );
    }

    const tradeUsd =
      byId("tradeUsd");

    if (tradeUsd) {
      tradeUsd.addEventListener(
        "input",
        updateTrade
      );
    }

    /* Quick amount */

    $$(".quick button").forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const amount =
              button.dataset.amount;

            if (tradeAmount) {
              tradeAmount.value =
                amount;
            }

            if (tradeUsd) {
              tradeUsd.value =
                amount;
            }

            updateTrade();
          }
        );
      }
    );

    /* Execute old trade button */

    const executeTradeOld =
      byId("executeTrade");

    if (executeTradeOld) {
      executeTradeOld.addEventListener(
        "click",
        executeTrade
      );
    }

    /* Execute V2 trade button */

    const executeTradeNew =
      byId(
        "executeTradeBtn"
      );

    if (executeTradeNew) {
      executeTradeNew.addEventListener(
        "click",
        async () => {
          executeTradeNew.disabled =
            true;

          setText(
            "tradeStatus",
            "Traitement..."
          );

          try {
            await executeTrade();
          } finally {
            executeTradeNew.disabled =
              false;
          }
        }
      );
    }

    /* Search */

    const search =
      byId("globalSearch");

    if (search) {
      search.addEventListener(
        "input",
        (event) => {
          searchMarkets(
            event.target.value
          );
        }
      );
    }

    /* Hide balance */

    const hide =
      byId("hideBalances");

    if (hide) {
      hide.addEventListener(
        "change",
        (event) => {
          toggleBalances(
            event.target.checked
          );
        }
      );
    }

    /* Wallet refresh */

    const refreshWallet =
      byId(
        "refreshWalletBtn"
      );

    if (refreshWallet) {
      refreshWallet.addEventListener(
        "click",
        async () => {
          if (
            refreshWallet.disabled
          ) {
            return;
          }

          refreshWallet.disabled =
            true;

          try {
            await loadWallet();
            showToast(
              "Wallet actualisé."
            );
          } finally {
            refreshWallet.disabled =
              false;
          }
        }
      );
    }

    /* Advanced wallet refresh */

    const refreshAdvanced =
      byId(
        "refreshAdvancedBtn"
      );

    if (refreshAdvanced) {
      refreshAdvanced.addEventListener(
        "click",
        refreshAll
      );
    }

    /* Market refresh */

    const refreshMarket =
      byId(
        "refreshMarketBtn"
      );

    if (refreshMarket) {
      refreshMarket.addEventListener(
        "click",
        async () => {
          await loadAssets();
          await loadOrders();
          showToast(
            "Marché actualisé."
          );
        }
      );
    }
  }

  /* =========================================================
     AUTH STATE LISTENER
     ========================================================= */

  function registerAuthListener() {
    if (
      state.authListenerRegistered
    ) {
      return;
    }

    const client = getSupabase();

    client.auth.onAuthStateChange(
      (event, session) => {
        console.log(
          "JR Trade auth event:",
          event
        );

        state.session =
          session || null;

        state.user =
          session?.user || null;

        /*
         * Ne pas lancer trop de requêtes
         * directement dans le callback Supabase.
         */
        setTimeout(async () => {
          try {
            if (session?.user) {
              closeAuth();

              await loadProfile();
              await loadAssets();

              await Promise.all([
                loadWallet(),
                loadHistory(),
                loadOrders()
              ]);

              renderPortfolio();
            } else {
              openAuth();
              setAuthMode(false);

              state.wallet = null;
              state.walletAssets = [];
              state.history = [];
              state.orders = [];

              renderPortfolio();
            }
          } catch (error) {
            console.error(
              "Auth refresh error:",
              error
            );
          }
        }, 0);
      }
    );

    state.authListenerRegistered =
      true;
  }

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  async function init() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    console.log(
      "JR Trade — initialization..."
    );

    initTheme();

    loadCache();

    useFallbackAssets();

    bindEvents();

    renderMarkets();
    renderPortfolio();
    renderHistory();

    updateTrade();

    try {
      const session =
        await loadSession();

      state.user =
        session?.user || null;

      registerAuthListener();

      if (!state.user) {
        openAuth();
        setAuthMode(false);

        setText(
          "walletStatus",
          "Connectez-vous pour voir votre wallet."
        );

        return;
      }

      closeAuth();

      /*
       * Assets et profile peuvent être
       * chargés en parallèle.
       */

      await Promise.all([
        loadProfile(),
        loadAssets()
      ]);

      /*
       * Puis les données dépendantes
       * du wallet/user.
       */

      await Promise.all([
        loadWallet(),
        loadHistory(),
        loadOrders()
      ]);

      renderPortfolio();

      console.log(
        "JR Trade — ready."
      );
    } catch (error) {
      console.error(
        "JR Trade initialization error:",
        error
      );

      /*
       * On évite de laisser "Loading..."
       * indéfiniment.
       */

      setText(
        "walletStatus",
        "Connexion Supabase indisponible."
      );

      renderMarkets();
      renderPortfolio();
      renderHistory();
    }
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.JRTrade = {
    ...(window.JRTrade || {}),

    state,

    goTo,

    loadAssets,

    loadWallet,

    loadHistory,

    loadOrders,

    refreshAll,

    loadAdvancedWallet:
      loadWallet,

    renderPortfolio,

    setTradeAsset,

    updateTrade
  };

  window.goTo = goTo;
  window.setTradeAsset =
    setTradeAsset;

  /* =========================================================
     START
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
