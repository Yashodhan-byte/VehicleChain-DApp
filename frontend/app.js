/**
 * VehicleChain DApp — Interactive Web3.js Frontend
 * Automotive Rental Theme with MetaMask + Ethereum Smart Contract
 */

// ─────────────────────────────────────────────────────────────────
// ⚠️  UPDATE AFTER REMIX DEPLOYMENT
// ─────────────────────────────────────────────────────────────────
const CONTRACT_ADDRESS  = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"; // ← Paste your deployed address
const SEPOLIA_CHAIN_ID  = "0xaa36a7";
const ETHERSCAN_BASE    = "https://sepolia.etherscan.io";

const CONTRACT_ABI = [
  { "inputs":[],"stateMutability":"nonpayable","type":"constructor" },
  { "anonymous":false,"inputs":[{"indexed":true,"internalType":"string","name":"vehicleId","type":"string"},{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"OwnershipTransferred","type":"event" },
  { "anonymous":false,"inputs":[{"indexed":true,"internalType":"string","name":"vehicleId","type":"string"},{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"VehicleRegistered","type":"event" },
  { "inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"string","name":"_vehicleId","type":"string"}],"name":"getCurrentOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"string","name":"_vehicleId","type":"string"}],"name":"getOwnershipCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"string","name":"_vehicleId","type":"string"}],"name":"getOwnershipHistory","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"string","name":"_vehicleId","type":"string"}],"name":"getVehicleDetails","outputs":[{"internalType":"string","name":"vehicleId","type":"string"},{"internalType":"string","name":"model","type":"string"},{"internalType":"uint256","name":"year","type":"uint256"},{"internalType":"address","name":"currentOwner","type":"address"},{"internalType":"uint256","name":"registrationDate","type":"uint256"}],"stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"string","name":"_vehicleId","type":"string"}],"name":"isVehicleRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"string","name":"_vehicleId","type":"string"},{"internalType":"string","name":"_model","type":"string"},{"internalType":"uint256","name":"_year","type":"uint256"},{"internalType":"address","name":"_owner","type":"address"}],"name":"registerVehicle","outputs":[],"stateMutability":"nonpayable","type":"function" },
  { "inputs":[{"internalType":"string","name":"_vehicleId","type":"string"},{"internalType":"address","name":"_newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function" },
  { "inputs":[{"internalType":"string","name":"","type":"string"}],"name":"vehicles","outputs":[{"internalType":"string","name":"vehicleId","type":"string"},{"internalType":"string","name":"model","type":"string"},{"internalType":"uint256","name":"year","type":"uint256"},{"internalType":"address","name":"currentOwner","type":"address"},{"internalType":"uint256","name":"registrationDate","type":"uint256"},{"internalType":"bool","name":"exists","type":"bool"}],"stateMutability":"view","type":"function" }
];

// ─────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────
let web3, contract;
let currentAccount = null;
let adminAddress   = null;
let knownVehicles  = [];   // local vehicle cache from events + manual lookups
let eventLogs      = [];
let stats          = { registered: 0, transfers: 0 };

// Car emojis mapped to vehicle categories
const CAR_EMOJIS = ["🚗","🚕","🚙","🏎️","🚓","🚑","🚒","🚐","🛻","🚌","🛺","🚘"];

function getCarEmoji(model = "") {
  const m = model.toLowerCase();
  if (m.includes("truck") || m.includes("pickup")) return "🛻";
  if (m.includes("bus"))    return "🚌";
  if (m.includes("sport") || m.includes("ferrari") || m.includes("lambo") || m.includes("porsche")) return "🏎️";
  if (m.includes("suv") || m.includes("jeep") || m.includes("toyota") || m.includes("land")) return "🚙";
  if (m.includes("taxi"))   return "🚕";
  const idx = Math.abs([...model].reduce((a,c) => a + c.charCodeAt(0), 0)) % CAR_EMOJIS.length;
  return CAR_EMOJIS[idx];
}

// ─────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  renderVehicleGrid();
  renderEventFeed();

  if (typeof window.ethereum === "undefined") {
    document.getElementById("connect-btn").textContent = "Install MetaMask 🦊";
    document.getElementById("connect-btn").onclick = () =>
      window.open("https://metamask.io/download/", "_blank");
    toast("warning","MetaMask Not Found","Install MetaMask to interact with the blockchain.");
    return;
  }

  web3 = new Web3(window.ethereum);

  // Auto-reconnect
  window.ethereum.request({ method:"eth_accounts" }).then(accs => {
    if (accs.length) onConnect(accs[0]);
  });
  window.ethereum.on("accountsChanged", accs => accs.length ? onConnect(accs[0]) : onDisconnect());
  window.ethereum.on("chainChanged", () => location.reload());
});

// ─────────────────────────────────────────────────────────────────
// WALLET
// ─────────────────────────────────────────────────────────────────
async function connectWallet() {
  if (!window.ethereum) return toast("error","MetaMask Required","Please install MetaMask.");
  try {
    setConnectBtnLoading(true);
    await switchToSepolia();
    const accs = await window.ethereum.request({ method:"eth_requestAccounts" });
    await onConnect(accs[0]);
  } catch(e) {
    console.error(e);
    toast("error","Connection Failed", e.message || "User rejected.");
  } finally {
    setConnectBtnLoading(false);
  }
}

async function switchToSepolia() {
  try {
    await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{chainId:SEPOLIA_CHAIN_ID}] });
  } catch(e) {
    if (e.code === 4902) {
      await window.ethereum.request({ method:"wallet_addEthereumChain", params:[{
        chainId: SEPOLIA_CHAIN_ID,
        chainName: "Sepolia Testnet",
        nativeCurrency: { name:"SepoliaETH", symbol:"ETH", decimals:18 },
        rpcUrls: ["https://rpc.sepolia.org"],
        blockExplorerUrls: ["https://sepolia.etherscan.io"]
      }]});
    } else throw e;
  }
}

async function onConnect(account) {
  currentAccount = account;
  web3 = new Web3(window.ethereum);

  if (isContractConfigured()) {
    contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
    try { adminAddress = await contract.methods.admin().call(); } catch(e) {}
    subscribeEvents();
    // Try to load historical events
    loadPastEvents();
  }

  updateWalletUI();
  renderVehicleGrid();
  toast("success","Wallet Connected 🦊", `${shortAddr(account)}`);
}

function onDisconnect() {
  currentAccount = null;
  adminAddress   = null;
  updateWalletUI();
  renderVehicleGrid();
  toast("info","Disconnected","Wallet disconnected.");
}

function updateWalletUI() {
  const btn  = document.getElementById("connect-btn");
  const pill = document.getElementById("wallet-pill");
  const addr = document.getElementById("wallet-addr");
  const adminBadge  = document.getElementById("admin-badge");
  const adminBadge2 = document.getElementById("admin-badge-2");

  if (currentAccount) {
    btn.style.display  = "none";
    pill.style.display = "flex"; /* show wallet pill */
    addr.textContent   = shortAddr(currentAccount);
    const isAdmin = adminAddress && currentAccount.toLowerCase() === adminAddress.toLowerCase();
    const showAdmin = isAdmin ? "inline-flex" : "none";
    if (adminBadge)  adminBadge.style.display  = showAdmin;
    if (adminBadge2) adminBadge2.style.display = showAdmin;
    const footerEl = document.getElementById("footer-addr");
    if (footerEl) footerEl.textContent = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000"
      ? CONTRACT_ADDRESS : "Not yet configured";
  } else {
    btn.style.display  = "flex";
    pill.style.display = "none";
    if (adminBadge)  adminBadge.style.display  = "none";
    if (adminBadge2) adminBadge2.style.display = "none";
  }
}

function setConnectBtnLoading(v) {
  const btn = document.getElementById("connect-btn");
  btn.innerHTML = v
    ? `<span style="width:16px;height:16px;border:2px solid rgba(0,0,0,0.3);border-top-color:#000;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;"></span> Connecting…`
    : `🦊 Connect MetaMask`;
  btn.disabled = v;
}

// ─────────────────────────────────────────────────────────────────
// VEHICLE GRID
// ─────────────────────────────────────────────────────────────────
function renderVehicleGrid(filter = "") {
  const grid = document.getElementById("fleet-grid");
  const filtered = knownVehicles.filter(v =>
    !filter ||
    v.vehicleId.toLowerCase().includes(filter.toLowerCase()) ||
    v.model.toLowerCase().includes(filter.toLowerCase())
  );

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🚗</span>
        <div class="empty-title">${knownVehicles.length ? "No matches found" : "No vehicles on-chain yet"}</div>
        <div class="empty-desc">${
          !currentAccount
            ? "Connect your MetaMask wallet to get started."
            : knownVehicles.length
              ? "Try a different search."
              : isAdmin() ? "Register the first vehicle using the panel below!" : "Admin can register vehicles to appear here."
        }</div>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(v => vehicleCardHTML(v)).join("");
}

function vehicleCardHTML(v) {
  const emoji = getCarEmoji(v.model);
  const isMine = currentAccount && v.currentOwner &&
    v.currentOwner.toLowerCase() === currentAccount.toLowerCase();
  return `
    <div class="v-card" onclick="openVehicleDetail('${v.vehicleId}')">
      <div class="v-card-img">
        <div class="v-card-img-bg">${v.year || ""}</div>
        <div class="v-card-emoji">${emoji}</div>
        <span class="v-card-status ${isMine ? "status-mine" : "status-available"}">
          ${isMine ? "⭐ Yours" : "● Active"}
        </span>
      </div>
      <div class="v-card-body">
        <div class="v-card-model">${v.model || "Unknown Model"}</div>
        <div class="v-card-meta">
          <span>${v.year || "—"}</span>
          <span class="dot">·</span>
          <span>${v.vehicleId}</span>
        </div>
        <div class="v-card-owner">
          <div class="owner-orb"></div>
          <div>
            <div class="owner-lbl">Current Owner</div>
            <div class="owner-addr">${shortAddr(v.currentOwner)}</div>
          </div>
        </div>
        <div class="v-card-actions">
          <button class="btn-v-primary" onclick="event.stopPropagation(); openVehicleDetail('${v.vehicleId}')">
            🔍 View Details
          </button>
          ${isMine
            ? `<button class="btn-v-secondary" onclick="event.stopPropagation(); openTransferModal('${v.vehicleId}')">🔄 Transfer</button>`
            : `<button class="btn-v-secondary" onclick="event.stopPropagation(); openQueryModal('${v.vehicleId}')">📋 History</button>`
          }
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// REGISTER VEHICLE
// ─────────────────────────────────────────────────────────────────
async function registerVehicle() {
  if (!checkReady()) return;

  const vehicleId = v("reg-id");
  const model     = v("reg-model");
  const year      = parseInt(v("reg-year"));
  const owner     = v("reg-owner");

  if (!vehicleId || !model || !year || !owner)
    return toast("warning","Missing Fields","Please fill in all fields.");
  if (!web3.utils.isAddress(owner))
    return toast("error","Invalid Address","Owner address is not a valid Ethereum address.");

  const btn = document.getElementById("reg-btn");
  setBtnLoading(btn, true, true);

  try {
    const tx = await contract.methods
      .registerVehicle(vehicleId, model, year, owner)
      .send({ from: currentAccount });

    // Add to local cache immediately
    addOrUpdateVehicle({ vehicleId, model, year: year.toString(), currentOwner: owner });
    stats.registered++;
    syncStats();

    toast("success","Vehicle Registered! 🎉",`${vehicleId} is now on-chain. TX: ${shortAddr(tx.transactionHash)}`);
    addEvent("reg", { vehicleId, owner, txHash: tx.transactionHash, blockNumber: tx.blockNumber });

    // Clear fields
    ["reg-id","reg-model","reg-year","reg-owner"].forEach(id => { document.getElementById(id).value = ""; });
    renderVehicleGrid();
  } catch(e) {
    console.error(e);
    toast("error","Registration Failed", parseErr(e));
  } finally {
    setBtnLoading(btn, false, true);
  }
}

// ─────────────────────────────────────────────────────────────────
// TRANSFER OWNERSHIP
// ─────────────────────────────────────────────────────────────────
async function transferOwnership() {
  if (!checkReady()) return;

  const vehicleId = v("tx-id");
  const newOwner  = v("tx-owner");

  if (!vehicleId || !newOwner)
    return toast("warning","Missing Fields","Fill in both Vehicle ID and new owner address.");
  if (!web3.utils.isAddress(newOwner))
    return toast("error","Invalid Address","New owner is not a valid Ethereum address.");

  const btn = document.getElementById("tx-btn");
  setBtnLoading(btn, true, false);

  try {
    const tx = await contract.methods
      .transferOwnership(vehicleId, newOwner)
      .send({ from: currentAccount });

    // Update local cache
    const veh = knownVehicles.find(x => x.vehicleId === vehicleId);
    if (veh) veh.currentOwner = newOwner;
    stats.transfers++;
    syncStats();

    toast("success","Ownership Transferred! 🔄",`${vehicleId} → ${shortAddr(newOwner)}`);
    addEvent("tx", { vehicleId, from: currentAccount, to: newOwner, txHash: tx.transactionHash, blockNumber: tx.blockNumber });

    ["tx-id","tx-owner"].forEach(id => { document.getElementById(id).value = ""; });
    closeModal("transfer-modal");
    renderVehicleGrid();
  } catch(e) {
    console.error(e);
    toast("error","Transfer Failed", parseErr(e));
  } finally {
    setBtnLoading(btn, false, false);
  }
}

// ─────────────────────────────────────────────────────────────────
// QUERY VEHICLE
// ─────────────────────────────────────────────────────────────────
async function queryVehicle() {
  if (!checkReady()) return;

  const vehicleId = v("query-id");
  if (!vehicleId) return toast("warning","Input Required","Enter a Vehicle ID.");

  const btn = document.getElementById("query-btn");
  setBtnLoading(btn, true, false);

  try {
    const [details, history] = await Promise.all([
      contract.methods.getVehicleDetails(vehicleId).call(),
      contract.methods.getOwnershipHistory(vehicleId).call()
    ]);

    // Update/add to cache
    addOrUpdateVehicle({
      vehicleId: details.vehicleId,
      model: details.model,
      year: details.year.toString(),
      currentOwner: details.currentOwner
    });

    renderVehicleGrid();
    renderDetailView(details, history);
    toast("success","Vehicle Found","Details loaded successfully.");
  } catch(e) {
    console.error(e);
    document.getElementById("query-result").innerHTML = "";
    toast("error","Query Failed", parseErr(e));
  } finally {
    setBtnLoading(btn, false, false);
  }
}

function renderDetailView(d, history) {
  const emoji = getCarEmoji(d.model);
  const regDate = new Date(Number(d.registrationDate) * 1000).toLocaleDateString("en-US", {
    year:"numeric", month:"short", day:"numeric"
  });
  const ownerCount = history.length;
  const isMine = currentAccount &&
    d.currentOwner.toLowerCase() === currentAccount.toLowerCase();

  const timelineHTML = history.map((addr, i) => {
    const isFirst   = i === 0;
    const isCurrent = i === history.length - 1;
    const cls = isCurrent ? "tl-current" : isFirst ? "tl-first" : "tl-mid";
    const role = isFirst && isCurrent ? "Original & Current Owner"
               : isFirst ? "Original Owner"
               : isCurrent ? "Current Owner" : `Owner #${i+1}`;
    return `
      <div class="tl-item">
        <div class="tl-num ${cls}">${i+1}</div>
        <div class="tl-body">
          <div class="tl-addr">${addr}</div>
          <div class="tl-role">${role}</div>
        </div>
        ${isCurrent ? `<span class="tl-cur-badge">● Current</span>` : ""}
        <a href="${ETHERSCAN_BASE}/address/${addr}" target="_blank" class="tx-link" onclick="event.stopPropagation()">↗</a>
      </div>`;
  }).join("");

  document.getElementById("query-result").innerHTML = `
    <div class="detail-card">
      <div class="detail-hero-img">
        <div class="detail-bg-yr">${d.year}</div>
        <div class="detail-emoji">${emoji}</div>
      </div>
      <div class="detail-body">
        <div class="detail-top">
          <div>
            <div class="detail-name">${d.model}</div>
            <div class="detail-id">ID: ${d.vehicleId}</div>
          </div>
          <div class="detail-acts">
            <a href="${ETHERSCAN_BASE}/address/${d.currentOwner}" target="_blank" class="tx-link">Etherscan ↗</a>
            ${isMine ? `<button class="btn btn-amber" style="padding:8px 16px;font-size:13px;" onclick="openTransferModal('${d.vehicleId}')">🔄 Transfer</button>` : ""}
          </div>
        </div>
        <div class="detail-meta-row">
          <div class="d-meta">
            <div class="d-meta-lbl">Year</div>
            <div class="d-meta-val amber">${d.year}</div>
          </div>
          <div class="d-meta">
            <div class="d-meta-lbl">Owners</div>
            <div class="d-meta-val amber">${ownerCount}</div>
          </div>
          <div class="d-meta">
            <div class="d-meta-lbl">Registered</div>
            <div class="d-meta-val" style="font-size:13px;">${regDate}</div>
          </div>
        </div>
        <div class="d-section-lbl">Current Owner</div>
        <div class="d-owner-row" style="margin-bottom:22px;">
          <div class="d-owner-orb"></div>
          <div class="d-owner-addr">${d.currentOwner}</div>
        </div>
        <div class="d-section-lbl">Ownership Timeline (${ownerCount} record${ownerCount !== 1 ? "s" : ""})</div>
        <div class="timeline">${timelineHTML}</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  document.body.style.overflow = "";
}

function openTransferModal(vehicleId) {
  const veh = knownVehicles.find(v => v.vehicleId === vehicleId);
  const emoji = getCarEmoji(veh?.model || "");
  document.getElementById("modal-tx-vehicle-name").textContent  = veh?.model || vehicleId;
  document.getElementById("modal-tx-vehicle-emoji").textContent = emoji;
  document.getElementById("modal-tx-vehicle-meta").textContent  = `${veh?.year || "—"} · ${vehicleId}`;
  document.getElementById("modal-tx-id").value = vehicleId;
  document.getElementById("modal-tx-owner").value = "";
  document.getElementById("tx-id").value = vehicleId;
  openModal("transfer-modal");
}

function openQueryModal(vehicleId) {
  document.getElementById("query-id").value = vehicleId;
  document.getElementById("query-sec").scrollIntoView({ behavior:"smooth" });
  setTimeout(queryVehicle, 400);
}

function openVehicleDetail(vehicleId) {
  document.getElementById("query-id").value = vehicleId;
  document.getElementById("query-sec").scrollIntoView({ behavior:"smooth" });
  if (isContractConfigured() && currentAccount) {
    setTimeout(queryVehicle, 400);
  }
}

async function submitModalTransfer() {
  const vehicleId = document.getElementById("modal-tx-id").value;
  const newOwner  = document.getElementById("modal-tx-owner").value.trim();

  if (!newOwner) return toast("warning","Missing Address","Enter the new owner's address.");
  if (!web3.utils.isAddress(newOwner)) return toast("error","Invalid Address","Not a valid Ethereum address.");

  // Set values and call main transfer
  document.getElementById("tx-id").value    = vehicleId;
  document.getElementById("tx-owner").value = newOwner;
  closeModal("transfer-modal");
  await transferOwnership();
}

// ─────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────
function subscribeEvents() {
  if (!contract) return;
  try {
    contract.events.VehicleRegistered({ fromBlock:"latest" })
      .on("data", e => {
        stats.registered++;
        syncStats();
        addEvent("reg", { vehicleId: e.returnValues.vehicleId, owner: e.returnValues.owner, txHash: e.transactionHash, blockNumber: e.blockNumber });
      });
    contract.events.OwnershipTransferred({ fromBlock:"latest" })
      .on("data", e => {
        stats.transfers++;
        syncStats();
        addEvent("tx", { vehicleId: e.returnValues.vehicleId, from: e.returnValues.from, to: e.returnValues.to, txHash: e.transactionHash, blockNumber: e.blockNumber });
      });
  } catch(e) { console.warn("Event subscription failed:", e); }
}

async function loadPastEvents() {
  if (!contract) return;
  try {
    const regEvents = await contract.getPastEvents("VehicleRegistered", { fromBlock: 0, toBlock: "latest" });
    for (const e of regEvents) {
      const vid = e.returnValues.vehicleId;
      try {
        const det = await contract.methods.getVehicleDetails(vid).call();
        addOrUpdateVehicle({ vehicleId: det.vehicleId, model: det.model, year: det.year.toString(), currentOwner: det.currentOwner });
      } catch(_) {}
    }
    stats.registered = regEvents.length;
    const txEvents = await contract.getPastEvents("OwnershipTransferred", { fromBlock: 0, toBlock: "latest" });
    stats.transfers = txEvents.length;
    syncStats();
    renderVehicleGrid();
  } catch(e) { console.warn("Could not load past events:", e); }
}

function addEvent(type, data) {
  eventLogs.unshift({ type, data, ts: new Date() });
  renderEventFeed();
}

function renderEventFeed() {
  const el = document.getElementById("event-feed");
  if (!eventLogs.length) {
    el.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;">
        <div class="empty-icon" style="font-size:40px;">📡</div>
        <div class="empty-title">No events yet</div>
        <div class="empty-desc">Events will appear here when vehicles are registered or transferred.</div>
      </div>`;
    return;
  }
  el.innerHTML = eventLogs.map(({ type, data, ts }) => {
    const isReg = type === "reg";
    return `
      <div class="event-entry" onclick="openEtherscan('tx','${data.txHash}')">
        <div class="event-entry-icon ${isReg ? "reg" : "tx"}">${isReg ? "🚘" : "🔄"}</div>
        <div class="event-entry-body">
          <div class="event-entry-title">${isReg ? "Vehicle Registered" : "Ownership Transferred"} — <strong>${data.vehicleId}</strong></div>
          <div class="event-entry-sub">${isReg ? `Owner: ${data.owner}` : `${shortAddr(data.from)} → ${shortAddr(data.to)}`}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
          <span class="event-entry-time">${ts.toLocaleTimeString()}</span>
          ${data.blockNumber ? `<span class="event-block-badge">blk ${data.blockNumber}</span>` : ""}
        </div>
      </div>`;
  }).join("");
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function addOrUpdateVehicle(veh) {
  const idx = knownVehicles.findIndex(x => x.vehicleId === veh.vehicleId);
  if (idx >= 0) Object.assign(knownVehicles[idx], veh);
  else knownVehicles.unshift(veh);
}

function syncStats() {
  document.getElementById("stat-reg").textContent       = stats.registered;
  document.getElementById("stat-tx").textContent        = stats.transfers;
  document.getElementById("stat-vehicles").textContent  = knownVehicles.length;
  document.getElementById("stat-events").textContent    = eventLogs.length;
}

function v(id) { return (document.getElementById(id)?.value || "").trim(); }

function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr || "N/A";
  return addr.slice(0,6) + "…" + addr.slice(-4);
}

function isAdmin() {
  return adminAddress && currentAccount &&
    currentAccount.toLowerCase() === adminAddress.toLowerCase();
}

function isContractConfigured() {
  return CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";
}

function checkReady() {
  if (!currentAccount) {
    toast("warning","Not Connected","Connect your MetaMask wallet first.");
    return false;
  }
  if (!isContractConfigured()) {
    toast("error","Contract Not Set","Update CONTRACT_ADDRESS in app.js after deploying on Remix.");
    return false;
  }
  return true;
}

function setBtnLoading(btn, loading, darkSpinner = true) {
  if (!btn) return;
  const spinEl = btn.querySelector(".spin");
  btn.disabled = loading;
  btn.classList.toggle("loading", loading);
  if (!darkSpinner) btn.classList.toggle("ws", loading);
  if (spinEl) spinEl.style.display = loading ? "inline-block" : "none";
}

function parseErr(e) {
  const m = e?.data?.message || e?.message || "";
  if (m.includes("not the admin"))        return "Only the admin can register vehicles.";
  if (m.includes("not the current owner"))return "You are not the current vehicle owner.";
  if (m.includes("already registered"))   return "This Vehicle ID is already registered.";
  if (m.includes("does not exist"))       return "Vehicle ID not found on-chain.";
  if (m.includes("User denied"))          return "Transaction cancelled in MetaMask.";
  if (m.includes("Cannot transfer to"))   return "Cannot transfer to yourself.";
  return m.length > 120 ? m.slice(0,120) + "…" : m || "Unknown error.";
}

function openEtherscan(type, hash) {
  if (!hash) return;
  window.open(`${ETHERSCAN_BASE}/${type}/${hash}`, "_blank");
}

// ─────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────
function toast(type, title, msg, ms = 5000) {
  const icons = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
  document.getElementById("toast-wrap").appendChild(el);
  el.onclick = () => dismissToast(el);
  setTimeout(() => dismissToast(el), ms);
}
function dismissToast(el) {
  if (!el.parentNode) return;
  el.classList.add("out");
  setTimeout(() => el.parentNode?.removeChild(el), 350);
}

// ─────────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────────
function onSearch(e) {
  renderVehicleGrid(e.target.value);
}

// ─────────────────────────────────────────────────────────────────
// DEMO DATA (works without contract — for UI preview)
// ─────────────────────────────────────────────────────────────────
function loadDemoVehicles() {
  if (knownVehicles.length) return;
  const demos = [
    { vehicleId:"MH12AB1234", model:"Tesla Model S", year:"2023", currentOwner:"0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
    { vehicleId:"DL08XY9988", model:"BMW M5 Competition", year:"2024", currentOwner:"0x3A1f5E8B7d2c5A4E9B3c7D1e6F2a8C4b0E5D9A3" },
    { vehicleId:"KA01MN5566", model:"Lamborghini Urus", year:"2022", currentOwner:"0x9B2c4E7A1f3D6e8B5C0a2F4d8E1b3A7c5E2d0F" },
    { vehicleId:"GJ05PQ2233", model:"Toyota Land Cruiser", year:"2023", currentOwner:"0x5D3a9C1e7B2f4A8d6E0b3F7c1A5e9D2a8C4b0F" },
  ];
  demos.forEach(d => addOrUpdateVehicle(d));
  renderVehicleGrid();
  syncStats();
}
