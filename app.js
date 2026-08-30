/**
 * CommerceHub ERP - Professional SaaS Application Logic
 * Comprehensive Inventory, Multi-Channel Sales, Purchases, Daily Expenses & 2-Partner Ledger
 */

// Global State (Clean Pristine Database & Custom User Accounts)
const DEFAULT_FIREBASE_RTDB_URL = "https://dwarkadhish-erp-default-rtdb.firebaseio.com/dwarkadhish_state.json";

const INITIAL_STORE_DATABASE = {
  settings: {
    bizName: "Dwarkadhish Enterprise",
    partner1Name: "Kenil (You)",
    partner2Name: "Alpesh",
    partner1Ratio: 50,
    partner2Ratio: 50,
    firebaseConfig: "https://dwarkadhish-erp-default-rtdb.firebaseio.com/",
    sellerAccounts: [],
    accountNames: {}
  },
  products: [],
  onlinePayouts: [],
  onlineDispatches: [],
  sales: [],
  purchases: [],
  supplierReturns: [],
  expenses: [],
  adjustments: [],
  partnerTransactions: [],
  _syncTime: Date.now()
};

let state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));

const STORAGE_KEY = "DWARKADHISH_ENTERPRISE_V2_CLEAN";
let isSyncingFromCloud = false;
let cloudSyncTimer = null;

// ==================== AUTHENTICATION & LOGIN GATE ====================
const AUTH_STORAGE_KEY = "DWARKADHISH_AUTH_LOGGED_IN";
const SYSTEM_AUTH_USER = "alken";
const SYSTEM_AUTH_PASS = "Dwarkadhish#2003#";

function checkAuthStatus() {
  const isAuth = localStorage.getItem(AUTH_STORAGE_KEY) === "true" || sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
  const loginScreen = document.getElementById("loginScreen");
  const appContainer = document.getElementById("appContainer");

  if (isAuth) {
    if (loginScreen) loginScreen.classList.add("hidden");
    if (appContainer) appContainer.classList.remove("hidden");
    return true;
  } else {
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (appContainer) appContainer.classList.add("hidden");
    return false;
  }
}

function handleUserLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const rememberCheckbox = document.getElementById("loginRememberMe");
  const errorAlert = document.getElementById("loginErrorAlert");
  const errorText = document.getElementById("loginErrorText");
  const loginCard = document.getElementById("loginCard");

  const username = (usernameInput?.value || "").trim().toLowerCase();
  const password = passwordInput?.value || "";

  if (username === SYSTEM_AUTH_USER && password === SYSTEM_AUTH_PASS) {
    if (rememberCheckbox && rememberCheckbox.checked) {
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
    }

    if (errorAlert) errorAlert.classList.add("hidden");
    const loginScreen = document.getElementById("loginScreen");
    const appContainer = document.getElementById("appContainer");
    if (loginScreen) loginScreen.classList.add("hidden");
    if (appContainer) appContainer.classList.remove("hidden");

    showToast("Welcome, Alken! Login successful.");
    refreshAllUI();
  } else {
    if (errorAlert) {
      errorAlert.classList.remove("hidden");
      if (errorText) errorText.textContent = "Invalid username or password. Please try again.";
    }
    if (loginCard) {
      loginCard.classList.add("animate-pulse");
      setTimeout(() => loginCard.classList.remove("animate-pulse"), 600);
    }
    showToast("Invalid Username or Password!", true);
  }
}

function handleUserLogout() {
  if (confirm("Are you sure you want to log out from Dwarkadhish Enterprise ERP?")) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);

    const loginScreen = document.getElementById("loginScreen");
    const appContainer = document.getElementById("appContainer");
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (appContainer) appContainer.classList.add("hidden");

    const form = document.getElementById("loginForm");
    if (form) form.reset();

    showToast("Logged out successfully.");
  }
}

function autoFillDemoCredentials() {
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  if (usernameInput) usernameInput.value = SYSTEM_AUTH_USER;
  if (passwordInput) passwordInput.value = SYSTEM_AUTH_PASS;
  showToast("Credentials loaded: alken");
}

function togglePasswordVisibility() {
  const passInput = document.getElementById("loginPassword");
  const eyeIcon = document.getElementById("passwordEyeIcon");
  if (!passInput) return;

  if (passInput.type === "password") {
    passInput.type = "text";
    if (eyeIcon) eyeIcon.className = "fa-solid fa-eye-slash text-xs";
  } else {
    passInput.type = "password";
    if (eyeIcon) eyeIcon.className = "fa-solid fa-eye text-xs";
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  checkAuthStatus();
  
  // Clean all inline styles that might have been cached
  document.querySelectorAll(".pro-card, div, section, main").forEach(el => {
    el.style.transform = "none";
    el.style.perspective = "none";
  });

  const today = new Date().toISOString().split('T')[0];
  const dateInputs = ["saleDate", "purchaseDate", "expenseDate", "settleDate", "capitalDate", "vpDate", "ccDate", "dispatchDate"];
  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  updatePartnerLabelsInUI();
  refreshAllUI();

  // 1. Initial Cloud Sync Fetch
  fetchFromInstantCloud();

  // 2. Periodic Live Sync (Every 5 Seconds)
  if (cloudSyncTimer) clearInterval(cloudSyncTimer);
  cloudSyncTimer = setInterval(fetchFromInstantCloud, 5000);

  // 3. Sync on tab focus
  window.addEventListener("focus", fetchFromInstantCloud);
});

// ==================== ZERO-SETUP INSTANT CLOUD SYNC & FIREBASE ====================
function getFirebaseSyncUrl() {
  const config = state.settings.firebaseConfig || localStorage.getItem("FIREBASE_CONFIG_KEY") || DEFAULT_FIREBASE_RTDB_URL;
  if (!config) return DEFAULT_FIREBASE_RTDB_URL;

  try {
    const trimmed = config.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      let cleanUrl = trimmed.replace(/\/$/, "");
      if (!cleanUrl.endsWith(".json")) {
        cleanUrl += "/dwarkadhish_state.json";
      }
      return cleanUrl;
    }
    const parsed = JSON.parse(trimmed);
    if (parsed.databaseURL) {
      let dbUrl = parsed.databaseURL.replace(/\/$/, "");
      return `${dbUrl}/dwarkadhish_state.json`;
    }
    if (parsed.projectId) {
      return `https://${parsed.projectId}-default-rtdb.firebaseio.com/dwarkadhish_state.json`;
    }
  } catch (e) {
    if (config.includes("firebase")) {
      let cleanUrl = config.trim().replace(/\/$/, "");
      if (!cleanUrl.startsWith("http")) cleanUrl = "https://" + cleanUrl;
      if (!cleanUrl.endsWith(".json")) cleanUrl += "/dwarkadhish_state.json";
      return cleanUrl;
    }
  }
  return DEFAULT_FIREBASE_RTDB_URL;
}

function initFirebaseSync() {
  fetchFromInstantCloud();
}

async function fetchFromInstantCloud() {
  if (isSyncingFromCloud) return;
  const fbUrl = getFirebaseSyncUrl();

  try {
    if (fbUrl) {
      const res = await fetch(fbUrl, { cache: "no-store" });
      if (res.ok) {
        const cloudState = await res.json();
        if (cloudState && typeof cloudState === 'object') {
          const cloudTime = cloudState._syncTime || 0;
          const localTime = state._syncTime || 0;

          // If cloud has newer data OR local has no data but cloud has data (e.g. partner opening for first time)
          const localHasNoData = (!state.expenses || state.expenses.length === 0) && (!state.sales || state.sales.length === 0) && (!state.partnerTransactions || state.partnerTransactions.length === 0) && (!state.products || state.products.length === 0);
          const cloudHasData = (cloudState.expenses && cloudState.expenses.length > 0) || (cloudState.sales && cloudState.sales.length > 0) || (cloudState.partnerTransactions && cloudState.partnerTransactions.length > 0) || (cloudState.products && cloudState.products.length > 0);

          if (cloudTime > localTime || (localHasNoData && cloudHasData)) {
            isSyncingFromCloud = true;
            state = { ...state, ...cloudState };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            updatePartnerLabelsInUI();
            refreshAllUI();
            isSyncingFromCloud = false;
          }
        }
        updateCloudStatusUI(true, "Firebase Cloud Live");
        return;
      }
    }

    updateCloudStatusUI(navigator.onLine, navigator.onLine ? "Local Device (Safe)" : "Offline");
  } catch (err) {
    console.log("Cloud sync check (offline/local fallback):", err);
    updateCloudStatusUI(navigator.onLine);
  }
}

async function pushToInstantCloud() {
  if (isSyncingFromCloud) return;
  const fbUrl = getFirebaseSyncUrl();

  try {
    state._syncTime = Date.now();
    if (fbUrl) {
      await fetch(fbUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      updateCloudStatusUI(true, "Firebase Cloud Live");
    }
  } catch (err) {
    console.warn("Cloud push error (saved locally):", err);
  }
}

function updateCloudStatusUI(isOnline, customLabel = null) {
  const badge = document.getElementById("cloudSyncStatusBadge");
  const dot = document.getElementById("cloudSyncDot");
  const text = document.getElementById("cloudSyncText");
  const settingStatus = document.getElementById("settingCloudStatus");

  const fbUrl = getFirebaseSyncUrl();
  const label = customLabel || (fbUrl ? "Firebase Cloud Live" : (isOnline ? "Local Device (Safe)" : "Offline"));

  if (isOnline) {
    if (badge) {
      badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold " + (fbUrl ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200");
    }
    if (dot) dot.className = "w-1.5 h-1.5 rounded-full " + (fbUrl ? "bg-emerald-500 animate-pulse" : "bg-indigo-500");
    if (text) text.textContent = label;
    if (settingStatus) {
      settingStatus.className = "text-[10px] font-bold px-2 py-0.5 rounded " + (fbUrl ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600");
      settingStatus.textContent = fbUrl ? "Firebase Active" : "Local Mode";
    }
  } else {
    if (badge) {
      badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200";
    }
    if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-slate-400";
    if (text) text.textContent = "Offline (Local Mode)";
    if (settingStatus) {
      settingStatus.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600";
      settingStatus.textContent = "Offline (Local)";
    }
  }
}

function loadState() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed) {
        state = { ...JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE)), ...parsed };
      } else {
        state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      if (!state.onlineDispatches) state.onlineDispatches = [];
      if (!state.supplierReturns) state.supplierReturns = [];
      rebuildProductBatchesFromHistory();
    } else {
      state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (err) {
    console.error("Error loading state from localStorage", err);
    state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));
  }
  rebuildProductBatchesFromHistory();
  reconcileSupplierReturnsAndBills();
}

function saveState() {
  try {
    state._syncTime = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    pushToInstantCloud();
  } catch (err) {
    console.error("Error saving state to localStorage", err);
    showToast("Error saving data to local storage!", true);
  }
}

// ==================== TAB NAVIGATION ====================
function switchTab(tabId) {
  document.querySelectorAll("main > section").forEach(sec => sec.classList.add("hidden"));
  document.querySelectorAll(".nav-tab-item").forEach(tab => tab.classList.remove("active"));

  const targetSection = document.getElementById(`view-${tabId}`);
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetSection) targetSection.classList.remove("hidden");
  if (targetTab) targetTab.classList.add("active");

  refreshAllUI();
}

// ==================== UI HELPERS & LABELS ====================
function formatCurrency(num) {
  if (isNaN(num)) num = 0;
  return "₹" + Number(num).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function updatePartnerLabelsInUI() {
  const p1 = state.settings.partner1Name || "Partner 1 (You)";
  const p2 = state.settings.partner2Name || "Partner 2";
  const r1 = state.settings.partner1Ratio || 50;
  const r2 = state.settings.partner2Ratio || 50;

  const headBiz = document.getElementById("headerBizName");
  if (headBiz) headBiz.textContent = state.settings.bizName || "CommerceHub";

  const dashP1 = document.getElementById("dashP1Name");
  const dashP2 = document.getElementById("dashP2Name");
  const dashR1 = document.getElementById("dashP1Ratio");
  const dashR2 = document.getElementById("dashP2Ratio");

  if (dashP1) dashP1.textContent = p1;
  if (dashP2) dashP2.textContent = p2;
  if (dashR1) dashR1.textContent = `${r1}%`;
  if (dashR2) dashR2.textContent = `${r2}%`;

  const cardP1 = document.getElementById("cardP1Name");
  const cardP2 = document.getElementById("cardP2Name");
  const cardR1 = document.getElementById("cardP1Ratio");
  const cardR2 = document.getElementById("cardP2Ratio");

  if (cardP1) cardP1.textContent = p1;
  if (cardP2) cardP2.textContent = p2;
  if (cardR1) cardR1.textContent = `Profit & Expense Share: ${r1}%`;
  if (cardR2) cardR2.textContent = `Profit & Expense Share: ${r2}%`;

  const p1RadioPurch = document.getElementById("purchaseP1RadioLabel");
  const p2RadioPurch = document.getElementById("purchaseP2RadioLabel");
  const p1RadioExp = document.getElementById("expenseP1RadioLabel");
  const p2RadioExp = document.getElementById("expenseP2RadioLabel");
  const p1RadioVp = document.getElementById("vpP1RadioLabel");
  const p2RadioVp = document.getElementById("vpP2RadioLabel");

  if (p1RadioPurch) p1RadioPurch.textContent = p1;
  if (p2RadioPurch) p2RadioPurch.textContent = p2;
  if (p1RadioExp) p1RadioExp.textContent = p1;
  if (p2RadioExp) p2RadioExp.textContent = p2;
  if (p1RadioVp) p1RadioVp.textContent = p1;
  if (p2RadioVp) p2RadioVp.textContent = p2;

  const settlePayer = document.getElementById("settlePayer");
  const settleReceiver = document.getElementById("settleReceiver");
  const capitalPartner = document.getElementById("capitalPartner");
  const drawingPartner = document.getElementById("drawingPartner");

  if (settlePayer) settlePayer.innerHTML = `<option value="partner1">${p1}</option><option value="partner2">${p2}</option>`;
  if (settleReceiver) settleReceiver.innerHTML = `<option value="partner2">${p2}</option><option value="partner1">${p1}</option>`;
  if (capitalPartner) capitalPartner.innerHTML = `<option value="partner1">${p1}</option><option value="partner2">${p2}</option>`;
  if (drawingPartner) drawingPartner.innerHTML = `<option value="partner1">${p1} (Partner 1 / You)</option><option value="partner2">${p2} (Partner 2)</option>`;

  const saleRecv = document.getElementById("saleReceivedBy");
  const ccRecv = document.getElementById("ccReceivedBy");
  const partnerOptions = `
    <option value="partner1">${escapeHtml(p1)}'s Account (Partner 1)</option>
    <option value="partner2">${escapeHtml(p2)}'s Account (Partner 2)</option>
    <option value="business">Business Account / Cash</option>
  `;
  if (saleRecv) saleRecv.innerHTML = partnerOptions;
  if (ccRecv) ccRecv.innerHTML = partnerOptions;

  const optNewAccP1 = document.getElementById("optNewAccP1");
  const optNewAccP2 = document.getElementById("optNewAccP2");
  if (optNewAccP1) optNewAccP1.textContent = `${p1} & Family (Partner 1)`;
  if (optNewAccP2) optNewAccP2.textContent = `${p2} & Family (Partner 2)`;

  const setBiz = document.getElementById("settingBizName");
  const setP1 = document.getElementById("settingP1Name");
  const setP2 = document.getElementById("settingP2Name");
  const setR1 = document.getElementById("settingP1Ratio");
  const setR2 = document.getElementById("settingP2Ratio");
  const setFb = document.getElementById("settingFirebaseConfig");

  if (setBiz) setBiz.value = state.settings.bizName || "Dwarkadhish Enterprise";
  if (setP1) setP1.value = p1;
  if (setP2) setP2.value = p2;
  if (setR1) setR1.value = r1;
  if (setR2) setR2.value = r2;
  if (setFb) setFb.value = state.settings.firebaseConfig || localStorage.getItem("FIREBASE_CONFIG_KEY") || "";
}

function updateP2Ratio() {
  const p1Val = parseInt(document.getElementById("settingP1Ratio").value) || 0;
  const p2Val = Math.max(0, 100 - p1Val);
  document.getElementById("settingP2Ratio").value = p2Val;
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toastNotification");
  const msgEl = document.getElementById("toastMessage");
  const iconEl = document.getElementById("toastIcon");
  if (!toast || !msgEl || !iconEl) return;

  msgEl.textContent = message;
  if (isError) {
    iconEl.className = "fa-solid fa-triangle-exclamation text-rose-400 text-sm";
  } else {
    iconEl.className = "fa-solid fa-check-circle text-emerald-400 text-sm";
  }

  toast.classList.remove("translate-y-20", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-20", "opacity-0");
  }, 2400);
}

// ==================== MODAL MANAGEMENT ====================
function openModal(modalId, isEditOrParam = null) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("hidden");

  if (isEditOrParam === 'edit' || isEditOrParam === true) {
    return;
  }

  if (modalId === 'payoutModal') {
    const form = document.getElementById("payoutForm");
    if (form) form.reset();
    document.getElementById("payoutEditId").value = "";
    document.getElementById("payoutDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("payoutModalTitle").textContent = "Add Online Bank Payout";
    updatePayoutAccountsDropdown();
  } else if (modalId === 'sellerAccountsModal') {
    renderSellerAccountsManager();
  } else if (modalId === 'saleModal') {
    initSaleModal(isEditOrParam);
  } else if (modalId === 'purchaseModal') {
    initPurchaseModal();
  } else if (modalId === 'adjustmentModal') {
    populateAdjustmentProductSelect();
  } else if (modalId === 'productModal') {
    const form = document.getElementById("productForm");
    if (form) form.reset();
    document.getElementById("productEditId").value = "";
    document.getElementById("productModalTitle").textContent = "Add New Product";
    document.getElementById("openingStockGroup").classList.remove("hidden");
  } else if (modalId === 'expenseModal') {
    const form = document.getElementById("expenseForm");
    if (form) form.reset();
    document.getElementById("expenseEditId").value = "";
    document.getElementById("expenseDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("expenseModalTitle").textContent = "Add Daily Expense";
  } else if (modalId === 'capitalModal') {
    const form = document.getElementById("capitalForm");
    if (form) form.reset();
    document.getElementById("capitalEditId").value = "";
    document.getElementById("capitalDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("capitalModalTitle").textContent = "Add Capital Investment";
  } else if (modalId === 'drawingModal') {
    const form = document.getElementById("drawingForm");
    if (form) form.reset();
    document.getElementById("drawingEditId").value = "";
    document.getElementById("drawingDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("drawingModalTitle").innerHTML = `<i class="fa-solid fa-money-bill-transfer text-amber-600"></i> Record Partner Drawing`;
  } else if (modalId === 'onlineDispatchModal') {
    initOnlineDispatchModal();
  } else if (modalId === 'settingsModal') {
    updatePartnerLabelsInUI();
  } else if (modalId === 'settleModal') {
    const form = document.getElementById("settleForm");
    if (form) form.reset();
    document.getElementById("settleEditId").value = "";
    document.getElementById("settleDate").value = new Date().toISOString().split('T')[0];
    document.getElementById("settleModalTitle").textContent = "Record Partner Settlement";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

// ==================== DASHBOARD & PROFIT ENGINE ====================
function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const curMonth = today.substring(0, 7);

  // 1. Stock Valuation & Items
  let totalStockVal = 0;
  let totalItemsCount = state.products.length;
  let lowStockList = [];

  state.products.forEach(p => {
    const stock = Number(p.currentStock) || 0;
    const activeBatches = (p.purchaseBatches || []).filter(b => b.remainingQty > 0);
    const prodVal = activeBatches.length > 0 
      ? activeBatches.reduce((acc, b) => acc + (b.remainingQty * b.netCostPrice), 0)
      : (stock * (Number(p.costPrice) || 0));
    totalStockVal += prodVal;

    const minStock = Number(p.minStockAlert) || 5;
    if (stock <= minStock) {
      lowStockList.push(p);
    }
  });

  const dStockVal = document.getElementById("dashStockValue");
  const dItemsCount = document.getElementById("dashTotalItems");
  if (dStockVal) dStockVal.textContent = formatCurrency(totalStockVal);
  if (dItemsCount) dItemsCount.textContent = totalItemsCount;

  // 2. Online Bank Payouts Inward
  let totalOnlineInward = 0;
  let onlineGrossProfit = 0;
  (state.onlinePayouts || []).forEach(op => {
    const bank = Number(op.bankAmount) || 0;
    const cost = Number(op.approxCost) || 0;
    totalOnlineInward += bank;
    onlineGrossProfit += Math.max(0, bank - cost);
  });

  // 3. Wholesale Inward & Profit
  let totalWholesaleInward = 0;
  let wholesaleGrossProfit = 0;
  let totalReceivables = 0;
  let pendingReceivablesCount = 0;

  state.sales.forEach(s => {
    const amt = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? amt : 0);
    const pending = Math.max(0, amt - paid);

    totalWholesaleInward += paid;
    if (pending > 0) {
      totalReceivables += pending;
      pendingReceivablesCount++;
    }

    if (s.items && s.items.length) {
      s.items.forEach(it => {
        const prod = state.products.find(p => p.id === it.productId);
        const costPrice = prod ? (Number(prod.costPrice) || 0) : (Number(it.costPrice) || 0);
        const sellingPrice = Number(it.price) || 0;
        const qty = Number(it.qty) || 0;
        wholesaleGrossProfit += (sellingPrice - costPrice) * qty;
      });
    } else {
      wholesaleGrossProfit += amt * 0.25;
    }
  });

  // 4. Expenses
  let totalExpenses = 0;
  let monthExpenses = 0;
  state.expenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    totalExpenses += amt;
    if (e.date && e.date.startsWith(curMonth)) monthExpenses += amt;
  });

  const dTotalExp = document.getElementById("dashTotalExpenses");
  const dMonthExp = document.getElementById("dashMonthExpenses");
  if (dTotalExp) dTotalExp.textContent = formatCurrency(totalExpenses);
  if (dMonthExp) dMonthExp.textContent = formatCurrency(monthExpenses);

  // 5. Total Inward Bank Received
  const grandInward = totalOnlineInward + totalWholesaleInward;
  const dTotInward = document.getElementById("dashTotalInward");
  const dOnlInward = document.getElementById("dashOnlineInward");
  const dWhsInward = document.getElementById("dashWholesaleInward");

  if (dTotInward) dTotInward.textContent = formatCurrency(grandInward);
  if (dOnlInward) dOnlInward.textContent = formatCurrency(totalOnlineInward);
  if (dWhsInward) dWhsInward.textContent = formatCurrency(totalWholesaleInward);

  // 6. Net Realized Profit
  const grandGrossProfit = onlineGrossProfit + wholesaleGrossProfit;
  const netRealizedProfit = grandGrossProfit - totalExpenses;
  const p1Ratio = (state.settings.partner1Ratio || 50) / 100;
  const p1NetProfit = Math.round(netRealizedProfit * p1Ratio);
  const p2NetProfit = netRealizedProfit - p1NetProfit;

  const dNetProfit = document.getElementById("dashNetProfit");
  const dP1Net = document.getElementById("dashP1NetProfit");
  const dP2Net = document.getElementById("dashP2NetProfit");

  if (dNetProfit) dNetProfit.textContent = formatCurrency(netRealizedProfit);
  if (dP1Net) dP1Net.textContent = formatCurrency(p1NetProfit);
  if (dP2Net) dP2Net.textContent = formatCurrency(p2NetProfit);

  // 7. Low Stock Alerts
  const lowStockBadge = document.getElementById("lowStockBadge");
  const lowStockCount = document.getElementById("lowStockCount");
  const dashLowStockList = document.getElementById("dashLowStockList");

  if (lowStockList.length > 0) {
    if (lowStockBadge) {
      lowStockBadge.classList.remove("hidden");
      lowStockBadge.textContent = lowStockList.length;
    }
    if (lowStockCount) {
      lowStockCount.textContent = `${lowStockList.length} Low`;
      lowStockCount.className = "badge-status badge-pending";
    }
    if (dashLowStockList) {
      dashLowStockList.innerHTML = lowStockList.map(p => `
        <div class="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-200">
          <div>
            <h4 class="font-semibold text-slate-800 text-xs">${escapeHtml(p.name)}</h4>
            <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(p.sku || 'No-SKU')}</span>
          </div>
          <div class="text-right">
            <span class="text-xs font-bold ${p.currentStock <= 0 ? 'text-rose-600' : 'text-amber-600'} font-mono">${p.currentStock} left</span>
            <span class="block text-[10px] text-slate-400">Min: ${p.minStockAlert || 5}</span>
          </div>
        </div>
      `).join('');
    }
  } else {
    if (lowStockBadge) lowStockBadge.classList.add("hidden");
    if (lowStockCount) {
      lowStockCount.textContent = "Optimal";
      lowStockCount.className = "badge-status badge-paid";
    }
    if (dashLowStockList) {
      dashLowStockList.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">All inventory levels are optimal.</p>`;
    }
  }

  // 8. 2-Partner Calculation
  calculatePartnerBalances();

  // 9. Recent Activity Table
  renderRecentActivity();
}

function renderRecentActivity() {
  const tbody = document.getElementById("dashRecentActivityBody");
  if (!tbody) return;
  const activities = [];

  state.sales.slice(-5).forEach(s => {
    activities.push({
      date: s.date,
      type: s.type === 'wholesale' ? 'Wholesale' : 'Online',
      badgeClass: s.type === 'wholesale' ? 'badge-partial' : 'badge-paid',
      title: `${s.invoiceNo} - ${s.customerName || (s.type === 'wholesale' ? 'Wholesale Party' : 'Online Customer')}`,
      sub: s.channel || s.type,
      amount: Number(s.totalAmount) || 0,
      isCredit: true
    });
  });

  state.purchases.slice(-5).forEach(p => {
    const payer = p.paidBy === 'partner1' ? state.settings.partner1Name : (p.paidBy === 'partner2' ? state.settings.partner2Name : 'Business Account');
    activities.push({
      date: p.date,
      type: 'Purchase',
      badgeClass: 'badge-neutral',
      title: `${p.billNo || 'Purchase'} - ${p.vendor}`,
      sub: `Paid by: ${payer}`,
      amount: Number(p.totalAmount) || 0,
      isCredit: false
    });
  });

  state.expenses.slice(-5).forEach(e => {
    const payer = e.paidBy === 'partner1' ? state.settings.partner1Name : (e.paidBy === 'partner2' ? state.settings.partner2Name : 'Business Account');
    activities.push({
      date: e.date,
      type: `Expense`,
      badgeClass: 'badge-pending',
      title: e.description || e.category,
      sub: `Paid by: ${payer}`,
      amount: Number(e.amount) || 0,
      isCredit: false
    });
  });

  activities.sort((a, b) => (b.date > a.date ? 1 : -1));
  const recent = activities.slice(0, 6);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-5 text-center text-slate-400">No recent transactions recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(act => `
    <tr>
      <td><span class="badge-status ${act.badgeClass}">${act.type}</span></td>
      <td class="text-slate-500 font-mono">${formatDate(act.date)}</td>
      <td class="font-medium text-slate-900">${escapeHtml(act.title)}</td>
      <td class="text-slate-500">${escapeHtml(act.sub)}</td>
      <td class="text-right font-bold font-mono ${act.isCredit ? 'text-emerald-600' : 'text-slate-800'}">
        ${act.isCredit ? '+' : '-'}${formatCurrency(act.amount)}
      </td>
    </tr>
  `).join('');
}

// ==================== 2-PARTNER BALANCES ====================
function calculatePartnerBalances() {
  const p1 = state.settings.partner1Name || "Partner 1 (You)";
  const p2 = state.settings.partner2Name || "Partner 2";
  const r1 = (state.settings.partner1Ratio || 50) / 100;
  const r2 = (state.settings.partner2Ratio || 50) / 100;

  // 1. Purchases Paid
  let p1Purchases = 0;
  let p2Purchases = 0;
  state.purchases.forEach(p => {
    const amt = Number(p.totalAmount) || 0;
    const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Pending' ? 0 : amt);
    if (p.paidBy === 'partner1') p1Purchases += paid;
    else if (p.paidBy === 'partner2') p2Purchases += paid;
  });

  // 1b. Extra Money Paid to Supplier on Item Exchanges
  (state.supplierReturns || []).forEach(sr => {
    if (sr.settlementMode === 'extra_paid') {
      const extraAmt = Math.abs(Number(sr.netBalance) || 0);
      if (sr.refundRecipient === 'partner1') p1Purchases += extraAmt;
      else if (sr.refundRecipient === 'partner2') p2Purchases += extraAmt;
    }
  });

  // 2. Expenses Paid
  let p1Expenses = 0;
  let p2Expenses = 0;
  state.expenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    if (e.paidBy === 'partner1') p1Expenses += amt;
    else if (e.paidBy === 'partner2') p2Expenses += amt;
  });

  // 3. Capital Injected
  let p1Capital = 0;
  let p2Capital = 0;
  state.partnerTransactions.filter(t => t.type === 'capital').forEach(c => {
    const amt = Number(c.amount) || 0;
    if (c.payer === 'partner1') p1Capital += amt;
    else if (c.payer === 'partner2') p2Capital += amt;
  });

  // 4. Wholesale Collections & Supplier Refunds Received in Partner's personal account
  let p1WholesaleRecv = 0;
  let p2WholesaleRecv = 0;
  state.sales.forEach(s => {
    if (s.paymentStatus === 'Pending' && (Number(s.paidAmount) || 0) === 0) return;
    if (s.paymentHistory && Array.isArray(s.paymentHistory) && s.paymentHistory.length > 0) {
      s.paymentHistory.forEach(ph => {
        const amt = Number(ph.amount) || 0;
        if (ph.receivedBy === 'partner1') p1WholesaleRecv += amt;
        else if (ph.receivedBy === 'partner2') p2WholesaleRecv += amt;
      });
    } else {
      const amt = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? Number(s.totalAmount) : 0);
      if (s.receivedBy === 'partner1') p1WholesaleRecv += amt;
      else if (s.receivedBy === 'partner2') p2WholesaleRecv += amt;
    }
  });

  // 4b. Cash / Bank Refund Received from Supplier into Partner's account
  (state.supplierReturns || []).forEach(sr => {
    if (sr.settlementMode === 'refund_received') {
      const refAmt = Math.abs(Number(sr.netBalance) || Number(sr.totalReturnedVal) || 0);
      if (sr.refundRecipient === 'partner1') p1WholesaleRecv += refAmt;
      else if (sr.refundRecipient === 'partner2') p2WholesaleRecv += refAmt;
    }
  });

  // 4c. Online Marketplace Bank Payouts Received in Partner's Bank Accounts
  let p1OnlinePayoutsRecv = 0;
  let p2OnlinePayoutsRecv = 0;
  const sellerAccs = getSellerAccounts();
  const accOwnerMap = {};
  sellerAccs.forEach(a => {
    accOwnerMap[a.id] = a.linkedPartner || 'partner1';
  });

  (state.onlinePayouts || []).forEach(op => {
    const amt = Number(op.bankAmount) || 0;
    const recipient = (op.accountId && accOwnerMap[op.accountId]) ? accOwnerMap[op.accountId] : (op.receivedBy || 'partner1');
    if (recipient === 'partner1') p1OnlinePayoutsRecv += amt;
    else if (recipient === 'partner2') p2OnlinePayoutsRecv += amt;
  });

  // 5. Personal Drawings
  let p1Drawings = 0;
  let p2Drawings = 0;
  state.partnerTransactions.filter(t => t.type === 'drawing').forEach(d => {
    const amt = Number(d.amount) || 0;
    if (d.payer === 'partner1') p1Drawings += amt;
    else if (d.payer === 'partner2') p2Drawings += amt;
  });

  // 6. Direct Settlements
  let p1SettlementAdj = 0;
  let p2SettlementAdj = 0;
  state.partnerTransactions.filter(t => t.type === 'settlement').forEach(s => {
    const amt = Number(s.amount) || 0;
    if (s.payer === 'partner1' && s.receiver === 'partner2') {
      p1SettlementAdj += amt;
      p2SettlementAdj -= amt;
    } else if (s.payer === 'partner2' && s.receiver === 'partner1') {
      p2SettlementAdj += amt;
      p1SettlementAdj -= amt;
    }
  });

  const p1TotalPaid = (p1Purchases + p1Expenses + p1Capital + p1SettlementAdj) - (p1WholesaleRecv + p1OnlinePayoutsRecv + p1Drawings);
  const p2TotalPaid = (p2Purchases + p2Expenses + p2Capital + p2SettlementAdj) - (p2WholesaleRecv + p2OnlinePayoutsRecv + p2Drawings);
  const totalCombinedPaid = p1TotalPaid + p2TotalPaid;

  const p1ExpectedShare = totalCombinedPaid * r1;
  const p2ExpectedShare = totalCombinedPaid * r2;
  const p1Diff = p1TotalPaid - p1ExpectedShare;

  const dP1Total = document.getElementById("dashP1TotalPaid");
  const dP2Total = document.getElementById("dashP2TotalPaid");
  if (dP1Total) dP1Total.textContent = formatCurrency(p1TotalPaid);
  if (dP2Total) dP2Total.textContent = formatCurrency(p2TotalPaid);

  const cP1Purch = document.getElementById("cardP1Purchases");
  const cP1Exp = document.getElementById("cardP1Expenses");
  const cP1Cap = document.getElementById("cardP1Capital");
  const cP1Ws = document.getElementById("cardP1WholesaleRecv");
  const cP1Op = document.getElementById("cardP1OnlinePayouts");
  const cP1Draw = document.getElementById("cardP1Drawings");
  const cP1Set = document.getElementById("cardP1Settlements");
  const cP1Grand = document.getElementById("cardP1GrandTotal");

  if (cP1Purch) cP1Purch.textContent = formatCurrency(p1Purchases);
  if (cP1Exp) cP1Exp.textContent = formatCurrency(p1Expenses);
  if (cP1Cap) cP1Cap.textContent = formatCurrency(p1Capital);
  if (cP1Ws) cP1Ws.textContent = formatCurrency(p1WholesaleRecv);
  if (cP1Op) cP1Op.textContent = formatCurrency(p1OnlinePayoutsRecv);
  if (cP1Draw) cP1Draw.textContent = formatCurrency(p1Drawings);
  if (cP1Set) cP1Set.textContent = (p1SettlementAdj >= 0 ? "+" : "") + formatCurrency(p1SettlementAdj);
  if (cP1Grand) cP1Grand.textContent = formatCurrency(p1TotalPaid);

  const cP2Purch = document.getElementById("cardP2Purchases");
  const cP2Exp = document.getElementById("cardP2Expenses");
  const cP2Cap = document.getElementById("cardP2Capital");
  const cP2Ws = document.getElementById("cardP2WholesaleRecv");
  const cP2Op = document.getElementById("cardP2OnlinePayouts");
  const cP2Draw = document.getElementById("cardP2Drawings");
  const cP2Set = document.getElementById("cardP2Settlements");
  const cP2Grand = document.getElementById("cardP2GrandTotal");

  if (cP2Purch) cP2Purch.textContent = formatCurrency(p2Purchases);
  if (cP2Exp) cP2Exp.textContent = formatCurrency(p2Expenses);
  if (cP2Cap) cP2Cap.textContent = formatCurrency(p2Capital);
  if (cP2Ws) cP2Ws.textContent = formatCurrency(p2WholesaleRecv);
  if (cP2Op) cP2Op.textContent = formatCurrency(p2OnlinePayoutsRecv);
  if (cP2Draw) cP2Draw.textContent = formatCurrency(p2Drawings);
  if (cP2Set) cP2Set.textContent = (p2SettlementAdj >= 0 ? "+" : "") + formatCurrency(p2SettlementAdj);
  if (cP2Grand) cP2Grand.textContent = formatCurrency(p2TotalPaid);

  let settlementVerdict = "";
  let settlementExpl = "";
  let dashText = "";

  const diffAbs = Math.abs(p1Diff);

  if (diffAbs < 1) {
    settlementVerdict = "Accounts are fully balanced (50/50)";
    settlementExpl = `Both partners have contributed equally according to the agreed ratio.`;
    dashText = "Accounts are fully balanced (50/50)";
  } else if (p1Diff > 0) {
    settlementVerdict = `${p2} needs to pay ${p1} ${formatCurrency(diffAbs)}`;
    settlementExpl = `${p1} has paid ${formatCurrency(diffAbs)} more than their agreed share. To balance accounts 50/50, ${p2} should settle this amount.`;
    dashText = `${p2} owes ${p1} ${formatCurrency(diffAbs)}`;
  } else {
    settlementVerdict = `${p1} needs to pay ${p2} ${formatCurrency(diffAbs)}`;
    settlementExpl = `${p2} has paid ${formatCurrency(diffAbs)} more than their agreed share. To balance accounts 50/50, ${p1} should settle this amount.`;
    dashText = `${p1} owes ${p2} ${formatCurrency(diffAbs)}`;
  }

  const dSettlement = document.getElementById("dashSettlementText");
  const fSettlementV = document.getElementById("finalSettlementVerdict");
  const fSettlementE = document.getElementById("finalSettlementExplanation");

  if (dSettlement) dSettlement.textContent = dashText;
  if (fSettlementV) fSettlementV.textContent = settlementVerdict;
  if (fSettlementE) fSettlementE.textContent = settlementExpl;

  // Visual Contribution Progress Bar
  const p1SharePct = totalCombinedPaid > 0 ? Math.round((p1TotalPaid / totalCombinedPaid) * 100) : 50;
  const p2SharePct = totalCombinedPaid > 0 ? (100 - p1SharePct) : 50;

  const barP1 = document.getElementById("dashP1ProgressBar");
  const barP2 = document.getElementById("dashP2ProgressBar");
  const txtP1 = document.getElementById("dashP1ShareText");
  const txtP2 = document.getElementById("dashP2ShareText");

  if (barP1) barP1.style.width = `${p1SharePct}%`;
  if (barP2) barP2.style.width = `${p2SharePct}%`;
  if (txtP1) txtP1.textContent = `${p1}: ${p1SharePct}% (${formatCurrency(p1TotalPaid)})`;
  if (txtP2) txtP2.textContent = `${p2}: ${p2SharePct}% (${formatCurrency(p2TotalPaid)})`;

  renderPartnerTransactionsTable();
}

function renderPartnerTransactionsTable() {
  const tbody = document.getElementById("partnerTransactionsTableBody");
  if (!tbody) return;

  if (state.partnerTransactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-5 text-center text-slate-400">No partner capital, drawings or settlement records found.</td></tr>`;
    return;
  }

  const p1 = state.settings.partner1Name;
  const p2 = state.settings.partner2Name;

  tbody.innerHTML = state.partnerTransactions.map(tx => {
    let badgeClass = "badge-paid";
    let badgeLabel = "Settlement";
    let receiverName = tx.receiver ? (tx.receiver === 'partner1' ? p1 : (tx.receiver === 'partner2' ? p2 : 'Business Account')) : 'Business Account';

    if (tx.type === 'capital') {
      badgeClass = "badge-neutral";
      badgeLabel = "Capital Added";
    } else if (tx.type === 'drawing') {
      badgeClass = "bg-amber-100 text-amber-800 border border-amber-300 font-bold";
      badgeLabel = "Partner Drawing";
      receiverName = "Self / Personal Use";
    }

    const payerName = tx.payer === 'partner1' ? p1 : p2;
    const notesDisplay = tx.source ? `${escapeHtml(tx.source)}${tx.notes ? ' - ' + escapeHtml(tx.notes) : ''}` : (tx.notes || '-');

    return `
      <tr>
        <td class="text-slate-500 font-mono text-xs">${formatDate(tx.date)}</td>
        <td>
          <span class="badge-status ${badgeClass}">
            ${badgeLabel}
          </span>
        </td>
        <td class="font-semibold text-slate-900">${escapeHtml(payerName)}</td>
        <td class="text-slate-600">${escapeHtml(receiverName)}</td>
        <td class="text-slate-500 text-xs">${notesDisplay}</td>
        <td class="text-right font-bold font-mono text-slate-900 ${tx.type === 'drawing' ? 'text-amber-700' : ''}">${formatCurrency(tx.amount)}</td>
        <td class="text-center space-x-1">
          <button onclick="editPartnerTx('${tx.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deletePartnerTx('${tx.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deletePartnerTx(id) {
  if (confirm("Are you sure you want to delete this partner transaction?")) {
    state.partnerTransactions = state.partnerTransactions.filter(t => t.id !== id);
    saveState();
    refreshAllUI();
    showToast("Transaction deleted successfully!");
  }
}

// ==================== BATCH-WISE PURCHASE LOTS & COSTING ENGINE ====================
function rebuildProductBatchesFromHistory() {
  if (!state.products || !Array.isArray(state.products)) return;

  state.products.forEach(p => {
    // 1. Collect all inward lots
    const inwardBatches = [];

    // Opening Stock Batch (if opening stock was set or existed)
    const initialOpening = Number(p.openingStock) || 0;
    if (initialOpening > 0) {
      inwardBatches.push({
        id: "batch_open_" + p.id,
        purchaseId: "opening",
        date: "Initial Stock",
        billNo: "Opening Stock",
        vendor: "Opening",
        qty: initialOpening,
        remainingQty: initialOpening,
        grossRate: Number(p.costPrice) || 0,
        discountPercent: 0,
        discountAmount: 0,
        costPrice: Number(p.costPrice) || 0,
        netCostPrice: Number(p.costPrice) || 0
      });
    }

    // Purchase Inward Batches (sorted chronologically)
    const sortedPurchases = [...(state.purchases || [])].sort((a, b) => (a.date > b.date ? 1 : (a.date < b.date ? -1 : 0)));
    sortedPurchases.forEach((purch, pIdx) => {
      (purch.items || []).forEach((it, itIdx) => {
        if (it.productId === p.id) {
          const qty = Number(it.qty) || 0;
          if (qty <= 0) return;
          const grossRate = Number(it.costPrice) || 0;
          const discAmt = Number(it.discountAmount) || 0;
          const discPct = Number(it.discountPercent) || 0;
          const gstRate = Number(it.gstRate) || 0;
          const grossTotal = qty * grossRate;
          const taxable = Math.max(0, grossTotal - discAmt);
          const gstAmt = it.gstAmount !== undefined ? Number(it.gstAmount) : Math.round(((taxable * gstRate) / 100) * 100) / 100;
          const finalTotalWithGst = taxable + gstAmt;
          // Exact Landed Net Cost per piece INCLUDING GST (e.g. ₹11 + 18% GST = ₹12.98)!
          const netLandedCost = Math.round((finalTotalWithGst / qty) * 100) / 100;

          inwardBatches.push({
            id: `batch_${purch.id}_${itIdx}`,
            purchaseId: purch.id,
            date: purch.date,
            billNo: purch.billNo || `PB-${pIdx + 101}`,
            vendor: purch.vendor || 'Supplier',
            qty: qty,
            remainingQty: qty,
            grossRate: grossRate,
            discountPercent: discPct,
            discountAmount: discAmt,
            gstRate: gstRate,
            gstAmount: gstAmt,
            costPrice: netLandedCost,
            netCostPrice: netLandedCost
          });
        }
      });
    });

    // Exchanged Inward Items from Supplier Returns (sorted chronologically)
    (state.supplierReturns || []).forEach(sr => {
      (sr.exchangedItems || []).forEach((it, itIdx) => {
        if (it.productId === p.id) {
          const qty = Number(it.qty) || 0;
          if (qty <= 0) return;
          const cost = Number(it.costPrice) || 0;
          const gstRate = Number(it.gstRate) || 0;
          const gstAmt = it.gstAmount !== undefined ? Number(it.gstAmount) : Math.round(((qty * cost * gstRate) / 100) * 100) / 100;
          const netLandedCost = Math.round(((qty * cost + gstAmt) / qty) * 100) / 100;

          inwardBatches.push({
            id: `batch_exc_${sr.id}_${itIdx}`,
            purchaseId: sr.id,
            date: sr.date,
            billNo: `Exchange (${sr.refNo || 'PR'})`,
            vendor: sr.vendor || 'Supplier Exchange',
            qty: qty,
            remainingQty: qty,
            grossRate: cost,
            discountPercent: 0,
            discountAmount: 0,
            gstRate: gstRate,
            gstAmount: gstAmt,
            costPrice: netLandedCost,
            netCostPrice: netLandedCost
          });
        }
      });
    });

    // If no purchase records yet, but product has currentStock, create legacy base batch
    if (inwardBatches.length === 0 && Number(p.currentStock) > 0) {
      const curStock = Number(p.currentStock) || 0;
      inwardBatches.push({
        id: "batch_legacy_" + p.id,
        purchaseId: "legacy",
        date: "Current Stock",
        billNo: "Existing Inventory",
        vendor: "Godown",
        qty: curStock,
        remainingQty: curStock,
        grossRate: Number(p.costPrice) || 0,
        discountPercent: 0,
        discountAmount: 0,
        gstRate: 0,
        gstAmount: 0,
        costPrice: Number(p.costPrice) || 0,
        netCostPrice: Number(p.costPrice) || 0
      });
    }

    // 2. Collect all outward stock reductions (Wholesale Sales, Online Dispatches & Supplier Returns)
    let totalOutwardUnits = 0;

    (state.sales || []).forEach(s => {
      (s.items || []).forEach(it => {
        if (it.productId === p.id) {
          totalOutwardUnits += (Number(it.qty) || 0);
        }
      });
    });

    (state.onlineDispatches || []).forEach(d => {
      (d.items || []).forEach(it => {
        if (it.productId === p.id) {
          totalOutwardUnits += (Number(it.qty) || 0);
        }
      });
    });

    (state.supplierReturns || []).forEach(sr => {
      (sr.returnedItems || []).forEach(it => {
        if (it.productId === p.id) {
          totalOutwardUnits += (Number(it.qty) || 0);
        }
      });
    });

    // 3. FIFO Deductions across inward batches
    let unitsToDeduct = totalOutwardUnits;
    for (let i = 0; i < inwardBatches.length; i++) {
      const b = inwardBatches[i];
      if (unitsToDeduct <= 0) break;
      if (b.remainingQty <= unitsToDeduct) {
        unitsToDeduct -= b.remainingQty;
        b.remainingQty = 0;
      } else {
        b.remainingQty -= unitsToDeduct;
        unitsToDeduct = 0;
      }
    }

    // 4. Calculate total remaining stock and accurate valuations
    p.purchaseBatches = inwardBatches;
    const activeBatches = inwardBatches.filter(b => b.remainingQty > 0);
    const totalRemaining = activeBatches.reduce((acc, b) => acc + b.remainingQty, 0);
    const totalValuation = activeBatches.reduce((acc, b) => acc + (b.remainingQty * b.netCostPrice), 0);

    p.currentStock = totalRemaining;

    if (activeBatches.length > 0) {
      p.weightedAvgCost = Math.round((totalValuation / totalRemaining) * 100) / 100;
      p.latestCost = inwardBatches[inwardBatches.length - 1].netCostPrice;
      p.costPrice = p.latestCost; // Reflects net landed cost with GST and discount!
    }
  });
}

function openBatchBreakdownModal(prodId) {
  rebuildProductBatchesFromHistory();

  const prod = (state.products || []).find(p => p.id === prodId);
  if (!prod) return;

  document.getElementById("batchModalTitle").innerHTML = `<i class="fa-solid fa-boxes-stacked text-indigo-600"></i> ${escapeHtml(prod.name)} - Batch Breakdown`;
  document.getElementById("batchModalSubtitle").textContent = `SKU: ${prod.sku || '-'} | Category: ${prod.category || 'General'}`;

  const batches = prod.purchaseBatches || [];
  const activeBatches = batches.filter(b => b.remainingQty > 0);
  const totalStock = activeBatches.reduce((acc, b) => acc + b.remainingQty, 0);
  const totalValuation = activeBatches.reduce((acc, b) => acc + (b.remainingQty * b.netCostPrice), 0);
  const avgCost = totalStock > 0 ? (totalValuation / totalStock) : (Number(prod.costPrice) || 0);
  const latestBatch = batches[batches.length - 1];
  const latestRate = latestBatch ? latestBatch.netCostPrice : (Number(prod.costPrice) || 0);

  document.getElementById("batchSummaryTotalStock").textContent = `${totalStock} pcs`;
  document.getElementById("batchSummaryValuation").textContent = formatCurrency(totalValuation);
  document.getElementById("batchSummaryAvgCost").textContent = formatCurrency(avgCost);
  document.getElementById("batchSummaryLatestRate").textContent = formatCurrency(latestRate);

  const tbody = document.getElementById("batchBreakdownTableBody");
  if (!tbody) return;

  if (batches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-400">No purchase batches found for this product.</td></tr>`;
  } else {
    tbody.innerHTML = batches.map(b => {
      let statusBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200";
      let statusText = "In Stock";

      if (b.remainingQty === 0) {
        statusBadge = "bg-slate-100 text-slate-500 border border-slate-200";
        statusText = "Fully Sold";
      } else if (b.remainingQty < b.qty) {
        statusBadge = "bg-amber-50 text-amber-700 border border-amber-200";
        statusText = "Partial Sold";
      }

      const discText = b.discountAmount > 0 
        ? `${b.discountPercent ? `${b.discountPercent}% ` : ''}(-₹${b.discountAmount})`
        : '-';

      const gstText = b.gstAmount > 0
        ? `${b.gstRate}% (+₹${b.gstAmount})`
        : (b.gstRate ? `${b.gstRate}%` : '-');

      return `
        <tr class="hover:bg-slate-50">
          <td class="font-mono text-slate-600">${formatDate(b.date)}</td>
          <td>
            <div class="font-bold text-slate-900 text-xs">${escapeHtml(b.billNo || '-')}</div>
            <div class="text-[11px] text-slate-500">${escapeHtml(b.vendor || '-')}</div>
          </td>
          <td class="text-right font-mono text-slate-700">${b.qty}</td>
          <td class="text-right font-mono text-slate-500">${formatCurrency(b.grossRate)}</td>
          <td class="text-right font-mono text-rose-600 text-xs">${discText}</td>
          <td class="text-right font-mono text-indigo-700 text-xs">${gstText}</td>
          <td class="text-right font-mono font-bold text-emerald-700 text-sm bg-emerald-50/50" title="Effective Landed Price (Incl. GST)">${formatCurrency(b.netCostPrice)}</td>
          <td class="text-right font-mono font-extrabold text-indigo-900 text-sm">${b.remainingQty} pcs</td>
          <td class="text-right font-mono font-bold text-slate-900">${formatCurrency(b.remainingQty * b.netCostPrice)}</td>
          <td class="text-center">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${statusBadge}">
              ${statusText}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  openModal('batchBreakdownModal');
}

function renderProductsTable() {
  rebuildProductBatchesFromHistory();

  const tbody = document.getElementById("productsTableBody");
  if (!tbody) return;

  const search = (document.getElementById("productSearchInput")?.value || "").toLowerCase();
  const filterStock = document.getElementById("productFilterStock")?.value || "all";

  const filtered = state.products.filter(p => {
    const matchSearch = (p.name && p.name.toLowerCase().includes(search)) ||
                        (p.sku && p.sku.toLowerCase().includes(search)) ||
                        (p.category && p.category.toLowerCase().includes(search));
    if (!matchSearch) return false;

    const stock = Number(p.currentStock) || 0;
    const min = Number(p.minStockAlert) || 5;

    if (filterStock === 'low') return stock <= min && stock > 0;
    if (filterStock === 'out') return stock <= 0;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-5 text-center text-slate-400">No products found. Click 'Add Product' to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    let stock = Number(p.currentStock) || 0;
    let stockDisplay = `${stock} Units`;
    let stockBadge = "badge-paid";

    if (p.isBundle && Array.isArray(p.bundleItems) && p.bundleItems.length > 0) {
      const possibleCombos = p.bundleItems.map(comp => {
        const cProd = state.products.find(prod => prod.id === comp.productId);
        const cur = cProd ? Number(cProd.currentStock) || 0 : 0;
        const req = Number(comp.qty) || 1;
        return Math.floor(cur / req);
      });
      const maxCombos = possibleCombos.length > 0 ? Math.min(...possibleCombos) : 0;
      stockDisplay = `${maxCombos} Combos Ready`;
      if (maxCombos <= 0) stockBadge = "badge-pending";
      else if (maxCombos <= (Number(p.minStockAlert) || 5)) stockBadge = "badge-partial";
      else stockBadge = "bg-amber-100 text-amber-800 border border-amber-300 font-bold";
    } else {
      const minStock = Number(p.minStockAlert) || 5;
      if (stock <= 0) stockBadge = "badge-pending";
      else if (stock <= minStock) stockBadge = "badge-partial";
    }

    // Active batches summary display (e.g. 50 @ ₹10 | 100 @ ₹9)
    const activeBatches = (p.purchaseBatches || []).filter(b => b.remainingQty > 0);
    let batchSummaryHtml = "";
    if (activeBatches.length > 1) {
      const summaryParts = activeBatches.map(b => `${b.remainingQty} @ ${formatCurrency(b.netCostPrice)}`).join(' | ');
      batchSummaryHtml = `
        <div class="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer mt-0.5 flex items-center justify-center gap-1" onclick="openBatchBreakdownModal('${p.id}')" title="Click to view all purchase batches">
          <i class="fa-solid fa-layer-group text-[9px]"></i> ${summaryParts}
        </div>
      `;
    } else if (activeBatches.length === 1) {
      batchSummaryHtml = `
        <div class="text-[10px] text-slate-500 cursor-pointer hover:text-indigo-600 mt-0.5 flex items-center justify-center gap-1" onclick="openBatchBreakdownModal('${p.id}')" title="Click to view batch breakdown">
          <i class="fa-solid fa-tag text-[9px]"></i> Net Cost: ${formatCurrency(activeBatches[0].netCostPrice)}
        </div>
      `;
    } else if (p.isBundle && Array.isArray(p.bundleItems)) {
      const compText = (p.bundleItems || []).map(b => {
        const cp = state.products.find(x => x.id === b.productId);
        return `${b.qty}x ${cp ? cp.name.split(' ')[0] : 'Item'}`;
      }).join(' + ');
      batchSummaryHtml = `
        <div class="text-[10px] text-amber-700 font-semibold mt-0.5">
          <i class="fa-solid fa-boxes-packing text-[9px]"></i> ${compText}
        </div>
      `;
    }

    return `
      <tr>
        <td class="font-mono font-semibold text-slate-600">${escapeHtml(p.sku || '-')}</td>
        <td class="font-bold text-slate-900">
          <div class="flex items-center gap-1.5">
            <span>${escapeHtml(p.name)}</span>
            ${p.isBundle ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800"><i class="fa-solid fa-boxes-packing text-[9px]"></i> Combo</span>` : ''}
          </div>
          ${p.isBundle && Array.isArray(p.bundleItems) ? `<div class="text-[10px] text-slate-500 font-normal">Includes: ${(p.bundleItems || []).map(b => `${b.qty}x ${b.productName}`).join(' + ')}</div>` : ''}
          <div class="text-[11px] text-slate-400 font-normal sm:hidden">${escapeHtml(p.category || 'General')}</div>
        </td>
        <td class="hidden sm:table-cell"><span class="badge-status badge-neutral">${escapeHtml(p.category || 'General')}</span></td>
        <td class="text-right font-mono font-bold text-slate-700" title="Net Landed Purchase Cost (After Discount)">
          ${formatCurrency(p.costPrice)}
        </td>
        <td class="text-right text-emerald-600 font-bold font-mono">${formatCurrency(p.retailPrice)}</td>
        <td class="text-right text-indigo-600 font-bold font-mono">${formatCurrency(p.wholesalePrice)}</td>
        <td class="text-center">
          <span class="badge-status ${stockBadge} font-mono cursor-pointer" onclick="${p.isBundle ? `editProduct('${p.id}')` : `openBatchBreakdownModal('${p.id}')`}" title="${p.isBundle ? 'Click to edit combo components' : 'Click to see Batch Breakdown'}">
            ${stockDisplay}
          </span>
          ${batchSummaryHtml}
        </td>
        <td class="text-center space-x-1">
          <button onclick="openBatchBreakdownModal('${p.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="View Purchase Batches & Net Cost">
            <i class="fa-solid fa-boxes-stacked"></i>
          </button>
          <button onclick="editProduct('${p.id}')" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Edit Product">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="quickAdjustStock('${p.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="Adjust Stock">
            <i class="fa-solid fa-sliders"></i>
          </button>
          <button onclick="deleteProduct('${p.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function addSkuMappingRow(sku = "", multiplier = 1, note = "") {
  const container = document.getElementById("skuMappingsContainer");
  if (!container) return;

  const rowId = "skumap_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs sku-mapping-row";
  row.id = rowId;

  row.innerHTML = `
    <div class="flex-grow">
      <input type="text" value="${escapeHtml(sku)}" oninput="onSkuMappingCodeInput('${rowId}')" placeholder="Paste Meesho SKU / Style ID / Barcode" class="input-pro py-1 text-xs font-mono font-semibold skumap-code" required>
    </div>
    <div class="w-32 flex-shrink-0 flex items-center gap-1">
      <select class="input-pro py-1 text-xs font-bold text-indigo-700 skumap-multiplier">
        <option value="1" ${multiplier == 1 ? 'selected' : ''}>Pack of 1 (1 pc)</option>
        <option value="2" ${multiplier == 2 ? 'selected' : ''}>Pack of 2 (2 pcs)</option>
        <option value="3" ${multiplier == 3 ? 'selected' : ''}>Pack of 3 (3 pcs)</option>
        <option value="4" ${multiplier == 4 ? 'selected' : ''}>Pack of 4 (4 pcs)</option>
        <option value="5" ${multiplier == 5 ? 'selected' : ''}>Pack of 5 (5 pcs)</option>
        <option value="6" ${multiplier == 6 ? 'selected' : ''}>Pack of 6 (6 pcs)</option>
        <option value="8" ${multiplier == 8 ? 'selected' : ''}>Pack of 8 (8 pcs)</option>
        <option value="10" ${multiplier == 10 ? 'selected' : ''}>Pack of 10 (10 pcs)</option>
        <option value="12" ${multiplier == 12 ? 'selected' : ''}>Pack of 12 (12 pcs)</option>
        <option value="15" ${multiplier == 15 ? 'selected' : ''}>Pack of 15 (15 pcs)</option>
        <option value="20" ${multiplier == 20 ? 'selected' : ''}>Pack of 20 (20 pcs)</option>
      </select>
    </div>
    <div class="w-28 flex-shrink-0">
      <input type="text" value="${escapeHtml(note)}" placeholder="Note (e.g. Set of 4)" class="input-pro py-1 text-[11px] skumap-note">
    </div>
    <button type="button" onclick="removeSkuMappingRow('${rowId}')" class="text-slate-400 hover:text-rose-600 p-1 flex-shrink-0" title="Remove SKU">
      <i class="fa-solid fa-trash-can text-xs"></i>
    </button>
  `;

  container.appendChild(row);
}

function onSkuMappingCodeInput(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const codeInput = row.querySelector(".skumap-code");
  const multSelect = row.querySelector(".skumap-multiplier");
  const noteInput = row.querySelector(".skumap-note");
  if (!codeInput || !multSelect) return;

  const val = codeInput.value.toLowerCase();
  let detected = null;

  if (val.match(/pack\s*of\s*12|pack\s*12|12\s*pcs?|set\s*of\s*12/i)) detected = 12;
  else if (val.match(/pack\s*of\s*10|pack\s*10|10\s*pcs?|set\s*of\s*10/i)) detected = 10;
  else if (val.match(/pack\s*of\s*8|pack\s*8|8\s*pcs?|set\s*of\s*8/i)) detected = 8;
  else if (val.match(/pack\s*of\s*6|pack\s*6|6\s*pcs?|set\s*of\s*6/i)) detected = 6;
  else if (val.match(/pack\s*of\s*5|pack\s*5|5\s*pcs?|set\s*of\s*5/i)) detected = 5;
  else if (val.match(/pack\s*of\s*4|pack\s*4|4\s*pcs?|set\s*of\s*4/i)) detected = 4;
  else if (val.match(/pack\s*of\s*3|pack\s*3|3\s*pcs?|set\s*of\s*3/i)) detected = 3;
  else if (val.match(/pack\s*of\s*2|pack\s*2|2\s*pcs?|set\s*of\s*2|pair/i)) detected = 2;
  else if (val.match(/pack\s*of\s*1|pack\s*1|single|1\s*pc/i)) detected = 1;

  if (detected) {
    multSelect.value = String(detected);
    if (noteInput && !noteInput.value) {
      noteInput.value = `Pack of ${detected}`;
    }
  }
}

function removeSkuMappingRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

function toggleProductTypeUI() {
  const isBundle = document.querySelector('input[name="prodType"]:checked')?.value === 'bundle';
  const bundleSection = document.getElementById("bundleComponentsSection");
  const openingGroup = document.getElementById("openingStockGroup");

  if (isBundle) {
    if (bundleSection) bundleSection.classList.remove("hidden");
    if (openingGroup) openingGroup.classList.add("hidden");
    const container = document.getElementById("bundleComponentsContainer");
    if (container && container.children.length === 0) {
      addBundleComponentRow();
      addBundleComponentRow();
    }
  } else {
    if (bundleSection) bundleSection.classList.add("hidden");
    const editId = document.getElementById("productEditId")?.value;
    if (!editId && openingGroup) openingGroup.classList.remove("hidden");
  }
}

function addBundleComponentRow(selectedProdId = "", qty = 1) {
  const container = document.getElementById("bundleComponentsContainer");
  if (!container) return;

  const rowId = "comp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 bg-white p-2 rounded-lg border border-amber-200 shadow-2xs bundle-comp-row";
  row.id = rowId;

  // Single items list (exclude combos to prevent loops)
  const singleProducts = (state.products || []).filter(p => !p.isBundle);

  row.innerHTML = `
    <div class="flex-grow">
      <select onchange="recalculateBundleCost()" class="input-pro py-1 text-xs font-semibold comp-product-select" required>
        <option value="">-- Choose Component Product --</option>
        ${singleProducts.map(p => `<option value="${p.id}" ${p.id === selectedProdId ? 'selected' : ''}>${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
      </select>
    </div>
    <div class="w-24 flex-shrink-0 flex items-center gap-1">
      <input type="number" min="1" value="${qty}" oninput="recalculateBundleCost()" placeholder="Qty" class="input-pro py-1 text-xs font-bold text-center comp-qty" required>
      <span class="text-[11px] text-slate-500 font-semibold">pcs</span>
    </div>
    <button type="button" onclick="removeBundleComponentRow('${rowId}')" class="text-slate-400 hover:text-rose-600 p-1 flex-shrink-0" title="Remove Component">
      <i class="fa-solid fa-trash-can text-xs"></i>
    </button>
  `;

  container.appendChild(row);
  recalculateBundleCost();
}

function removeBundleComponentRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
  recalculateBundleCost();
}

function recalculateBundleCost() {
  const compRows = document.querySelectorAll(".bundle-comp-row");
  let totalCost = 0;
  compRows.forEach(r => {
    const prodId = r.querySelector(".comp-product-select")?.value;
    const qty = parseFloat(r.querySelector(".comp-qty")?.value) || 0;
    if (prodId && qty > 0) {
      const prod = state.products.find(p => p.id === prodId);
      if (prod) {
        totalCost += (Number(prod.costPrice) || 0) * qty;
      }
    }
  });

  const costInput = document.getElementById("prodCostPrice");
  if (costInput && totalCost > 0) {
    costInput.value = Math.round(totalCost * 100) / 100;
  }
}

function handleSaveProduct(e) {
  e.preventDefault();
  const editId = document.getElementById("productEditId").value;
  const name = document.getElementById("prodName").value.trim();
  const sku = document.getElementById("prodSku").value.trim();
  const category = document.getElementById("prodCategory").value.trim();
  const minStock = parseInt(document.getElementById("prodMinStock").value) || 5;
  const costPrice = parseFloat(document.getElementById("prodCostPrice").value) || 0;
  const retailPrice = parseFloat(document.getElementById("prodRetailPrice").value) || 0;
  const wholesalePrice = parseFloat(document.getElementById("prodWholesalePrice").value) || 0;
  const openingStock = parseInt(document.getElementById("prodOpeningStock").value) || 0;
  const isBundle = document.querySelector('input[name="prodType"]:checked')?.value === 'bundle';

  // Collect Bundle Components
  const bundleItems = [];
  if (isBundle) {
    const compRows = document.querySelectorAll(".bundle-comp-row");
    compRows.forEach(r => {
      const pId = r.querySelector(".comp-product-select")?.value;
      const q = parseInt(r.querySelector(".comp-qty")?.value) || 1;
      if (pId && q > 0) {
        const pObj = state.products.find(p => p.id === pId);
        bundleItems.push({
          productId: pId,
          productName: pObj ? pObj.name : "Product",
          qty: q
        });
      }
    });

    if (bundleItems.length < 2) {
      showToast("Please add at least 2 products to create a combo bundle!", true);
      return;
    }
  }

  // Collect SKU & Pack Multiplier mappings
  const mappingRows = document.querySelectorAll(".sku-mapping-row");
  const skuMappings = [];
  mappingRows.forEach(r => {
    const code = r.querySelector(".skumap-code")?.value.trim();
    const mult = parseInt(r.querySelector(".skumap-multiplier")?.value) || 1;
    const note = r.querySelector(".skumap-note")?.value.trim() || `Pack of ${mult}`;
    if (code) {
      skuMappings.push({
        id: "map_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        sku: code,
        multiplier: mult,
        note
      });
    }
  });

  if (editId) {
    const prod = state.products.find(p => p.id === editId);
    if (prod) {
      prod.name = name;
      prod.sku = sku;
      prod.category = category;
      prod.minStockAlert = minStock;
      prod.costPrice = costPrice;
      prod.retailPrice = retailPrice;
      prod.wholesalePrice = wholesalePrice;
      prod.skuMappings = skuMappings;
      prod.isBundle = isBundle;
      prod.bundleItems = bundleItems;
      showToast(`${isBundle ? 'Combo bundle' : 'Product'} updated successfully!`);
    }
  } else {
    const newProd = {
      id: "prod_" + Date.now(),
      name,
      sku: sku || "SKU-" + Math.floor(1000 + Math.random() * 9000),
      category: category || (isBundle ? "Combo Packs" : "General"),
      costPrice,
      retailPrice,
      wholesalePrice,
      isBundle: isBundle,
      bundleItems: bundleItems,
      openingStock: isBundle ? 0 : openingStock,
      currentStock: isBundle ? 0 : openingStock,
      minStockAlert: minStock,
      skuMappings: skuMappings,
      purchaseBatches: (!isBundle && openingStock > 0) ? [{
        id: "batch_open_" + Date.now(),
        purchaseId: "opening",
        date: new Date().toISOString().split('T')[0],
        billNo: "Opening Stock",
        vendor: "Opening",
        qty: openingStock,
        remainingQty: openingStock,
        grossRate: costPrice,
        discountPercent: 0,
        discountAmount: 0,
        costPrice: costPrice,
        netCostPrice: costPrice
      }] : []
    };
    state.products.push(newProd);
    showToast(`New ${isBundle ? 'combo bundle' : 'product'} added successfully!`);
  }

  saveState();
  closeModal('productModal');
  refreshAllUI();
}

function editProduct(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  document.getElementById("productEditId").value = prod.id;
  document.getElementById("prodName").value = prod.name;
  document.getElementById("prodSku").value = prod.sku || "";
  document.getElementById("prodCategory").value = prod.category || "";
  document.getElementById("prodMinStock").value = prod.minStockAlert || 5;
  document.getElementById("prodCostPrice").value = prod.costPrice;
  document.getElementById("prodRetailPrice").value = prod.retailPrice;
  document.getElementById("prodWholesalePrice").value = prod.wholesalePrice;
  document.getElementById("openingStockGroup").classList.add("hidden");

  // Bundle vs Single Toggle
  const isBundle = !!prod.isBundle;
  const singleRadio = document.getElementById("prodTypeSingle");
  const bundleRadio = document.getElementById("prodTypeBundle");
  if (isBundle && bundleRadio) {
    bundleRadio.checked = true;
  } else if (singleRadio) {
    singleRadio.checked = true;
  }

  // Load Bundle Components
  const bundleContainer = document.getElementById("bundleComponentsContainer");
  if (bundleContainer) {
    bundleContainer.innerHTML = "";
    if (isBundle && Array.isArray(prod.bundleItems) && prod.bundleItems.length > 0) {
      prod.bundleItems.forEach(b => {
        addBundleComponentRow(b.productId, b.qty);
      });
    }
  }
  toggleProductTypeUI();

  // Load existing SKU Mappings
  const container = document.getElementById("skuMappingsContainer");
  if (container) {
    container.innerHTML = "";
    if (Array.isArray(prod.skuMappings) && prod.skuMappings.length > 0) {
      prod.skuMappings.forEach(m => {
        addSkuMappingRow(m.sku, m.multiplier, m.note);
      });
    }
  }

  document.getElementById("productModalTitle").textContent = isBundle ? `Edit Combo Bundle (${prod.name})` : "Edit Product";
  openModal('productModal', 'edit');
}

function deleteProduct(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  if (confirm(`Are you sure you want to delete '${prod.name}'?`)) {
    state.products = state.products.filter(p => p.id !== id);
    saveState();
    refreshAllUI();
    showToast("Product deleted successfully!");
  }
}

function quickAdjustStock(id) {
  openModal('adjustmentModal');
  const select = document.getElementById("adjProductSelect");
  if (select) select.value = id;
}

function populateAdjustmentProductSelect() {
  const select = document.getElementById("adjProductSelect");
  if (!select) return;
  select.innerHTML = state.products.map(p => `
    <option value="${p.id}">${escapeHtml(p.name)} (Current Stock: ${p.currentStock})</option>
  `).join('');
}

function handleSaveAdjustment(e) {
  e.preventDefault();
  const prodId = document.getElementById("adjProductSelect").value;
  const type = document.getElementById("adjType").value;
  const qty = parseInt(document.getElementById("adjQty").value) || 0;
  const reason = document.getElementById("adjReason").value;
  const notes = document.getElementById("adjNotes").value.trim();

  const prod = state.products.find(p => p.id === prodId);
  if (!prod) {
    showToast("Please select a product!", true);
    return;
  }

  if (qty <= 0) {
    showToast("Quantity must be greater than 0!", true);
    return;
  }

  if (type === 'reduce') {
    prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - qty);
  } else {
    prod.currentStock = (Number(prod.currentStock) || 0) + qty;
  }

  state.adjustments.push({
    id: "adj_" + Date.now(),
    date: new Date().toISOString().split('T')[0],
    productId: prod.id,
    productName: prod.name,
    type,
    qty,
    reason,
    notes
  });

  saveState();
  closeModal('adjustmentModal');
  refreshAllUI();
  showToast(`Stock successfully ${type === 'add' ? 'increased (+)' : 'reduced (-)'}!`);
}

// ==================== DAILY ONLINE DISPATCHES (MEESHO / AMAZON / FLIPKART) ====================
function initOnlineDispatchModal() {
  const form = document.getElementById("dispatchForm");
  if (form) form.reset();

  const today = new Date().toISOString().split('T')[0];
  document.getElementById("dispatchDate").value = today;
  document.getElementById("dispatchEditId").value = "";
  document.getElementById("dispatchModalTitle").innerHTML = `<i class="fa-solid fa-truck-fast text-indigo-600"></i> Daily Online Dispatch`;
  document.getElementById("dispatchItemsContainer").innerHTML = "";

  updateDispatchAccountsDropdown();
  addDispatchItemRow();
  calculateDispatchTotals();
}

function updateDispatchAccountsDropdown() {
  const platform = document.getElementById("dispatchPlatform")?.value || "Meesho";
  const select = document.getElementById("dispatchAccount");
  if (!select) return;

  const accounts = getSellerAccounts().filter(acc => acc.platform === platform || acc.platform === 'Other' || platform === 'Other');
  if (accounts.length > 0) {
    select.innerHTML = accounts.map(acc => `<option value="${acc.id}">${escapeHtml(acc.name)}</option>`).join('');
  } else {
    select.innerHTML = `<option value="${platform.toLowerCase()}_default">${platform} Main ID</option>`;
  }
}

function addDispatchItemRow(prodId = "", qty = 1) {
  const container = document.getElementById("dispatchItemsContainer");
  if (!container) return;

  const rowIndex = Date.now() + "_" + Math.random().toString(36).substr(2, 4);
  const row = document.createElement("div");
  row.className = "flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 dispatch-item-row";
  row.id = `disp_row_${rowIndex}`;

  row.innerHTML = `
    <div class="flex-grow">
      <select id="disp_prod_${rowIndex}" onchange="calculateDispatchTotals()" required class="input-pro py-1 text-xs font-semibold">
        <option value="">-- Select Product --</option>
        ${state.products.map(p => `<option value="${p.id}" ${p.id === prodId ? 'selected' : ''}>${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
      </select>
    </div>
    <div class="w-24 sm:w-28 flex items-center gap-1">
      <input type="number" id="disp_qty_${rowIndex}" min="1" value="${qty}" oninput="calculateDispatchTotals()" placeholder="Qty" required class="input-pro py-1 text-xs text-center font-bold font-mono text-indigo-700">
      <span class="text-xs text-slate-500 font-medium">pcs</span>
    </div>
    <button type="button" onclick="removeDispatchItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1 flex-shrink-0" title="Remove">
      <i class="fa-solid fa-trash-can"></i>
    </button>
  `;

  container.appendChild(row);
  calculateDispatchTotals();
}

function removeDispatchItemRow(rowIndex) {
  const row = document.getElementById(`disp_row_${rowIndex}`);
  if (row) row.remove();
  calculateDispatchTotals();
}

function calculateDispatchTotals() {
  const rows = document.querySelectorAll(".dispatch-item-row");
  let totalUnits = 0;
  rows.forEach(row => {
    const id = row.id.replace("disp_row_", "");
    const qtyInput = document.getElementById(`disp_qty_${id}`);
    if (qtyInput) {
      totalUnits += (parseInt(qtyInput.value) || 0);
    }
  });

  const dispEl = document.getElementById("dispatchTotalUnitsDisplay");
  if (dispEl) dispEl.textContent = `${totalUnits} pcs`;
}

function handleSaveOnlineDispatch(e) {
  e.preventDefault();
  const editId = document.getElementById("dispatchEditId").value;
  const date = document.getElementById("dispatchDate").value;
  const platform = document.getElementById("dispatchPlatform").value;
  const accountId = document.getElementById("dispatchAccount").value;
  const accountSelect = document.getElementById("dispatchAccount");
  const accountName = accountSelect.options[accountSelect.selectedIndex]?.text || platform;
  const notes = document.getElementById("dispatchNotes").value.trim();

  const rows = document.querySelectorAll(".dispatch-item-row");
  if (rows.length === 0) {
    showToast("Please select at least one product to dispatch!", true);
    return;
  }

  const items = [];
  let totalUnits = 0;

  rows.forEach(row => {
    const id = row.id.replace("disp_row_", "");
    const prodId = document.getElementById(`disp_prod_${id}`)?.value;
    const qty = parseInt(document.getElementById(`disp_qty_${id}`)?.value) || 0;

    if (!prodId || qty <= 0) return;

    const prod = state.products.find(p => p.id === prodId);
    if (!prod) return;

    totalUnits += qty;
    items.push({
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku || '',
      costPrice: prod.costPrice || 0,
      retailPrice: prod.retailPrice || 0,
      qty
    });
  });

  if (items.length === 0) {
    showToast("Please select valid products with quantity > 0!", true);
    return;
  }

  // If editing, first revert old stock quantities
  if (editId) {
    const oldDisp = (state.onlineDispatches || []).find(d => d.id === editId);
    if (oldDisp && Array.isArray(oldDisp.items)) {
      oldDisp.items.forEach(oldItem => {
        const prod = state.products.find(p => p.id === oldItem.productId);
        if (prod) {
          prod.currentStock = (Number(prod.currentStock) || 0) + (Number(oldItem.qty) || 0);
        }
      });
    }
  }

  // Deduct new dispatched quantities from stock
  items.forEach(item => {
    const prod = state.products.find(p => p.id === item.productId);
    if (prod) {
      prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - Number(item.qty));
    }
  });

  if (!state.onlineDispatches) state.onlineDispatches = [];

  if (editId) {
    const existing = state.onlineDispatches.find(d => d.id === editId);
    if (existing) {
      existing.date = date;
      existing.platform = platform;
      existing.accountId = accountId;
      existing.accountName = accountName;
      existing.items = items;
      existing.totalUnits = totalUnits;
      existing.notes = notes;
      showToast(`Dispatch entry updated & stock adjusted!`);
    }
  } else {
    const newDisp = {
      id: "disp_" + Date.now(),
      date,
      platform,
      accountId,
      accountName,
      items,
      totalUnits,
      notes
    };
    state.onlineDispatches.push(newDisp);
    showToast(`Recorded ${totalUnits} pcs dispatched on ${platform} (${accountName}) & stock updated!`);
  }

  saveState();
  closeModal('onlineDispatchModal');
  refreshAllUI();
}

function renderDispatchesTable() {
  const tbody = document.getElementById("dispatchesTableBody");
  if (!tbody) return;

  if (!state.onlineDispatches || state.onlineDispatches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-5 text-center text-slate-400">No online dispatches recorded yet. Click "New Dispatch Out" to record daily dispatches.</td></tr>`;
    return;
  }

  const sorted = [...state.onlineDispatches].sort((a, b) => (b.date > a.date ? 1 : -1));

  tbody.innerHTML = sorted.map(d => {
    let platformBadgeClass = "bg-slate-100 text-slate-700";
    if (d.platform === 'Meesho') platformBadgeClass = "bg-pink-50 text-pink-700 border border-pink-200 font-bold";
    else if (d.platform === 'Amazon') platformBadgeClass = "bg-amber-50 text-amber-800 border border-amber-200 font-bold";
    else if (d.platform === 'Flipkart') platformBadgeClass = "bg-blue-50 text-blue-700 border border-blue-200 font-bold";
    else if (d.platform === 'Other') platformBadgeClass = "bg-purple-50 text-purple-700 border border-purple-200 font-bold";

    const itemsSummary = (d.items || []).map(it => `
      <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-medium mr-1 mb-1">
        <b>${escapeHtml(it.productName)}</b>: <span class="font-mono font-bold text-indigo-700">${it.qty} pcs</span>
      </span>
    `).join('');

    return `
      <tr>
        <td class="font-mono text-slate-500 text-xs">${formatDate(d.date)}</td>
        <td>
          <span class="badge-status ${platformBadgeClass}">${escapeHtml(d.platform)}</span>
        </td>
        <td class="font-semibold text-slate-800 text-xs">${escapeHtml(d.accountName || d.platform)}</td>
        <td class="max-w-md">${itemsSummary}</td>
        <td class="text-right font-mono font-extrabold text-indigo-700 text-sm">${d.totalUnits} pcs</td>
        <td class="text-slate-500 text-xs">${escapeHtml(d.notes || '-')}</td>
        <td class="text-center space-x-1">
          <button onclick="editOnlineDispatch('${d.id}')" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Edit Dispatch">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteOnlineDispatch('${d.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete Dispatch">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function editOnlineDispatch(id) {
  const disp = (state.onlineDispatches || []).find(d => d.id === id);
  if (!disp) return;

  const form = document.getElementById("dispatchForm");
  if (form) form.reset();

  document.getElementById("dispatchEditId").value = disp.id;
  document.getElementById("dispatchDate").value = disp.date;
  document.getElementById("dispatchPlatform").value = disp.platform;
  updateDispatchAccountsDropdown();
  document.getElementById("dispatchAccount").value = disp.accountId;
  document.getElementById("dispatchNotes").value = disp.notes || "";
  document.getElementById("dispatchModalTitle").innerHTML = `<i class="fa-solid fa-truck-fast text-indigo-600"></i> Edit Dispatch (${disp.platform})`;

  const container = document.getElementById("dispatchItemsContainer");
  container.innerHTML = "";

  (disp.items || []).forEach(it => {
    addDispatchItemRow(it.productId, it.qty);
  });

  calculateDispatchTotals();
  openModal('onlineDispatchModal', 'edit');
}

function deleteOnlineDispatch(id) {
  const disp = (state.onlineDispatches || []).find(d => d.id === id);
  if (!disp) return;

  if (confirm(`Are you sure you want to delete this dispatch entry of ${disp.totalUnits} pcs? Note: Stock will be restored.`)) {
    if (disp.items && Array.isArray(disp.items)) {
      disp.items.forEach(item => {
        const prod = state.products.find(p => p.id === item.productId);
        if (prod) {
          prod.currentStock = (Number(prod.currentStock) || 0) + (Number(item.qty) || 0);
        }
      });
    }

    state.onlineDispatches = state.onlineDispatches.filter(d => d.id !== id);
    saveState();
    refreshAllUI();
    showToast("Dispatch deleted and stock restored!");
  }
}

// ==================== FAST DISPATCH BARCODE SCANNER & PACK MULTIPLIER ENGINE ====================

let scannerSession = {
  date: new Date().toISOString().split('T')[0],
  platform: 'Meesho',
  accountId: '',
  accountName: '',
  items: [] // { productId, productName, matchedSku, packLabel, multiplier, count, totalUnits }
};

let cameraStream = null;
let cameraScanInterval = null;

function playScannerAudio(isSuccess = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (isSuccess) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.warn("AudioContext audio beep failed", e);
  }
}

function findProductAndMultiplierByBarcode(rawCode) {
  if (!rawCode) return null;
  const cleanCode = rawCode.trim();
  const codeLower = cleanCode.toLowerCase();
  const codeUpper = cleanCode.toUpperCase();
  if (!codeUpper) return null;

  for (const p of (state.products || [])) {
    const candidatePrefixes = [];
    if (p.sku) candidatePrefixes.push(p.sku.trim().toUpperCase());
    if (p.prefix) candidatePrefixes.push(p.prefix.trim().toUpperCase());
    if (Array.isArray(p.skuMappings)) {
      p.skuMappings.forEach(m => {
        if (m.sku) candidatePrefixes.push(m.sku.trim().toUpperCase());
      });
    }

    // 1. Direct Exact Match on Master SKU or ID
    if ((p.sku && p.sku.trim().toLowerCase() === codeLower) || p.id.toLowerCase() === codeLower) {
      const digitMatch = (p.sku || '').match(/0*([1-9][0-9]?)$/);
      const mult = digitMatch ? parseInt(digitMatch[1]) : 1;
      return { product: p, matchedSku: p.sku || p.name, multiplier: mult, label: mult > 1 ? `Pack of ${mult} (${mult} pcs)` : 'Single (1 pc)' };
    }

    // 2. Direct Exact Match on mapped listing SKUs
    if (Array.isArray(p.skuMappings)) {
      for (const m of p.skuMappings) {
        if (m.sku && m.sku.trim().toLowerCase() === codeLower) {
          const mult = parseInt(m.multiplier) || 1;
          return { product: p, matchedSku: m.sku, multiplier: mult, label: m.note || `Pack of ${mult} (${mult} pcs)` };
        }
      }
    }

    // 3. SMART PREFIX + PACK NUMBER PATTERN (e.g. MMD01 -> 1pc, MMD02 -> 2pcs, MMD03 -> 3pcs, MMD04 -> 4pcs, MMD05 -> 5pcs)
    for (const pref of candidatePrefixes) {
      if (!pref || pref.length < 2) continue;

      // Extract alphanumeric base prefix (e.g. if pref is MMD01, base is MMD)
      const basePref = pref.replace(/[-_\s]*(?:P|PACK|PK|SET)?0*[1-9][0-9]?$/i, '');
      const prefixesToCheck = [pref];
      if (basePref && basePref.length >= 2 && !prefixesToCheck.includes(basePref)) {
        prefixesToCheck.push(basePref);
      }

      for (const curBase of prefixesToCheck) {
        const escaped = curBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Matches MMD01, MMD02, MMD05, MMD-1, MMD-2, MMD_P3, MMD-PACK-4, M1-MMD02, etc.
        const regex = new RegExp(`(?:^|[^A-Z0-9])${escaped}[-_\\s]*(?:P|PACK|PK|SET)?[-_\\s]*0*([1-9][0-9]?)(?:[^A-Z0-9]|$)`, 'i');
        const match = codeUpper.match(regex);
        if (match) {
          const qty = parseInt(match[1]) || 1;
          return {
            product: p,
            matchedSku: `${curBase}${qty < 10 ? '0' + qty : qty}`,
            multiplier: qty,
            label: `Pack of ${qty} (${qty} pcs)`
          };
        }
      }
    }

    // 4. Substring Match Fallback
    if (p.sku && p.sku.length >= 3 && codeLower.includes(p.sku.trim().toLowerCase())) {
      return { product: p, matchedSku: p.sku, multiplier: 1, label: 'Single (1 pc)' };
    }

    if (Array.isArray(p.skuMappings)) {
      for (const m of p.skuMappings) {
        if (m.sku && m.sku.length >= 3 && codeLower.includes(m.sku.trim().toLowerCase())) {
          const mult = parseInt(m.multiplier) || 1;
          return { product: p, matchedSku: m.sku, multiplier: mult, label: m.note || `Pack of ${mult} (${mult} pcs)` };
        }
      }
    }
  }
  return null;
}

function openDispatchScannerModal() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById("scannerDate");
  if (dateInput) dateInput.value = today;

  updateScannerAccountsDropdown();

  scannerSession = {
    date: today,
    platform: document.getElementById("scannerPlatform")?.value || 'Meesho',
    accountId: document.getElementById("scannerAccount")?.value || '',
    accountName: getSellerAccountName(document.getElementById("scannerAccount")?.value),
    items: []
  };

  renderScannerSessionTable();

  const statusText = document.getElementById("scannerStatusText");
  if (statusText) {
    statusText.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i> Ready to scan parcels. Point your barcode gun and pull trigger.`;
    statusText.className = "text-slate-700 font-semibold";
  }

  openModal('dispatchScannerModal');

  setTimeout(() => {
    const input = document.getElementById("scannerBarcodeGunInput");
    if (input) {
      input.value = "";
      input.focus();
    }
  }, 200);
}

function closeDispatchScannerModal() {
  stopCameraScanner();
  closeModal('dispatchScannerModal');
  refreshAllUI();
}

function updateScannerAccountsDropdown() {
  const platform = document.getElementById("scannerPlatform")?.value || "Meesho";
  const select = document.getElementById("scannerAccount");
  if (!select) return;

  const accounts = (state.settings.sellerAccounts || []).filter(a => a.platform === platform);

  if (accounts.length === 0) {
    select.innerHTML = `
      <option value="${platform}_default">${platform} - Account 1 (Main)</option>
      <option value="${platform}_acc2">${platform} - Account 2</option>
      <option value="${platform}_acc3">${platform} - Account 3</option>
    `;
  } else {
    select.innerHTML = accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  }
}

function handleBarcodeGunKeydown(e) {
  if (e.key === "Enter" || e.keyCode === 13) {
    e.preventDefault();
    submitManualScan();
  }
}

function submitManualScan() {
  const input = document.getElementById("scannerBarcodeGunInput");
  if (!input) return;
  const rawCode = input.value.trim();
  if (!rawCode) return;

  processScannedBarcode(rawCode);
  input.value = "";
  input.focus();
}

function processScannedBarcode(rawCode) {
  const match = findProductAndMultiplierByBarcode(rawCode);
  const statusText = document.getElementById("scannerStatusText");

  if (!match) {
    playScannerAudio(false);
    if (statusText) {
      statusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-600 mr-1"></i> <b>SKU / Barcode "${escapeHtml(rawCode)}" not found!</b> Please map this SKU under Product details.`;
      statusText.className = "text-rose-700 font-bold animate-pulse";
    }
    showToast(`Unknown Barcode: "${rawCode}"!`, true);
    return;
  }

  const prod = match.product;
  const multiplier = match.multiplier || 1;

  let deductionSummaryText = "";

  // Check if this is a Combo / Bundle Pack!
  if (prod.isBundle && Array.isArray(prod.bundleItems) && prod.bundleItems.length > 0) {
    const deductions = [];
    prod.bundleItems.forEach((comp, idx) => {
      const compProd = state.products.find(p => p.id === comp.productId);
      if (compProd) {
        // If secondary component has base qty of 1 (like 1 dispenser with 4, 8, 10, 12 bags), don't multiply dispenser!
        let deductQty = 0;
        if (idx === 0) {
          // Primary item (e.g. Garbage Bags) scales with pack size multiplier (4, 8, 10, 12)
          deductQty = (Number(comp.qty) || 1) * multiplier;
        } else {
          // Secondary accessories (e.g. 1 Dispenser) stay fixed at 1 pc per order package
          deductQty = Number(comp.qty) || 1;
        }
        compProd.currentStock = Math.max(0, (Number(compProd.currentStock) || 0) - deductQty);
        deductions.push(`-${deductQty} ${compProd.name}`);
      }
    });
    deductionSummaryText = deductions.join(" & ");
  } else {
    // Normal Single Product deduction
    prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - multiplier);
    deductionSummaryText = `-${multiplier} pcs ${prod.name}`;
  }

  // Add / Update item in scannerSession
  let sessionItem = scannerSession.items.find(it => it.productId === prod.id && it.matchedSku === match.matchedSku);
  if (sessionItem) {
    sessionItem.count += 1;
    sessionItem.totalUnits += multiplier;
  } else {
    scannerSession.items.push({
      productId: prod.id,
      productName: prod.name,
      matchedSku: match.matchedSku,
      packLabel: match.label,
      multiplier: multiplier,
      isBundle: !!prod.isBundle,
      bundleSummary: prod.isBundle ? (prod.bundleItems || []).map((b, idx) => `${idx === 0 ? multiplier * (b.qty || 1) : b.qty}x ${b.productName}`).join(" + ") : "",
      count: 1,
      totalUnits: multiplier
    });
  }

  // Update or record in state.onlineDispatches for today & platform/account
  recordScannerDispatchInState(prod, match, multiplier);

  playScannerAudio(true);

  if (statusText) {
    statusText.innerHTML = `
      <i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i>
      <b>${escapeHtml(prod.name)}</b> (${escapeHtml(match.label)}) ➔ 
      <span class="text-emerald-800 font-extrabold font-mono">${deductionSummaryText} Stock Out</span>
    `;
    statusText.className = "text-emerald-900 font-semibold";
  }

  renderScannerSessionTable();
  saveState();
}

function recordScannerDispatchInState(prod, match, multiplier) {
  const date = document.getElementById("scannerDate")?.value || new Date().toISOString().split('T')[0];
  const platform = document.getElementById("scannerPlatform")?.value || "Meesho";
  const accountSelect = document.getElementById("scannerAccount");
  const accountId = accountSelect?.value || `${platform}_default`;
  const accountName = accountSelect?.options[accountSelect?.selectedIndex]?.text || platform;

  if (!state.onlineDispatches) state.onlineDispatches = [];

  let dispatchEntry = state.onlineDispatches.find(d => d.date === date && d.platform === platform && d.accountId === accountId);

  const itemData = {
    productId: prod.id,
    productName: prod.name,
    sku: match.matchedSku,
    costPrice: prod.costPrice || 0,
    retailPrice: prod.retailPrice || 0,
    qty: multiplier,
    isBundle: !!prod.isBundle,
    bundleItems: prod.isBundle ? prod.bundleItems : null
  };

  if (dispatchEntry) {
    if (!Array.isArray(dispatchEntry.items)) dispatchEntry.items = [];
    let dispItem = dispatchEntry.items.find(it => it.productId === prod.id && it.sku === match.matchedSku);
    if (dispItem) {
      dispItem.qty = (Number(dispItem.qty) || 0) + multiplier;
    } else {
      dispatchEntry.items.push(itemData);
    }
    dispatchEntry.totalUnits = dispatchEntry.items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  } else {
    dispatchEntry = {
      id: "disp_" + Date.now(),
      date,
      platform,
      accountId,
      accountName,
      items: [itemData],
      totalUnits: multiplier,
      notes: "Scanned via Barcode Scanner"
    };
    state.onlineDispatches.push(dispatchEntry);
  }
}

function undoScannerSessionItem(index) {
  const item = scannerSession.items[index];
  if (!item) return;

  const prod = state.products.find(p => p.id === item.productId);
  if (prod && prod.isBundle && Array.isArray(prod.bundleItems)) {
    // Restore stock for all bundle components
    prod.bundleItems.forEach((comp, idx) => {
      const cProd = state.products.find(p => p.id === comp.productId);
      if (cProd) {
        const restoreQty = idx === 0 ? (Number(comp.qty) || 1) * item.multiplier : (Number(comp.qty) || 1);
        cProd.currentStock = (Number(cProd.currentStock) || 0) + restoreQty;
      }
    });
  } else if (prod) {
    prod.currentStock = (Number(prod.currentStock) || 0) + item.multiplier;
  }

  // Also remove units from onlineDispatches
  const date = document.getElementById("scannerDate")?.value || new Date().toISOString().split('T')[0];
  const platform = document.getElementById("scannerPlatform")?.value || "Meesho";
  const accountId = document.getElementById("scannerAccount")?.value;

  const dispatchEntry = (state.onlineDispatches || []).find(d => d.date === date && d.platform === platform && d.accountId === accountId);
  if (dispatchEntry && Array.isArray(dispatchEntry.items)) {
    const dispItem = dispatchEntry.items.find(it => it.productId === item.productId);
    if (dispItem) {
      dispItem.qty = Math.max(0, (Number(dispItem.qty) || 0) - item.multiplier);
      if (dispItem.qty === 0) {
        dispatchEntry.items = dispatchEntry.items.filter(it => it.productId !== item.productId);
      }
      dispatchEntry.totalUnits = dispatchEntry.items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    }
  }

  if (item.count > 1) {
    item.count -= 1;
    item.totalUnits -= item.multiplier;
  } else {
    scannerSession.items.splice(index, 1);
  }

  renderScannerSessionTable();
  saveState();
  showToast("Scan undone! Stock restored.");
}

function renderScannerSessionTable() {
  const tbody = document.getElementById("scannerSessionTableBody");
  if (!tbody) return;

  const totalSessionUnits = scannerSession.items.reduce((acc, it) => acc + it.totalUnits, 0);
  const totalOrders = scannerSession.items.reduce((acc, it) => acc + it.count, 0);

  const badgeEl = document.getElementById("scannerSessionUnitBadge");
  if (badgeEl) badgeEl.textContent = `Session: ${totalOrders} pkgs (${totalSessionUnits} pcs)`;

  const totalEl = document.getElementById("scannerBatchTotalCount");
  if (totalEl) totalEl.textContent = `Total Orders: ${totalOrders} | Total Units: ${totalSessionUnits} pcs`;

  if (scannerSession.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-slate-400">No parcels scanned yet in this session. Point scanner at a shipping label.</td></tr>`;
    return;
  }

  tbody.innerHTML = scannerSession.items.map((it, idx) => {
    const prod = state.products.find(p => p.id === it.productId);
    let stockDisplay = "";
    if (prod && prod.isBundle && Array.isArray(prod.bundleItems)) {
      stockDisplay = prod.bundleItems.map(comp => {
        const cProd = state.products.find(p => p.id === comp.productId);
        return `${cProd ? cProd.name.split(' ')[0] : 'Item'}: ${cProd ? cProd.currentStock : 0}`;
      }).join(", ");
    } else {
      stockDisplay = `${prod ? prod.currentStock : 0} pcs`;
    }

    return `
      <tr class="hover:bg-slate-50">
        <td>
          <div class="font-bold text-slate-900 text-xs">${escapeHtml(it.productName)}</div>
          ${it.isBundle ? `<div class="text-[10px] text-amber-700 font-semibold"><i class="fa-solid fa-boxes-packing"></i> Combo (${escapeHtml(it.bundleSummary)})</div>` : ''}
        </td>
        <td class="font-mono text-slate-600 text-xs">${escapeHtml(it.matchedSku)}</td>
        <td class="text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${it.isBundle ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}">
            ${escapeHtml(it.packLabel)}
          </span>
        </td>
        <td class="text-right font-mono font-bold text-slate-800">${it.count}</td>
        <td class="text-right font-mono font-extrabold text-indigo-900 text-sm bg-indigo-50/50">${it.totalUnits} pkgs</td>
        <td class="text-right font-mono font-bold text-emerald-700 text-xs">${stockDisplay}</td>
        <td class="text-center">
          <button onclick="undoScannerSessionItem(${idx})" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded" title="Undo / Minus 1 Scan">
            <i class="fa-solid fa-rotate-left text-xs"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function clearScannerSession() {
  if (confirm("Reset current scanner session display? (Note: Already saved dispatches remain in log)")) {
    scannerSession.items = [];
    renderScannerSessionTable();
  }
}

function completeScannerSession() {
  closeDispatchScannerModal();
  showToast("Dispatch scanning session completed! All inventory updated.");
}

// Camera Scanner Implementation using Html5Qrcode Library (Works on all iPhone & Android browsers)
let html5QrScanner = null;
let lastScannedText = "";
let lastScannedTimestamp = 0;

async function toggleCameraScanner() {
  const container = document.getElementById("scannerCameraContainer");
  const btnText = document.getElementById("cameraBtnText");

  if (!container.classList.contains("hidden")) {
    stopCameraScanner();
    return;
  }

  try {
    container.classList.remove("hidden");
    if (btnText) btnText.textContent = "Stop Camera";

    if (typeof Html5Qrcode !== "undefined") {
      html5QrScanner = new Html5Qrcode("scannerQrReader");
      
      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ]
      };

      await html5QrScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          const now = Date.now();
          // Debounce same barcode within 1.5 seconds
          if (decodedText === lastScannedText && (now - lastScannedTimestamp) < 1500) {
            return;
          }
          lastScannedText = decodedText;
          lastScannedTimestamp = now;
          processScannedBarcode(decodedText);
        },
        (errorMessage) => {
          // ignore scan frame error
        }
      );
    } else {
      showToast("Mobile camera scanner is initializing...", false);
    }
  } catch (err) {
    console.error("Camera access error:", err);
    showToast("Unable to start camera: " + (err.message || err), true);
    stopCameraScanner();
  }
}

async function stopCameraScanner() {
  const container = document.getElementById("scannerCameraContainer");
  const btnText = document.getElementById("cameraBtnText");
  if (container) container.classList.add("hidden");
  if (btnText) btnText.textContent = "Use Camera Scanner";

  if (html5QrScanner) {
    try {
      await html5QrScanner.stop();
      html5QrScanner.clear();
    } catch (e) {
      console.warn("Error stopping Html5Qrcode", e);
    }
    html5QrScanner = null;
  }
}

// ==================== WHOLESALE PARTIES DIRECTORY & SALES ====================
function getWholesaleParties() {
  if (!state.customers || !Array.isArray(state.customers)) {
    state.customers = [];
  }
  
  const existingNames = new Set(state.customers.map(c => (c.name || '').trim().toLowerCase()));
  (state.sales || []).forEach(s => {
    const name = (s.customerName || '').trim();
    if (name && !existingNames.has(name.toLowerCase())) {
      existingNames.add(name.toLowerCase());
      state.customers.push({
        id: "cust_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        name: name,
        phone: s.customerPhone || "",
        city: s.customerCity || "",
        gstNo: s.customerGst || "",
        address: s.customerAddress || ""
      });
    }
  });

  return state.customers;
}

function updatePartiesDatalist() {
  const datalist = document.getElementById("partiesDatalist");
  const select = document.getElementById("salePartySelect");
  const parties = getWholesaleParties();

  if (datalist) {
    datalist.innerHTML = parties.map(p => `
      <option value="${escapeHtml(p.name)}">${p.city ? `(${escapeHtml(p.city)})` : ''} ${p.phone ? `Ph: ${escapeHtml(p.phone)}` : ''} ${p.gstNo ? `GST: ${escapeHtml(p.gstNo)}` : ''}</option>
    `).join('');
  }

  if (select) {
    const currentVal = select.value;
    select.innerHTML = `
      <option value="">-- Or Choose from Saved Parties Directory --</option>
      ${parties.map(p => `
        <option value="${p.id}" ${p.id === currentVal ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.city || 'No City')} - Ph: ${escapeHtml(p.phone || 'N/A')}${p.gstNo ? ` - GST: ${escapeHtml(p.gstNo)}` : ''})</option>
      `).join('')}
    `;
  }
}

function onPartySelectDropdownChange() {
  const select = document.getElementById("salePartySelect");
  if (!select) return;
  const partyId = select.value;
  if (!partyId) return;

  const parties = getWholesaleParties();
  const party = parties.find(p => p.id === partyId);
  if (!party) return;

  if (document.getElementById("saleCustomerName")) document.getElementById("saleCustomerName").value = party.name || "";
  if (document.getElementById("saleCustomerPhone")) document.getElementById("saleCustomerPhone").value = party.phone || "";
  if (document.getElementById("saleCustomerCity")) document.getElementById("saleCustomerCity").value = party.city || "";
  if (document.getElementById("saleCustomerGst")) document.getElementById("saleCustomerGst").value = party.gstNo || "";
  if (document.getElementById("saleCustomerAddress")) document.getElementById("saleCustomerAddress").value = party.address || "";

  showToast(`Auto-filled details for "${party.name}"!`);
}

function onPartyNameSelected() {
  const nameInput = document.getElementById("saleCustomerName");
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) return;

  const parties = getWholesaleParties();
  const matched = parties.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (matched) {
    if (document.getElementById("saleCustomerPhone") && matched.phone) document.getElementById("saleCustomerPhone").value = matched.phone;
    if (document.getElementById("saleCustomerCity") && matched.city) document.getElementById("saleCustomerCity").value = matched.city;
    if (document.getElementById("saleCustomerGst") && matched.gstNo) document.getElementById("saleCustomerGst").value = matched.gstNo;
    if (document.getElementById("saleCustomerAddress") && matched.address) document.getElementById("saleCustomerAddress").value = matched.address;
    
    const select = document.getElementById("salePartySelect");
    if (select) select.value = matched.id;
  }
}

function openPartyModal(partyId = "") {
  const form = document.getElementById("partyForm");
  if (form) form.reset();

  document.getElementById("partyEditId").value = "";
  document.getElementById("partyModalTitle").innerHTML = `<i class="fa-solid fa-user-tag text-indigo-600"></i> New Wholesale Party / Customer`;

  if (partyId) {
    const parties = getWholesaleParties();
    const p = parties.find(x => x.id === partyId);
    if (p) {
      document.getElementById("partyEditId").value = p.id;
      document.getElementById("partyName").value = p.name || "";
      document.getElementById("partyPhone").value = p.phone || "";
      document.getElementById("partyCity").value = p.city || "";
      document.getElementById("partyGst").value = p.gstNo || "";
      document.getElementById("partyAddress").value = p.address || "";
      document.getElementById("partyModalTitle").innerHTML = `<i class="fa-solid fa-user-pen text-indigo-600"></i> Edit Party (${escapeHtml(p.name)})`;
    }
  } else {
    // Pre-fill from saleModal if open
    const curName = document.getElementById("saleCustomerName")?.value || "";
    const curPhone = document.getElementById("saleCustomerPhone")?.value || "";
    const curCity = document.getElementById("saleCustomerCity")?.value || "";
    const curGst = document.getElementById("saleCustomerGst")?.value || "";
    const curAddr = document.getElementById("saleCustomerAddress")?.value || "";
    if (curName) document.getElementById("partyName").value = curName;
    if (curPhone) document.getElementById("partyPhone").value = curPhone;
    if (curCity) document.getElementById("partyCity").value = curCity;
    if (curGst) document.getElementById("partyGst").value = curGst;
    if (curAddr) document.getElementById("partyAddress").value = curAddr;
  }

  openModal('partyModal');
}

function handleSaveParty(e) {
  if (e && e.preventDefault) e.preventDefault();

  const editId = document.getElementById("partyEditId")?.value || "";
  const name = (document.getElementById("partyName")?.value || "").trim();
  const phone = (document.getElementById("partyPhone")?.value || "").trim();
  const city = (document.getElementById("partyCity")?.value || "").trim();
  const gstNo = (document.getElementById("partyGst")?.value || "").trim().toUpperCase();
  const address = (document.getElementById("partyAddress")?.value || "").trim();

  if (!name) {
    showToast("Please enter Party / Business Name!", true);
    return;
  }

  if (!state.customers) state.customers = [];

  let savedParty = null;
  if (editId) {
    const existing = state.customers.find(p => p.id === editId);
    if (existing) {
      existing.name = name;
      existing.phone = phone;
      existing.city = city;
      existing.gstNo = gstNo;
      existing.address = address;
      savedParty = existing;
      showToast(`Party "${name}" updated!`);
    }
  } else {
    const existing = state.customers.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.phone = phone || existing.phone;
      existing.city = city || existing.city;
      existing.gstNo = gstNo || existing.gstNo;
      existing.address = address || existing.address;
      savedParty = existing;
      showToast(`Party "${name}" updated!`);
    } else {
      const newParty = {
        id: "cust_" + Date.now(),
        name,
        phone,
        city,
        gstNo,
        address
      };
      state.customers.push(newParty);
      savedParty = newParty;
      showToast(`Party "${name}" added successfully!`);
    }
  }

  saveState();
  closeModal('partyModal');
  updatePartiesDatalist();

  // If saleModal is open, auto-fill it
  if (document.getElementById("saleCustomerName")) {
    document.getElementById("saleCustomerName").value = name;
    if (document.getElementById("saleCustomerPhone")) document.getElementById("saleCustomerPhone").value = phone;
    if (document.getElementById("saleCustomerCity")) document.getElementById("saleCustomerCity").value = city;
    if (document.getElementById("saleCustomerGst")) document.getElementById("saleCustomerGst").value = gstNo;
    if (document.getElementById("saleCustomerAddress")) document.getElementById("saleCustomerAddress").value = address;
    if (document.getElementById("salePartySelect") && savedParty) document.getElementById("salePartySelect").value = savedParty.id;
  }

  renderPartiesManageTable();
}

function openPartiesManageModal() {
  renderPartiesManageTable();
  openModal('partiesManageModal');
}

function renderPartiesManageTable() {
  const tbody = document.getElementById("partiesManageTableBody");
  if (!tbody) return;

  const query = (document.getElementById("partiesSearchInput")?.value || "").toLowerCase().trim();
  let parties = getWholesaleParties();

  if (query) {
    parties = parties.filter(p => 
      (p.name || '').toLowerCase().includes(query) ||
      (p.phone || '').toLowerCase().includes(query) ||
      (p.city || '').toLowerCase().includes(query) ||
      (p.gstNo || '').toLowerCase().includes(query) ||
      (p.address || '').toLowerCase().includes(query)
    );
  }

  if (parties.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No parties found. Click "+ Add New Party" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = parties.map(p => `
    <tr class="hover:bg-slate-50">
      <td class="font-bold text-slate-900">${escapeHtml(p.name)}</td>
      <td class="font-mono text-slate-700">${p.phone ? `<a href="tel:${escapeHtml(p.phone)}" class="text-indigo-600 hover:underline font-semibold">${escapeHtml(p.phone)}</a>` : '-'}</td>
      <td class="text-slate-600">${escapeHtml(p.city || '-')}</td>
      <td class="font-mono font-bold text-slate-800 text-xs">${p.gstNo ? `<span class="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">${escapeHtml(p.gstNo)}</span>` : '-'}</td>
      <td class="text-slate-500 text-xs max-w-xs truncate" title="${escapeHtml(p.address || '')}">${escapeHtml(p.address || '-')}</td>
      <td class="text-center space-x-1">
        <button onclick="openPartyModal('${p.id}')" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Edit Party">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="deleteParty('${p.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete Party">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function deleteParty(id) {
  if (confirm("Are you sure you want to delete this party from the directory?")) {
    state.customers = (state.customers || []).filter(p => p.id !== id);
    saveState();
    updatePartiesDatalist();
    renderPartiesManageTable();
    showToast("Party removed from directory!");
  }
}

function initSaleModal(saleType = 'wholesale') {
  const form = document.getElementById("saleForm");
  if (form) form.reset();

  const today = new Date().toISOString().split('T')[0];
  document.getElementById("saleDate").value = today;
  document.getElementById("saleEditId").value = "";
  document.getElementById("saleModalTitle").textContent = "New Wholesale Bill (B2B)";
  document.getElementById("saleItemsContainer").innerHTML = "";

  document.getElementById("salePaymentStatus").value = "Paid";

  updatePartiesDatalist();

  addSaleItemRow();
  calculateSaleTotal();
  toggleSalePaidAmount();
}

function editSale(id) {
  const sale = state.sales.find(s => s.id === id);
  if (!sale) return;

  const form = document.getElementById("saleForm");
  if (form) form.reset();

  updatePartiesDatalist();

  document.getElementById("saleEditId").value = sale.id;
  document.getElementById("saleDate").value = sale.date;
  document.getElementById("saleModalTitle").textContent = `Edit Sale (${sale.invoiceNo})`;

  document.getElementById("saleCustomerName").value = sale.customerName || "";
  document.getElementById("saleCustomerPhone").value = sale.customerPhone || "";
  document.getElementById("saleCustomerCity").value = sale.customerCity || "";
  if (document.getElementById("saleCustomerGst")) document.getElementById("saleCustomerGst").value = sale.customerGst || "";
  if (document.getElementById("saleCustomerAddress")) document.getElementById("saleCustomerAddress").value = sale.customerAddress || "";

  document.getElementById("salePaymentStatus").value = sale.paymentStatus || "Paid";
  document.getElementById("salePaidAmount").value = sale.paidAmount !== undefined ? sale.paidAmount : (sale.paymentStatus === 'Pending' ? 0 : sale.totalAmount);
  if (document.getElementById("saleReceivedBy")) {
    document.getElementById("saleReceivedBy").value = sale.receivedBy || "partner1";
  }
  document.getElementById("saleNotes").value = sale.notes || "";

  const container = document.getElementById("saleItemsContainer");
  container.innerHTML = "";
  (sale.items || []).forEach(it => {
    addSaleItemRow(it.productId, it.qty, it.price, it.discountPercent, it.discountAmount, it.gstRate);
  });

  calculateSaleTotal();
  toggleSalePaidAmount();
  toggleSalePaidAmountInput();
  openModal('saleModal', 'edit');
}

function addSaleItemRow(prodId = "", qty = 1, customPrice = null, discPercent = null, discAmount = null, gstRate = 0) {
  const container = document.getElementById("saleItemsContainer");
  if (!container) return;

  const rowIndex = Date.now() + "_" + Math.random().toString(36).substr(2, 4);
  const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'wholesale';

  let initialPrice = 0;
  if (customPrice !== null && customPrice !== undefined) {
    initialPrice = customPrice;
  } else if (prodId) {
    const prod = state.products.find(p => p.id === prodId);
    if (prod) {
      initialPrice = (saleType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice) || 0;
    }
  }

  const dPct = (discPercent !== null && discPercent !== undefined && discPercent > 0) ? discPercent : "";
  const dAmt = (discAmount !== null && discAmount !== undefined && discAmount > 0) ? discAmount : "";
  const gRate = (gstRate !== null && gstRate !== undefined) ? gstRate : 0;

  const row = document.createElement("div");
  row.className = "bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5 sale-item-row hover:border-indigo-400 transition-all";
  row.id = `sale_row_${rowIndex}`;

  row.innerHTML = `
    <!-- Top: Wide Product Select & Item Total Badge -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex-grow">
        <label class="block text-[11px] font-bold text-slate-700 mb-1">
          <i class="fa-solid fa-box-open text-indigo-600"></i> Select Product *
        </label>
        <select onchange="onSaleProductSelect('${rowIndex}')" id="sale_prod_${rowIndex}" required class="input-pro py-1.5 text-xs sm:text-sm font-semibold">
          <option value="">-- Choose Product --</option>
          ${state.products.map(p => {
            const activeBatches = (p.purchaseBatches || []).filter(b => b.remainingQty > 0);
            let batchInfo = `Stock: ${p.currentStock}`;
            if (activeBatches.length > 1) {
              batchInfo += ` [${activeBatches.map(b => `${b.remainingQty}@₹${b.netCostPrice}`).join(', ')}]`;
            } else if (activeBatches.length === 1) {
              batchInfo += ` [Cost: ₹${activeBatches[0].netCostPrice}]`;
            }
            return `<option value="${p.id}" ${p.id === prodId ? 'selected' : ''}>${escapeHtml(p.name)} (${batchInfo})</option>`;
          }).join('')}
        </select>
      </div>
      <div class="text-right flex-shrink-0 pt-3">
        <div class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Item Total (Incl. GST)</div>
        <div class="flex items-center gap-2">
          <span id="sale_subtotal_${rowIndex}" class="font-mono text-sm sm:text-base font-bold text-emerald-700">₹0</span>
          <button type="button" onclick="removeSaleItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Remove Product">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom: 5 Spacious Input Boxes with Top Labels -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Qty (pcs) *</label>
        <input type="number" id="sale_qty_${rowIndex}" min="1" value="${qty}" oninput="onSaleRowQtyOrPriceChange('${rowIndex}')" placeholder="Qty" required class="input-pro py-1.5 text-xs sm:text-sm text-center font-bold font-mono">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Selling Rate (₹) *</label>
        <input type="number" id="sale_price_${rowIndex}" min="0" step="any" value="${initialPrice > 0 ? initialPrice : ''}" oninput="onSaleRowQtyOrPriceChange('${rowIndex}')" placeholder="₹ Rate" required class="input-pro py-1.5 text-xs sm:text-sm text-right font-bold text-slate-800 font-mono">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Discount (%)</label>
        <input type="number" id="sale_disc_pct_${rowIndex}" min="0" max="100" step="any" value="${dPct}" oninput="onSaleRowDiscPercentChange('${rowIndex}')" placeholder="0%" class="input-pro py-1.5 text-xs sm:text-sm text-right font-mono font-bold text-indigo-700">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Discount (₹)</label>
        <input type="number" id="sale_disc_amt_${rowIndex}" min="0" step="any" value="${dAmt}" oninput="onSaleRowDiscAmountChange('${rowIndex}')" placeholder="₹0.00" class="input-pro py-1.5 text-xs sm:text-sm text-right font-mono font-bold text-rose-600">
      </div>
      <div class="col-span-2 sm:col-span-1">
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">GST Rate (%)</label>
        <select id="sale_gst_${rowIndex}" onchange="onSaleRowQtyOrPriceChange('${rowIndex}')" class="input-pro py-1.5 text-xs sm:text-sm font-bold text-indigo-700">
          <option value="0" ${gRate == 0 ? 'selected' : ''}>0% (Nil)</option>
          <option value="5" ${gRate == 5 ? 'selected' : ''}>5%</option>
          <option value="12" ${gRate == 12 ? 'selected' : ''}>12%</option>
          <option value="18" ${gRate == 18 ? 'selected' : ''}>18%</option>
          <option value="28" ${gRate == 28 ? 'selected' : ''}>28%</option>
        </select>
      </div>
    </div>
  `;

  container.appendChild(row);
  onSaleRowQtyOrPriceChange(rowIndex);
}

function removeSaleItemRow(rowIndex) {
  const row = document.getElementById(`sale_row_${rowIndex}`);
  if (row) row.remove();
  calculateSaleTotal();
}

function onSaleProductSelect(rowIndex) {
  const prodId = document.getElementById(`sale_prod_${rowIndex}`).value;
  const prod = state.products.find(p => p.id === prodId);
  const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'wholesale';

  if (prod) {
    const priceInput = document.getElementById(`sale_price_${rowIndex}`);
    if (priceInput) {
      priceInput.value = (saleType === 'wholesale' ? (prod.wholesalePrice || prod.retailPrice) : prod.retailPrice) || 0;
    }
  }
  onSaleRowQtyOrPriceChange(rowIndex);
}

function updateSaleItemPricesBasedOnType(saleType) {
  const rows = document.querySelectorAll(".sale-item-row");
  rows.forEach(row => {
    const id = row.id.replace("sale_row_", "");
    const prodId = document.getElementById(`sale_prod_${id}`)?.value;
    const prod = state.products.find(p => p.id === prodId);
    if (prod) {
      const priceInput = document.getElementById(`sale_price_${id}`);
      if (priceInput && !document.getElementById("saleEditId").value) {
        priceInput.value = (saleType === 'wholesale' ? (prod.wholesalePrice || prod.retailPrice) : prod.retailPrice) || 0;
        onSaleRowQtyOrPriceChange(id);
      }
    }
  });
}

function onSaleRowDiscPercentChange(rowIndex) {
  const qty = parseFloat(document.getElementById(`sale_qty_${rowIndex}`)?.value) || 0;
  const price = parseFloat(document.getElementById(`sale_price_${rowIndex}`)?.value) || 0;
  const gross = qty * price;

  const pctInput = document.getElementById(`sale_disc_pct_${rowIndex}`);
  const amtInput = document.getElementById(`sale_disc_amt_${rowIndex}`);

  let pct = parseFloat(pctInput?.value) || 0;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  if (pctInput && pctInput.value !== "" && pctInput.value != pct) pctInput.value = pct;

  if (pct > 0 && gross > 0) {
    const discAmt = Math.round(((gross * pct) / 100) * 100) / 100;
    if (amtInput) amtInput.value = discAmt;
  } else {
    if (amtInput) amtInput.value = "";
  }
  onSaleRowQtyOrPriceChange(rowIndex);
}

function onSaleRowDiscAmountChange(rowIndex) {
  const qty = parseFloat(document.getElementById(`sale_qty_${rowIndex}`)?.value) || 0;
  const price = parseFloat(document.getElementById(`sale_price_${rowIndex}`)?.value) || 0;
  const gross = qty * price;

  const pctInput = document.getElementById(`sale_disc_pct_${rowIndex}`);
  const amtInput = document.getElementById(`sale_disc_amt_${rowIndex}`);

  let discAmt = parseFloat(amtInput?.value) || 0;
  if (discAmt < 0) discAmt = 0;
  if (gross > 0 && discAmt > gross) discAmt = gross;
  if (amtInput && amtInput.value !== "" && amtInput.value != discAmt) amtInput.value = discAmt;

  if (discAmt > 0 && gross > 0) {
    const pct = Math.round(((discAmt / gross) * 100) * 100) / 100;
    if (pctInput) pctInput.value = pct;
  } else {
    if (pctInput) pctInput.value = "";
  }
  onSaleRowQtyOrPriceChange(rowIndex);
}

function onSaleRowQtyOrPriceChange(rowIndex) {
  const qty = parseFloat(document.getElementById(`sale_qty_${rowIndex}`)?.value) || 0;
  const price = parseFloat(document.getElementById(`sale_price_${rowIndex}`)?.value) || 0;
  const gross = qty * price;

  const pctInput = document.getElementById(`sale_disc_pct_${rowIndex}`);
  const amtInput = document.getElementById(`sale_disc_amt_${rowIndex}`);

  if (pctInput && pctInput.value !== "") {
    const pct = parseFloat(pctInput.value) || 0;
    if (pct > 0 && gross > 0) {
      const discAmt = Math.round(((gross * pct) / 100) * 100) / 100;
      if (amtInput) amtInput.value = discAmt;
    } else {
      if (amtInput) amtInput.value = "";
    }
  } else if (amtInput && amtInput.value !== "") {
    const discAmt = parseFloat(amtInput.value) || 0;
    if (discAmt > 0 && gross > 0) {
      const pct = Math.round(((discAmt / gross) * 100) * 100) / 100;
      if (pctInput) pctInput.value = pct;
    } else {
      if (pctInput) pctInput.value = "";
    }
  }

  const discAmt = parseFloat(document.getElementById(`sale_disc_amt_${rowIndex}`)?.value) || 0;
  const taxable = Math.max(0, gross - discAmt);
  const gstPct = parseFloat(document.getElementById(`sale_gst_${rowIndex}`)?.value) || 0;
  const gstAmt = Math.round(((taxable * gstPct) / 100) * 100) / 100;
  const rowNetTotal = taxable + gstAmt;

  const subEl = document.getElementById(`sale_subtotal_${rowIndex}`);
  if (subEl) {
    if (gstAmt > 0) {
      subEl.innerHTML = `<span>${formatCurrency(rowNetTotal)}</span> <span class="text-[10px] text-slate-500 font-normal block font-sans">Taxable: ${formatCurrency(taxable)} + GST: ${formatCurrency(gstAmt)}</span>`;
    } else {
      subEl.textContent = formatCurrency(rowNetTotal);
    }
  }

  calculateSaleTotal();
}

function calculateSaleTotal() {
  const rows = document.querySelectorAll(".sale-item-row");
  let totalGross = 0;
  let totalDiscounts = 0;
  let totalTaxable = 0;
  let totalGst = 0;
  let netGrandTotal = 0;
  let totalEstimatedCost = 0;

  rows.forEach(row => {
    const id = row.id.replace("sale_row_", "");
    const prodId = document.getElementById(`sale_prod_${id}`)?.value;
    const qty = parseFloat(document.getElementById(`sale_qty_${id}`)?.value) || 0;
    const price = parseFloat(document.getElementById(`sale_price_${id}`)?.value) || 0;
    const gross = qty * price;
    totalGross += gross;

    const discAmt = parseFloat(document.getElementById(`sale_disc_amt_${id}`)?.value) || 0;
    totalDiscounts += discAmt;

    const taxable = Math.max(0, gross - discAmt);
    totalTaxable += taxable;

    const gstPct = parseFloat(document.getElementById(`sale_gst_${id}`)?.value) || 0;
    const gstAmt = Math.round(((taxable * gstPct) / 100) * 100) / 100;
    totalGst += gstAmt;

    const rowNetTotal = taxable + gstAmt;
    netGrandTotal += rowNetTotal;

    const prod = state.products.find(p => p.id === prodId);
    if (prod) {
      totalEstimatedCost += (qty * (Number(prod.costPrice) || 0));
    }
  });

  const grossEl = document.getElementById("saleGrossDisplay");
  if (grossEl) grossEl.textContent = formatCurrency(totalGross);

  const discEl = document.getElementById("saleTotalDiscountDisplay");
  if (discEl) discEl.textContent = `-${formatCurrency(totalDiscounts)}`;

  const gstEl = document.getElementById("saleTotalGstDisplay");
  if (gstEl) gstEl.textContent = `+${formatCurrency(totalGst)}`;

  const dTotal = document.getElementById("saleTotalDisplay");
  if (dTotal) dTotal.textContent = formatCurrency(netGrandTotal);

  const profitEl = document.getElementById("saleProfitDisplay");
  if (profitEl) {
    const profit = netGrandTotal - totalEstimatedCost;
    profitEl.textContent = `Profit: +${formatCurrency(profit)}`;
  }

  const status = document.getElementById("salePaymentStatus")?.value;
  const paidInput = document.getElementById("salePaidAmount");
  const recvGroup = document.getElementById("saleReceivedByGroup");

  if (status === 'Paid' && paidInput && !document.getElementById("saleEditId").value) {
    paidInput.value = netGrandTotal;
    if (recvGroup) recvGroup.classList.remove("hidden");
  } else if (status === 'Pending') {
    if (recvGroup) recvGroup.classList.add("hidden");
  } else if (status === 'Partial') {
    const paidAmt = parseFloat(paidInput?.value) || 0;
    if (paidAmt > 0 && recvGroup) recvGroup.classList.remove("hidden");
  }
}

function toggleSalePaidAmount() {
  const status = document.getElementById("salePaymentStatus")?.value;
  const paidInput = document.getElementById("salePaidAmount");
  const recvGroup = document.getElementById("saleReceivedByGroup");
  const total = parseFloat(document.getElementById("saleTotalDisplay")?.textContent.replace(/[₹,]/g, '')) || 0;

  if (status === 'Paid') {
    if (paidInput) paidInput.value = total;
    if (recvGroup) recvGroup.classList.remove("hidden");
  } else if (status === 'Pending') {
    if (paidInput) paidInput.value = 0;
    if (recvGroup) recvGroup.classList.add("hidden");
  } else if (status === 'Partial') {
    const paidAmt = parseFloat(paidInput?.value) || 0;
    if (paidAmt > 0 && recvGroup) recvGroup.classList.remove("hidden");
  }
}

function toggleSalePaidAmountInput() {
  const paidAmt = parseFloat(document.getElementById("salePaidAmount")?.value) || 0;
  const recvGroup = document.getElementById("saleReceivedByGroup");
  if (paidAmt > 0) {
    if (recvGroup) recvGroup.classList.remove("hidden");
  } else {
    if (recvGroup) recvGroup.classList.add("hidden");
  }
}

function handleSaveSale(e) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    const editId = document.getElementById("saleEditId")?.value || "";
    const date = document.getElementById("saleDate")?.value || new Date().toISOString().split('T')[0];
    const customerName = document.getElementById("saleCustomerName")?.value.trim();
    const customerPhone = document.getElementById("saleCustomerPhone")?.value.trim() || "";
    const customerCity = document.getElementById("saleCustomerCity")?.value.trim() || "";
    const customerGst = document.getElementById("saleCustomerGst")?.value.trim().toUpperCase() || "";
    const customerAddress = document.getElementById("saleCustomerAddress")?.value.trim() || "";
    let paymentStatus = document.getElementById("salePaymentStatus")?.value || "Paid";
    const notes = document.getElementById("saleNotes")?.value.trim() || "";

    if (!customerName) {
      showToast("Please enter Party / Customer Name!", true);
      document.getElementById("saleCustomerName")?.focus();
      return;
    }

    // Auto save party into state.customers if new or update existing
    const parties = getWholesaleParties();
    const matched = parties.find(p => p.name.toLowerCase() === customerName.toLowerCase());
    if (matched) {
      if (customerPhone) matched.phone = customerPhone;
      if (customerCity) matched.city = customerCity;
      if (customerGst) matched.gstNo = customerGst;
      if (customerAddress) matched.address = customerAddress;
    } else {
      state.customers.push({
        id: "cust_" + Date.now(),
        name: customerName,
        phone: customerPhone,
        city: customerCity,
        gstNo: customerGst,
        address: customerAddress
      });
    }

    if (editId) {
      const oldSale = state.sales.find(s => s.id === editId);
      if (oldSale && oldSale.items) {
        oldSale.items.forEach(it => {
          const prod = state.products.find(p => p.id === it.productId);
          if (prod) {
            prod.currentStock = (Number(prod.currentStock) || 0) + (Number(it.qty) || 0);
          }
        });
      }
    }

    const rows = document.querySelectorAll(".sale-item-row");
    if (rows.length === 0) {
      showToast("Please select at least one product!", true);
      return;
    }

    const items = [];
    let totalGross = 0;
    let totalDiscounts = 0;
    let totalTaxable = 0;
    let totalGst = 0;
    let netGrandTotal = 0;

    rows.forEach(row => {
      const id = row.id.replace("sale_row_", "");
      const prodId = document.getElementById(`sale_prod_${id}`)?.value;
      const qty = parseInt(document.getElementById(`sale_qty_${id}`)?.value) || 0;
      const price = parseFloat(document.getElementById(`sale_price_${id}`)?.value) || 0;
      const discountPercent = parseFloat(document.getElementById(`sale_disc_pct_${id}`)?.value) || 0;
      const discountAmount = parseFloat(document.getElementById(`sale_disc_amt_${id}`)?.value) || 0;
      const gstRate = parseFloat(document.getElementById(`sale_gst_${id}`)?.value) || 0;

      if (!prodId || qty <= 0) return;

      const prod = state.products.find(p => p.id === prodId);
      if (!prod) return;

      const gross = qty * price;
      const taxable = Math.max(0, gross - discountAmount);
      const gstAmount = Math.round(((taxable * gstRate) / 100) * 100) / 100;
      const rowTotal = taxable + gstAmount;

      totalGross += gross;
      totalDiscounts += discountAmount;
      totalTaxable += taxable;
      totalGst += gstAmount;
      netGrandTotal += rowTotal;

      items.push({
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || "",
        qty,
        price,
        costPrice: prod.costPrice || 0,
        discountPercent,
        discountAmount,
        taxableAmount: taxable,
        gstRate,
        gstAmount,
        grossTotal: gross,
        total: rowTotal
      });
    });

    if (items.length === 0) {
      showToast("Please select a product and valid quantity!", true);
      return;
    }

    let paidAmount = parseFloat(document.getElementById("salePaidAmount")?.value);
    if (isNaN(paidAmount)) paidAmount = (paymentStatus === 'Paid' ? netGrandTotal : 0);

    if (paidAmount >= netGrandTotal) {
      paymentStatus = 'Paid';
      paidAmount = netGrandTotal;
    } else if (paidAmount <= 0) {
      paymentStatus = 'Pending';
      paidAmount = 0;
    } else {
      paymentStatus = 'Partial';
    }

    // Deduct stock
    items.forEach(item => {
      const prod = state.products.find(p => p.id === item.productId);
      if (prod) {
        prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - item.qty);
      }
    });

    const receivedBy = document.getElementById("saleReceivedBy")?.value || "partner1";

    if (editId) {
      const existing = state.sales.find(s => s.id === editId);
      if (existing) {
        existing.date = date;
        existing.type = 'wholesale';
        existing.channel = 'Wholesale Party';
        existing.customerName = customerName;
        existing.customerPhone = customerPhone;
        existing.customerCity = customerCity;
        existing.customerGst = customerGst;
        existing.customerAddress = customerAddress;
        existing.items = items;
        existing.subtotal = totalGross;
        existing.discountAmount = totalDiscounts;
        existing.taxableAmount = totalTaxable;
        existing.gstAmount = totalGst;
        existing.totalAmount = netGrandTotal;
        existing.paymentStatus = paymentStatus;
        existing.paidAmount = paidAmount;
        existing.receivedBy = receivedBy;
        existing.notes = notes;
        if (paymentStatus === 'Pending' || paidAmount === 0) {
          existing.paymentHistory = [];
        } else if (!existing.paymentHistory || existing.paymentHistory.length === 0) {
          existing.paymentHistory = [{ date, amount: paidAmount, receivedBy, notes }];
        }
        showToast(`Wholesale Bill ${existing.invoiceNo} updated successfully!`);
      }
    } else {
      const invoiceNo = 'WS-' + (state.sales.length + 101);
      const newSale = {
        id: "sale_" + Date.now(),
        invoiceNo,
        date,
        type: 'wholesale',
        channel: 'Wholesale Party',
        customerName,
        customerPhone,
        customerCity,
        customerGst,
        customerAddress,
        items,
        subtotal: totalGross,
        discountAmount: totalDiscounts,
        taxableAmount: totalTaxable,
        gstAmount: totalGst,
        totalAmount: netGrandTotal,
        paymentStatus,
        paidAmount,
        receivedBy,
        paymentHistory: paidAmount > 0 ? [{ date, amount: paidAmount, receivedBy, notes }] : [],
        notes
      };
      state.sales.push(newSale);
      showToast(`Wholesale Bill ${invoiceNo} saved successfully!`);
    }

    saveState();
    closeModal('saleModal');
    refreshAllUI();
  } catch (err) {
    console.error("Error saving sale:", err);
    showToast("Error saving bill: " + err.message, true);
  }
}

// ==================== DEFECT / SCRAP CLEARANCE LOT SALES ====================
function openScrapSaleModal(id = "") {
  const form = document.getElementById("scrapSaleForm");
  if (form) form.reset();

  const p1Name = state.settings.partner1Name || "Kenil (You)";
  const p2Name = state.settings.partner2Name || "Alpesh";

  const p1Radio = document.getElementById("scrapP1RadioLabel");
  const p2Radio = document.getElementById("scrapP2RadioLabel");
  if (p1Radio) p1Radio.textContent = p1Name;
  if (p2Radio) p2Radio.textContent = p2Name;

  document.getElementById("scrapSaleEditId").value = id || "";
  document.getElementById("scrapSaleDate").value = new Date().toISOString().split('T')[0];
  document.getElementById("scrapSaleDescription").value = "Home & Kitchen Defect / Return Scrap Lot";

  if (id) {
    const sale = state.sales.find(s => s.id === id);
    if (sale) {
      document.getElementById("scrapSaleDate").value = sale.date;
      document.getElementById("scrapSaleAmount").value = sale.totalAmount;
      document.getElementById("scrapSaleDescription").value = sale.items && sale.items[0] ? sale.items[0].productName : "Home & Kitchen Defect / Return Scrap Lot";
      document.getElementById("scrapSaleBuyer").value = sale.customerName || "";
      document.getElementById("scrapSaleNotes").value = sale.notes || "";
      
      const radio = form.querySelector(`input[name="scrapReceivedBy"][value="${sale.receivedBy || 'partner1'}"]`);
      if (radio) radio.checked = true;
      
      document.getElementById("scrapSaleModalTitle").innerHTML = `<i class="fa-solid fa-recycle text-amber-600"></i> Edit Scrap Lot Sale (${sale.invoiceNo})`;
    }
  } else {
    document.getElementById("scrapSaleModalTitle").innerHTML = `<i class="fa-solid fa-recycle text-amber-600"></i> Defect / Scrap Lot Sale (ભંગાર / લોટ-શોટ વેચાણ)`;
  }

  openModal('scrapSaleModal');
}

function handleSaveScrapSale(e) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    const editId = document.getElementById("scrapSaleEditId")?.value || "";
    const date = document.getElementById("scrapSaleDate")?.value || new Date().toISOString().split('T')[0];
    const amount = parseFloat(document.getElementById("scrapSaleAmount")?.value) || 0;
    const description = document.getElementById("scrapSaleDescription")?.value.trim() || "Home & Kitchen Defect / Return Scrap Lot";
    const buyer = document.getElementById("scrapSaleBuyer")?.value.trim() || "Scrap / Clearance Lot Buyer";
    const receivedBy = document.querySelector('input[name="scrapReceivedBy"]:checked')?.value || "partner1";
    const notes = document.getElementById("scrapSaleNotes")?.value.trim() || "";

    if (amount <= 0) {
      showToast("Please enter a valid sale amount!", true);
      document.getElementById("scrapSaleAmount")?.focus();
      return;
    }

    const p1 = state.settings.partner1Name || "Kenil";
    const p2 = state.settings.partner2Name || "Alpesh";
    const receiverLabel = receivedBy === 'partner1' ? p1 : (receivedBy === 'partner2' ? p2 : 'Business Bank A/c');

    const invoiceNo = editId 
      ? (state.sales.find(s => s.id === editId)?.invoiceNo || "LOT-" + (state.sales.length + 101))
      : ("LOT-" + (state.sales.length + 101));

    const item = {
      productId: "scrap_lot_item",
      productName: description,
      qty: 1,
      price: amount,
      costPrice: 0,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: amount,
      gstRate: 0,
      gstAmount: 0,
      total: amount
    };

    if (editId) {
      const existing = state.sales.find(s => s.id === editId);
      if (existing) {
        existing.date = date;
        existing.customerName = buyer;
        existing.type = "scrap_lot";
        existing.items = [item];
        existing.subtotal = amount;
        existing.totalAmount = amount;
        existing.paidAmount = amount;
        existing.paymentStatus = "Paid";
        existing.receivedBy = receivedBy;
        existing.notes = notes ? `${description} (${notes})` : description;
        showToast(`Scrap lot sale ${existing.invoiceNo} updated successfully!`);
      }
    } else {
      const newSale = {
        id: "sale_scrap_" + Date.now(),
        invoiceNo,
        date,
        type: "scrap_lot",
        channel: "Scrap Clearance",
        customerName: buyer,
        customerPhone: "",
        customerCity: "Local Clearance",
        customerGst: "",
        customerAddress: "",
        items: [item],
        subtotal: amount,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: amount,
        gstAmount: 0,
        totalAmount: amount,
        paymentStatus: "Paid",
        paidAmount: amount,
        receivedBy,
        paymentHistory: [{
          date,
          amount,
          receivedBy,
          notes: `Full cash collected by ${receiverLabel}`
        }],
        notes: notes ? `${description} (${notes})` : description
      };
      state.sales.push(newSale);
      showToast(`Recorded ₹${amount} scrap lot sale! Cash received by ${receiverLabel}.`);
    }

    saveState();
    closeModal('scrapSaleModal');
    refreshAllUI();
  } catch (err) {
    console.error("Error saving scrap sale:", err);
    showToast("Error saving scrap sale: " + err.message, true);
  }
}

function renderSalesTable() {
  const tbody = document.getElementById("salesTableBody");
  if (!tbody) return;

  const search = (document.getElementById("salesSearchInput")?.value || "").toLowerCase();
  const filterPayment = document.getElementById("salesFilterPayment")?.value || "all";

  const filtered = state.sales.filter(s => {
    const matchSearch = (s.invoiceNo && s.invoiceNo.toLowerCase().includes(search)) ||
                        (s.customerName && s.customerName.toLowerCase().includes(search)) ||
                        (s.customerCity && s.customerCity.toLowerCase().includes(search)) ||
                        (s.customerPhone && s.customerPhone.includes(search));
    if (!matchSearch) return false;

    if (filterPayment !== 'all' && s.paymentStatus !== filterPayment) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-5 text-center text-slate-400">No sales or scrap lot bills found. Click "New Wholesale Bill" or "+ Defect / Scrap Lot Sale".</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const isScrap = s.type === 'scrap_lot';
    const itemsSummary = (s.items || []).map(it => `${it.productName} (${it.qty} pcs @ ₹${it.price})`).join(", ");
    const total = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
    const pending = Math.max(0, total - paid);

    let billProfit = 0;
    if (isScrap) {
      billProfit = total; // Pure revenue clearance recovery
    } else if (s.items && s.items.length) {
      s.items.forEach(it => {
        const prod = state.products.find(p => p.id === it.productId);
        const cost = prod ? (Number(prod.costPrice) || 0) : (Number(it.costPrice) || 0);
        const price = Number(it.price) || 0;
        const qty = Number(it.qty) || 0;
        billProfit += (price - cost) * qty;
      });
    } else {
      billProfit = total * 0.25;
    }

    let statusBadge = "badge-paid";
    let statusText = "Paid";
    if (s.paymentStatus === 'Pending' || pending === total) {
      statusBadge = "badge-pending";
      statusText = "Due";
    } else if (s.paymentStatus === 'Partial' || pending > 0) {
      statusBadge = "badge-partial";
      statusText = `Due: ${formatCurrency(pending)}`;
    }

    const p1 = state.settings.partner1Name || "Kenil";
    const p2 = state.settings.partner2Name || "Alpesh";
    let recvLabel = "Business A/c";
    if (s.receivedBy === 'partner1') recvLabel = p1;
    else if (s.receivedBy === 'partner2') recvLabel = p2;

    return `
      <tr>
        <td>
          <span class="font-mono font-bold text-slate-900 block">${s.invoiceNo}</span>
          ${isScrap ? `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded mt-0.5"><i class="fa-solid fa-recycle text-[9px]"></i> Scrap Lot</span>` : ''}
        </td>
        <td class="text-slate-500 font-mono text-xs">${formatDate(s.date)}</td>
        <td class="font-semibold text-slate-800">
          ${escapeHtml(s.customerName)}
          ${s.customerCity ? `<span class="inline-block ml-1 text-[11px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-medium">${escapeHtml(s.customerCity)}</span>` : ''}
          ${s.customerPhone ? `<span class="block text-[10px] text-slate-400 font-mono">${escapeHtml(s.customerPhone)}</span>` : ''}
        </td>
        <td class="text-slate-600 max-w-xs truncate text-xs" title="${escapeHtml(itemsSummary)}">${escapeHtml(itemsSummary)}</td>
        <td class="text-right font-bold text-slate-900 font-mono text-sm">${formatCurrency(total)}</td>
        <td class="text-right">
          <span class="font-bold text-emerald-700 block font-mono text-xs">Recv: ${formatCurrency(paid)}</span>
          ${paid > 0 ? `<span class="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded font-bold ${s.receivedBy === 'partner1' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : (s.receivedBy === 'partner2' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-700 border border-slate-200')}">In: ${escapeHtml(recvLabel)}</span>` : ''}
          ${pending > 0 ? `<span class="text-[10px] text-rose-600 font-bold block font-mono">Due: ${formatCurrency(pending)}</span>` : ''}
        </td>
        <td class="text-right font-mono font-extrabold text-indigo-700 text-sm">
          +${formatCurrency(billProfit)}
        </td>
        <td class="text-center">
          <span class="badge-status ${statusBadge}">
            ${statusText}
          </span>
          ${pending > 0 ? `
            <button onclick="openCustomerCollectModal('${s.id}')" class="block mx-auto mt-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold">
              Collect
            </button>
          ` : ''}
        </td>
        <td class="text-center space-x-1">
          <button onclick="viewInvoiceReceipt('${s.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="Print Bill Receipt">
            <i class="fa-solid fa-print"></i>
          </button>
          <button onclick="${isScrap ? `openScrapSaleModal('${s.id}')` : `editSale('${s.id}')`}" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteSale('${s.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteSale(id) {
  const sale = state.sales.find(s => s.id === id);
  if (!sale) return;

  if (confirm(`Are you sure you want to delete Invoice ${sale.invoiceNo}? Note: Stock will be restored.`)) {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        const prod = state.products.find(p => p.id === item.productId);
        if (prod) {
          prod.currentStock = (Number(prod.currentStock) || 0) + (Number(item.qty) || 0);
        }
      });
    }

    state.sales = state.sales.filter(s => s.id !== id);
    saveState();
    refreshAllUI();
    showToast("Sale deleted and stock restored!");
  }
}

function openCustomerCollectModal(saleId) {
  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;

  const total = Number(sale.totalAmount) || 0;
  const paid = sale.paidAmount !== undefined ? Number(sale.paidAmount) : 0;
  const pending = Math.max(0, total - paid);

  document.getElementById("ccSaleId").value = sale.id;
  document.getElementById("ccCustomerName").textContent = sale.customerName;
  document.getElementById("ccInvoiceNo").textContent = sale.invoiceNo;
  document.getElementById("ccPendingAmount").textContent = formatCurrency(pending);
  document.getElementById("ccAmount").value = pending;
  document.getElementById("ccAmount").max = pending;
  document.getElementById("ccDate").value = new Date().toISOString().split('T')[0];
  document.getElementById("ccNotes").value = "";

  const recv = document.getElementById("ccReceivedBy");
  if (recv) recv.value = "partner1";

  openModal('customerCollectModal');
}

function handleSaveCustomerCollect(e) {
  e.preventDefault();
  const saleId = document.getElementById("ccSaleId").value;
  const amount = parseFloat(document.getElementById("ccAmount").value) || 0;
  const date = document.getElementById("ccDate").value;
  const receivedBy = document.getElementById("ccReceivedBy").value || "partner1";
  const notes = document.getElementById("ccNotes").value.trim();

  const sale = state.sales.find(s => s.id === saleId);
  if (!sale) return;

  if (amount <= 0) {
    showToast("Amount must be greater than 0!", true);
    return;
  }

  const currentPaid = sale.paidAmount !== undefined ? Number(sale.paidAmount) : (sale.paymentStatus === 'Paid' ? sale.totalAmount : 0);
  const newPaid = currentPaid + amount;
  sale.paidAmount = newPaid;

  if (newPaid >= sale.totalAmount) {
    sale.paymentStatus = 'Paid';
    sale.paidAmount = sale.totalAmount;
  } else {
    sale.paymentStatus = 'Partial';
  }

  if (!sale.paymentHistory) sale.paymentHistory = [];
  sale.paymentHistory.push({
    date,
    amount,
    receivedBy,
    notes
  });

  const pName = receivedBy === 'partner1' ? state.settings.partner1Name : (receivedBy === 'partner2' ? state.settings.partner2Name : 'Business Account');

  if (notes) {
    sale.notes = (sale.notes ? sale.notes + " | " : "") + `Received ₹${amount} in ${pName} on ${formatDate(date)} (${notes})`;
  } else {
    sale.notes = (sale.notes ? sale.notes + " | " : "") + `Received ₹${amount} in ${pName} on ${formatDate(date)}`;
  }

  saveState();
  closeModal('customerCollectModal');
  refreshAllUI();
  showToast(`Recorded ₹${amount} received in ${pName}!`);
}

function viewInvoiceReceipt(id) {
  const sale = state.sales.find(s => s.id === id);
  if (!sale) return;

  const content = document.getElementById("invoicePrintContent");
  const bizName = state.settings.bizName || "CommerceHub Store";
  const total = Number(sale.totalAmount) || 0;
  const paid = sale.paidAmount !== undefined ? Number(sale.paidAmount) : (sale.paymentStatus === 'Paid' ? total : 0);
  const pending = Math.max(0, total - paid);

  const p1 = state.settings.partner1Name || "Kenil";
  const p2 = state.settings.partner2Name || "Alpesh";
  let recvLabel = "Unpaid (Credit)";
  if (paid > 0) {
    recvLabel = "Business Account";
    if (sale.receivedBy === 'partner1') recvLabel = `${p1}'s A/c`;
    else if (sale.receivedBy === 'partner2') recvLabel = `${p2}'s A/c`;
  }

  content.innerHTML = `
    <div class="text-center pb-3 border-b border-slate-200 flex flex-col items-center">
      <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm mb-1.5 flex items-center justify-center bg-white">
        <img src="logo.jpg" alt="Dwarkadhish Enterprise" class="w-full h-full object-cover scale-105 rounded-full">
      </div>
      <h2 class="text-base font-bold text-slate-900">${escapeHtml(bizName)}</h2>
      <p class="text-[11px] text-slate-500">Multi-Channel Online & Wholesale Invoice</p>
    </div>

    <div class="grid grid-cols-2 text-xs py-2 gap-2 border-b border-slate-100">
      <div>
        <p><span class="text-slate-500">Invoice:</span> <b class="font-mono text-slate-900">${sale.invoiceNo}</b></p>
        <p><span class="text-slate-500">Date:</span> <b>${formatDate(sale.date)}</b></p>
        <p><span class="text-slate-500">Payment Status:</span> <b class="${paid >= total ? 'text-emerald-700' : (paid > 0 ? 'text-indigo-700' : 'text-rose-600')}">${escapeHtml(recvLabel)}</b></p>
      </div>
      <div class="text-right">
        <p><span class="text-slate-500">Party:</span> <b>${escapeHtml(sale.customerName)}</b></p>
        ${sale.customerPhone ? `<p><span class="text-slate-500">Phone:</span> <b class="font-mono">${escapeHtml(sale.customerPhone)}</b></p>` : ''}
        ${sale.customerCity ? `<p><span class="text-slate-500">City:</span> <b>${escapeHtml(sale.customerCity)}</b></p>` : ''}
        ${sale.customerGst ? `<p><span class="text-slate-500">GSTIN:</span> <b class="font-mono text-indigo-700 font-bold">${escapeHtml(sale.customerGst)}</b></p>` : ''}
        ${sale.customerAddress ? `<p class="text-[10px] text-slate-500">${escapeHtml(sale.customerAddress)}</p>` : ''}
      </div>
    </div>

    <table class="w-full text-xs text-left my-2.5">
      <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
        <tr>
          <th class="py-1.5 px-2">Item</th>
          <th class="py-1.5 px-2 text-center">Qty</th>
          <th class="py-1.5 px-2 text-right">Rate</th>
          <th class="py-1.5 px-2 text-right">Disc</th>
          <th class="py-1.5 px-2 text-right">GST</th>
          <th class="py-1.5 px-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${(sale.items || []).map(it => `
          <tr>
            <td class="py-1.5 px-2 font-medium text-slate-900">${escapeHtml(it.productName)}</td>
            <td class="py-1.5 px-2 text-center font-mono">${it.qty}</td>
            <td class="py-1.5 px-2 text-right font-mono">${formatCurrency(it.price)}</td>
            <td class="py-1.5 px-2 text-right font-mono text-rose-600">${(it.discountAmount > 0) ? `-${formatCurrency(it.discountAmount)}` : '-'}</td>
            <td class="py-1.5 px-2 text-right font-mono text-indigo-700">${(it.gstAmount > 0) ? `+${formatCurrency(it.gstAmount)} <span class="text-[9px] text-slate-400">(${it.gstRate}%)</span>` : '-'}</td>
            <td class="py-1.5 px-2 text-right font-mono font-bold">${formatCurrency(it.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="border-t border-slate-200 pt-2 space-y-1 text-xs">
      ${sale.discountAmount > 0 ? `
        <div class="flex justify-between text-slate-600">
          <span>Items Gross Total:</span>
          <span class="font-mono">${formatCurrency(sale.subtotal || (total + sale.discountAmount))}</span>
        </div>
        <div class="flex justify-between text-rose-600 font-semibold">
          <span>Total Item Discount:</span>
          <span class="font-mono">-${formatCurrency(sale.discountAmount)}</span>
        </div>
      ` : ''}
      ${sale.gstAmount > 0 ? `
        <div class="flex justify-between text-slate-600">
          <span>Taxable Subtotal:</span>
          <span class="font-mono">${formatCurrency(sale.taxableAmount || (total - sale.gstAmount))}</span>
        </div>
        <div class="flex justify-between text-indigo-700 font-semibold">
          <span>Total GST (Tax):</span>
          <span class="font-mono">+${formatCurrency(sale.gstAmount)}</span>
        </div>
      ` : ''}
      <div class="flex justify-between font-bold text-slate-900 text-sm pt-0.5 border-t border-slate-100">
        <span>Net Bill Total:</span>
        <span class="font-mono">${formatCurrency(total)}</span>
      </div>
      <div class="flex justify-between text-slate-600">
        <span>Amount Received:</span>
        <span class="font-bold text-emerald-600 font-mono">${formatCurrency(paid)}</span>
      </div>
      ${pending > 0 ? `
        <div class="flex justify-between text-rose-600 font-bold">
          <span>Balance Due:</span>
          <span class="font-mono">${formatCurrency(pending)}</span>
        </div>
      ` : ''}
      ${sale.notes ? `<div class="text-[11px] text-slate-500 pt-1"><b>Remarks:</b> ${escapeHtml(sale.notes)}</div>` : ''}
    </div>

    <div class="text-center pt-4 text-[10px] text-slate-400">
      Thank you for your business!
    </div>
  `;

  openModal('invoiceModal');
}

// ==================== DYNAMIC SELLER ACCOUNTS MANAGEMENT ====================
function getSellerAccounts() {
  if (!state.settings.sellerAccounts || !Array.isArray(state.settings.sellerAccounts)) {
    state.settings.sellerAccounts = [];
  }
  return state.settings.sellerAccounts;
}

function getSellerAccountName(id) {
  const accs = getSellerAccounts();
  const found = accs.find(a => a.id === id);
  if (found) return found.name;
  if (state.settings.accountNames && state.settings.accountNames[id]) return state.settings.accountNames[id];
  return id || "Seller Account";
}

function updatePayoutAccountsDropdown() {
  const platform = document.getElementById("payoutPlatform")?.value || "Meesho";
  const select = document.getElementById("payoutAccountId");
  if (!select) return;

  const p1 = state.settings.partner1Name || "Kenil";
  const p2 = state.settings.partner2Name || "Alpesh";
  const accs = getSellerAccounts().filter(a => a.platform === platform || (platform === 'Other' && a.platform !== 'Meesho' && a.platform !== 'Amazon' && a.platform !== 'Flipkart'));

  if (accs.length === 0) {
    select.innerHTML = `<option value="">-- No ${platform} accounts yet. Click "+ New Account" --</option>`;
    onPayoutAccountChanged();
    return;
  }

  select.innerHTML = accs.map(a => {
    const isP2 = a.linkedPartner === 'partner2';
    const tag = isP2 ? ` [${p2} & Family]` : ` [${p1} & Family]`;
    return `<option value="${a.id}">${escapeHtml(a.name)}${tag}</option>`;
  }).join('');

  onPayoutAccountChanged();
}

function onPayoutAccountChanged() {
  const accId = document.getElementById("payoutAccountId")?.value;
  const badge = document.getElementById("payoutPartnerBadge");
  if (!badge) return;
  const acc = getSellerAccounts().find(a => a.id === accId);
  const p1 = state.settings.partner1Name || "Kenil (You)";
  const p2 = state.settings.partner2Name || "Alpesh";
  const isP2 = acc && acc.linkedPartner === 'partner2';
  badge.textContent = isP2 ? `${p2} & Family (Partner 2)` : `${p1} & Family (Partner 1)`;
  badge.className = isP2
    ? "font-bold px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200"
    : "font-bold px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-200";
}

function quickAddNewSellerAccount() {
  const currentPlatform = document.getElementById("payoutPlatform")?.value || "Meesho";
  const existingCount = getSellerAccounts().filter(a => a.platform === currentPlatform).length;
  const defaultName = `${currentPlatform} - ID ${existingCount + 1}`;
  const accName = prompt(`Enter new seller account name for ${currentPlatform}:`, defaultName);

  if (accName && accName.trim()) {
    const newId = "acc_" + Date.now();
    if (!state.settings.sellerAccounts) state.settings.sellerAccounts = [];
    state.settings.sellerAccounts.push({
      id: newId,
      platform: currentPlatform,
      name: accName.trim(),
      linkedPartner: 'partner1'
    });
    saveState();
    updatePayoutAccountsDropdown();
    const select = document.getElementById("payoutAccountId");
    if (select) select.value = newId;
    onPayoutAccountChanged();
    renderOnlinePayouts();
    calculatePartnerBalances();
    showToast(`New account "${accName.trim()}" added to ${currentPlatform}!`);
  }
}

function handleAddNewSellerAccount(e) {
  e.preventDefault();
  const platform = document.getElementById("newAccountPlatform").value;
  const name = document.getElementById("newAccountName").value.trim();
  const linkedPartner = document.getElementById("newAccountPartner")?.value || "partner1";
  if (!name) return;

  if (!state.settings.sellerAccounts) state.settings.sellerAccounts = [];
  const newId = "acc_" + Date.now();
  state.settings.sellerAccounts.push({
    id: newId,
    platform,
    name,
    linkedPartner
  });
  saveState();
  document.getElementById("newAccountName").value = "";
  renderSellerAccountsManager();
  renderOnlinePayouts();
  updatePayoutAccountsDropdown();
  calculatePartnerBalances();
  showToast(`Account "${name}" added successfully!`);
}

function toggleAccountPartner(id) {
  const acc = getSellerAccounts().find(a => a.id === id);
  if (!acc) return;
  acc.linkedPartner = acc.linkedPartner === 'partner2' ? 'partner1' : 'partner2';
  
  (state.onlinePayouts || []).forEach(op => {
    if (op.accountId === id) {
      op.receivedBy = acc.linkedPartner;
    }
  });

  saveState();
  renderSellerAccountsManager();
  renderOnlinePayouts();
  updatePayoutAccountsDropdown();
  calculatePartnerBalances();
  const pName = acc.linkedPartner === 'partner2' ? (state.settings.partner2Name || "Alpesh") : (state.settings.partner1Name || "Kenil");
  showToast(`Account "${acc.name}" linked to ${pName} & Family!`);
}

function deleteSellerAccount(id) {
  const acc = getSellerAccounts().find(a => a.id === id);
  if (!acc) return;

  if (confirm(`Are you sure you want to remove "${acc.name}"? Past recorded payouts will stay safe.`)) {
    state.settings.sellerAccounts = getSellerAccounts().filter(a => a.id !== id);
    saveState();
    renderSellerAccountsManager();
    renderOnlinePayouts();
    updatePayoutAccountsDropdown();
    calculatePartnerBalances();
    showToast(`Account "${acc.name}" removed.`);
  }
}

function renameSellerAccount(id) {
  const acc = getSellerAccounts().find(a => a.id === id);
  if (!acc) return;

  const newName = prompt("Edit account name:", acc.name);
  if (newName && newName.trim() && newName.trim() !== acc.name) {
    acc.name = newName.trim();
    saveState();
    renderSellerAccountsManager();
    renderOnlinePayouts();
    updatePayoutAccountsDropdown();
    showToast(`Account renamed to "${acc.name}".`);
  }
}

function renderSellerAccountsManager() {
  const container = document.getElementById("sellerAccountsListContainer");
  if (!container) return;

  const accs = getSellerAccounts();
  if (accs.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">No seller accounts registered yet. Add your first account above.</p>`;
    return;
  }

  const p1 = state.settings.partner1Name || "Kenil (You)";
  const p2 = state.settings.partner2Name || "Alpesh";

  // Group by platform
  const groups = {};
  accs.forEach(a => {
    if (!groups[a.platform]) groups[a.platform] = [];
    groups[a.platform].push(a);
  });

  let html = "";
  Object.keys(groups).forEach(platform => {
    let badgeClass = "bg-purple-100 text-purple-800";
    if (platform === "Amazon") badgeClass = "bg-amber-100 text-amber-800";
    else if (platform === "Flipkart") badgeClass = "bg-blue-100 text-blue-800";

    html += `
      <div class="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2 shadow-sm">
        <div class="flex items-center justify-between pb-1 border-b border-slate-100">
          <span class="text-xs font-bold px-2 py-0.5 rounded ${badgeClass}">${escapeHtml(platform)} (${groups[platform].length} Accounts)</span>
        </div>
        <div class="space-y-1.5">
          ${groups[platform].map(a => {
            const isP2 = a.linkedPartner === 'partner2';
            const partnerBadge = isP2
              ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200"><i class="fa-solid fa-user-check text-[9px]"></i> ${escapeHtml(p2)} & Family</span>`
              : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"><i class="fa-solid fa-user-check text-[9px]"></i> ${escapeHtml(p1)} & Family</span>`;
            return `
            <div class="flex items-center justify-between p-2 rounded hover:bg-slate-50 border border-slate-100 text-xs">
              <div class="space-y-1">
                <div class="font-bold text-slate-800">${escapeHtml(a.name)}</div>
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] text-slate-400 font-medium">Credited To:</span>
                  ${partnerBadge}
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" onclick="toggleAccountPartner('${a.id}')" class="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded transition-colors" title="Switch Partner / Family">
                  <i class="fa-solid fa-arrows-rotate mr-1"></i>Switch
                </button>
                <button type="button" onclick="renameSellerAccount('${a.id}')" class="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50" title="Rename Account">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button type="button" onclick="deleteSellerAccount('${a.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50" title="Delete Account">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ==================== ONLINE BANK PAYOUTS ====================
function handleSavePayout(e) {
  e.preventDefault();
  const editId = document.getElementById("payoutEditId")?.value;
  const date = document.getElementById("payoutDate").value;
  const platform = document.getElementById("payoutPlatform").value;
  const accountId = document.getElementById("payoutAccountId").value;
  const bankAmount = parseFloat(document.getElementById("payoutBankAmount").value) || 0;
  const unitsDispatched = parseInt(document.getElementById("payoutUnits").value) || 0;
  const approxCost = parseFloat(document.getElementById("payoutApproxCost").value) || 0;
  const notes = document.getElementById("payoutNotes").value.trim();

  if (bankAmount <= 0) {
    showToast("Please enter a valid payout amount!", true);
    return;
  }

  const acc = getSellerAccounts().find(a => a.id === accountId);
  const receivedBy = acc ? (acc.linkedPartner || "partner1") : "partner1";

  if (!state.onlinePayouts) state.onlinePayouts = [];

  if (editId) {
    const existing = state.onlinePayouts.find(p => p.id === editId);
    if (existing) {
      existing.date = date;
      existing.platform = platform;
      existing.accountId = accountId;
      existing.bankAmount = bankAmount;
      existing.unitsDispatched = unitsDispatched;
      existing.approxCost = approxCost;
      existing.notes = notes;
      existing.receivedBy = receivedBy;
      showToast("Bank payout updated!");
    }
  } else {
    state.onlinePayouts.push({
      id: "op_" + Date.now(),
      date,
      platform,
      accountId,
      bankAmount,
      unitsDispatched,
      approxCost,
      receivedBy,
      notes
    });
    showToast("Bank payout saved successfully!");
  }

  saveState();
  closeModal('payoutModal');
  refreshAllUI();
}

function renderOnlinePayouts() {
  if (!state.onlinePayouts) state.onlinePayouts = [];

  const accs = getSellerAccounts();
  const accountTotals = {};
  const platformTotals = { Meesho: 0, Amazon: 0, Flipkart: 0, Other: 0 };
  const p1 = state.settings.partner1Name || "Kenil (You)";
  const p2 = state.settings.partner2Name || "Alpesh";
  let p1PayoutsTotal = 0;
  let p2PayoutsTotal = 0;
  let totalOnlinePayouts = 0;

  accs.forEach(a => {
    accountTotals[a.id] = 0;
    if (!platformTotals[a.platform]) platformTotals[a.platform] = 0;
  });

  const accMap = {};
  accs.forEach(a => {
    accMap[a.id] = a.linkedPartner || 'partner1';
  });

  state.onlinePayouts.forEach(op => {
    const amt = Number(op.bankAmount) || 0;
    totalOnlinePayouts += amt;
    const plat = op.platform || "Other";
    if (platformTotals[plat] !== undefined) platformTotals[plat] += amt;
    else platformTotals[plat] = (platformTotals[plat] || 0) + amt;

    if (accountTotals[op.accountId] !== undefined) {
      accountTotals[op.accountId] += amt;
    }

    const recipient = op.receivedBy || accMap[op.accountId] || 'partner1';
    if (recipient === 'partner2') p2PayoutsTotal += amt;
    else p1PayoutsTotal += amt;
  });

  // Render Dynamic Platform Cards Container
  const container = document.getElementById("platformAccountsCardsContainer");
  if (container) {
    if (accs.length === 0) {
      container.innerHTML = `
        <div class="col-span-full pro-card p-6 text-center space-y-3 bg-white border border-dashed border-slate-300">
          <div class="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-lg">
            <i class="fa-solid fa-building-columns"></i>
          </div>
          <div class="space-y-1">
            <h4 class="font-bold text-slate-800 text-sm">No Seller Accounts Added</h4>
            <p class="text-xs text-slate-500 max-w-md mx-auto">
              Add your seller accounts across Amazon, Meesho, Flipkart, and other platforms to track payouts.
            </p>
          </div>
          <button onclick="openModal('sellerAccountsModal')" class="btn-solid-primary text-xs py-2 px-4 mx-auto">
            <i class="fa-solid fa-plus"></i> Add Your Seller Account
          </button>
        </div>
      `;
    } else {
      // Unique platforms from user added accounts
      const platforms = [];
      accs.forEach(a => {
        if (!platforms.includes(a.platform)) platforms.push(a.platform);
      });

      // 1. Partner Family Summary Card
      let partnerFamilyCardHtml = `
        <div class="pro-card p-4 space-y-2 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                <i class="fa-solid fa-users"></i>
              </span>
              <h4 class="font-bold text-slate-900 text-xs sm:text-sm">Bank Accounts Summary</h4>
            </div>
            <span class="text-xs font-bold font-mono text-emerald-800">${formatCurrency(totalOnlinePayouts)}</span>
          </div>
          <div class="space-y-1 text-xs text-slate-600 pt-1">
            <div class="flex justify-between py-0.5 border-b border-slate-100">
              <span class="font-semibold text-indigo-700 flex items-center gap-1">
                <i class="fa-solid fa-building-columns text-[10px]"></i> ${escapeHtml(p1)} & Family:
              </span>
              <b class="font-mono text-indigo-900">${formatCurrency(p1PayoutsTotal)}</b>
            </div>
            <div class="flex justify-between py-0.5 border-b border-slate-100">
              <span class="font-semibold text-purple-700 flex items-center gap-1">
                <i class="fa-solid fa-building-columns text-[10px]"></i> ${escapeHtml(p2)} & Family:
              </span>
              <b class="font-mono text-purple-900">${formatCurrency(p2PayoutsTotal)}</b>
            </div>
          </div>
        </div>
      `;

      const platformCardsHtml = platforms.map(plat => {
        let platBorder = "border-l-purple-500";
        let platBadge = "bg-purple-100 text-purple-700";
        let platLetter = plat.charAt(0).toUpperCase();

        if (plat === 'Amazon') {
          platBorder = "border-l-amber-500";
          platBadge = "bg-amber-100 text-amber-700";
        } else if (plat === 'Flipkart') {
          platBorder = "border-l-blue-500";
          platBadge = "bg-blue-100 text-blue-700";
        } else if (plat === 'Meesho') {
          platBorder = "border-l-purple-500";
          platBadge = "bg-purple-100 text-purple-700";
        } else {
          platBorder = "border-l-indigo-500";
          platBadge = "bg-indigo-100 text-indigo-700";
        }

        const platAccs = accs.filter(a => a.platform === plat);
        const total = platformTotals[plat] || 0;

        return `
          <div class="pro-card p-4 space-y-2 border-l-4 ${platBorder}">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full ${platBadge} flex items-center justify-center text-xs font-bold">${platLetter}</span>
                <h4 class="font-bold text-slate-900 text-xs sm:text-sm">${escapeHtml(plat)} (${platAccs.length} Accounts)</h4>
              </div>
              <span class="text-xs font-bold font-mono text-slate-900">${formatCurrency(total)}</span>
            </div>
            <div class="space-y-1 text-xs text-slate-600 pt-1">
              ${platAccs.map(a => {
                const isP2 = a.linkedPartner === 'partner2';
                const pTag = isP2 ? `<span class="text-[9px] text-purple-700 font-bold ml-1">(${escapeHtml(p2)})</span>` : `<span class="text-[9px] text-indigo-700 font-bold ml-1">(${escapeHtml(p1)})</span>`;
                return `
                <div class="flex justify-between py-0.5 border-b border-slate-100">
                  <span class="truncate pr-2">${escapeHtml(a.name)}${pTag}:</span>
                  <b class="font-mono text-slate-800 flex-shrink-0">${formatCurrency(accountTotals[a.id] || 0)}</b>
                </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = partnerFamilyCardHtml + platformCardsHtml;
    }
  }

  // Render Table
  const tbody = document.getElementById("payoutsTableBody");
  if (!tbody) return;

  if (state.onlinePayouts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-5 text-center text-slate-400">No online bank settlements recorded. Click "Add Bank Payout" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.onlinePayouts.slice().reverse().map(op => {
    const accName = getSellerAccountName(op.accountId);
    const acc = accs.find(a => a.id === op.accountId);
    const bank = Number(op.bankAmount) || 0;
    const cost = Number(op.approxCost) || 0;
    const margin = bank - cost;

    const isP2 = (op.receivedBy || (acc ? acc.linkedPartner : 'partner1')) === 'partner2';
    const partnerLabel = isP2 ? p2 : p1;
    const pBadgeClass = isP2 ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-indigo-100 text-indigo-700 border-indigo-200";

    let badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
    if (op.platform === 'Amazon') badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    else if (op.platform === 'Flipkart') badgeClass = "bg-blue-50 text-blue-700 border-blue-200";

    return `
      <tr>
        <td class="font-mono text-slate-600">${formatDate(op.date)}</td>
        <td>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${badgeClass}">
            ${escapeHtml(op.platform)}
          </span>
        </td>
        <td>
          <div class="font-bold text-slate-800">${escapeHtml(accName)}</div>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${pBadgeClass} mt-0.5">
            <i class="fa-solid fa-building-columns mr-1 text-[9px]"></i>${escapeHtml(partnerLabel)} & Family
          </span>
        </td>
        <td class="text-right font-mono font-extrabold text-emerald-700 text-sm">${formatCurrency(bank)}</td>
        <td class="text-slate-600 text-xs">${op.unitsDispatched ? `${op.unitsDispatched} units` : '-'} ${cost > 0 ? `(${formatCurrency(cost)})` : ''}</td>
        <td class="font-mono font-bold ${margin >= 0 ? 'text-indigo-700' : 'text-rose-600'} text-xs">
          ${formatCurrency(margin)}
        </td>
        <td class="text-slate-500 text-xs max-w-xs truncate" title="${escapeHtml(op.notes || '')}">${escapeHtml(op.notes || '-')}</td>
        <td class="text-center space-x-1">
          <button onclick="editPayout('${op.id}')" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deletePayout('${op.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function editPayout(id) {
  const op = (state.onlinePayouts || []).find(p => p.id === id);
  if (!op) return;

  openModal('payoutModal');
  document.getElementById("payoutEditId").value = op.id;
  document.getElementById("payoutDate").value = op.date;
  document.getElementById("payoutPlatform").value = op.platform;
  updatePayoutAccountsDropdown();
  document.getElementById("payoutAccountId").value = op.accountId;
  document.getElementById("payoutBankAmount").value = op.bankAmount;
  document.getElementById("payoutUnits").value = op.unitsDispatched || "";
  document.getElementById("payoutApproxCost").value = op.approxCost || "";
  document.getElementById("payoutNotes").value = op.notes || "";
  document.getElementById("payoutModalTitle").textContent = "Edit Bank Payout";
}

function deletePayout(id) {
  if (confirm("Are you sure you want to delete this bank payout entry?")) {
    state.onlinePayouts = (state.onlinePayouts || []).filter(p => p.id !== id);
    saveState();
    refreshAllUI();
    showToast("Bank payout entry deleted!");
  }
}

// ==================== SUPPLIERS DIRECTORY & PURCHASES ====================
function getSuppliers() {
  if (!state.suppliers || !Array.isArray(state.suppliers)) {
    state.suppliers = [];
  }

  const existingNames = new Set(state.suppliers.map(s => (s.name || '').trim().toLowerCase()));
  (state.purchases || []).forEach(p => {
    const name = (p.vendor || '').trim();
    if (name && !existingNames.has(name.toLowerCase())) {
      existingNames.add(name.toLowerCase());
      state.suppliers.push({
        id: "supp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        name: name,
        phone: p.supplierPhone || "",
        city: p.supplierCity || "",
        gstNo: p.supplierGst || "",
        address: p.supplierAddress || ""
      });
    }
  });

  return state.suppliers;
}

function updateSuppliersDatalist() {
  const datalist = document.getElementById("suppliersDatalist");
  const select = document.getElementById("purchaseSupplierSelect");
  const suppliers = getSuppliers();

  if (datalist) {
    datalist.innerHTML = suppliers.map(s => `
      <option value="${escapeHtml(s.name)}">${s.city ? `(${escapeHtml(s.city)})` : ''} ${s.phone ? `Ph: ${escapeHtml(s.phone)}` : ''} ${s.gstNo ? `GST: ${escapeHtml(s.gstNo)}` : ''}</option>
    `).join('');
  }

  if (select) {
    const currentVal = select.value;
    select.innerHTML = `
      <option value="">-- Or Choose from Saved Suppliers Directory --</option>
      ${suppliers.map(s => `
        <option value="${s.id}" ${s.id === currentVal ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.city || 'No City')} - Ph: ${escapeHtml(s.phone || 'N/A')}${s.gstNo ? ` - GST: ${escapeHtml(s.gstNo)}` : ''})</option>
      `).join('')}
    `;
  }
}

function onSupplierSelectDropdownChange() {
  const select = document.getElementById("purchaseSupplierSelect");
  if (!select) return;
  const suppId = select.value;
  if (!suppId) return;

  const suppliers = getSuppliers();
  const supp = suppliers.find(s => s.id === suppId);
  if (!supp) return;

  if (document.getElementById("purchaseVendor")) document.getElementById("purchaseVendor").value = supp.name || "";
  if (document.getElementById("purchaseSupplierPhone")) document.getElementById("purchaseSupplierPhone").value = supp.phone || "";
  if (document.getElementById("purchaseSupplierCity")) document.getElementById("purchaseSupplierCity").value = supp.city || supp.address || "";
  if (document.getElementById("purchaseSupplierGst")) document.getElementById("purchaseSupplierGst").value = supp.gstNo || "";

  showToast(`Auto-filled details for "${supp.name}"!`);
}

function onSupplierNameSelected() {
  const nameInput = document.getElementById("purchaseVendor");
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) return;

  const suppliers = getSuppliers();
  const matched = suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
  if (matched) {
    if (document.getElementById("purchaseSupplierPhone") && matched.phone) document.getElementById("purchaseSupplierPhone").value = matched.phone;
    if (document.getElementById("purchaseSupplierCity") && (matched.city || matched.address)) document.getElementById("purchaseSupplierCity").value = matched.city || matched.address;
    if (document.getElementById("purchaseSupplierGst") && matched.gstNo) document.getElementById("purchaseSupplierGst").value = matched.gstNo;

    const select = document.getElementById("purchaseSupplierSelect");
    if (select) select.value = matched.id;
  }
}

function openSupplierModal(supplierId = "") {
  const form = document.getElementById("supplierForm");
  if (form) form.reset();

  document.getElementById("supplierEditId").value = "";
  document.getElementById("supplierModalTitle").innerHTML = `<i class="fa-solid fa-truck-field text-indigo-600"></i> New Supplier / Vendor Details`;

  if (supplierId) {
    const suppliers = getSuppliers();
    const s = suppliers.find(x => x.id === supplierId);
    if (s) {
      document.getElementById("supplierEditId").value = s.id;
      document.getElementById("supplierName").value = s.name || "";
      document.getElementById("supplierPhone").value = s.phone || "";
      document.getElementById("supplierCity").value = s.city || "";
      document.getElementById("supplierGst").value = s.gstNo || "";
      document.getElementById("supplierAddress").value = s.address || "";
      document.getElementById("supplierModalTitle").innerHTML = `<i class="fa-solid fa-truck-ramp-box text-indigo-600"></i> Edit Supplier (${escapeHtml(s.name)})`;
    }
  } else {
    const curName = document.getElementById("purchaseVendor")?.value || "";
    const curPhone = document.getElementById("purchaseSupplierPhone")?.value || "";
    const curCity = document.getElementById("purchaseSupplierCity")?.value || "";
    const curGst = document.getElementById("purchaseSupplierGst")?.value || "";
    if (curName) document.getElementById("supplierName").value = curName;
    if (curPhone) document.getElementById("supplierPhone").value = curPhone;
    if (curCity) document.getElementById("supplierCity").value = curCity;
    if (curGst) document.getElementById("supplierGst").value = curGst;
  }

  openModal('supplierModal');
}

function handleSaveSupplier(e) {
  if (e && e.preventDefault) e.preventDefault();

  const editId = document.getElementById("supplierEditId")?.value || "";
  const name = (document.getElementById("supplierName")?.value || "").trim();
  const phone = (document.getElementById("supplierPhone")?.value || "").trim();
  const city = (document.getElementById("supplierCity")?.value || "").trim();
  const gstNo = (document.getElementById("supplierGst")?.value || "").trim().toUpperCase();
  const address = (document.getElementById("supplierAddress")?.value || "").trim();

  if (!name) {
    showToast("Please enter Supplier / Firm Name!", true);
    return;
  }

  if (!state.suppliers) state.suppliers = [];

  let savedSupp = null;
  if (editId) {
    const existing = state.suppliers.find(s => s.id === editId);
    if (existing) {
      existing.name = name;
      existing.phone = phone;
      existing.city = city;
      existing.gstNo = gstNo;
      existing.address = address;
      savedSupp = existing;
      showToast(`Supplier "${name}" updated!`);
    }
  } else {
    const existing = state.suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.phone = phone || existing.phone;
      existing.city = city || existing.city;
      existing.gstNo = gstNo || existing.gstNo;
      existing.address = address || existing.address;
      savedSupp = existing;
      showToast(`Supplier "${name}" updated!`);
    } else {
      const newSupp = {
        id: "supp_" + Date.now(),
        name,
        phone,
        city,
        gstNo,
        address
      };
      state.suppliers.push(newSupp);
      savedSupp = newSupp;
      showToast(`Supplier "${name}" added successfully!`);
    }
  }

  saveState();
  closeModal('supplierModal');
  updateSuppliersDatalist();

  // If purchaseModal is open, auto-fill it
  if (document.getElementById("purchaseVendor")) {
    document.getElementById("purchaseVendor").value = name;
    if (document.getElementById("purchaseSupplierPhone")) document.getElementById("purchaseSupplierPhone").value = phone;
    if (document.getElementById("purchaseSupplierCity")) document.getElementById("purchaseSupplierCity").value = city || address;
    if (document.getElementById("purchaseSupplierGst")) document.getElementById("purchaseSupplierGst").value = gstNo;
    if (document.getElementById("purchaseSupplierSelect") && savedSupp) document.getElementById("purchaseSupplierSelect").value = savedSupp.id;
  }

  renderSuppliersManageTable();
}

function openSuppliersManageModal() {
  renderSuppliersManageTable();
  openModal('suppliersManageModal');
}

function renderSuppliersManageTable() {
  const tbody = document.getElementById("suppliersManageTableBody");
  if (!tbody) return;

  const query = (document.getElementById("suppliersSearchInput")?.value || "").toLowerCase().trim();
  let suppliers = getSuppliers();

  if (query) {
    suppliers = suppliers.filter(s => 
      (s.name || '').toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.city || '').toLowerCase().includes(query) ||
      (s.gstNo || '').toLowerCase().includes(query) ||
      (s.address || '').toLowerCase().includes(query)
    );
  }

  if (suppliers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">No suppliers found. Click "+ Add New Supplier" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = suppliers.map(s => `
    <tr class="hover:bg-slate-50">
      <td class="font-bold text-slate-900">${escapeHtml(s.name)}</td>
      <td class="font-mono text-slate-700">${s.phone ? `<a href="tel:${escapeHtml(s.phone)}" class="text-indigo-600 hover:underline font-semibold">${escapeHtml(s.phone)}</a>` : '-'}</td>
      <td class="text-slate-600">${escapeHtml(s.city || '-')}</td>
      <td class="font-mono font-bold text-slate-800 text-xs">${s.gstNo ? `<span class="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">${escapeHtml(s.gstNo)}</span>` : '-'}</td>
      <td class="text-slate-500 text-xs max-w-xs truncate" title="${escapeHtml(s.address || '')}">${escapeHtml(s.address || '-')}</td>
      <td class="text-center space-x-1">
        <button onclick="openSupplierModal('${s.id}')" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Edit Supplier">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button onclick="deleteSupplier('${s.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete Supplier">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function deleteSupplier(id) {
  if (confirm("Are you sure you want to delete this supplier from the directory?")) {
    state.suppliers = (state.suppliers || []).filter(s => s.id !== id);
    saveState();
    updateSuppliersDatalist();
    renderSuppliersManageTable();
    showToast("Supplier removed from directory!");
  }
}

function initPurchaseModal() {
  const form = document.getElementById("purchaseForm");
  if (form) form.reset();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("purchaseDate").value = today;
  document.getElementById("purchaseEditId").value = "";
  document.getElementById("purchaseModalTitle").textContent = "New Purchase Bill";
  document.getElementById("purchaseItemsContainer").innerHTML = "";

  updateSuppliersDatalist();

  document.getElementById("purchasePaymentStatus").value = "Paid";
  togglePurchasePaymentUI();
  addPurchaseItemRow();
  calculatePurchaseTotal();
}

function togglePurchasePaymentUI() {
  const status = document.getElementById("purchasePaymentStatus").value;
  const total = parseFloat(document.getElementById("purchaseTotalDisplay").textContent.replace(/[₹,]/g, '')) || 0;
  const paidInput = document.getElementById("purchasePaidAmount");
  const paidBySection = document.getElementById("purchasePaidBySection");

  if (status === 'Paid') {
    paidInput.value = total;
    if (paidBySection) paidBySection.classList.remove("hidden");
  } else if (status === 'Pending') {
    paidInput.value = 0;
    if (paidBySection) paidBySection.classList.add("hidden");
  } else if (status === 'Partial') {
    if (paidBySection) paidBySection.classList.remove("hidden");
  }
}

function togglePurchasePaidAmountInput() {
  const paidAmt = parseFloat(document.getElementById("purchasePaidAmount").value) || 0;
  const paidBySection = document.getElementById("purchasePaidBySection");
  if (paidAmt > 0) {
    if (paidBySection) paidBySection.classList.remove("hidden");
  } else {
    if (paidBySection) paidBySection.classList.add("hidden");
  }
}

function editPurchase(id) {
  const purch = state.purchases.find(p => p.id === id);
  if (!purch) return;

  const form = document.getElementById("purchaseForm");
  if (form) form.reset();

  updateSuppliersDatalist();

  document.getElementById("purchaseEditId").value = purch.id;
  document.getElementById("purchaseDate").value = purch.date;
  document.getElementById("purchaseVendor").value = purch.vendor || "";
  if (document.getElementById("purchaseSupplierPhone")) document.getElementById("purchaseSupplierPhone").value = purch.supplierPhone || "";
  if (document.getElementById("purchaseSupplierCity")) document.getElementById("purchaseSupplierCity").value = purch.supplierCity || "";
  if (document.getElementById("purchaseSupplierGst")) document.getElementById("purchaseSupplierGst").value = purch.supplierGst || "";
  document.getElementById("purchaseBillNo").value = purch.billNo || "";
  document.getElementById("purchaseNotes").value = purch.notes || "";

  document.getElementById("purchasePaymentStatus").value = purch.paymentStatus || "Paid";
  document.getElementById("purchasePaidAmount").value = purch.paidAmount !== undefined ? purch.paidAmount : (purch.paymentStatus === 'Pending' ? 0 : purch.totalAmount);
  document.getElementById("purchaseModalTitle").textContent = `Edit Purchase (${purch.billNo})`;

  const radio = form.querySelector(`input[name="purchasePaidBy"][value="${purch.paidBy || 'partner1'}"]`);
  if (radio) radio.checked = true;

  togglePurchasePaymentUI();

  const container = document.getElementById("purchaseItemsContainer");
  container.innerHTML = "";

  (purch.items || []).forEach(it => {
    addPurchaseItemRow(it.productId, it.qty, it.costPrice, it.discountPercent, it.discountAmount, it.gstRate);
  });

  calculatePurchaseTotal();
  openModal('purchaseModal', 'edit');
}

function addPurchaseItemRow(prodId = "", qty = 10, customCost = null, discPercent = null, discAmount = null, gstRate = 0) {
  const container = document.getElementById("purchaseItemsContainer");
  if (!container) return;

  const rowIndex = Date.now() + "_" + Math.random().toString(36).substr(2, 4);

  let initialCost = 0;
  if (customCost !== null && customCost !== undefined) {
    initialCost = customCost;
  } else if (prodId) {
    const prod = state.products.find(p => p.id === prodId);
    if (prod) initialCost = prod.costPrice || 0;
  }

  const dPct = (discPercent !== null && discPercent !== undefined && discPercent > 0) ? discPercent : "";
  const dAmt = (discAmount !== null && discAmount !== undefined && discAmount > 0) ? discAmount : "";
  const gRate = (gstRate !== null && gstRate !== undefined) ? gstRate : 0;

  const row = document.createElement("div");
  row.className = "bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5 purchase-item-row hover:border-indigo-400 transition-all";
  row.id = `purch_row_${rowIndex}`;

  row.innerHTML = `
    <!-- Top: Wide Product Select & Item Total Badge -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex-grow">
        <label class="block text-[11px] font-bold text-slate-700 mb-1">
          <i class="fa-solid fa-box-open text-indigo-600"></i> Select Purchased Item *
        </label>
        <select onchange="onPurchaseProductSelect('${rowIndex}')" id="purch_prod_${rowIndex}" required class="input-pro py-1.5 text-xs sm:text-sm font-semibold">
          <option value="">-- Choose Item --</option>
          ${state.products.map(p => `<option value="${p.id}" ${p.id === prodId ? 'selected' : ''}>${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
        </select>
      </div>
      <div class="text-right flex-shrink-0 pt-3">
        <div class="text-[10px] uppercase tracking-wider font-bold text-slate-400">Item Total (Incl. GST)</div>
        <div class="flex items-center gap-2">
          <span id="purch_subtotal_${rowIndex}" class="font-mono text-sm sm:text-base font-bold text-slate-900">₹0</span>
          <button type="button" onclick="removePurchaseItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Remove Item">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom: 5 Spacious Input Boxes with Top Labels -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Qty (pcs) *</label>
        <input type="number" id="purch_qty_${rowIndex}" min="1" value="${qty}" oninput="onPurchaseRowQtyOrCostChange('${rowIndex}')" placeholder="Qty" required class="input-pro py-1.5 text-xs sm:text-sm text-center font-bold font-mono">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Purchase Cost (₹) *</label>
        <input type="number" id="purch_cost_${rowIndex}" min="0" step="any" value="${initialCost > 0 ? initialCost : ''}" oninput="onPurchaseRowQtyOrCostChange('${rowIndex}')" placeholder="₹ Cost" required class="input-pro py-1.5 text-xs sm:text-sm text-right font-bold text-slate-800 font-mono">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Discount (%)</label>
        <input type="number" id="purch_disc_pct_${rowIndex}" min="0" max="100" step="any" value="${dPct}" oninput="onPurchaseRowDiscPercentChange('${rowIndex}')" placeholder="0%" class="input-pro py-1.5 text-xs sm:text-sm text-right font-mono font-bold text-indigo-700">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Discount (₹)</label>
        <input type="number" id="purch_disc_amt_${rowIndex}" min="0" step="any" value="${dAmt}" oninput="onPurchaseRowDiscAmountChange('${rowIndex}')" placeholder="₹0.00" class="input-pro py-1.5 text-xs sm:text-sm text-right font-mono font-bold text-rose-600">
      </div>
      <div class="col-span-2 sm:col-span-1">
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">GST Rate (%)</label>
        <select id="purch_gst_${rowIndex}" onchange="onPurchaseRowQtyOrCostChange('${rowIndex}')" class="input-pro py-1.5 text-xs sm:text-sm font-bold text-indigo-700">
          <option value="0" ${gRate == 0 ? 'selected' : ''}>0% (Nil)</option>
          <option value="5" ${gRate == 5 ? 'selected' : ''}>5%</option>
          <option value="12" ${gRate == 12 ? 'selected' : ''}>12%</option>
          <option value="18" ${gRate == 18 ? 'selected' : ''}>18%</option>
          <option value="28" ${gRate == 28 ? 'selected' : ''}>28%</option>
        </select>
      </div>
    </div>
  `;

  container.appendChild(row);
  onPurchaseRowQtyOrCostChange(rowIndex);
}

function removePurchaseItemRow(rowIndex) {
  const row = document.getElementById(`purch_row_${rowIndex}`);
  if (row) row.remove();
  calculatePurchaseTotal();
}

function onPurchaseProductSelect(rowIndex) {
  const prodId = document.getElementById(`purch_prod_${rowIndex}`).value;
  const prod = state.products.find(p => p.id === prodId);
  if (prod) {
    document.getElementById(`purch_cost_${rowIndex}`).value = prod.costPrice || 0;
  }
  onPurchaseRowQtyOrCostChange(rowIndex);
}

function onPurchaseRowDiscPercentChange(rowIndex) {
  const qty = parseFloat(document.getElementById(`purch_qty_${rowIndex}`)?.value) || 0;
  const cost = parseFloat(document.getElementById(`purch_cost_${rowIndex}`)?.value) || 0;
  const gross = qty * cost;

  const pctInput = document.getElementById(`purch_disc_pct_${rowIndex}`);
  const amtInput = document.getElementById(`purch_disc_amt_${rowIndex}`);

  let pct = parseFloat(pctInput?.value) || 0;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  if (pctInput && pctInput.value !== "" && pctInput.value != pct) pctInput.value = pct;

  if (pct > 0 && gross > 0) {
    const discAmt = Math.round(((gross * pct) / 100) * 100) / 100;
    if (amtInput) amtInput.value = discAmt;
  } else {
    if (amtInput) amtInput.value = "";
  }
  onPurchaseRowQtyOrCostChange(rowIndex);
}

function onPurchaseRowDiscAmountChange(rowIndex) {
  const qty = parseFloat(document.getElementById(`purch_qty_${rowIndex}`)?.value) || 0;
  const cost = parseFloat(document.getElementById(`purch_cost_${rowIndex}`)?.value) || 0;
  const gross = qty * cost;

  const pctInput = document.getElementById(`purch_disc_pct_${rowIndex}`);
  const amtInput = document.getElementById(`purch_disc_amt_${rowIndex}`);

  let discAmt = parseFloat(amtInput?.value) || 0;
  if (discAmt < 0) discAmt = 0;
  if (gross > 0 && discAmt > gross) discAmt = gross;
  if (amtInput && amtInput.value !== "" && amtInput.value != discAmt) amtInput.value = discAmt;

  if (discAmt > 0 && gross > 0) {
    const pct = Math.round(((discAmt / gross) * 100) * 100) / 100;
    if (pctInput) pctInput.value = pct;
  } else {
    if (pctInput) pctInput.value = "";
  }
  onPurchaseRowQtyOrCostChange(rowIndex);
}

function onPurchaseRowQtyOrCostChange(rowIndex) {
  const qty = parseFloat(document.getElementById(`purch_qty_${rowIndex}`)?.value) || 0;
  const cost = parseFloat(document.getElementById(`purch_cost_${rowIndex}`)?.value) || 0;
  const gross = qty * cost;

  const pctInput = document.getElementById(`purch_disc_pct_${rowIndex}`);
  const amtInput = document.getElementById(`purch_disc_amt_${rowIndex}`);

  if (pctInput && pctInput.value !== "") {
    const pct = parseFloat(pctInput.value) || 0;
    if (pct > 0 && gross > 0) {
      const discAmt = Math.round(((gross * pct) / 100) * 100) / 100;
      if (amtInput) amtInput.value = discAmt;
    } else {
      if (amtInput) amtInput.value = "";
    }
  } else if (amtInput && amtInput.value !== "") {
    const discAmt = parseFloat(amtInput.value) || 0;
    if (discAmt > 0 && gross > 0) {
      const pct = Math.round(((discAmt / gross) * 100) * 100) / 100;
      if (pctInput) pctInput.value = pct;
    } else {
      if (pctInput) pctInput.value = "";
    }
  }

  const discAmt = parseFloat(document.getElementById(`purch_disc_amt_${rowIndex}`)?.value) || 0;
  const taxable = Math.max(0, gross - discAmt);
  const gstPct = parseFloat(document.getElementById(`purch_gst_${rowIndex}`)?.value) || 0;
  const gstAmt = Math.round(((taxable * gstPct) / 100) * 100) / 100;
  const rowNetTotal = taxable + gstAmt;
  const landedPerPc = qty > 0 ? (Math.round((rowNetTotal / qty) * 100) / 100) : 0;

  const subEl = document.getElementById(`purch_subtotal_${rowIndex}`);
  if (subEl) {
    if (gstAmt > 0) {
      subEl.innerHTML = `<span>${formatCurrency(rowNetTotal)}</span> <span class="text-[10px] text-emerald-700 font-semibold block font-sans">Landed: ${formatCurrency(landedPerPc)}/pc (Incl. GST)</span>`;
    } else {
      subEl.innerHTML = `<span>${formatCurrency(rowNetTotal)}</span> <span class="text-[10px] text-slate-500 font-semibold block font-sans">Cost: ${formatCurrency(landedPerPc)}/pc</span>`;
    }
  }

  calculatePurchaseTotal();
}

function calculatePurchaseTotal() {
  const rows = document.querySelectorAll(".purchase-item-row");
  let totalGross = 0;
  let totalDiscounts = 0;
  let totalTaxable = 0;
  let totalGst = 0;
  let netGrandTotal = 0;

  rows.forEach(row => {
    const id = row.id.replace("purch_row_", "");
    const qty = parseFloat(document.getElementById(`purch_qty_${id}`)?.value) || 0;
    const cost = parseFloat(document.getElementById(`purch_cost_${id}`)?.value) || 0;
    const gross = qty * cost;
    totalGross += gross;

    const discAmt = parseFloat(document.getElementById(`purch_disc_amt_${id}`)?.value) || 0;
    totalDiscounts += discAmt;

    const taxable = Math.max(0, gross - discAmt);
    totalTaxable += taxable;

    const gstPct = parseFloat(document.getElementById(`purch_gst_${id}`)?.value) || 0;
    const gstAmt = Math.round(((taxable * gstPct) / 100) * 100) / 100;
    totalGst += gstAmt;

    const rowNetTotal = taxable + gstAmt;
    netGrandTotal += rowNetTotal;
  });

  const grossEl = document.getElementById("purchaseGrossDisplay");
  if (grossEl) grossEl.textContent = formatCurrency(totalGross);

  const discEl = document.getElementById("purchaseTotalDiscountDisplay");
  if (discEl) discEl.textContent = `-${formatCurrency(totalDiscounts)}`;

  const gstEl = document.getElementById("purchaseTotalGstDisplay");
  if (gstEl) gstEl.textContent = `+${formatCurrency(totalGst)}`;

  const dTotal = document.getElementById("purchaseTotalDisplay");
  if (dTotal) dTotal.textContent = formatCurrency(netGrandTotal);

  const status = document.getElementById("purchasePaymentStatus")?.value;
  const paidInput = document.getElementById("purchasePaidAmount");
  if (status === 'Paid' && paidInput && !document.getElementById("purchaseEditId").value) {
    paidInput.value = netGrandTotal;
  }
}

function handleSavePurchase(e) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    const editId = document.getElementById("purchaseEditId")?.value || "";
    const date = document.getElementById("purchaseDate")?.value || new Date().toISOString().split('T')[0];
    const vendor = document.getElementById("purchaseVendor")?.value.trim();
    const supplierPhone = document.getElementById("purchaseSupplierPhone")?.value.trim() || "";
    const supplierCity = document.getElementById("purchaseSupplierCity")?.value.trim() || "";
    const supplierGst = document.getElementById("purchaseSupplierGst")?.value.trim().toUpperCase() || "";
    const billNo = document.getElementById("purchaseBillNo")?.value.trim() || ("PB-" + (state.purchases.length + 101));
    let paymentStatus = document.getElementById("purchasePaymentStatus")?.value || "Paid";
    const paidBy = document.querySelector('input[name="purchasePaidBy"]:checked')?.value || 'partner1';
    const notes = document.getElementById("purchaseNotes")?.value.trim() || "";

    if (!vendor) {
      showToast("Please enter Supplier / Vendor Name!", true);
      document.getElementById("purchaseVendor")?.focus();
      return;
    }

    // Auto save supplier into state.suppliers if new or update existing
    const suppliers = getSuppliers();
    const matched = suppliers.find(s => s.name.toLowerCase() === vendor.toLowerCase());
    if (matched) {
      if (supplierPhone) matched.phone = supplierPhone;
      if (supplierCity) matched.city = supplierCity;
      if (supplierGst) matched.gstNo = supplierGst;
    } else {
      state.suppliers.push({
        id: "supp_" + Date.now(),
        name: vendor,
        phone: supplierPhone,
        city: supplierCity,
        gstNo: supplierGst
      });
    }

    if (editId) {
      const oldPurch = state.purchases.find(p => p.id === editId);
      if (oldPurch && oldPurch.items) {
        oldPurch.items.forEach(it => {
          const prod = state.products.find(p => p.id === it.productId);
          if (prod) {
            prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - (Number(it.qty) || 0));
          }
        });
      }
    }

    const rows = document.querySelectorAll(".purchase-item-row");
    if (rows.length === 0) {
      showToast("Please add at least one item!", true);
      return;
    }

    const items = [];
    let totalGross = 0;
    let totalDiscounts = 0;
    let totalTaxable = 0;
    let totalGst = 0;
    let netGrandTotal = 0;
    const shouldUpdateMasterCost = document.getElementById("purchaseUpdateMasterCost") ? document.getElementById("purchaseUpdateMasterCost").checked : true;

    rows.forEach(row => {
      const id = row.id.replace("purch_row_", "");
      const prodId = document.getElementById(`purch_prod_${id}`)?.value;
      const qty = parseInt(document.getElementById(`purch_qty_${id}`)?.value) || 0;
      const costPrice = parseFloat(document.getElementById(`purch_cost_${id}`)?.value) || 0;
      const discountPercent = parseFloat(document.getElementById(`purch_disc_pct_${id}`)?.value) || 0;
      const discountAmount = parseFloat(document.getElementById(`purch_disc_amt_${id}`)?.value) || 0;
      const gstRate = parseFloat(document.getElementById(`purch_gst_${id}`)?.value) || 0;

      if (!prodId || qty <= 0) return;

      const prod = state.products.find(p => p.id === prodId);
      if (!prod) return;

      const gross = qty * costPrice;
      const taxable = Math.max(0, gross - discountAmount);
      const gstAmount = Math.round(((taxable * gstRate) / 100) * 100) / 100;
      const rowTotal = taxable + gstAmount;

      totalGross += gross;
      totalDiscounts += discountAmount;
      totalTaxable += taxable;
      totalGst += gstAmount;
      netGrandTotal += rowTotal;

      // Net Landed Cost per piece INCLUDING GST and after discounts!
      const netCostPrice = qty > 0 ? (Math.round((rowTotal / qty) * 100) / 100) : (costPrice + (costPrice * (gstRate/100)));

      items.push({
        productId: prod.id,
        productName: prod.name,
        qty,
        costPrice,
        discountPercent,
        discountAmount,
        taxableAmount: taxable,
        gstRate,
        gstAmount,
        netCostPrice,
        grossTotal: gross,
        total: rowTotal
      });

      prod.currentStock = (Number(prod.currentStock) || 0) + qty;
      if (shouldUpdateMasterCost && netCostPrice > 0) {
        prod.costPrice = netCostPrice; // Updates master product cost with GST-inclusive landed price!
      }
    });

    if (items.length === 0) {
      showToast("Please select a valid item and quantity!", true);
      return;
    }

    let paidAmount = parseFloat(document.getElementById("purchasePaidAmount")?.value);
    if (isNaN(paidAmount)) paidAmount = (paymentStatus === 'Paid' ? netGrandTotal : 0);

    if (paidAmount >= netGrandTotal) {
      paymentStatus = 'Paid';
      paidAmount = netGrandTotal;
    } else if (paidAmount <= 0) {
      paymentStatus = 'Pending';
      paidAmount = 0;
    } else {
      paymentStatus = 'Partial';
    }

    if (editId) {
      const existing = state.purchases.find(p => p.id === editId);
      if (existing) {
        existing.date = date;
        existing.vendor = vendor;
        existing.supplierPhone = supplierPhone;
        existing.supplierCity = supplierCity;
        existing.supplierGst = supplierGst;
        existing.billNo = billNo;
        existing.paidBy = paidBy;
        existing.items = items;
        existing.subtotal = totalGross;
        existing.discountAmount = totalDiscounts;
        existing.taxableAmount = totalTaxable;
        existing.gstAmount = totalGst;
        existing.totalAmount = netGrandTotal;
        existing.paymentStatus = paymentStatus;
        existing.paidAmount = paidAmount;
        existing.notes = notes;
        if (paymentStatus === 'Pending' || paidAmount === 0) {
          existing.paymentHistory = [];
        } else if (!existing.paymentHistory || existing.paymentHistory.length === 0) {
          existing.paymentHistory = [{ date, amount: paidAmount, paidBy, notes }];
        }
        showToast(`Purchase bill ${existing.billNo} updated successfully!`);
      }
    } else {
      const newPurchase = {
        id: "purch_" + Date.now(),
        billNo,
        vendor,
        supplierPhone,
        supplierCity,
        supplierGst,
        date,
        paidBy,
        items,
        subtotal: totalGross,
        discountAmount: totalDiscounts,
        taxableAmount: totalTaxable,
        gstAmount: totalGst,
        totalAmount: netGrandTotal,
        paymentStatus,
        paidAmount,
        notes
      };
      state.purchases.push(newPurchase);
      showToast(`Purchase bill ${billNo} saved successfully!`);
    }

    saveState();
    closeModal('purchaseModal');
    refreshAllUI();
  } catch (err) {
    console.error("Error saving purchase:", err);
    showToast("Error saving purchase: " + err.message, true);
  }
}

function reconcileSupplierReturnsAndBills() {
  // Purchases retain their user-specified payment status (Paid, Pending, or Partial)
  // Lump-sum payments and debit note adjustments are handled explicitly via handleSaveSupplierLumpSumPay
}

function renderPurchasesTable() {
  const tbody = document.getElementById("purchasesTableBody");
  if (!tbody) return;

  if (state.purchases.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-5 text-center text-slate-400">No purchase bills recorded.</td></tr>`;
    return;
  }

  const p1 = state.settings.partner1Name;
  const p2 = state.settings.partner2Name;

  tbody.innerHTML = state.purchases.map(p => {
    const total = Number(p.totalAmount) || 0;
    const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Pending' ? 0 : total);
    const pending = Math.max(0, total - paid);

    const payerName = p.paidBy === 'partner1' ? p1 : (p.paidBy === 'partner2' ? p2 : 'Business Account');
    const itemsSummary = (p.items || []).map(it => `${it.productName} (+${it.qty})`).join(", ");

    let statusBadge = "badge-paid";
    let statusText = "Paid";
    if (p.paymentStatus === 'Pending' || pending === total) {
      statusBadge = "badge-pending";
      statusText = "Due";
    } else if (p.paymentStatus === 'Partial' || pending > 0) {
      statusBadge = "badge-partial";
      statusText = `Due: ${formatCurrency(pending)}`;
    }

    const debAdj = Number(p.debitNoteAdjusted) || 0;
    const cashPaid = Math.max(0, paid - debAdj);

    let payerDisplay = `<span class="text-xs text-slate-400 font-medium">Unpaid (Credit)</span>`;
    if (cashPaid > 0 && debAdj > 0) {
      payerDisplay = `<span class="badge-status badge-neutral font-medium">${escapeHtml(payerName)} (₹${cashPaid}) + <span class="text-emerald-700 font-bold">Return (₹${debAdj})</span></span>`;
    } else if (debAdj > 0 && cashPaid === 0) {
      payerDisplay = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><i class="fa-solid fa-rotate-left text-[10px]"></i> Return Debit (₹${debAdj})</span>`;
    } else if (paid > 0) {
      payerDisplay = `<span class="badge-status badge-neutral font-medium">${escapeHtml(payerName)} (₹${paid})</span>`;
    }

    return `
      <tr>
        <td>
          <span class="font-mono font-bold text-slate-900 block">${escapeHtml(p.billNo)}</span>
          <span class="text-[10px] text-slate-400 font-mono">${formatDate(p.date)}</span>
        </td>
        <td class="font-bold text-slate-900">${escapeHtml(p.vendor)}</td>
        <td class="text-slate-600 max-w-xs truncate" title="${escapeHtml(itemsSummary)}">${escapeHtml(itemsSummary)}</td>
        <td>
          ${payerDisplay}
        </td>
        <td class="text-right">
          <span class="font-bold text-slate-900 block font-mono">${formatCurrency(total)}</span>
          ${pending > 0 ? `<span class="text-[10px] text-rose-600 font-bold block font-mono">Due: ${formatCurrency(pending)}</span>` : `<span class="text-[10px] text-emerald-600 font-bold block">Paid</span>`}
        </td>
        <td class="text-center space-x-1">
          ${pending > 0 ? `
            <button onclick="openVendorPayModal('${p.id}')" class="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold">
              Pay
            </button>
          ` : ''}
          <button onclick="openSupplierReturnForPurchase('${p.id}')" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Return / Exchange with Supplier">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
          <button onclick="editPurchase('${p.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deletePurchase('${p.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deletePurchase(id) {
  const purch = state.purchases.find(p => p.id === id);
  if (!purch) return;

  if (confirm(`Are you sure you want to delete Bill ${purch.billNo}? Note: Inward stock will be removed.`)) {
    if (purch.items && Array.isArray(purch.items)) {
      purch.items.forEach(it => {
        const prod = state.products.find(p => p.id === it.productId);
        if (prod) {
          prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - (Number(it.qty) || 0));
        }
      });
    }

    state.purchases = state.purchases.filter(p => p.id !== id);
    saveState();
    refreshAllUI();
    showToast("Purchase bill deleted!");
  }
}

function openVendorPayModal(purchId) {
  const purch = state.purchases.find(p => p.id === purchId);
  if (!purch) return;
  openSupplierLumpSumPayModal(purch.vendor);
}

function handleSaveVendorPay(e) {
  handleSaveSupplierLumpSumPay(e);
}

// ==================== SUPPLIER PURCHASE RETURNS & EXCHANGES ====================
function openSupplierReturnModal(supplierName = "", purchaseId = "") {
  const form = document.getElementById("supplierReturnForm");
  if (form) form.reset();

  document.getElementById("supplierReturnEditId").value = "";
  document.getElementById("supplierReturnDate").value = new Date().toISOString().split('T')[0];
  document.getElementById("supplierReturnMode").value = "return_only";
  document.getElementById("supplierReturnModalTitle").innerHTML = `<i class="fa-solid fa-rotate-left text-amber-600"></i> Record Supplier Return / Debit Note`;

  updateSuppliersDatalist();

  const retContainer = document.getElementById("returnItemsContainer");
  if (retContainer) retContainer.innerHTML = "";

  const excContainer = document.getElementById("exchangeItemsContainer");
  if (excContainer) excContainer.innerHTML = "";

  if (purchaseId) {
    const purch = state.purchases.find(p => p.id === purchaseId);
    if (purch) {
      document.getElementById("supplierReturnVendor").value = purch.vendor || "";
      if (purch.items && purch.items.length > 0) {
        purch.items.forEach(it => {
          addReturnItemRow(it.productId, it.qty, it.costPrice, it.gstRate);
        });
      } else {
        addReturnItemRow();
      }
    } else {
      addReturnItemRow();
    }
  } else if (supplierName) {
    document.getElementById("supplierReturnVendor").value = supplierName;
    addReturnItemRow();
  } else {
    addReturnItemRow();
  }

  toggleSupplierReturnModeUI();
  toggleReturnSettlementUI();
  calculateReturnTotals();
  openModal('supplierReturnModal');
}

function openSupplierReturnForPurchase(purchaseId) {
  openSupplierReturnModal("", purchaseId);
}

function toggleSupplierReturnModeUI() {
  const mode = document.getElementById("supplierReturnMode")?.value || "return_only";
  const excSection = document.getElementById("exchangeItemsSection");
  const excTotalValContainer = document.getElementById("exchangeTotalValContainer");
  const title = document.getElementById("supplierReturnModalTitle");

  if (mode === "exchange") {
    if (excSection) excSection.classList.remove("hidden");
    if (excTotalValContainer) excTotalValContainer.classList.remove("hidden");
    if (title) title.innerHTML = `<i class="fa-solid fa-rotate text-amber-600"></i> Supplier Item Exchange (માલ બદલી)`;
    
    // Add default exchange item if container is empty
    const excContainer = document.getElementById("exchangeItemsContainer");
    if (excContainer && excContainer.children.length === 0) {
      addExchangeItemRow();
    }
  } else {
    if (excSection) excSection.classList.add("hidden");
    if (excTotalValContainer) excTotalValContainer.classList.add("hidden");
    if (title) title.innerHTML = `<i class="fa-solid fa-rotate-left text-amber-600"></i> Record Supplier Return / Debit Note`;
  }
  calculateReturnTotals();
}

function toggleReturnSettlementUI() {
  const mode = document.getElementById("returnSettlementMode")?.value || "ledger_credit";
  const recipientGroup = document.getElementById("returnRefundRecipientGroup");
  const accountLabel = document.getElementById("returnAccountLabel");

  if (mode === 'refund_received') {
    if (recipientGroup) recipientGroup.classList.remove("hidden");
    if (accountLabel) accountLabel.textContent = "Refund Received In / Account *";
  } else if (mode === 'extra_paid') {
    if (recipientGroup) recipientGroup.classList.remove("hidden");
    if (accountLabel) accountLabel.textContent = "Extra Money Paid By / Account *";
  } else {
    if (recipientGroup) recipientGroup.classList.add("hidden");
  }
}

function addReturnItemRow(prodId = "", qty = 1, customCost = null, gstRate = 0) {
  const container = document.getElementById("returnItemsContainer");
  if (!container) return;

  const rowIndex = "ret_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);

  let initialCost = 0;
  if (customCost !== null && customCost !== undefined) {
    initialCost = customCost;
  } else if (prodId) {
    const prod = state.products.find(p => p.id === prodId);
    if (prod) initialCost = prod.costPrice || 0;
  }

  const gRate = (gstRate !== null && gstRate !== undefined) ? gstRate : 0;

  const row = document.createElement("div");
  row.className = "bg-rose-50/40 p-3 rounded-xl border border-rose-200 shadow-2xs space-y-2 return-item-row";
  row.id = rowIndex;

  row.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="flex-grow">
        <label class="block text-[11px] font-bold text-rose-900 mb-1">
          <i class="fa-solid fa-box text-rose-600"></i> Returned Product (Stock Deduct -) *
        </label>
        <select onchange="onReturnProductSelect('${rowIndex}')" id="ret_prod_${rowIndex}" required class="input-pro py-1.5 text-xs sm:text-sm font-semibold">
          <option value="">-- Select Product to Return --</option>
          ${state.products.map(p => `<option value="${p.id}" ${p.id === prodId ? 'selected' : ''}>${escapeHtml(p.name)} (Current Stock: ${p.currentStock})</option>`).join('')}
        </select>
      </div>
      <div class="text-right flex-shrink-0 pt-2">
        <div class="text-[10px] uppercase font-bold text-rose-400">Return Value</div>
        <div class="flex items-center gap-2">
          <span id="ret_total_${rowIndex}" class="font-mono text-sm sm:text-base font-bold text-rose-900">₹0</span>
          <button type="button" onclick="removeReturnItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg" title="Remove Row">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 sm:gap-3 bg-white p-2 rounded-lg border border-rose-100">
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Qty (pcs) *</label>
        <input type="number" id="ret_qty_${rowIndex}" min="1" value="${qty}" oninput="calculateReturnTotals()" placeholder="Qty" required class="input-pro py-1.5 text-xs sm:text-sm text-center font-bold font-mono text-rose-700">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Rate (₹/pc) *</label>
        <input type="number" id="ret_cost_${rowIndex}" min="0" step="any" value="${initialCost > 0 ? initialCost : ''}" oninput="calculateReturnTotals()" placeholder="₹ Rate" required class="input-pro py-1.5 text-xs sm:text-sm text-right font-bold font-mono">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">GST (%)</label>
        <select id="ret_gst_${rowIndex}" onchange="calculateReturnTotals()" class="input-pro py-1.5 text-xs sm:text-sm font-bold text-indigo-700">
          <option value="0" ${gRate == 0 ? 'selected' : ''}>0% (Nil)</option>
          <option value="5" ${gRate == 5 ? 'selected' : ''}>5%</option>
          <option value="12" ${gRate == 12 ? 'selected' : ''}>12%</option>
          <option value="18" ${gRate == 18 ? 'selected' : ''}>18%</option>
          <option value="28" ${gRate == 28 ? 'selected' : ''}>28%</option>
        </select>
      </div>
    </div>
  `;

  container.appendChild(row);
  calculateReturnTotals();
}

function removeReturnItemRow(rowIndex) {
  const row = document.getElementById(rowIndex);
  if (row) row.remove();
  calculateReturnTotals();
}

function onReturnProductSelect(rowIndex) {
  const prodId = document.getElementById(`ret_prod_${rowIndex}`)?.value;
  const prod = state.products.find(p => p.id === prodId);
  if (prod) {
    const costInput = document.getElementById(`ret_cost_${rowIndex}`);
    if (costInput) costInput.value = prod.costPrice || 0;
  }
  calculateReturnTotals();
}

function addExchangeItemRow(prodId = "", qty = 1, customCost = null, gstRate = 0) {
  const container = document.getElementById("exchangeItemsContainer");
  if (!container) return;

  const rowIndex = "exc_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);

  let initialCost = 0;
  if (customCost !== null && customCost !== undefined) {
    initialCost = customCost;
  } else if (prodId) {
    const prod = state.products.find(p => p.id === prodId);
    if (prod) initialCost = prod.costPrice || 0;
  }

  const gRate = (gstRate !== null && gstRate !== undefined) ? gstRate : 0;

  const row = document.createElement("div");
  row.className = "bg-emerald-50/40 p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-2 exchange-item-row";
  row.id = rowIndex;

  row.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="flex-grow">
        <label class="block text-[11px] font-bold text-emerald-900 mb-1">
          <i class="fa-solid fa-box text-emerald-600"></i> New Exchanged Product (Stock Added +) *
        </label>
        <select onchange="onExchangeProductSelect('${rowIndex}')" id="exc_prod_${rowIndex}" required class="input-pro py-1.5 text-xs sm:text-sm font-semibold">
          <option value="">-- Select New Exchanged Product --</option>
          ${state.products.map(p => `<option value="${p.id}" ${p.id === prodId ? 'selected' : ''}>${escapeHtml(p.name)} (Current Stock: ${p.currentStock})</option>`).join('')}
        </select>
      </div>
      <div class="text-right flex-shrink-0 pt-2">
        <div class="text-[10px] uppercase font-bold text-emerald-400">Exchange Value</div>
        <div class="flex items-center gap-2">
          <span id="exc_total_${rowIndex}" class="font-mono text-sm sm:text-base font-bold text-emerald-900">₹0</span>
          <button type="button" onclick="removeExchangeItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg" title="Remove Row">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 sm:gap-3 bg-white p-2 rounded-lg border border-emerald-100">
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Qty (pcs) *</label>
        <input type="number" id="exc_qty_${rowIndex}" min="1" value="${qty}" oninput="calculateReturnTotals()" placeholder="Qty" required class="input-pro py-1.5 text-xs sm:text-sm text-center font-bold font-mono text-emerald-700">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">Rate (₹/pc) *</label>
        <input type="number" id="exc_cost_${rowIndex}" min="0" step="any" value="${initialCost > 0 ? initialCost : ''}" oninput="calculateReturnTotals()" placeholder="₹ Rate" required class="input-pro py-1.5 text-xs sm:text-sm text-right font-bold font-mono">
      </div>
      <div>
        <label class="block text-[11px] font-semibold text-slate-600 mb-1">GST (%)</label>
        <select id="exc_gst_${rowIndex}" onchange="calculateReturnTotals()" class="input-pro py-1.5 text-xs sm:text-sm font-bold text-indigo-700">
          <option value="0" ${gRate == 0 ? 'selected' : ''}>0% (Nil)</option>
          <option value="5" ${gRate == 5 ? 'selected' : ''}>5%</option>
          <option value="12" ${gRate == 12 ? 'selected' : ''}>12%</option>
          <option value="18" ${gRate == 18 ? 'selected' : ''}>18%</option>
          <option value="28" ${gRate == 28 ? 'selected' : ''}>28%</option>
        </select>
      </div>
    </div>
  `;

  container.appendChild(row);
  calculateReturnTotals();
}

function removeExchangeItemRow(rowIndex) {
  const row = document.getElementById(rowIndex);
  if (row) row.remove();
  calculateReturnTotals();
}

function onExchangeProductSelect(rowIndex) {
  const prodId = document.getElementById(`exc_prod_${rowIndex}`)?.value;
  const prod = state.products.find(p => p.id === prodId);
  if (prod) {
    const costInput = document.getElementById(`exc_cost_${rowIndex}`);
    if (costInput) costInput.value = prod.costPrice || 0;
  }
  calculateReturnTotals();
}

function calculateReturnTotals() {
  const mode = document.getElementById("supplierReturnMode")?.value || "return_only";

  let totalReturnedVal = 0;
  document.querySelectorAll(".return-item-row").forEach(row => {
    const id = row.id;
    const qty = parseFloat(document.getElementById(`ret_qty_${id}`)?.value) || 0;
    const cost = parseFloat(document.getElementById(`ret_cost_${id}`)?.value) || 0;
    const gstPct = parseFloat(document.getElementById(`ret_gst_${id}`)?.value) || 0;
    const taxable = qty * cost;
    const gstAmt = Math.round(((taxable * gstPct) / 100) * 100) / 100;
    const rowTotal = taxable + gstAmt;
    totalReturnedVal += rowTotal;

    const subEl = document.getElementById(`ret_total_${id}`);
    if (subEl) subEl.textContent = formatCurrency(rowTotal);
  });

  let totalExchangedVal = 0;
  if (mode === "exchange") {
    document.querySelectorAll(".exchange-item-row").forEach(row => {
      const id = row.id;
      const qty = parseFloat(document.getElementById(`exc_qty_${id}`)?.value) || 0;
      const cost = parseFloat(document.getElementById(`exc_cost_${id}`)?.value) || 0;
      const gstPct = parseFloat(document.getElementById(`exc_gst_${id}`)?.value) || 0;
      const taxable = qty * cost;
      const gstAmt = Math.round(((taxable * gstPct) / 100) * 100) / 100;
      const rowTotal = taxable + gstAmt;
      totalExchangedVal += rowTotal;

      const subEl = document.getElementById(`exc_total_${id}`);
      if (subEl) subEl.textContent = formatCurrency(rowTotal);
    });
  }

  const retValDisplay = document.getElementById("returnTotalValDisplay");
  if (retValDisplay) retValDisplay.textContent = formatCurrency(totalReturnedVal);

  const excValDisplay = document.getElementById("exchangeTotalValDisplay");
  if (excValDisplay) excValDisplay.textContent = formatCurrency(totalExchangedVal);

  const diff = totalReturnedVal - totalExchangedVal;
  const netBalDisplay = document.getElementById("returnNetBalanceDisplay");
  const netBalLabel = document.getElementById("returnNetBalanceLabel");

  if (diff > 0) {
    if (netBalLabel) netBalLabel.textContent = "Net Refund / Supplier Credit (Debit Note):";
    if (netBalDisplay) {
      netBalDisplay.textContent = formatCurrency(diff);
      netBalDisplay.className = "text-xl sm:text-2xl font-bold text-emerald-700 font-mono";
    }
  } else if (diff < 0) {
    if (netBalLabel) netBalLabel.textContent = "Extra Amount to Pay Supplier:";
    if (netBalDisplay) {
      netBalDisplay.textContent = formatCurrency(Math.abs(diff));
      netBalDisplay.className = "text-xl sm:text-2xl font-bold text-rose-600 font-mono";
    }
  } else {
    if (netBalLabel) netBalLabel.textContent = "Even Exchange (No Balance):";
    if (netBalDisplay) {
      netBalDisplay.textContent = formatCurrency(0);
      netBalDisplay.className = "text-xl sm:text-2xl font-bold text-slate-900 font-mono";
    }
  }
}

function handleSaveSupplierReturn(e) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    const editId = document.getElementById("supplierReturnEditId")?.value || "";
    const date = document.getElementById("supplierReturnDate")?.value || new Date().toISOString().split('T')[0];
    const vendor = document.getElementById("supplierReturnVendor")?.value.trim();
    const mode = document.getElementById("supplierReturnMode")?.value || "return_only";
    const settlementMode = document.getElementById("returnSettlementMode")?.value || "ledger_credit";
    const refundRecipient = document.getElementById("returnRefundRecipient")?.value || "partner1";
    const notes = document.getElementById("supplierReturnNotes")?.value.trim() || "";

    if (!vendor) {
      showToast("Please enter or select Supplier / Vendor Name!", true);
      document.getElementById("supplierReturnVendor")?.focus();
      return;
    }

    // Auto save supplier if new
    const suppliers = getSuppliers();
    const matched = suppliers.find(s => s.name.toLowerCase() === vendor.toLowerCase());
    if (!matched) {
      state.suppliers.push({
        id: "supp_" + Date.now(),
        name: vendor,
        phone: "",
        city: "",
        gstNo: ""
      });
    }

    // Collect Returned Items
    const returnedItems = [];
    let totalReturnedVal = 0;
    document.querySelectorAll(".return-item-row").forEach(row => {
      const id = row.id;
      const prodId = document.getElementById(`ret_prod_${id}`)?.value;
      const qty = parseInt(document.getElementById(`ret_qty_${id}`)?.value) || 0;
      const costPrice = parseFloat(document.getElementById(`ret_cost_${id}`)?.value) || 0;
      const gstRate = parseFloat(document.getElementById(`ret_gst_${id}`)?.value) || 0;

      if (!prodId || qty <= 0) return;
      const prod = state.products.find(p => p.id === prodId);
      if (!prod) return;

      const taxable = qty * costPrice;
      const gstAmount = Math.round(((taxable * gstRate) / 100) * 100) / 100;
      const total = taxable + gstAmount;
      totalReturnedVal += total;

      returnedItems.push({
        productId: prod.id,
        productName: prod.name,
        qty,
        costPrice,
        gstRate,
        gstAmount,
        taxableAmount: taxable,
        total
      });
    });

    if (returnedItems.length === 0) {
      showToast("Please select at least one item to return!", true);
      return;
    }

    // Collect Exchanged Items (if mode === 'exchange')
    const exchangedItems = [];
    let totalExchangedVal = 0;
    if (mode === "exchange") {
      document.querySelectorAll(".exchange-item-row").forEach(row => {
        const id = row.id;
        const prodId = document.getElementById(`exc_prod_${id}`)?.value;
        const qty = parseInt(document.getElementById(`exc_qty_${id}`)?.value) || 0;
        const costPrice = parseFloat(document.getElementById(`exc_cost_${id}`)?.value) || 0;
        const gstRate = parseFloat(document.getElementById(`exc_gst_${id}`)?.value) || 0;

        if (!prodId || qty <= 0) return;
        const prod = state.products.find(p => p.id === prodId);
        if (!prod) return;

        const taxable = qty * costPrice;
        const gstAmount = Math.round(((taxable * gstRate) / 100) * 100) / 100;
        const total = taxable + gstAmount;
        totalExchangedVal += total;

        exchangedItems.push({
          productId: prod.id,
          productName: prod.name,
          qty,
          costPrice,
          gstRate,
          gstAmount,
          taxableAmount: taxable,
          total
        });
      });

      if (exchangedItems.length === 0) {
        showToast("Please select at least one new item received in exchange!", true);
        return;
      }
    }

    // Rollback stock if editing existing return record
    if (editId) {
      const oldRec = (state.supplierReturns || []).find(r => r.id === editId);
      if (oldRec) {
        (oldRec.returnedItems || []).forEach(it => {
          const prod = state.products.find(p => p.id === it.productId);
          if (prod) prod.currentStock = (Number(prod.currentStock) || 0) + (Number(it.qty) || 0);
        });
        (oldRec.exchangedItems || []).forEach(it => {
          const prod = state.products.find(p => p.id === it.productId);
          if (prod) prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - (Number(it.qty) || 0));
        });
      }
    }

    // Deduct stock for returned items
    returnedItems.forEach(it => {
      const prod = state.products.find(p => p.id === it.productId);
      if (prod) {
        prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - (Number(it.qty) || 0));
      }
    });

    // Add stock for exchanged items
    if (mode === "exchange") {
      exchangedItems.forEach(it => {
        const prod = state.products.find(p => p.id === it.productId);
        if (prod) {
          prod.currentStock = (Number(prod.currentStock) || 0) + (Number(it.qty) || 0);
          if (it.costPrice > 0) prod.costPrice = it.costPrice;
        }
      });
    }

    const netBalance = totalReturnedVal - totalExchangedVal;
    const refNo = "PR-" + ((state.supplierReturns ? state.supplierReturns.length : 0) + 101);

    if (!state.supplierReturns) state.supplierReturns = [];

    if (editId) {
      const existing = state.supplierReturns.find(r => r.id === editId);
      if (existing) {
        existing.date = date;
        existing.vendor = vendor;
        existing.mode = mode;
        existing.returnedItems = returnedItems;
        existing.exchangedItems = exchangedItems;
        existing.totalReturnedVal = totalReturnedVal;
        existing.totalExchangedVal = totalExchangedVal;
        existing.netBalance = netBalance;
        existing.settlementMode = settlementMode;
        existing.refundRecipient = refundRecipient;
        existing.notes = notes;
        showToast(`Supplier return ${existing.refNo} updated successfully!`);
      }
    } else {
      state.supplierReturns.push({
        id: "sret_" + Date.now(),
        refNo,
        date,
        vendor,
        mode,
        returnedItems,
        exchangedItems,
        totalReturnedVal,
        totalExchangedVal,
        netBalance,
        settlementMode,
        refundRecipient,
        notes
      });
      showToast(`Supplier return ${refNo} recorded and stock adjusted!`);
    }

    saveState();
    closeModal('supplierReturnModal');
    refreshAllUI();
  } catch (err) {
    console.error("Error saving supplier return:", err);
    showToast("Error saving return: " + err.message, true);
  }
}

function renderSupplierReturnsTable() {
  const tbody = document.getElementById("supplierReturnsTableBody");
  if (!tbody) return;

  const returns = state.supplierReturns || [];
  if (returns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-5 text-center text-slate-400">No supplier returns or exchanges recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = returns.slice().reverse().map(r => {
    const isExchange = r.mode === 'exchange';
    const modeBadge = isExchange 
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><i class="fa-solid fa-rotate text-xs"></i> Exchange</span>'
      : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><i class="fa-solid fa-arrow-up-from-bracket text-xs"></i> Return (Stock Out)</span>';

    const retSummary = (r.returnedItems || []).map(it => `<span class="text-rose-700 font-semibold font-mono">-${it.qty}</span> ${escapeHtml(it.productName)}`).join("<br>");
    const excSummary = isExchange && r.exchangedItems && r.exchangedItems.length > 0
      ? r.exchangedItems.map(it => `<span class="text-emerald-700 font-semibold font-mono">+${it.qty}</span> ${escapeHtml(it.productName)}`).join("<br>")
      : '<span class="text-slate-400 text-xs">-</span>';

    let settlementText = "Ledger Debit Note";
    let settleClass = "bg-slate-100 text-slate-700";
    if (r.settlementMode === 'refund_received') {
      settlementText = "Refund Received";
      settleClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
    } else if (r.settlementMode === 'extra_paid') {
      settlementText = "Extra Paid";
      settleClass = "bg-rose-50 text-rose-700 border border-rose-200";
    } else if (r.settlementMode === 'even_exchange') {
      settlementText = "Even Exchange";
      settleClass = "bg-indigo-50 text-indigo-700 border border-indigo-200";
    }

    return `
      <tr>
        <td>
          <span class="font-mono font-bold text-slate-900 block text-xs">${escapeHtml(r.refNo || 'PR')}</span>
          <span class="text-[10px] text-slate-400 font-mono">${formatDate(r.date)}</span>
        </td>
        <td class="font-bold text-slate-800 text-xs">${escapeHtml(r.vendor || '-')}</td>
        <td>${modeBadge}</td>
        <td class="text-xs text-slate-700 max-w-xs">${retSummary}</td>
        <td class="text-xs text-slate-700 max-w-xs">${excSummary}</td>
        <td class="text-right font-mono font-bold ${r.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'} text-xs sm:text-sm">
          ${formatCurrency(Math.abs(r.netBalance || r.totalReturnedVal || 0))}
        </td>
        <td>
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold ${settleClass}">
            ${settlementText}
          </span>
          ${r.notes ? `<div class="text-[10px] text-slate-400 truncate max-w-[120px]" title="${escapeHtml(r.notes)}">${escapeHtml(r.notes)}</div>` : ''}
        </td>
        <td class="text-center space-x-1">
          <button onclick="deleteSupplierReturn('${r.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete Return">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteSupplierReturn(id) {
  const r = (state.supplierReturns || []).find(rec => rec.id === id);
  if (!r) return;

  if (confirm(`Are you sure you want to delete Supplier Return ${r.refNo}? Note: Stock will be automatically restored!`)) {
    // Restore returned stock
    (r.returnedItems || []).forEach(it => {
      const prod = state.products.find(p => p.id === it.productId);
      if (prod) prod.currentStock = (Number(prod.currentStock) || 0) + (Number(it.qty) || 0);
    });

    // Deduct exchanged stock
    (r.exchangedItems || []).forEach(it => {
      const prod = state.products.find(p => p.id === it.productId);
      if (prod) prod.currentStock = Math.max(0, (Number(prod.currentStock) || 0) - (Number(it.qty) || 0));
    });

    state.supplierReturns = state.supplierReturns.filter(rec => rec.id !== id);
    saveState();
    refreshAllUI();
    showToast(`Supplier return ${r.refNo} deleted and stock rolled back!`);
  }
}

// ==================== DAILY EXPENSES ====================
function editExpense(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;

  const form = document.getElementById("expenseForm");
  if (form) form.reset();

  document.getElementById("expenseEditId").value = exp.id;
  document.getElementById("expenseDate").value = exp.date;
  document.getElementById("expenseAmount").value = exp.amount;
  document.getElementById("expenseCategory").value = exp.category;
  document.getElementById("expenseDescription").value = exp.description || "";
  document.getElementById("expenseModalTitle").textContent = "Edit Expense";

  const radio = form.querySelector(`input[name="expensePaidBy"][value="${exp.paidBy}"]`);
  if (radio) radio.checked = true;

  openModal('expenseModal', 'edit');
}

function handleSaveExpense(e) {
  e.preventDefault();
  const editId = document.getElementById("expenseEditId").value;
  const date = document.getElementById("expenseDate").value;
  const amount = parseFloat(document.getElementById("expenseAmount").value) || 0;
  const category = document.getElementById("expenseCategory").value;
  const paidBy = document.querySelector('input[name="expensePaidBy"]:checked').value;
  const description = document.getElementById("expenseDescription").value.trim();

  if (amount <= 0) {
    showToast("Amount must be greater than 0!", true);
    return;
  }

  if (editId) {
    const existing = state.expenses.find(e => e.id === editId);
    if (existing) {
      existing.date = date;
      existing.amount = amount;
      existing.category = category;
      existing.paidBy = paidBy;
      existing.description = description;
      showToast("Expense updated successfully!");
    }
  } else {
    const newExpense = {
      id: "exp_" + Date.now(),
      date,
      amount,
      category,
      paidBy,
      description
    };
    state.expenses.push(newExpense);
    showToast(`Expense of ₹${amount} saved!`);
  }

  saveState();
  closeModal('expenseModal');
  refreshAllUI();
}

function renderExpensesTable() {
  const tbody = document.getElementById("expensesTableBody");
  if (!tbody) return;

  const catTotals = {};
  state.expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + (Number(e.amount) || 0);
  });

  const catContainer = document.getElementById("expenseCategorySummary");
  if (catContainer) {
    const topCats = Object.entries(catTotals).slice(0, 4);
    if (topCats.length > 0) {
      catContainer.innerHTML = topCats.map(([cat, amt]) => `
        <div class="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p class="text-[11px] text-slate-500 font-medium truncate">${escapeHtml(cat)}</p>
          <h4 class="text-sm font-bold text-slate-900 mt-0.5 font-mono">${formatCurrency(amt)}</h4>
        </div>
      `).join('');
    } else {
      catContainer.innerHTML = ``;
    }
  }

  if (state.expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-5 text-center text-slate-400">No expenses recorded.</td></tr>`;
    return;
  }

  const p1 = state.settings.partner1Name;
  const p2 = state.settings.partner2Name;

  tbody.innerHTML = state.expenses.map(e => {
    const payerName = e.paidBy === 'partner1' ? p1 : (e.paidBy === 'partner2' ? p2 : 'Business Account');

    return `
      <tr>
        <td class="text-slate-500 font-mono">${formatDate(e.date)}</td>
        <td>
          <span class="badge-status badge-neutral">
            ${escapeHtml(e.category)}
          </span>
        </td>
        <td class="text-slate-700">${escapeHtml(e.description || '-')}</td>
        <td>
          <span class="text-xs text-slate-600 font-medium">${escapeHtml(payerName)}</span>
        </td>
        <td class="text-right font-bold font-mono text-slate-900">${formatCurrency(e.amount)}</td>
        <td class="text-center space-x-1">
          <button onclick="editExpense('${e.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteExpense('${e.id}')" class="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteExpense(id) {
  if (confirm("Are you sure you want to delete this expense?")) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveState();
    refreshAllUI();
    showToast("Expense deleted successfully!");
  }
}

// ==================== PARTNER TRANSACTIONS ====================
function editPartnerTx(id) {
  const tx = state.partnerTransactions.find(t => t.id === id);
  if (!tx) return;

  if (tx.type === 'capital') {
    document.getElementById("capitalEditId").value = tx.id;
    document.getElementById("capitalDate").value = tx.date;
    document.getElementById("capitalPartner").value = tx.payer;
    document.getElementById("capitalAmount").value = tx.amount;
    document.getElementById("capitalNotes").value = tx.notes || "";
    document.getElementById("capitalModalTitle").textContent = "Edit Capital Investment";
    openModal('capitalModal', 'edit');
  } else if (tx.type === 'drawing') {
    document.getElementById("drawingEditId").value = tx.id;
    document.getElementById("drawingDate").value = tx.date;
    document.getElementById("drawingPartner").value = tx.payer;
    document.getElementById("drawingAmount").value = tx.amount;
    document.getElementById("drawingSource").value = tx.source || "Business Bank Account";
    document.getElementById("drawingNotes").value = tx.notes || "";
    document.getElementById("drawingModalTitle").innerHTML = `<i class="fa-solid fa-money-bill-transfer text-amber-600"></i> Edit Partner Drawing`;
    openModal('drawingModal', 'edit');
  } else {
    document.getElementById("settleEditId").value = tx.id;
    document.getElementById("settleDate").value = tx.date;
    document.getElementById("settlePayer").value = tx.payer;
    document.getElementById("settleReceiver").value = tx.receiver;
    document.getElementById("settleAmount").value = tx.amount;
    document.getElementById("settleNotes").value = tx.notes || "";
    document.getElementById("settleModalTitle").textContent = "Edit Partner Settlement";
    openModal('settleModal', 'edit');
  }
}

function handleSaveDrawing(e) {
  e.preventDefault();
  const editId = document.getElementById("drawingEditId").value;
  const date = document.getElementById("drawingDate").value;
  const partner = document.getElementById("drawingPartner").value;
  const amount = parseFloat(document.getElementById("drawingAmount").value) || 0;
  const source = document.getElementById("drawingSource").value;
  const notes = document.getElementById("drawingNotes").value.trim();

  if (amount <= 0) {
    showToast("Amount must be greater than 0!", true);
    return;
  }

  const pName = partner === 'partner1' ? state.settings.partner1Name : state.settings.partner2Name;

  if (editId) {
    const existing = state.partnerTransactions.find(t => t.id === editId);
    if (existing) {
      existing.date = date;
      existing.payer = partner;
      existing.amount = amount;
      existing.source = source;
      existing.notes = notes;
      showToast("Partner drawing updated!");
    }
  } else {
    state.partnerTransactions.push({
      id: "tx_" + Date.now(),
      date,
      type: 'drawing',
      payer: partner,
      receiver: 'personal',
      source,
      amount,
      notes
    });
    showToast(`Recorded ₹${amount} personal drawing for ${pName}!`);
  }

  saveState();
  closeModal('drawingModal');
  refreshAllUI();
}

function handleSaveSettlement(e) {
  e.preventDefault();
  const editId = document.getElementById("settleEditId").value;
  const date = document.getElementById("settleDate").value;
  const payer = document.getElementById("settlePayer").value;
  const receiver = document.getElementById("settleReceiver").value;
  const amount = parseFloat(document.getElementById("settleAmount").value) || 0;
  const notes = document.getElementById("settleNotes").value.trim();

  if (payer === receiver) {
    showToast("Payer and Receiver must be different partners!", true);
    return;
  }

  if (amount <= 0) {
    showToast("Amount must be greater than 0!", true);
    return;
  }

  if (editId) {
    const existing = state.partnerTransactions.find(t => t.id === editId);
    if (existing) {
      existing.date = date;
      existing.payer = payer;
      existing.receiver = receiver;
      existing.amount = amount;
      existing.notes = notes;
      showToast("Settlement updated successfully!");
    }
  } else {
    state.partnerTransactions.push({
      id: "tx_" + Date.now(),
      date,
      type: 'settlement',
      payer,
      receiver,
      amount,
      notes
    });
    showToast("Partner settlement recorded!");
  }

  saveState();
  closeModal('settleModal');
  refreshAllUI();
}

function handleSaveCapital(e) {
  e.preventDefault();
  const editId = document.getElementById("capitalEditId").value;
  const date = document.getElementById("capitalDate").value;
  const payer = document.getElementById("capitalPartner").value;
  const amount = parseFloat(document.getElementById("capitalAmount").value) || 0;
  const notes = document.getElementById("capitalNotes").value.trim();

  if (amount <= 0) {
    showToast("Amount must be greater than 0!", true);
    return;
  }

  if (editId) {
    const existing = state.partnerTransactions.find(t => t.id === editId);
    if (existing) {
      existing.date = date;
      existing.payer = payer;
      existing.amount = amount;
      existing.notes = notes;
      showToast("Capital investment updated!");
    }
  } else {
    state.partnerTransactions.push({
      id: "tx_" + Date.now(),
      date,
      type: 'capital',
      payer,
      receiver: 'business',
      amount,
      notes
    });
    showToast("Capital investment recorded!");
  }

  saveState();
  closeModal('capitalModal');
  refreshAllUI();
}

function handleSaveSettings(e) {
  if (e && e.preventDefault) e.preventDefault();

  const elBiz = document.getElementById("settingBizName");
  const elP1 = document.getElementById("settingP1Name");
  const elP2 = document.getElementById("settingP2Name");
  const elR1 = document.getElementById("settingP1Ratio");
  const elR2 = document.getElementById("settingP2Ratio");
  const elFb = document.getElementById("settingFirebaseConfig");

  state.settings.bizName = (elBiz && elBiz.value.trim()) || state.settings.bizName || "Dwarkadhish Enterprise";
  state.settings.partner1Name = (elP1 && elP1.value.trim()) || state.settings.partner1Name || "Kenil (You)";
  state.settings.partner2Name = (elP2 && elP2.value.trim()) || state.settings.partner2Name || "Alpesh";
  state.settings.partner1Ratio = elR1 ? (parseInt(elR1.value) || 50) : 50;
  state.settings.partner2Ratio = elR2 ? (parseInt(elR2.value) || 50) : 50;

  const fbConfig = elFb ? elFb.value.trim() : "";
  state.settings.firebaseConfig = fbConfig;
  if (fbConfig) {
    localStorage.setItem("FIREBASE_CONFIG_KEY", fbConfig);
  } else {
    localStorage.removeItem("FIREBASE_CONFIG_KEY");
  }

  saveState();
  initFirebaseSync();
  closeModal('settingsModal');
  updatePartnerLabelsInUI();
  refreshAllUI();
  showToast("Settings & Cloud Sync updated successfully!");
}

// ==================== EXCEL EXPORT ====================
function exportAllToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast("Excel library loading, please try again...", true);
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. Online Bank Payouts Sheet
  const payoutsData = (state.onlinePayouts || []).map(op => ({
    "Date": op.date,
    "Platform": op.platform,
    "Seller Account": getSellerAccountName(op.accountId),
    "Bank Payout (₹)": op.bankAmount,
    "Dispatched Units": op.unitsDispatched || 0,
    "Approx Item Cost (₹)": op.approxCost || 0,
    "Net Margin (₹)": (Number(op.bankAmount) || 0) - (Number(op.approxCost) || 0),
    "Bank UTR / Notes": op.notes || ''
  }));
  const wsPayouts = XLSX.utils.json_to_sheet(payoutsData);
  XLSX.utils.book_append_sheet(wb, wsPayouts, "Online Bank Payouts");

  // 2. Stock Sheet
  const stockData = state.products.map(p => ({
    "SKU": p.sku,
    "Product Name": p.name,
    "Category": p.category,
    "Current Stock": p.currentStock,
    "Cost Price (₹)": p.costPrice,
    "Retail Price (₹)": p.retailPrice,
    "Wholesale Price (₹)": p.wholesalePrice,
    "Stock Valuation (₹)": (p.currentStock * p.costPrice)
  }));
  const wsStock = XLSX.utils.json_to_sheet(stockData);
  XLSX.utils.book_append_sheet(wb, wsStock, "Inventory Stock");

  // 2.1 Online Daily Dispatches Sheet
  const dispExportData = [];
  (state.onlineDispatches || []).forEach(d => {
    (d.items || []).forEach(it => {
      dispExportData.push({
        "Date": d.date,
        "Platform": d.platform,
        "Seller Account": d.accountName || d.platform,
        "Product Name": it.productName,
        "SKU": it.sku || '',
        "Qty Dispatched (pcs)": it.qty,
        "Batch Total Units": d.totalUnits,
        "Courier / Notes": d.notes || ''
      });
    });
  });
  const wsDispatches = XLSX.utils.json_to_sheet(dispExportData);
  XLSX.utils.book_append_sheet(wb, wsDispatches, "Online Dispatches");

  // 3. Wholesale Sales Sheet
  const salesData = [];
  const p1Name = state.settings.partner1Name || "Kenil";
  const p2Name = state.settings.partner2Name || "Alpesh";

  state.sales.forEach(s => {
    const total = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
    const pending = Math.max(0, total - paid);
    let recvName = "Business Account";
    if (s.receivedBy === 'partner1') recvName = `${p1Name}'s Account`;
    else if (s.receivedBy === 'partner2') recvName = `${p2Name}'s Account`;

    (s.items || []).forEach(it => {
      salesData.push({
        "Bill #": s.invoiceNo,
        "Date": s.date,
        "Customer / Party": s.customerName,
        "City": s.customerCity || '',
        "Phone": s.customerPhone || '',
        "Product": it.productName,
        "Qty": it.qty,
        "Cost Price (₹)": it.costPrice || 0,
        "Selling Rate (₹)": it.price,
        "Gross Item Total (₹)": it.grossTotal || (it.qty * it.price),
        "Item Disc (%)": it.discountPercent || 0,
        "Item Disc (₹)": it.discountAmount || 0,
        "Net Item Total (₹)": it.total,
        "Bill Gross Total (₹)": s.subtotal || total,
        "Total Bill Disc (₹)": s.discountAmount || 0,
        "Net Bill Total (₹)": total,
        "Paid Amount (₹)": paid,
        "Pending Due (₹)": pending,
        "Payment Received In": recvName,
        "Gross Profit (₹)": it.total - ((Number(it.costPrice) || 0) * Number(it.qty)),
        "Payment Status": s.paymentStatus,
        "Remarks": s.notes || ''
      });
    });
  });
  const wsSales = XLSX.utils.json_to_sheet(salesData);
  XLSX.utils.book_append_sheet(wb, wsSales, "Wholesale Bills");

  // 4. Purchases Sheet
  const purchData = [];
  state.purchases.forEach(p => {
    const total = Number(p.totalAmount) || 0;
    const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Pending' ? 0 : total);
    const pending = Math.max(0, total - paid);
    const payer = p.paidBy === 'partner1' ? state.settings.partner1Name : (p.paidBy === 'partner2' ? state.settings.partner2Name : 'Business Account');

    (p.items || []).forEach(it => {
      purchData.push({
        "Bill #": p.billNo,
        "Date": p.date,
        "Supplier": p.vendor,
        "Paid By": payer,
        "Product": it.productName,
        "Qty": it.qty,
        "Cost Price (₹)": it.costPrice,
        "Gross Item Total (₹)": it.grossTotal || (it.qty * it.costPrice),
        "Item Disc (%)": it.discountPercent || 0,
        "Item Disc (₹)": it.discountAmount || 0,
        "Net Item Total (₹)": it.total,
        "Bill Gross Total (₹)": p.subtotal || total,
        "Total Bill Disc (₹)": p.discountAmount || 0,
        "Net Bill Total (₹)": total,
        "Amount Paid (₹)": paid,
        "Pending Due (₹)": pending,
        "Payment Status": p.paymentStatus,
        "Remarks": p.notes || ''
      });
    });
  });
  const wsPurch = XLSX.utils.json_to_sheet(purchData);
  XLSX.utils.book_append_sheet(wb, wsPurch, "Purchases");

  // 5. Expenses Sheet
  const expData = state.expenses.map(e => ({
    "Date": e.date,
    "Category": e.category,
    "Amount (₹)": e.amount,
    "Paid By": e.paidBy === 'partner1' ? state.settings.partner1Name : (e.paidBy === 'partner2' ? state.settings.partner2Name : 'Business Account'),
    "Description": e.description || ''
  }));
  const wsExp = XLSX.utils.json_to_sheet(expData);
  XLSX.utils.book_append_sheet(wb, wsExp, "Daily Expenses");

  // 6. Partner Ledger Sheet
  const partnerData = state.partnerTransactions.map(t => {
    let typeLabel = "Settlement";
    let receiver = t.receiver === 'partner1' ? state.settings.partner1Name : (t.receiver === 'partner2' ? state.settings.partner2Name : 'Business Account');

    if (t.type === 'capital') {
      typeLabel = "Capital Invested";
    } else if (t.type === 'drawing') {
      typeLabel = "Personal Drawing";
      receiver = "Self (Personal Use)";
    }

    return {
      "Date": t.date,
      "Transaction Type": typeLabel,
      "Partner / Payer": t.payer === 'partner1' ? state.settings.partner1Name : state.settings.partner2Name,
      "Received By": receiver,
      "Source / Account": t.source || '',
      "Amount (₹)": t.amount,
      "Remarks": t.notes || ''
    };
  });
  const wsPartner = XLSX.utils.json_to_sheet(partnerData);
  XLSX.utils.book_append_sheet(wb, wsPartner, "Partner Ledger");

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Dwarkadhish_Master_Business_Report_${dateStr}.xlsx`);
  showToast("Master Excel report downloaded!");
}

function exportPayoutsToExcel() {
  const data = (state.onlinePayouts || []).map(op => ({
    "Date": op.date,
    "Platform": op.platform,
    "Account ID / Name": getSellerAccountName(op.accountId),
    "Bank Payout (₹)": op.bankAmount,
    "Dispatched Orders": op.unitsDispatched || 0,
    "Approx Item Cost (₹)": op.approxCost || 0,
    "Net Margin (₹)": (Number(op.bankAmount) || 0) - (Number(op.approxCost) || 0),
    "Bank UTR / Notes": op.notes || ''
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Online Bank Payouts");
  XLSX.writeFile(wb, `Online_Bank_Payouts_${Date.now()}.xlsx`);
  showToast("Online payouts Excel downloaded!");
}

function exportStockToExcel() {
  rebuildProductBatchesFromHistory();
  const stockData = state.products.map(p => {
    const activeBatches = (p.purchaseBatches || []).filter(b => b.remainingQty > 0);
    const batchBreakdown = activeBatches.map(b => `${b.remainingQty} pcs @ ₹${b.netCostPrice} (${b.billNo})`).join('; ') || 'No batches';
    const totalValuation = activeBatches.reduce((acc, b) => acc + (b.remainingQty * b.netCostPrice), 0);

    return {
      "SKU": p.sku,
      "Product Name": p.name,
      "Category": p.category,
      "Current Stock": p.currentStock,
      "Net Landed Cost (₹)": p.costPrice,
      "Weighted Avg Cost (₹)": p.weightedAvgCost || p.costPrice,
      "Retail Price (₹)": p.retailPrice,
      "Wholesale Price (₹)": p.wholesalePrice,
      "Stock Valuation (₹)": totalValuation || (p.currentStock * p.costPrice),
      "Batch Breakdown": batchBreakdown
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(stockData);
  XLSX.utils.book_append_sheet(wb, ws, "Stock");
  XLSX.writeFile(wb, `Stock_Report_${Date.now()}.xlsx`);
  showToast("Stock report downloaded!");
}

function exportDispatchesToExcel() {
  const dispExportData = [];
  (state.onlineDispatches || []).forEach(d => {
    (d.items || []).forEach(it => {
      dispExportData.push({
        "Date": d.date,
        "Platform": d.platform,
        "Seller Account": d.accountName || d.platform,
        "Product Name": it.productName,
        "SKU": it.sku || '',
        "Qty Dispatched (pcs)": it.qty,
        "Batch Total Units": d.totalUnits,
        "Courier / Notes": d.notes || ''
      });
    });
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(dispExportData);
  XLSX.utils.book_append_sheet(wb, ws, "Online Dispatches");
  XLSX.writeFile(wb, `Online_Dispatches_Report_${Date.now()}.xlsx`);
  showToast("Online dispatches Excel downloaded!");
}

function exportSalesToExcel() {
  const p1Name = state.settings.partner1Name || "Kenil";
  const p2Name = state.settings.partner2Name || "Alpesh";

  const salesData = state.sales.map(s => {
    const total = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
    let recvName = "Business Account";
    if (s.receivedBy === 'partner1') recvName = `${p1Name}'s Account`;
    else if (s.receivedBy === 'partner2') recvName = `${p2Name}'s Account`;

    return {
      "Bill No": s.invoiceNo,
      "Date": s.date,
      "Party / Customer": s.customerName,
      "Phone": s.customerPhone || '',
      "City": s.customerCity || '',
      "GSTIN": s.customerGst || '',
      "Address": s.customerAddress || '',
      "Gross Total": s.subtotal || total,
      "Item Discounts": s.discountAmount || 0,
      "Bill Amount": total,
      "Paid Amount": paid,
      "Pending Balance": Math.max(0, total - paid),
      "Payment Received In": recvName,
      "Payment Status": s.paymentStatus
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(salesData);
  XLSX.utils.book_append_sheet(wb, ws, "Wholesale Bills");
  XLSX.writeFile(wb, `Wholesale_Bills_Report_${Date.now()}.xlsx`);
  showToast("Wholesale bills report downloaded!");
}

function exportPurchasesToExcel() {
  const p1Name = state.settings.partner1Name || "Kenil";
  const p2Name = state.settings.partner2Name || "Alpesh";

  const purchData = state.purchases.map(p => {
    const total = Number(p.totalAmount) || 0;
    const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Paid' ? total : 0);
    let paidByName = "Business Account";
    if (p.paidBy === 'partner1') paidByName = `${p1Name}'s Pocket`;
    else if (p.paidBy === 'partner2') paidByName = `${p2Name}'s Pocket`;

    return {
      "Bill No": p.billNo,
      "Date": p.date,
      "Supplier / Vendor": p.vendor,
      "Phone": p.supplierPhone || '',
      "City": p.supplierCity || '',
      "GSTIN": p.supplierGst || '',
      "Bill Amount": total,
      "Paid Amount": paid,
      "Pending Balance": Math.max(0, total - paid),
      "Paid By": paidByName,
      "Payment Status": p.paymentStatus
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(purchData);
  XLSX.utils.book_append_sheet(wb, ws, "Purchase Bills");
  XLSX.writeFile(wb, `Purchases_Report_${Date.now()}.xlsx`);
  showToast("Purchases report downloaded!");
}

function exportExpensesToExcel() {
  const p1Name = state.settings.partner1Name || "Kenil";
  const p2Name = state.settings.partner2Name || "Alpesh";

  const expData = state.expenses.map(e => {
    let paidByName = "Business Account";
    if (e.paidBy === 'partner1') paidByName = `${p1Name}'s Pocket`;
    else if (e.paidBy === 'partner2') paidByName = `${p2Name}'s Pocket`;

    return {
      "Date": e.date,
      "Category": e.category,
      "Amount": e.amount,
      "Paid By": paidByName,
      "Remarks": e.notes || ''
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(expData);
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");
  XLSX.writeFile(wb, `Expenses_Report_${Date.now()}.xlsx`);
  showToast("Expenses report downloaded!");
}

// ==================== BACKUP & RESTORE ====================
function backupSystemData() {
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CommerceHub_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Database backup downloaded!");
}

function restoreSystemData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const restored = JSON.parse(evt.target.result);
      if (restored && (restored.products || restored.sales || restored.onlinePayouts)) {
        state = restored;
        saveState();
        updatePartnerLabelsInUI();
        refreshAllUI();
        showToast("Database restored successfully!");
      } else {
        showToast("Invalid backup file structure!", true);
      }
    } catch (err) {
      showToast("Error reading JSON file!", true);
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (confirm("Warning: Are you sure you want to reset all data? This cannot be undone!")) {
    state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));
    saveState();
    updatePartnerLabelsInUI();
    refreshAllUI();
    showToast("All data reset to defaults!");
  }
}

// ==================== KHATA / BALANCES & MULTI-BILL SETTLEMENT ENGINE ====================

let activeKhataSubTab = 'parties'; // 'parties', 'suppliers', 'recv_log', or 'pay_log'

function switchKhataSubTab(subTab) {
  activeKhataSubTab = subTab;
  const btnParties = document.getElementById("khata-subtab-parties");
  const btnSuppliers = document.getElementById("khata-subtab-suppliers");
  const btnRecvLog = document.getElementById("khata-subtab-recv_log");
  const btnPayLog = document.getElementById("khata-subtab-pay_log");

  const secParties = document.getElementById("khataPartiesSection");
  const secSuppliers = document.getElementById("khataSuppliersSection");
  const secRecvLog = document.getElementById("khataRecvLogSection");
  const secPayLog = document.getElementById("khataPayLogSection");

  const activeBtnClass = "py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-sm bg-white text-slate-900 border border-slate-200 whitespace-nowrap";
  const inactiveBtnClass = "py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-bold transition-all text-slate-600 hover:text-slate-900 whitespace-nowrap";

  if (btnParties) btnParties.className = (subTab === 'parties') ? activeBtnClass : inactiveBtnClass;
  if (btnSuppliers) btnSuppliers.className = (subTab === 'suppliers') ? activeBtnClass : inactiveBtnClass;
  if (btnRecvLog) btnRecvLog.className = (subTab === 'recv_log') ? activeBtnClass : inactiveBtnClass;
  if (btnPayLog) btnPayLog.className = (subTab === 'pay_log') ? activeBtnClass : inactiveBtnClass;

  if (secParties) secParties.classList.toggle("hidden", subTab !== 'parties');
  if (secSuppliers) secSuppliers.classList.toggle("hidden", subTab !== 'suppliers');
  if (secRecvLog) secRecvLog.classList.toggle("hidden", subTab !== 'recv_log');
  if (secPayLog) secPayLog.classList.toggle("hidden", subTab !== 'pay_log');

  renderKhataTables();
}

function renderKhataTables() {
  const search = (document.getElementById("khataSearchInput")?.value || "").toLowerCase().trim();
  const filterDue = document.getElementById("khataFilterDue")?.value || "due_only";

  // 1. Group & Compute Wholesale Parties Khata
  const partiesMap = new Map();

  // Populate from directory first
  (getWholesaleParties() || []).forEach(p => {
    const key = (p.name || '').trim().toLowerCase();
    if (key) {
      partiesMap.set(key, {
        name: p.name.trim(),
        phone: p.phone || '',
        city: p.city || '',
        gst: p.gstNo || '',
        invoices: [],
        totalBilled: 0,
        totalPaid: 0,
        totalDue: 0
      });
    }
  });

  // Aggregate from sales
  (state.sales || []).forEach(s => {
    const name = (s.customerName || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!partiesMap.has(key)) {
      partiesMap.set(key, {
        name: name,
        phone: s.customerPhone || '',
        city: s.customerCity || '',
        gst: s.customerGst || '',
        invoices: [],
        totalBilled: 0,
        totalPaid: 0,
        totalDue: 0
      });
    }
    const party = partiesMap.get(key);
    const total = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
    const due = Math.max(0, total - paid);

    party.invoices.push(s);
    party.totalBilled += total;
    party.totalPaid += paid;
    party.totalDue += due;
  });

  const partiesList = Array.from(partiesMap.values());
  let totalReceivables = 0;
  let partiesWithDueCount = 0;

  partiesList.forEach(p => {
    totalReceivables += p.totalDue;
    if (p.totalDue > 0) partiesWithDueCount++;
  });

  // 2. Group & Compute Suppliers Khata
  const suppliersMap = new Map();

  (getSuppliers() || []).forEach(s => {
    const key = (s.name || '').trim().toLowerCase();
    if (key) {
      suppliersMap.set(key, {
        name: s.name.trim(),
        phone: s.phone || '',
        city: s.city || '',
        gst: s.gstNo || '',
        purchases: [],
        totalPurchased: 0,
        totalPaid: 0,
        totalReturns: 0,
        totalPayable: 0
      });
    }
  });

  (state.purchases || []).forEach(p => {
    const name = (p.vendor || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!suppliersMap.has(key)) {
      suppliersMap.set(key, {
        name: name,
        phone: p.supplierPhone || '',
        city: p.supplierCity || '',
        gst: p.supplierGst || '',
        purchases: [],
        totalPurchased: 0,
        totalPaid: 0,
        totalReturns: 0,
        totalPayable: 0
      });
    }
    const sup = suppliersMap.get(key);
    const total = Number(p.totalAmount) || 0;
    const debAdj = Number(p.debitNoteAdjusted) || 0;
    const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Paid' ? total : 0);
    const directCashPaid = Math.max(0, paid - debAdj);

    sup.purchases.push(p);
    sup.totalPurchased += total;
    sup.totalPaid += directCashPaid;
  });

  // Factor in supplier returns/debit notes that reduce supplier payable
  (state.supplierReturns || []).forEach(sr => {
    const name = (sr.vendor || sr.supplierName || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (suppliersMap.has(key)) {
      const sup = suppliersMap.get(key);
      const retVal = Math.abs(Number(sr.netBalance) || Number(sr.totalReturnedVal) || Number(sr.netReturnVal) || 0);
      const isDebitNote = sr.settlementMode === 'ledger_credit' || sr.settlementType === 'Debit Note (Deduct from Future Bill)' || (!sr.settlementMode && !sr.settlementType);
      if (isDebitNote && retVal > 0) {
        sup.totalReturns += retVal;
      }
    }
  });

  // Calculate final net payable for each supplier
  suppliersMap.forEach(sup => {
    sup.totalPayable = Math.max(0, Math.round((sup.totalPurchased - sup.totalPaid - sup.totalReturns) * 100) / 100);
  });

  const suppliersList = Array.from(suppliersMap.values());
  let totalPayables = 0;
  let suppliersWithDueCount = 0;

  suppliersList.forEach(s => {
    totalPayables += s.totalPayable;
    if (s.totalPayable > 0) suppliersWithDueCount++;
  });

  // Top Metrics UI Update
  const recEl = document.getElementById("khataTotalReceivables");
  const payEl = document.getElementById("khataTotalPayables");
  const netEl = document.getElementById("khataNetPosition");
  const recCountEl = document.getElementById("khataPartiesDueCount");
  const payCountEl = document.getElementById("khataSuppliersDueCount");
  const netLabel = document.getElementById("khataNetLabel");

  if (recEl) recEl.textContent = formatCurrency(totalReceivables);
  if (payEl) payEl.textContent = formatCurrency(totalPayables);
  if (recCountEl) recCountEl.textContent = `${partiesWithDueCount} Parties Due`;
  if (payCountEl) payCountEl.textContent = `${suppliersWithDueCount} Suppliers Pending`;

  const netDiff = totalReceivables - totalPayables;
  if (netEl) {
    netEl.textContent = (netDiff >= 0 ? "+" : "-") + formatCurrency(Math.abs(netDiff));
    if (netDiff >= 0) {
      netEl.className = "text-2xl sm:text-3xl font-extrabold text-emerald-800 font-mono tracking-tight";
      if (netLabel) netLabel.textContent = "Net Receivable (ચોખ્ખા લેવાના)";
    } else {
      netEl.className = "text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono tracking-tight";
      if (netLabel) netLabel.textContent = "Net Payable (ચોખ્ખા દેવાના)";
    }
  }

  // Render Parties Table
  const partiesTbody = document.getElementById("khataPartiesTableBody");
  if (partiesTbody) {
    let filteredParties = partiesList.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search) || p.city.toLowerCase().includes(search) || p.phone.includes(search);
      const matchDue = filterDue === 'all' || p.totalDue > 0;
      return matchSearch && matchDue;
    });

    filteredParties.sort((a, b) => b.totalDue - a.totalDue);

    if (filteredParties.length === 0) {
      partiesTbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">No parties found matching criteria.</td></tr>`;
    } else {
      partiesTbody.innerHTML = filteredParties.map(p => {
        const safeName = escapeHtml(p.name);
        const encodedName = encodeURIComponent(p.name || '');
        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td>
              <div class="font-bold text-slate-900">${safeName}</div>
              ${p.gst ? `<span class="text-[10px] text-slate-400 font-mono">GST: ${escapeHtml(p.gst)}</span>` : ''}
            </td>
            <td class="text-slate-600 text-xs">${escapeHtml(p.city || '-')}</td>
            <td class="text-slate-600 font-mono text-xs">${escapeHtml(p.phone || '-')}</td>
            <td class="text-center font-mono font-bold text-slate-700 text-xs">${p.invoices.length}</td>
            <td class="text-right font-mono font-bold text-slate-800 text-xs">${formatCurrency(p.totalBilled)}</td>
            <td class="text-right font-mono font-bold text-emerald-700 text-xs">${formatCurrency(p.totalPaid)}</td>
            <td class="text-right font-mono font-extrabold text-sm ${p.totalDue > 0 ? 'text-rose-600 bg-rose-50/50' : 'text-slate-400'}">
              ${p.totalDue > 0 ? formatCurrency(p.totalDue) : '₹0 (Clear)'}
            </td>
            <td class="text-center space-x-1.5 whitespace-nowrap">
              ${p.totalDue > 0 ? `
                <button type="button" onclick="openPartyLumpSumCollectModal('${encodedName}')" class="btn-solid-primary text-[11px] py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer">
                  <i class="fa-solid fa-hand-holding-dollar mr-1"></i> Collect
                </button>
              ` : `
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <i class="fa-solid fa-check mr-1"></i> All Paid
                </span>
                <button type="button" onclick="openPartyLumpSumCollectModal('${encodedName}')" class="btn-solid-primary text-[11px] py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer" title="Collect Payment">
                  <i class="fa-solid fa-plus mr-0.5"></i> Collect
                </button>
              `}
              <button type="button" onclick="viewCustomerStatement('${encodedName}')" class="btn-outline text-[11px] py-1 px-2 text-indigo-700 hover:bg-indigo-50 border-indigo-200 shadow-xs cursor-pointer" title="View Statement">
                <i class="fa-solid fa-file-invoice mr-0.5"></i> Statement
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // Render Suppliers Table
  const suppliersTbody = document.getElementById("khataSuppliersTableBody");
  if (suppliersTbody) {
    let filteredSuppliers = suppliersList.filter(s => {
      const matchSearch = !search || s.name.toLowerCase().includes(search) || s.city.toLowerCase().includes(search) || s.phone.includes(search);
      const matchDue = filterDue === 'all' || s.totalPayable > 0;
      return matchSearch && matchDue;
    });

    filteredSuppliers.sort((a, b) => b.totalPayable - a.totalPayable);

    if (filteredSuppliers.length === 0) {
      suppliersTbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-400">No suppliers found matching criteria.</td></tr>`;
    } else {
      suppliersTbody.innerHTML = filteredSuppliers.map(s => {
        const safeName = escapeHtml(s.name);
        const encodedSupName = encodeURIComponent(s.name || '');
        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td>
              <div class="font-bold text-slate-900">${safeName}</div>
              ${s.gst ? `<span class="text-[10px] text-slate-400 font-mono">GST: ${escapeHtml(s.gst)}</span>` : ''}
            </td>
            <td class="text-slate-600 text-xs">${escapeHtml(s.city || '-')}</td>
            <td class="text-slate-600 font-mono text-xs">${escapeHtml(s.phone || '-')}</td>
            <td class="text-center font-mono font-bold text-slate-700 text-xs">${s.purchases.length}</td>
            <td class="text-right font-mono font-bold text-slate-800 text-xs">${formatCurrency(s.totalPurchased)}</td>
            <td class="text-right font-mono font-bold text-emerald-700 text-xs">${formatCurrency(s.totalPaid)}</td>
            <td class="text-right font-mono font-bold text-indigo-700 text-xs">${s.totalReturns > 0 ? '-' + formatCurrency(s.totalReturns) : '₹0'}</td>
            <td class="text-right font-mono font-extrabold text-sm ${s.totalPayable > 0 ? 'text-rose-700 bg-rose-50/50' : 'text-slate-400'}">
              ${s.totalPayable > 0 ? formatCurrency(s.totalPayable) : '₹0 (Clear)'}
            </td>
            <td class="text-center space-x-1.5 whitespace-nowrap">
              ${s.totalPayable > 0 ? `
                <button type="button" onclick="openSupplierLumpSumPayModal('${encodedSupName}')" class="btn-solid-primary text-[11px] py-1 px-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer">
                  <i class="fa-solid fa-money-bill-wave mr-1"></i> Pay
                </button>
              ` : `
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <i class="fa-solid fa-check mr-1"></i> Settled
                </span>
                <button type="button" onclick="openSupplierLumpSumPayModal('${encodedSupName}')" class="btn-solid-primary text-[11px] py-1 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs cursor-pointer" title="Pay Supplier / Advance">
                  <i class="fa-solid fa-plus mr-0.5"></i> Pay
                </button>
              `}
              <button type="button" onclick="viewSupplierStatement('${encodedSupName}')" class="btn-outline text-[11px] py-1 px-2 text-indigo-700 hover:bg-indigo-50 border-indigo-200 shadow-xs cursor-pointer" title="View Statement">
                <i class="fa-solid fa-file-invoice mr-0.5"></i> Statement
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 3. Render Wholesale Payments Received Log (ગ્રાહક પાસેથી આવેલ પેમેન્ટ હિસ્ટ્રી)
  const recvTableBody = document.getElementById("khataRecvLogTableBody");
  if (recvTableBody) {
    const p1 = state.settings.partner1Name || "Kenil";
    const p2 = state.settings.partner2Name || "Alpesh";

    const recvEvents = [];
    (state.sales || []).forEach(s => {
      const custName = (s.customerName || s.partyName || 'Wholesale Customer').trim();
      const invNo = s.invoiceNo || s.billNo || 'Invoice';

      if (Array.isArray(s.paymentHistory) && s.paymentHistory.length > 0) {
        s.paymentHistory.forEach(ph => {
          const amt = Number(ph.amount) || 0;
          if (amt > 0) {
            recvEvents.push({
              date: ph.date || s.date,
              partyName: custName,
              billNo: invNo,
              amount: amt,
              receivedBy: ph.receivedBy || s.receivedBy || 'partner1',
              method: ph.method || s.paymentMode || 'UPI / Cash',
              notes: ph.notes || s.notes || '',
              saleId: s.id
            });
          }
        });
      } else {
        const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? Number(s.totalAmount) : 0);
        if (paid > 0) {
          recvEvents.push({
            date: s.date,
            partyName: custName,
            billNo: invNo,
            amount: paid,
            receivedBy: s.receivedBy || 'partner1',
            method: s.paymentMode || 'UPI / Cash',
            notes: s.notes || 'Full payment at billing',
            saleId: s.id
          });
        }
      }
    });

    recvEvents.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let filteredRecv = recvEvents;
    if (search) {
      filteredRecv = recvEvents.filter(ev =>
        (ev.partyName || '').toLowerCase().includes(search) ||
        (ev.billNo || '').toLowerCase().includes(search) ||
        (ev.method || '').toLowerCase().includes(search) ||
        (ev.notes || '').toLowerCase().includes(search) ||
        (ev.date || '').includes(search)
      );
    }

    const totalRecvAmt = filteredRecv.reduce((sum, x) => sum + x.amount, 0);
    const badgeRecv = document.getElementById("khataRecvLogSummaryBadge");
    if (badgeRecv) {
      badgeRecv.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-bold font-mono">Total Collected: ${formatCurrency(totalRecvAmt)} (${filteredRecv.length} Entries)</span>`;
    }

    if (filteredRecv.length === 0) {
      recvTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400">No wholesale payment collection records found.</td></tr>`;
    } else {
      recvTableBody.innerHTML = filteredRecv.map(ev => {
        const receiverLabel = ev.receivedBy === 'partner1' ? p1 : (ev.receivedBy === 'partner2' ? p2 : 'Business Account');
        return `
          <tr class="hover:bg-slate-50">
            <td><span class="font-mono font-bold text-slate-900">${formatDate(ev.date)}</span></td>
            <td class="font-bold text-slate-900">${escapeHtml(ev.partyName)}</td>
            <td><span class="font-mono text-indigo-700 font-bold text-xs">${escapeHtml(ev.billNo)}</span></td>
            <td><span class="badge-status badge-neutral font-medium text-[11px]">${escapeHtml(ev.method)}</span></td>
            <td><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200"><i class="fa-solid fa-wallet text-[10px]"></i> ${escapeHtml(receiverLabel)}</span></td>
            <td class="text-right font-mono font-extrabold text-emerald-700 text-sm">${formatCurrency(ev.amount)}</td>
            <td class="text-slate-600 text-xs max-w-xs truncate" title="${escapeHtml(ev.notes || '-')}">${escapeHtml(ev.notes || '-')}</td>
            <td class="text-center">
              <button type="button" onclick="viewInvoiceReceipt('${ev.saleId}')" class="btn-outline text-[11px] py-1 px-2 text-indigo-700 hover:bg-indigo-50 border-indigo-200 shadow-xs cursor-pointer" title="View Invoice">
                <i class="fa-solid fa-file-invoice mr-0.5"></i> Bill
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 4. Render Supplier Payments Made Log (સપ્લાયરને કરેલ ચૂકવણી હિસ્ટ્રી)
  const payTableBody = document.getElementById("khataPayLogTableBody");
  if (payTableBody) {
    const p1 = state.settings.partner1Name || "Kenil";
    const p2 = state.settings.partner2Name || "Alpesh";

    const payEvents = [];
    (state.purchases || []).forEach(p => {
      const suppName = (p.vendor || 'Supplier').trim();
      const billNo = p.billNo || 'Bill';

      if (Array.isArray(p.paymentHistory) && p.paymentHistory.length > 0) {
        p.paymentHistory.forEach(ph => {
          const cashAmt = Number(ph.amount) || 0;
          const debAmt = Number(ph.debitAdjusted) || 0;
          const totSettled = cashAmt + debAmt;
          if (totSettled > 0) {
            payEvents.push({
              date: ph.date || p.date,
              supplierName: suppName,
              billNo: billNo,
              amount: cashAmt,
              debitAdjusted: debAmt,
              totalSettled: totSettled,
              paidBy: ph.paidBy || p.paidBy || 'partner1',
              method: ph.method || 'UPI / Cash',
              notes: ph.notes || p.notes || '',
              purchId: p.id
            });
          }
        });
      } else {
        const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Paid' ? Number(p.totalAmount) : 0);
        if (paid > 0) {
          payEvents.push({
            date: p.date,
            supplierName: suppName,
            billNo: billNo,
            amount: paid,
            debitAdjusted: 0,
            totalSettled: paid,
            paidBy: p.paidBy || 'partner1',
            method: 'Cash / Bank',
            notes: p.notes || 'Paid on purchase date',
            purchId: p.id
          });
        }
      }
    });

    payEvents.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let filteredPay = payEvents;
    if (search) {
      filteredPay = payEvents.filter(ev =>
        (ev.supplierName || '').toLowerCase().includes(search) ||
        (ev.billNo || '').toLowerCase().includes(search) ||
        (ev.method || '').toLowerCase().includes(search) ||
        (ev.notes || '').toLowerCase().includes(search) ||
        (ev.date || '').includes(search)
      );
    }

    const totalCashPaid = filteredPay.reduce((sum, x) => sum + x.amount, 0);
    const totalDebitAdj = filteredPay.reduce((sum, x) => sum + x.debitAdjusted, 0);
    const totalOverallSettled = filteredPay.reduce((sum, x) => sum + x.totalSettled, 0);

    const badgePay = document.getElementById("khataPayLogSummaryBadge");
    if (badgePay) {
      badgePay.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-900 rounded-lg text-xs font-bold font-mono">Paid Cash/Bank: ${formatCurrency(totalCashPaid)} | Returns: ${formatCurrency(totalDebitAdj)} | Total Settled: ${formatCurrency(totalOverallSettled)} (${filteredPay.length} Entries)</span>`;
    }

    if (filteredPay.length === 0) {
      payTableBody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-400">No supplier payment records found.</td></tr>`;
    } else {
      payTableBody.innerHTML = filteredPay.map(ev => {
        const payerLabel = ev.paidBy === 'partner1' ? p1 : (ev.paidBy === 'partner2' ? p2 : 'Business Account');
        const encodedSup = encodeURIComponent(ev.supplierName);
        return `
          <tr class="hover:bg-slate-50">
            <td><span class="font-mono font-bold text-slate-900">${formatDate(ev.date)}</span></td>
            <td class="font-bold text-slate-900">${escapeHtml(ev.supplierName)}</td>
            <td><span class="font-mono text-rose-700 font-bold text-xs">${escapeHtml(ev.billNo)}</span></td>
            <td><span class="badge-status badge-neutral font-medium text-[11px]">${escapeHtml(ev.method)}</span></td>
            <td><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"><i class="fa-solid fa-wallet text-[10px]"></i> ${escapeHtml(payerLabel)}</span></td>
            <td class="text-right font-mono font-bold text-rose-700 text-xs">${formatCurrency(ev.amount)}</td>
            <td class="text-right font-mono font-bold text-emerald-700 text-xs">${ev.debitAdjusted > 0 ? '-' + formatCurrency(ev.debitAdjusted) : '₹0'}</td>
            <td class="text-right font-mono font-extrabold text-slate-900 text-sm">${formatCurrency(ev.totalSettled)}</td>
            <td class="text-slate-600 text-xs max-w-xs truncate" title="${escapeHtml(ev.notes || '-')}">${escapeHtml(ev.notes || '-')}</td>
            <td class="text-center">
              <button type="button" onclick="viewSupplierStatement('${encodedSup}')" class="btn-outline text-[11px] py-1 px-2 text-indigo-700 hover:bg-indigo-50 border-indigo-200 shadow-xs cursor-pointer" title="View Supplier Statement">
                <i class="fa-solid fa-file-invoice mr-0.5"></i> Statement
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

// 1. Lump-Sum Payment Collection from Wholesale Party (FIFO across unpaid bills)
function openPartyLumpSumCollectModal(rawCustomerName) {
  try {
    let customerName = rawCustomerName || "";
    try {
      if (typeof customerName === 'string' && customerName.includes('%')) {
        customerName = decodeURIComponent(customerName);
      }
    } catch(e) {}

    const p1 = state.settings.partner1Name || "Kenil";
    const p2 = state.settings.partner2Name || "Alpesh";
    const p1Lbl = document.getElementById("lumpSumP1Label");
    const p2Lbl = document.getElementById("lumpSumP2Label");
    if (p1Lbl) p1Lbl.textContent = `${p1} (Partner 1)`;
    if (p2Lbl) p2Lbl.textContent = `${p2} (Partner 2)`;

    const unpaidSales = (state.sales || [])
      .filter(s => (s.customerName || '').trim().toLowerCase() === customerName.trim().toLowerCase())
      .map(s => {
        const total = Number(s.totalAmount) || 0;
        const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
        const due = Math.max(0, total - paid);
        return { sale: s, total, paid, due };
      })
      .filter(x => x.due > 0);

    const totalDue = unpaidSales.reduce((acc, x) => acc + x.due, 0);

    const nameInput = document.getElementById("lumpSumCustomerName");
    const dispEl = document.getElementById("lumpSumPartyDisplayName");
    const dueEl = document.getElementById("lumpSumTotalDueDisplay");
    const amtInput = document.getElementById("lumpSumAmount");
    const dateInput = document.getElementById("lumpSumDate");
    const notesInput = document.getElementById("lumpSumNotes");

    if (nameInput) nameInput.value = customerName;
    if (dispEl) dispEl.textContent = customerName;
    if (dueEl) dueEl.textContent = formatCurrency(totalDue);
    if (amtInput) amtInput.value = totalDue > 0 ? totalDue : "";
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (notesInput) notesInput.value = "";

    const breakdownText = unpaidSales.length > 0
      ? unpaidSales.map(x => `Bill #${x.sale.invoiceNo} (${formatDate(x.sale.date)}): Due ${formatCurrency(x.due)}`).join(' | ')
      : "No pending unpaid bills found.";

    const billsContainer = document.getElementById("lumpSumBillsSummaryText");
    if (billsContainer) {
      billsContainer.innerHTML = `<span class="font-semibold text-indigo-900">Unpaid Bills (${unpaidSales.length}):</span> ${escapeHtml(breakdownText)}`;
    }

    openModal('partyLumpSumCollectModal');
  } catch (err) {
    console.error("Error opening party lump sum modal:", err);
    showToast("Error opening modal: " + err.message, true);
  }
}

function handleSavePartyLumpSumCollect(e) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    let customerName = document.getElementById("lumpSumCustomerName")?.value.trim() || "";
    const amount = parseFloat(document.getElementById("lumpSumAmount")?.value) || 0;
    const date = document.getElementById("lumpSumDate")?.value || new Date().toISOString().split('T')[0];
    const receivedBy = document.querySelector('input[name="lumpSumReceivedBy"]:checked')?.value || "partner1";
    const method = document.getElementById("lumpSumMethod")?.value || "Google Pay / UPI";
    const notes = document.getElementById("lumpSumNotes")?.value.trim() || "";

    if (amount <= 0) {
      showToast("Please enter a valid received amount!", true);
      return;
    }

    const p1 = state.settings.partner1Name || "Kenil";
    const p2 = state.settings.partner2Name || "Alpesh";
    const receiverLabel = receivedBy === 'partner1' ? p1 : (receivedBy === 'partner2' ? p2 : 'Business Account');

    // Find all unpaid sales for this customer sorted chronologically (FIFO - oldest date first)
    const customerSales = (state.sales || [])
      .filter(s => (s.customerName || '').trim().toLowerCase() === customerName.toLowerCase())
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let remaining = amount;
    const settledBills = [];

    customerSales.forEach(s => {
      if (remaining <= 0) return;

      const total = Number(s.totalAmount) || 0;
      const currentPaid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
      const due = Math.max(0, total - currentPaid);

      if (due > 0) {
        const applyAmt = Math.min(remaining, due);
        const newPaid = currentPaid + applyAmt;
        s.paidAmount = newPaid;

        if (newPaid >= total) {
          s.paymentStatus = 'Paid';
          s.paidAmount = total;
        } else {
          s.paymentStatus = 'Partial';
        }

        s.receivedBy = receivedBy; // Updates partner who received this payment

        if (!s.paymentHistory) s.paymentHistory = [];
        s.paymentHistory.push({
          date,
          amount: applyAmt,
          receivedBy,
          method,
          notes: notes ? `Lump-sum collection: ${notes}` : `Lump-sum receipt (${method})`
        });

        remaining -= applyAmt;
        settledBills.push(`${s.invoiceNo} (₹${applyAmt})`);
      }
    });

    saveState();
    closeModal('partyLumpSumCollectModal');
    refreshAllUI();
    showToast(`Recorded ₹${amount} received from ${customerName} in ${receiverLabel}! Settled: ${settledBills.join(', ')}`);
  } catch (err) {
    console.error("Error saving party lump sum collection:", err);
    showToast("Error saving: " + err.message, true);
  }
}

// 2. Lump-Sum Payment to Supplier / Vendor (FIFO across unpaid purchase bills)
function openSupplierLumpSumPayModal(rawVendorName) {
  try {
    let vendorName = rawVendorName || "";
    try {
      if (typeof vendorName === 'string' && vendorName.includes('%')) {
        vendorName = decodeURIComponent(vendorName);
      }
    } catch(e) {}

    const p1 = state.settings.partner1Name || "Kenil";
    const p2 = state.settings.partner2Name || "Alpesh";
    const p1Lbl = document.getElementById("supplierLumpSumP1Label");
    const p2Lbl = document.getElementById("supplierLumpSumP2Label");
    if (p1Lbl) p1Lbl.textContent = `${p1} (Partner 1)`;
    if (p2Lbl) p2Lbl.textContent = `${p2} (Partner 2)`;

    const unpaidPurchases = (state.purchases || [])
      .filter(p => (p.vendor || '').trim().toLowerCase() === vendorName.trim().toLowerCase())
      .map(p => {
        const total = Number(p.totalAmount) || 0;
        const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Paid' ? total : 0);
        const due = Math.max(0, total - paid);
        return { purchase: p, total, paid, due };
      })
      .filter(x => x.due > 0);

    const totalDue = unpaidPurchases.reduce((acc, x) => acc + x.due, 0);

    let totalDebitNotes = 0;
    (state.supplierReturns || []).forEach(sr => {
      const name = (sr.vendor || sr.supplierName || '').trim();
      if (name.toLowerCase() === vendorName.toLowerCase()) {
        const isDebitNote = sr.settlementMode === 'ledger_credit' || sr.settlementType === 'Debit Note (Deduct from Future Bill)' || (!sr.settlementMode && !sr.settlementType);
        if (isDebitNote) {
          totalDebitNotes += Math.abs(Number(sr.netBalance) || Number(sr.totalReturnedVal) || 0);
        }
      }
    });

    const netPayable = Math.max(0, totalDue - totalDebitNotes);

    const nameInput = document.getElementById("supplierLumpSumVendorName");
    const dispEl = document.getElementById("supplierLumpSumDisplayName");
    const dueEl = document.getElementById("supplierLumpSumTotalDueDisplay");
    const amtInput = document.getElementById("supplierLumpSumAmount");
    const dateInput = document.getElementById("supplierLumpSumDate");
    const notesInput = document.getElementById("supplierLumpSumNotes");

    if (nameInput) nameInput.value = vendorName;
    if (dispEl) dispEl.textContent = vendorName;
    if (dueEl) dueEl.textContent = formatCurrency(netPayable);
    if (amtInput) amtInput.value = netPayable > 0 ? netPayable : 0;
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (notesInput) notesInput.value = "";

    let breakdownText = unpaidPurchases.length > 0
      ? unpaidPurchases.map(x => `Bill #${x.purchase.billNo} (${formatDate(x.purchase.date)}): Due ${formatCurrency(x.due)}`).join(' | ')
      : "No pending unpaid purchase bills found.";

    if (totalDebitNotes > 0) {
      breakdownText += ` | <span class="text-emerald-700 font-bold">Debit Notes: -${formatCurrency(totalDebitNotes)}</span>`;
    }

    const billsContainer = document.getElementById("supplierLumpSumBillsSummaryText");
    if (billsContainer) {
      billsContainer.innerHTML = `<span class="font-semibold text-rose-900">Pending Bills (${unpaidPurchases.length}):</span> ${breakdownText}`;
    }

    openModal('supplierLumpSumPayModal');
  } catch (err) {
    console.error("Error opening supplier lump sum modal:", err);
    showToast("Error opening modal: " + err.message, true);
  }
}

function handleSaveSupplierLumpSumPay(e) {
  if (e && e.preventDefault) e.preventDefault();

  try {
    let vendorName = document.getElementById("supplierLumpSumVendorName")?.value.trim() || "";
    const amount = parseFloat(document.getElementById("supplierLumpSumAmount")?.value) || 0;
    const date = document.getElementById("supplierLumpSumDate")?.value || new Date().toISOString().split('T')[0];
    const paidBy = document.querySelector('input[name="supplierLumpSumPaidBy"]:checked')?.value || "partner1";
    const method = document.getElementById("supplierLumpSumMethod")?.value || "Google Pay / UPI";
    const notes = document.getElementById("supplierLumpSumNotes")?.value.trim() || "";

    const p1 = state.settings.partner1Name || "Kenil";
    const p2 = state.settings.partner2Name || "Alpesh";
    const payerLabel = paidBy === 'partner1' ? p1 : (paidBy === 'partner2' ? p2 : 'Business Account');

    // Find all unpaid purchases for this supplier sorted chronologically (FIFO)
    const vendorPurchases = (state.purchases || [])
      .filter(p => (p.vendor || '').trim().toLowerCase() === vendorName.toLowerCase())
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Calculate total debit notes for this vendor
    let totalDebitNotes = 0;
    (state.supplierReturns || []).forEach(sr => {
      const name = (sr.vendor || sr.supplierName || '').trim();
      if (name.toLowerCase() === vendorName.toLowerCase()) {
        const isDebitNote = sr.settlementMode === 'ledger_credit' || sr.settlementType === 'Debit Note (Deduct from Future Bill)' || (!sr.settlementMode && !sr.settlementType);
        if (isDebitNote) {
          totalDebitNotes += Math.abs(Number(sr.netBalance) || Number(sr.totalReturnedVal) || 0);
        }
      }
    });

    if (amount <= 0 && totalDebitNotes <= 0) {
      showToast("Please enter a valid payment amount or ensure a return/debit note exists!", true);
      return;
    }

    let remainingCash = amount;
    let remainingDebit = totalDebitNotes;
    const settledPurchases = [];

    vendorPurchases.forEach(p => {
      const total = Number(p.totalAmount) || 0;
      const currentPaid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Paid' ? total : 0);
      const due = Math.max(0, total - currentPaid);

      if (due > 0 && (remainingCash > 0 || remainingDebit > 0)) {
        const applyDebit = Math.min(remainingDebit, due);
        const remainingDueAfterDebit = due - applyDebit;
        const applyCash = Math.min(remainingCash, remainingDueAfterDebit);
        const totalApplied = applyDebit + applyCash;

        const newPaid = currentPaid + totalApplied;
        p.paidAmount = newPaid;

        if (newPaid >= total) {
          p.paymentStatus = 'Paid';
          p.paidAmount = total;
        } else {
          p.paymentStatus = 'Partial';
        }

        if (applyCash > 0) {
          p.paidBy = paidBy;
        }

        if (!p.paymentHistory) p.paymentHistory = [];
        const logParts = [];
        if (applyCash > 0) logParts.push(`Paid ₹${applyCash} via ${method} by ${payerLabel}`);
        if (applyDebit > 0) logParts.push(`₹${applyDebit} adjusted from Debit Note / Return`);
        if (notes) logParts.push(`(${notes})`);

        p.paymentHistory.push({
          date,
          amount: applyCash,
          debitAdjusted: applyDebit,
          paidBy,
          method,
          notes: logParts.join(' | ')
        });

        remainingCash -= applyCash;
        remainingDebit -= applyDebit;
        settledPurchases.push(`${p.billNo} (₹${totalApplied}${applyDebit > 0 ? ` [incl. ₹${applyDebit} Return]` : ''})`);
      }
    });

    saveState();
    closeModal('supplierLumpSumPayModal');
    refreshAllUI();
    showToast(`Payment & Return adjustments recorded for ${vendorName}! Settled: ${settledPurchases.join(', ') || 'None'}`);
  } catch (err) {
    console.error("Error saving supplier lump sum payment:", err);
    showToast("Error saving: " + err.message, true);
  }
}

// 3. Complete Ledger Statement for Customer
function viewCustomerStatement(rawCustomerName) {
  try {
    let customerName = rawCustomerName || "";
    try {
      if (typeof customerName === 'string' && customerName.includes('%')) {
        customerName = decodeURIComponent(customerName);
      }
    } catch(e) {}

    const content = document.getElementById("statementPrintContent");
    const title = document.getElementById("statementModalTitle");
    const subtitle = document.getElementById("statementModalSubtitle");
    const bizName = state.settings.bizName || "Dwarkadhish Enterprise";

    if (title) title.innerHTML = `<i class="fa-solid fa-address-book text-indigo-600"></i> Wholesale Customer Ledger: ${escapeHtml(customerName)}`;
    if (subtitle) subtitle.textContent = `Statement of Accounts & Transaction History`;

    const partySales = (state.sales || [])
      .filter(s => (s.customerName || '').trim().toLowerCase() === customerName.trim().toLowerCase())
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let totalBilled = 0;
    let totalPaid = 0;
    let runningBal = 0;

    const rows = [];

    partySales.forEach(s => {
      const total = Number(s.totalAmount) || 0;
      const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
      
      totalBilled += total;
      runningBal += total;

      // 1. Debit Row for Invoice
      rows.push({
        date: s.date,
        type: 'Invoice',
        ref: s.invoiceNo,
        desc: s.items ? s.items.map(it => `${it.productName} (${it.qty} pcs)`).join(', ') : 'Wholesale Goods',
        debit: total,
        credit: 0,
        balance: runningBal
      });

      // 2. Credit Row(s) for Payments
      if (Array.isArray(s.paymentHistory) && s.paymentHistory.length > 0) {
        s.paymentHistory.forEach(ph => {
          totalPaid += Number(ph.amount) || 0;
          runningBal -= Number(ph.amount) || 0;
          rows.push({
            date: ph.date || s.date,
            type: 'Payment Receipt',
            ref: `Recv-${s.invoiceNo}`,
            desc: ph.notes || `Payment received (${ph.method || 'Cash/Online'})`,
            debit: 0,
            credit: Number(ph.amount) || 0,
            balance: runningBal
          });
        });
      } else if (paid > 0) {
        totalPaid += paid;
        runningBal -= paid;
        rows.push({
          date: s.date,
          type: 'Payment Receipt',
          ref: `Recv-${s.invoiceNo}`,
          desc: `Payment received at billing`,
          debit: 0,
          credit: paid,
          balance: runningBal
        });
      }
    });

    const netPending = Math.max(0, runningBal);

    content.innerHTML = `
      <div class="text-center pb-3 border-b border-slate-200 flex flex-col items-center">
        <div class="w-14 h-14 rounded-full overflow-hidden border border-slate-200 mb-1 flex items-center justify-center bg-white">
          <img src="logo.jpg" alt="Dwarkadhish Enterprise" class="w-full h-full object-cover">
        </div>
        <h2 class="text-base font-bold text-slate-900">${escapeHtml(bizName)}</h2>
        <p class="text-xs text-slate-500">Customer Account Statement / ખાતાવહી</p>
      </div>

      <div class="grid grid-cols-2 text-xs py-2 gap-2 border-b border-slate-100">
        <div>
          <p><span class="text-slate-500">Customer:</span> <b class="text-slate-900 text-sm">${escapeHtml(customerName)}</b></p>
          <p><span class="text-slate-500">Statement Date:</span> <b>${formatDate(new Date().toISOString().split('T')[0])}</b></p>
        </div>
        <div class="text-right">
          <p><span class="text-slate-500">Total Billed:</span> <b class="font-mono text-slate-900">${formatCurrency(totalBilled)}</b></p>
          <p><span class="text-slate-500">Total Received:</span> <b class="font-mono text-emerald-700">${formatCurrency(totalPaid)}</b></p>
          <p class="text-sm font-extrabold ${netPending > 0 ? 'text-rose-600' : 'text-emerald-700'}">
            Net Outstanding Due: ${formatCurrency(netPending)}
          </p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-600 border-b border-slate-200">
              <th class="py-2 px-2">Date</th>
              <th class="py-2 px-2">Type / Ref #</th>
              <th class="py-2 px-2">Particulars / Description</th>
              <th class="py-2 px-2 text-right">Debit (Bill ₹)</th>
              <th class="py-2 px-2 text-right">Credit (Paid ₹)</th>
              <th class="py-2 px-2 text-right">Balance Due (₹)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-mono">
            ${rows.map(r => `
              <tr>
                <td class="py-2 px-2 text-slate-600">${formatDate(r.date)}</td>
                <td class="py-2 px-2 font-bold text-slate-800">${escapeHtml(r.ref)} <span class="text-[10px] block font-normal text-slate-400">${r.type}</span></td>
                <td class="py-2 px-2 font-sans text-slate-600 text-[11px] max-w-xs">${escapeHtml(r.desc)}</td>
                <td class="py-2 px-2 text-right font-bold text-slate-900">${r.debit > 0 ? formatCurrency(r.debit) : '-'}</td>
                <td class="py-2 px-2 text-right font-bold text-emerald-700">${r.credit > 0 ? formatCurrency(r.credit) : '-'}</td>
                <td class="py-2 px-2 text-right font-extrabold ${r.balance > 0 ? 'text-rose-600' : 'text-emerald-700'}">${formatCurrency(r.balance)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="bg-slate-50 font-bold border-t-2 border-slate-300 font-mono">
              <td colspan="3" class="py-2 px-2 text-right font-sans">Total:</td>
              <td class="py-2 px-2 text-right text-slate-900">${formatCurrency(totalBilled)}</td>
              <td class="py-2 px-2 text-right text-emerald-700">${formatCurrency(totalPaid)}</td>
              <td class="py-2 px-2 text-right text-rose-600 font-extrabold">${formatCurrency(netPending)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openModal('statementModal');
  } catch (err) {
    console.error("Error generating customer statement:", err);
    showToast("Error generating statement: " + err.message, true);
  }
}

// 4. Complete Ledger Statement for Supplier
function viewSupplierStatement(rawVendorName) {
  try {
    let vendorName = rawVendorName || "";
    try {
      if (typeof vendorName === 'string' && vendorName.includes('%')) {
        vendorName = decodeURIComponent(vendorName);
      }
    } catch(e) {}

    const content = document.getElementById("statementPrintContent");
    const title = document.getElementById("statementModalTitle");
    const subtitle = document.getElementById("statementModalSubtitle");
    const bizName = state.settings.bizName || "Dwarkadhish Enterprise";

    if (title) title.innerHTML = `<i class="fa-solid fa-truck-field text-rose-600"></i> Supplier Statement: ${escapeHtml(vendorName)}`;
  if (subtitle) subtitle.textContent = `Statement of Purchases, Payments & Returns`;

  const purchases = (state.purchases || [])
    .filter(p => (p.vendor || '').trim().toLowerCase() === vendorName.trim().toLowerCase());

  const allEvents = [];

  purchases.forEach(p => {
    const total = Number(p.totalAmount) || 0;
    const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Paid' ? total : 0);
    allEvents.push({
      date: p.date,
      type: 'Purchase Bill',
      ref: p.billNo,
      desc: p.items ? p.items.map(it => `${it.productName} (${it.qty} pcs)`).join(', ') : 'Inventory Purchase',
      purchaseAmt: total,
      paidAmt: 0
    });

    if (Array.isArray(p.paymentHistory) && p.paymentHistory.length > 0) {
      p.paymentHistory.forEach(ph => {
        allEvents.push({
          date: ph.date || p.date,
          type: 'Supplier Payment',
          ref: `Pay-${p.billNo}`,
          desc: ph.notes || `Paid to supplier (${ph.method || 'Online/Cash'})`,
          purchaseAmt: 0,
          paidAmt: Number(ph.amount) || 0
        });
      });
    } else if (paid > 0) {
      allEvents.push({
        date: p.date,
        type: 'Supplier Payment',
        ref: `Pay-${p.billNo}`,
        desc: `Paid on purchase date`,
        purchaseAmt: 0,
        paidAmt: paid
      });
    }
  });

  (state.supplierReturns || []).forEach(sr => {
    const name = (sr.vendor || sr.supplierName || '').trim();
    if (name.toLowerCase() === vendorName.toLowerCase()) {
      const retVal = Math.abs(Number(sr.netBalance) || Number(sr.totalReturnedVal) || 0);
      const isDebitNote = sr.settlementMode === 'ledger_credit' || sr.settlementType === 'Debit Note (Deduct from Future Bill)' || (!sr.settlementMode && !sr.settlementType);
      if (isDebitNote && retVal > 0) {
        const itemDesc = (sr.returnedItems || []).map(it => `${it.productName || 'Item'} (${it.qty} pcs)`).join(', ') || 'Goods Returned';
        allEvents.push({
          date: sr.date,
          type: 'Debit Note / Return',
          ref: sr.refNo || 'PR-Ret',
          desc: `Returned goods to supplier: ${itemDesc}`,
          purchaseAmt: 0,
          paidAmt: retVal
        });
      }
    }
  });

  allEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let totalPurchased = 0;
  let totalPaid = 0;
  let runningBal = 0;
  const rows = [];

  allEvents.forEach(ev => {
    totalPurchased += ev.purchaseAmt;
    totalPaid += ev.paidAmt;
    runningBal += ev.purchaseAmt - ev.paidAmt;

    rows.push({
      date: ev.date,
      type: ev.type,
      ref: ev.ref,
      desc: ev.desc,
      purchaseAmt: ev.purchaseAmt,
      paidAmt: ev.paidAmt,
      balance: Math.max(0, runningBal)
    });
  });

  const netPayable = Math.max(0, runningBal);

  content.innerHTML = `
    <div class="text-center pb-3 border-b border-slate-200 flex flex-col items-center">
      <div class="w-14 h-14 rounded-full overflow-hidden border border-slate-200 mb-1 flex items-center justify-center bg-white">
        <img src="logo.jpg" alt="Dwarkadhish Enterprise" class="w-full h-full object-cover">
      </div>
      <h2 class="text-base font-bold text-slate-900">${escapeHtml(bizName)}</h2>
      <p class="text-xs text-slate-500">Supplier Account Statement / સપ્લાયર ખાતાવહી</p>
    </div>

    <div class="grid grid-cols-2 text-xs py-2 gap-2 border-b border-slate-100">
      <div>
        <p><span class="text-slate-500">Supplier:</span> <b class="text-slate-900 text-sm">${escapeHtml(vendorName)}</b></p>
        <p><span class="text-slate-500">Statement Date:</span> <b>${formatDate(new Date().toISOString().split('T')[0])}</b></p>
      </div>
      <div class="text-right">
        <p><span class="text-slate-500">Total Purchases:</span> <b class="font-mono text-slate-900">${formatCurrency(totalPurchased)}</b></p>
        <p><span class="text-slate-500">Total Paid:</span> <b class="font-mono text-emerald-700">${formatCurrency(totalPaid)}</b></p>
        <p class="text-sm font-extrabold ${netPayable > 0 ? 'text-rose-700' : 'text-emerald-700'}">
          Net Balance Payable: ${formatCurrency(netPayable)}
        </p>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 text-slate-600 border-b border-slate-200">
            <th class="py-2 px-2">Date</th>
            <th class="py-2 px-2">Type / Bill #</th>
            <th class="py-2 px-2">Particulars / Description</th>
            <th class="py-2 px-2 text-right">Purchase (₹)</th>
            <th class="py-2 px-2 text-right">Paid (₹)</th>
            <th class="py-2 px-2 text-right">Balance Payable (₹)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 font-mono">
          ${rows.map(r => `
            <tr>
              <td class="py-2 px-2 text-slate-600">${formatDate(r.date)}</td>
              <td class="py-2 px-2 font-bold text-slate-800">${escapeHtml(r.ref)} <span class="text-[10px] block font-normal text-slate-400">${r.type}</span></td>
              <td class="py-2 px-2 font-sans text-slate-600 text-[11px] max-w-xs">${escapeHtml(r.desc)}</td>
              <td class="py-2 px-2 text-right font-bold text-slate-900">${r.purchaseAmt > 0 ? formatCurrency(r.purchaseAmt) : '-'}</td>
              <td class="py-2 px-2 text-right font-bold text-emerald-700">${r.paidAmt > 0 ? formatCurrency(r.paidAmt) : '-'}</td>
              <td class="py-2 px-2 text-right font-extrabold ${r.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}">${formatCurrency(r.balance)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="bg-slate-50 font-bold border-t-2 border-slate-300 font-mono">
            <td colspan="3" class="py-2 px-2 text-right font-sans">Total:</td>
            <td class="py-2 px-2 text-right text-slate-900">${formatCurrency(totalPurchased)}</td>
            <td class="py-2 px-2 text-right text-emerald-700">${formatCurrency(totalPaid)}</td>
            <td class="py-2 px-2 text-right text-rose-700 font-extrabold">${formatCurrency(netPayable)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

    openModal('statementModal');
  } catch (err) {
    console.error("Error generating supplier statement:", err);
    showToast("Error generating statement: " + err.message, true);
  }
}

function refreshAllUI() {
  reconcileSupplierReturnsAndBills();
  renderDashboard();
  renderOnlinePayouts();
  renderProductsTable();
  renderDispatchesTable();
  renderSalesTable();
  renderPurchasesTable();
  renderSupplierReturnsTable();
  renderExpensesTable();
  renderKhataTables();
  updatePartiesDatalist();
  updateSuppliersDatalist();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

