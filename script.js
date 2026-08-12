const { createClient } = window.supabase;
const supabaseClient = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);

const fallbackAssets = [
  {symbol:"BTC", name:"Bitcoin", price:67420, change:5.24, amount:0, icon:"₿"},
  {symbol:"ETH", name:"Ethereum", price:3528.40, change:3.18, amount:0, icon:"Ξ"},
  {symbol:"SOL", name:"Solana", price:182.73, change:-1.42, amount:0, icon:"S"},
  {symbol:"USDT", name:"Tether", price:1, change:0.02, amount:0, icon:"₮"}
];
let assets=[...fallbackAssets];
let history=[];
let side="buy";
let isSignup=false;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function money(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(n)||0)}
function asset(symbol){return assets.find(a=>a.symbol===symbol)||fallbackAssets.find(a=>a.symbol===symbol)}
function showToast(message){const t=$("#toast");if(!t)return;t.textContent=message;t.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove("show"),2600)}
function setAuthMessage(m){$("#authMessage").textContent=m||""}

function renderPortfolio(){
 const html=assets.map(a=>{const value=a.price*a.amount;return `<div class="asset-row"><div class="coin-icon">${a.icon||a.symbol[0]}</div><div class="asset-name"><b>${a.name}</b><span>${Number(a.amount).toFixed(6)} ${a.symbol}</span></div><div class="asset-price"><b>${money(value)}</b><span class="${a.change>=0?'positive':'negative'}">${a.change>=0?'+':''}${a.change}%</span></div></div>`}).join("");
 $("#portfolioList").innerHTML=html;$("#walletAssets").innerHTML=html;
 const total=assets.reduce((s,a)=>s+a.price*a.amount,0);
 $("#portfolioValue").textContent=money(total);
}
function renderMarkets(){
 const rows=assets.map(a=>`<div class="market-row"><div class="coin-icon">${a.icon||a.symbol[0]}</div><div class="asset-name"><b>${a.name}</b><span>${a.symbol}/USD</span></div><div class="asset-price"><b>${money(a.price)}</b><span class="${a.change>=0?'positive':'negative'}">${a.change>=0?'+':''}${a.change}%</span></div></div>`).join("");
 $("#marketPreview").innerHTML=rows;
 $("#marketTable").innerHTML=assets.map(a=>`<div class="table-row"><div class="asset-name"><b>${a.icon||a.symbol[0]} ${a.name}</b><span>${a.symbol}</span></div><b>${money(a.price)}</b><span class="${a.change>=0?'positive':'negative'}">${a.change>=0?'+':''}${a.change}%</span><button class="text-btn" onclick="goTo('trade');setTradeAsset('${a.symbol}')">Trader →</button></div>`).join("");
}
function renderHistory(){
 $("#historyTable").innerHTML=history.length?history.map(h=>`<div class="table-row history-row"><span>${h.type}</span><b>${h.symbol||"—"}</b><span>${money(h.amount_usd||0)}</span><span class="pill positive">${h.status||"Confirmé"}</span><span>${new Date(h.created_at||Date.now()).toLocaleDateString("fr-FR")}</span></div>`).join(""): `<div class="empty-state">Aucune transaction pour le moment.</div>`;
}
function goTo(page){$$('.page').forEach(p=>p.classList.remove('active'));const target=$("#page-"+page);if(target)target.classList.add('active');$$('.nav-item[data-page]').forEach(n=>n.classList.toggle('active',n.dataset.page===page));$("#sidebar").classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
function setTradeAsset(symbol){$("#tradeAsset").value=symbol;updateTrade()}
window.goTo=goTo;window.setTradeAsset=setTradeAsset;

$$('[data-page]').forEach(el=>el.addEventListener('click',()=>goTo(el.dataset.page)));
$("#menuBtn").addEventListener('click',()=>$("#sidebar").classList.toggle('open'));
$("#notificationBtn").addEventListener('click',()=>goTo('notifications'));
$("#themeToggle").addEventListener('click',()=>{document.body.classList.toggle('light');const light=document.body.classList.contains('light');$("#themeToggle").innerHTML=light?'<span>☾</span>Mode sombre':'<span>☼</span>Mode clair';localStorage.setItem('jr-theme',light?'light':'dark')});
if(localStorage.getItem('jr-theme')==='light'){document.body.classList.add('light');$("#themeToggle").innerHTML='<span>☾</span>Mode sombre'}

$("#receiveBtn").addEventListener('click',()=>$("#modal").classList.add('open'));$("#modalClose").addEventListener('click',()=>$("#modal").classList.remove('open'));$("#modal").addEventListener('click',e=>{if(e.target.id==='modal')$("#modal").classList.remove('open')});
async function copyDemoAddress(){const address='0xJRTradeDemo8f2c1A9d7A21';try{await navigator.clipboard.writeText(address);showToast('Adresse copiée.')}catch{showToast('Adresse : '+address)}}
$("#copyAddress").addEventListener('click',copyDemoAddress);$("#modalCopy").addEventListener('click',copyDemoAddress);

$$('[data-side]').forEach(btn=>btn.addEventListener('click',()=>{side=btn.dataset.side;$$('[data-side]').forEach(b=>b.classList.toggle('active',b===btn));$("#executeTrade").textContent=side==='buy'?'Confirmer l’achat':'Confirmer la vente'}));
function updateTrade(){const a=asset($("#tradeAsset").value),amount=Math.max(0,Number($("#tradeAmount").value)||0);$("#tradePrice").textContent=money(a.price);$("#tradeQuantity").textContent=`${(amount/a.price).toFixed(a.price<2?2:6)} ${a.symbol}`;$("#chartTitle").textContent=`${a.symbol} / USD`}
$("#tradeAsset").addEventListener('change',updateTrade);$("#tradeAmount").addEventListener('input',updateTrade);$$('.quick button').forEach(b=>b.addEventListener('click',()=>{$("#tradeAmount").value=b.dataset.amount;updateTrade()}));
$("#executeTrade").addEventListener('click',async()=>{const a=asset($("#tradeAsset").value),amount=Number($("#tradeAmount").value)||0;if(amount<=0)return showToast('Entrez un montant valide.');const {data:{user}}=await supabaseClient.auth.getUser();if(!user)return showToast('Connectez-vous d’abord.');const quantity=amount/a.price;const {error}=await supabaseClient.from('orders').insert({user_id:user.id,asset_id:a.id||null,side,amount_usd:amount,quantity,price_usd:a.price,status:'completed'});if(error){console.error(error);return showToast('Ordre non enregistré : '+error.message)}await supabaseClient.from('transactions').insert({user_id:user.id,asset_id:a.id||null,type:side==='buy'?'buy':'sell',amount_usd:amount,quantity,status:'completed'});await loadHistory();showToast(`${side==='buy'?'Achat':'Vente'} démo enregistré.`);goTo('history')});
$("#hideBalances").addEventListener('change',e=>{document.querySelectorAll('#portfolioValue,#profitValue').forEach(el=>el.textContent=e.target.checked?'••••••':el.dataset.value||el.textContent)});
$("#globalSearch").addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();$$('#marketTable .table-row').forEach(row=>row.style.display=row.textContent.toLowerCase().includes(q)?'':'none');if(q)goTo('markets')});

function openAuth(){$("#authModal").classList.remove('hidden');}
function closeAuth(){$("#authModal").classList.add('hidden');}
function setAuthMode(signup){isSignup=signup;$("#authTitle").textContent=signup?'Créer un compte':'Connexion';$("#authSubtitle").textContent=signup?'Créez votre compte JR Trade.':'Connectez-vous à votre compte JR Trade.';$("#authSubmit").textContent=signup?'Créer le compte':'Se connecter';$("#authSwitch").textContent=signup?'J’ai déjà un compte':'Créer un compte';$("#authUsername").style.display=signup?'block':'none';setAuthMessage('')}
$("#authSwitch").addEventListener('click',()=>setAuthMode(!isSignup));
$("#authForm").addEventListener('submit',async e=>{e.preventDefault();setAuthMessage('Chargement…');const email=$("#authEmail").value.trim();const password=$("#authPassword").value;if(isSignup){const username=$("#authUsername").value.trim();const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{username}}});if(error)return setAuthMessage(error.message);if(!data.session){setAuthMessage('Compte créé. Vérifie ton email si Supabase demande une confirmation.')}else{closeAuth();await initSession()}}else{const {error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)return setAuthMessage(error.message);closeAuth();await initSession()}});
$("#signOutBtn").addEventListener('click',async()=>{await supabaseClient.auth.signOut();location.reload()});

async function loadAssets(){const {data,error}=await supabaseClient.from('assets').select('*').order('symbol');if(error){console.warn(error);return}assets=data.map(a=>({id:a.id,symbol:a.symbol,name:a.name,price:Number(a.price_usd),change:Number(a.change_24h),amount:0,icon:a.symbol==='BTC'?'₿':a.symbol==='ETH'?'Ξ':a.symbol==='SOL'?'S':'₮'}));renderMarkets();renderPortfolio();updateTrade()}
async function loadHistory(){const {data,error}=await supabaseClient.from('transactions').select('*,assets(symbol)').order('created_at',{ascending:false});if(error){console.warn(error);history=[]}else history=(data||[]).map(x=>({type:x.type==='buy'?'Achat':x.type==='sell'?'Vente':x.type==='deposit'?'Dépôt':'Retrait',symbol:x.assets?.symbol,amount_usd:Number(x.amount_usd),status:x.status,created_at:x.created_at}));renderHistory()}
async function loadProfile(user){$("#accountEmail").textContent=user?.email||'Non connecté';$("#authEmail").value=user?.email||'';const {data}=await supabaseClient.from('profiles').select('display_name,username').eq('id',user.id).maybeSingle();const name=data?.display_name||data?.username||'JR Trade User';document.querySelector('#page-profile h1').textContent=name}
async function initSession(){const {data:{session}}=await supabaseClient.auth.getSession();if(!session){openAuth();setAuthMode(false);return}closeAuth();await loadProfile(session.user);await loadAssets();await loadHistory();}
supabaseClient.auth.onAuthStateChange((_event,session)=>{if(session)closeAuth();else openAuth()});

renderMarkets();renderPortfolio();renderHistory();updateTrade();initSession();



/* ===== JR Trade V2.1 — Dashboard + Wallet ===== */
(function () {
  let walletRefreshButton;

  function money(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  async function getClient() {
    if (window.supabaseClient) return window.supabaseClient;

    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Supabase client/configuration is not available.");
    }

    window.supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_PUBLISHABLE_KEY
    );
    return window.supabaseClient;
  }

  async function loadWallet() {
    const client = await getClient();
    setText("walletStatus", "Loading...");
    setText("walletBalance", "$0.00");

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;

    if (!user) {
      setText("walletStatus", "Sign in to view your wallet.");
      renderAssets([]);
      return;
    }

    const { data: wallet, error: walletError } = await client
      .from("wallets")
      .select("id,balance_usd,created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletError) throw walletError;

    if (!wallet) {
      setText("walletStatus", "Wallet not found yet.");
      renderAssets([]);
      return;
    }

    setText("walletBalance", money(wallet.balance_usd));
    setText("walletStatus", "Demo wallet • " + user.email);

    const { data: rows, error: assetsError } = await client
      .from("wallet_assets")
      .select("amount, asset_id, assets(symbol,name,price_usd,change_24h)")
      .eq("wallet_id", wallet.id);

    if (assetsError) throw assetsError;

    renderAssets(rows || []);
  }

  function renderAssets(rows) {
    const box = document.getElementById("walletAssets");
    if (!box) return;

    const visible = rows.filter(row => Number(row.amount || 0) > 0);

    if (!visible.length) {
      box.innerHTML = '<div class="data-muted">No crypto holdings yet. Your demo wallet is ready.</div>';
      return;
    }

    box.innerHTML = visible.map(row => {
      const a = row.assets || {};
      const amount = Number(row.amount || 0);
      const price = Number(a.price_usd || 0);
      const value = amount * price;

      return `
        <div class="asset-row">
          <div>
            <strong>${escapeHtml(a.symbol || "—")}</strong>
            <div class="data-muted">${escapeHtml(a.name || "")}</div>
          </div>
          <div class="asset-right">
            <strong>${amount.toLocaleString("en-US", {maximumFractionDigits: 8})}</strong>
            <div class="data-muted">${money(value)}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  async function initDashboardWallet() {
    walletRefreshButton = document.getElementById("refreshWalletBtn");
    if (walletRefreshButton) {
      walletRefreshButton.addEventListener("click", async () => {
        walletRefreshButton.disabled = true;
        try {
          await loadWallet();
        } catch (error) {
          console.error("Wallet refresh error:", error);
          setText("walletStatus", "Unable to load wallet.");
        } finally {
          walletRefreshButton.disabled = false;
        }
      });
    }

    try {
      await loadWallet();
    } catch (error) {
      console.error("Dashboard wallet error:", error);
      setText("walletStatus", "Unable to connect to wallet.");
    }

    const client = await getClient();
    client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setTimeout(() => loadWallet().catch(console.error), 0);
      } else {
        setText("walletBalance", "$0.00");
        setText("walletStatus", "Sign in to view your wallet.");
        renderAssets([]);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboardWallet);
  } else {
    initDashboardWallet();
  }

  window.JRTrade = window.JRTrade || {};
  window.JRTrade.loadWallet = loadWallet;
})();

/* ===== JR Trade V2.2 — Market + Demo Trading ===== */
(function(){
  let assets=[], selected=null;
  const client=()=>window.supabaseClient||(window.supabaseClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY));
  const $=id=>document.getElementById(id);
  const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(Number(n||0));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const msg=t=>{if($("tradeStatus"))$("tradeStatus").textContent=t};
  async function user(){const r=await client().auth.getUser();if(r.error)throw r.error;return r.data.user}
  async function loadMarket(){
    const r=await client().from("assets").select("id,symbol,name,price_usd,change_24h").order("symbol");
    if(r.error)throw r.error; assets=r.data||[];
    $("marketList").innerHTML=assets.map(a=>`<button class="market-row" data-id="${esc(a.id)}"><div><strong>${esc(a.symbol)}</strong><div class="data-muted">${esc(a.name)}</div></div><div class="market-right"><strong>${money(a.price_usd)}</strong><div>${Number(a.change_24h||0)>=0?"+":""}${Number(a.change_24h||0).toFixed(2)}%</div></div></button>`).join("")||'<div class="data-muted">No assets available.</div>';
    document.querySelectorAll(".market-row").forEach(b=>b.onclick=()=>select(b.dataset.id));
    if(!selected&&assets[0])select(assets[0].id);
  }
  function select(id){selected=assets.find(a=>a.id===id)||null;if(!selected)return;$("selectedAssetLabel").textContent=`${selected.name} (${selected.symbol})`;$("selectedAssetPrice").textContent=money(selected.price_usd);preview();msg(`Ready to trade ${selected.symbol} in demo mode.`)}
  function preview(){const usd=Number($("tradeUsd")?.value||0),p=Number(selected?.price_usd||0);$("tradeQuantityPreview").textContent=`Quantity: ${p? (usd/p).toLocaleString("en-US",{maximumFractionDigits:8}):"0"}`}
  async function trade(){
    const u=await user();if(!u)throw Error("Please sign in first.");if(!selected)throw Error("Select an asset first.");
    const side=$("tradeSide").value,usd=Number($("tradeUsd").value),price=Number(selected.price_usd);
    if(!usd||usd<=0)throw Error("Enter a valid USD amount.");const qty=usd/price;
    const w=await client().from("wallets").select("id,balance_usd").eq("user_id",u.id).maybeSingle();if(w.error)throw w.error;if(!w.data)throw Error("Wallet not found.");
    let h=await client().from("wallet_assets").select("id,amount").eq("wallet_id",w.data.id).eq("asset_id",selected.id).maybeSingle();if(h.error)throw h.error;
    const bal=Number(w.data.balance_usd||0), old=Number(h.data?.amount||0);
    if(side==="buy"&&usd>bal)throw Error(`Insufficient demo balance. Available: ${money(bal)}`);
    if(side==="sell"&&qty>old+1e-12)throw Error(`Insufficient ${selected.symbol} balance.`);
    const nb=side==="buy"?bal-usd:bal+usd, na=side==="buy"?old+qty:old-qty;
    let r=await client().from("wallets").update({balance_usd:nb}).eq("id",w.data.id).eq("user_id",u.id);if(r.error)throw r.error;
    if(h.data)r=await client().from("wallet_assets").update({amount:Math.max(0,na)}).eq("id",h.data.id);
    else r=await client().from("wallet_assets").insert({wallet_id:w.data.id,asset_id:selected.id,amount:na});
    if(r.error)throw r.error;
    r=await client().from("orders").insert({user_id:u.id,asset_id:selected.id,side,amount_usd:usd,quantity:qty,price_usd:price,status:"completed"});if(r.error)throw r.error;
    r=await client().from("transactions").insert({user_id:u.id,asset_id:selected.id,type:side,amount_usd:usd,quantity:qty,status:"completed"});if(r.error)throw r.error;
    $("tradeUsd").value="";preview();msg(`${side==="buy"?"Bought":"Sold"} ${qty.toLocaleString("en-US",{maximumFractionDigits:8})} ${selected.symbol} for ${money(usd)}.`);
    if(window.JRTrade?.loadWallet)await window.JRTrade.loadWallet();await orders();
  }
  async function orders(){
    const u=await user(),box=$("ordersList");if(!u){box.textContent="Sign in to view your orders.";return}
    const r=await client().from("orders").select("id,side,amount_usd,quantity,price_usd,status,created_at,assets(symbol)").eq("user_id",u.id).order("created_at",{ascending:false}).limit(10);
    if(r.error)throw r.error;box.innerHTML=r.data?.length?r.data.map(o=>`<div class="order-row"><div><strong>${esc(o.side.toUpperCase())} ${esc(o.assets?.symbol||"")}</strong><div class="data-muted">${new Date(o.created_at).toLocaleString()}</div></div><div class="order-right"><strong>${money(o.amount_usd)}</strong><div class="data-muted">${Number(o.quantity).toLocaleString("en-US",{maximumFractionDigits:8})}</div></div></div>`).join(""):'<div class="data-muted">No demo orders yet.</div>';
  }
  async function init(){ $("tradeUsd")?.addEventListener("input",preview);$("executeTradeBtn")?.addEventListener("click",async()=>{ $("executeTradeBtn").disabled=true;msg("Processing demo trade...");try{await trade()}catch(e){console.error(e);msg(e.message||"Trade failed.")}finally{$("executeTradeBtn").disabled=false}});$("refreshMarketBtn")?.addEventListener("click",async()=>{try{await loadMarket();await orders()}catch(e){msg("Unable to refresh market.")}});try{await loadMarket();await orders()}catch(e){console.error(e);msg("Unable to load market.")}}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();

/* ===== JR Trade V2.3 — Advanced Dashboard + Wallet ===== */
(function(){
  const client=()=>window.supabaseClient||(window.supabaseClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY));
  const money2=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n||0));
  const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  const pct=(n)=>`${Number(n||0)>=0?'+':''}${Number(n||0).toFixed(2)}%`;
  const icon=s=>s==='BTC'?'₿':s==='ETH'?'Ξ':s==='SOL'?'S':'₮';
  async function getData(){
    const c=client(); const ur=await c.auth.getUser(); if(ur.error)throw ur.error; const user=ur.data.user;
    if(!user)return {user:null,wallet:null,rows:[]};
    const wr=await c.from('wallets').select('id,balance_usd').eq('user_id',user.id).maybeSingle(); if(wr.error)throw wr.error;
    if(!wr.data)return {user,wallet:null,rows:[]};
    const ar=await c.from('wallet_assets').select('amount,asset_id,assets(symbol,name,price_usd,change_24h)').eq('wallet_id',wr.data.id); if(ar.error)throw ar.error;
    return {user,wallet:wr.data,rows:ar.data||[]};
  }
  function render(rows,wallet){
    const cash=Number(wallet?.balance_usd||0); const items=rows.map(r=>{const a=r.assets||{};const amount=Number(r.amount||0),price=Number(a.price_usd||0),value=amount*price,change=Number(a.change_24h||0);return {...a,amount,value,change}}).filter(x=>x.amount>0);
    const crypto=items.reduce((s,x)=>s+x.value,0), total=cash+crypto, pnl=items.reduce((s,x)=>s+x.value*x.change/100,0), base=total||1;
    const active=items.filter(x=>x.value>0); const syms=active.map(x=>x.symbol).join(' · ')||'Aucun actif';
    set('portfolioValue',money2(total));set('portfolioMGA',`≈ ${Math.round(total*2400).toLocaleString('fr-FR')} MGA`);set('profitValue',`${pnl>=0?'+':''}${money2(pnl)}`);set('portfolioChange',pct(total?100*pnl/total:0));
    set('assetCount',String(active.length));set('assetCountLarge',`${active.length} crypto`);set('assetSymbols',syms);set('walletTotalAdvanced',money2(total));set('walletCashAdvanced',`Liquidités : ${money2(cash)}`);set('walletCryptoAdvanced',money2(crypto));set('walletPnLAdvanced',`${pnl>=0?'+':''}${money2(pnl)}`);set('walletCashMini',money2(cash));set('walletAssetCount',`${active.length} actif${active.length>1?'s':''}`);set('cashValue',money2(cash));set('cryptoValue',money2(crypto));set('performance24h',`${pnl>=0?'+':''}${money2(pnl)}`);
    const fill=document.getElementById('performanceBarFill');if(fill)fill.style.width=`${Math.min(100,Math.max(8,50+(pnl/Math.max(total,1))*500))}%`;
    const makeList=(id)=>{const box=document.getElementById(id);if(!box)return;if(!active.length){box.innerHTML='<div class="data-muted">Aucun actif détenu pour le moment.</div>';return}box.innerHTML=active.map(x=>{const share=100*x.value/base;return `<div class="allocation-item"><div><div class="allocation-head"><strong>${icon(x.symbol)} ${esc2(x.symbol)}</strong><span>${share.toFixed(1)}%</span></div><div class="data-muted">${esc2(x.name)} · ${x.amount.toLocaleString('en-US',{maximumFractionDigits:8})}</div><div class="allocation-track"><div class="allocation-fill" style="width:${Math.min(100,share)}%"></div></div></div><strong>${money2(x.value)}</strong></div>`}).join('')};
    makeList('allocationList');makeList('walletAllocation');
  }
  async function loadAdvanced(){try{const d=await getData();if(!d.user){render([],null);return}render(d.rows,d.wallet)}catch(e){console.error('Advanced wallet:',e)}}
  window.JRTrade=window.JRTrade||{};window.JRTrade.loadAdvancedWallet=loadAdvanced;
  const start=()=>{loadAdvanced();document.getElementById('refreshAdvancedBtn')?.addEventListener('click',loadAdvanced);const c=client();c.auth.onAuthStateChange(()=>setTimeout(loadAdvanced,0))};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
