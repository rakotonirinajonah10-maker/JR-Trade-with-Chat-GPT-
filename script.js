const assets = [
  {symbol:"BTC", name:"Bitcoin", price:67420, change:5.24, amount:0.215, icon:"₿"},
  {symbol:"ETH", name:"Ethereum", price:3528.40, change:3.18, amount:2.84, icon:"Ξ"},
  {symbol:"SOL", name:"Solana", price:182.73, change:-1.42, amount:18.5, icon:"S"},
  {symbol:"USDT", name:"Tether", price:1, change:0.02, amount:4820, icon:"₮"}
];

const history = [
  {type:"Achat", symbol:"BTC", amount:"$1,000.00", status:"Confirmé", date:"11 août 2026"},
  {type:"Achat", symbol:"ETH", amount:"$500.00", status:"Confirmé", date:"10 août 2026"},
  {type:"Vente", symbol:"SOL", amount:"$250.00", status:"Confirmé", date:"09 août 2026"},
  {type:"Dépôt", symbol:"USDT", amount:"$2,000.00", status:"Confirmé", date:"08 août 2026"}
];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function money(n){ return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n); }
function asset(symbol){ return assets.find(a=>a.symbol===symbol); }

function showToast(message){
  const t=$("#toast"); t.textContent=message; t.classList.add("show");
  clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>t.classList.remove("show"),2600);
}

function renderPortfolio(){
  const html=assets.map(a=>{
    const value=a.price*a.amount;
    return `<div class="asset-row">
      <div class="coin-icon">${a.icon}</div>
      <div class="asset-name"><b>${a.name}</b><span>${a.amount} ${a.symbol}</span></div>
      <div class="asset-price"><b>${money(value)}</b><span class="${a.change>=0?'positive':''}">${a.change>=0?'+':''}${a.change}%</span></div>
    </div>`;
  }).join("");
  $("#portfolioList").innerHTML=html;
  $("#walletAssets").innerHTML=html;
}

function renderMarkets(){
  const rows=assets.map(a=>`<div class="market-row">
    <div class="coin-icon">${a.icon}</div>
    <div class="asset-name"><b>${a.name}</b><span>${a.symbol}/USD</span></div>
    <div class="asset-price"><b>${money(a.price)}</b><span class="${a.change>=0?'positive':'negative'}">${a.change>=0?'+':''}${a.change}%</span></div>
  </div>`).join("");
  $("#marketPreview").innerHTML=rows;

  $("#marketTable").innerHTML=assets.map(a=>`<div class="table-row">
    <div class="asset-name"><b>${a.icon} ${a.name}</b><span>${a.symbol}</span></div>
    <b>${money(a.price)}</b>
    <span class="${a.change>=0?'positive':''}">${a.change>=0?'+':''}${a.change}%</span>
    <button class="text-btn" onclick="goTo('trade'); setTradeAsset('${a.symbol}')">Trader →</button>
  </div>`).join("");
}

function renderHistory(){
  $("#historyTable").innerHTML=history.map(h=>`<div class="table-row history-row">
    <span>${h.type}</span><b>${h.symbol}</b><span>${h.amount}</span><span class="pill positive">${h.status}</span><span>${h.date}</span>
  </div>`).join("");
}

function goTo(page){
  $$(".page").forEach(p=>p.classList.remove("active"));
  const target=$("#page-"+page); if(target) target.classList.add("active");
  $$(".nav-item[data-page]").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  $("#sidebar").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
}
function setTradeAsset(symbol){
  $("#tradeAsset").value=symbol; updateTrade();
}

$$("[data-page]").forEach(el=>el.addEventListener("click",()=>goTo(el.dataset.page)));
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#notificationBtn").addEventListener("click",()=>goTo("notifications"));

$("#themeToggle").addEventListener("click",()=>{
  document.body.classList.toggle("light");
  $("#themeToggle").innerHTML=document.body.classList.contains("light")?"<span>☾</span>Mode sombre":"<span>☼</span>Mode clair";
  localStorage.setItem("jr-theme",document.body.classList.contains("light")?"light":"dark");
});
if(localStorage.getItem("jr-theme")==="light"){
  document.body.classList.add("light");
  $("#themeToggle").innerHTML="<span>☾</span>Mode sombre";
}

$("#receiveBtn").addEventListener("click",()=>$("#modal").classList.add("open"));
$("#modalClose").addEventListener("click",()=>$("#modal").classList.remove("open"));
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal") $("#modal").classList.remove("open")});
$("#copyAddress").addEventListener("click",()=>copyDemoAddress());
$("#modalCopy").addEventListener("click",()=>copyDemoAddress());

async function copyDemoAddress(){
  const address="0xJRTradeDemo8f2c1A9d7A21";
  try{await navigator.clipboard.writeText(address);showToast("Adresse copiée.");}
  catch{showToast("Adresse : "+address);}
}

let side="buy";
$$("[data-side]").forEach(btn=>btn.addEventListener("click",()=>{
  side=btn.dataset.side;
  $$("[data-side]").forEach(b=>b.classList.toggle("active",b===btn));
  $("#executeTrade").textContent=side==="buy"?"Confirmer l'achat":"Confirmer la vente";
}));

function updateTrade(){
  const a=asset($("#tradeAsset").value), amount=Math.max(0,Number($("#tradeAmount").value)||0);
  $("#tradePrice").textContent=money(a.price);
  $("#tradeQuantity").textContent=`${(amount/a.price).toFixed(a.price<2?2:6)} ${a.symbol}`;
  $("#chartTitle").textContent=`${a.symbol} / USD`;
}
$("#tradeAsset").addEventListener("change",updateTrade);
$("#tradeAmount").addEventListener("input",updateTrade);
$$(".quick button").forEach(b=>b.addEventListener("click",()=>{$("#tradeAmount").value=b.dataset.amount;updateTrade()}));

$("#executeTrade").addEventListener("click",()=>{
  const a=asset($("#tradeAsset").value), amount=Number($("#tradeAmount").value)||0;
  if(amount<=0) return showToast("Entrez un montant valide.");
  history.unshift({type:side==="buy"?"Achat":"Vente",symbol:a.symbol,amount:money(amount),status:"Confirmé",date:"Aujourd'hui"});
  renderHistory();
  showToast(`${side==="buy"?"Achat":"Vente"} démo de ${money(amount)} enregistré.`);
  goTo("history");
});

$("#hideBalances").addEventListener("change",e=>{
  document.querySelectorAll("#portfolioValue,#profitValue").forEach(el=>el.textContent=e.target.checked?"••••••":"");
  if(!e.target.checked){$("#portfolioValue").textContent="$24,680.42";$("#profitValue").textContent="+$1,924.60";}
});

$("#globalSearch").addEventListener("input",e=>{
  const q=e.target.value.toLowerCase().trim();
  $$("#marketTable .table-row").forEach(row=>row.style.display=row.textContent.toLowerCase().includes(q)?"":"none");
  if(q) goTo("markets");
});

renderPortfolio(); renderMarkets(); renderHistory(); updateTrade();
