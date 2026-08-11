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
