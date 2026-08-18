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
    } else {
      state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (err) {
    console.error("Error loading state from localStorage", err);
    state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));
  }
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
    const cost = Number(p.costPrice) || 0;
    totalStockVal += stock * cost;

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

  // 4. Wholesale Collections Received in Partner's personal account
  let p1WholesaleRecv = 0;
  let p2WholesaleRecv = 0;
  state.sales.forEach(s => {
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
  });  // 5. Personal Drawings
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

  const p1TotalPaid = (p1Purchases + p1Expenses + p1Capital + p1SettlementAdj) - (p1WholesaleRecv + p1Drawings);
  const p2TotalPaid = (p2Purchases + p2Expenses + p2Capital + p2SettlementAdj) - (p2WholesaleRecv + p2Drawings);
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
  const cP1Draw = document.getElementById("cardP1Drawings");
  const cP1Set = document.getElementById("cardP1Settlements");
  const cP1Grand = document.getElementById("cardP1GrandTotal");

  if (cP1Purch) cP1Purch.textContent = formatCurrency(p1Purchases);
  if (cP1Exp) cP1Exp.textContent = formatCurrency(p1Expenses);
  if (cP1Cap) cP1Cap.textContent = formatCurrency(p1Capital);
  if (cP1Ws) cP1Ws.textContent = formatCurrency(p1WholesaleRecv);
  if (cP1Draw) cP1Draw.textContent = formatCurrency(p1Drawings);
  if (cP1Set) cP1Set.textContent = (p1SettlementAdj >= 0 ? "+" : "") + formatCurrency(p1SettlementAdj);
  if (cP1Grand) cP1Grand.textContent = formatCurrency(p1TotalPaid);

  const cP2Purch = document.getElementById("cardP2Purchases");
  const cP2Exp = document.getElementById("cardP2Expenses");
  const cP2Cap = document.getElementById("cardP2Capital");
  const cP2Ws = document.getElementById("cardP2WholesaleRecv");
  const cP2Draw = document.getElementById("cardP2Drawings");
  const cP2Set = document.getElementById("cardP2Settlements");
  const cP2Grand = document.getElementById("cardP2GrandTotal");

  if (cP2Purch) cP2Purch.textContent = formatCurrency(p2Purchases);
  if (cP2Exp) cP2Exp.textContent = formatCurrency(p2Expenses);
  if (cP2Cap) cP2Cap.textContent = formatCurrency(p2Capital);
  if (cP2Ws) cP2Ws.textContent = formatCurrency(p2WholesaleRecv);
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

// ==================== INVENTORY & PRODUCTS ====================
function renderProductsTable() {
  const tbody = document.getElementById("productsTableBody");
  if (!tbody) return;

  const search = (document.getElementById("productSearchInput")?.value || "").toLowerCase();
  const filterStock = document.getElementById("productFilterStock")?.value || "all";

  let filtered = state.products.filter(p => {
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
    const stock = Number(p.currentStock) || 0;
    const minStock = Number(p.minStockAlert) || 5;
    let stockBadge = "badge-paid";
    if (stock <= 0) stockBadge = "badge-pending";
    else if (stock <= minStock) stockBadge = "badge-partial";

    return `
      <tr>
        <td class="font-mono font-semibold text-slate-600">${escapeHtml(p.sku || '-')}</td>
        <td class="font-bold text-slate-900">${escapeHtml(p.name)}</td>
        <td><span class="badge-status badge-neutral">${escapeHtml(p.category || 'General')}</span></td>
        <td class="text-right text-slate-600 font-mono">${formatCurrency(p.costPrice)}</td>
        <td class="text-right text-emerald-600 font-bold font-mono">${formatCurrency(p.retailPrice)}</td>
        <td class="text-right text-indigo-600 font-bold font-mono">${formatCurrency(p.wholesalePrice)}</td>
        <td class="text-center">
          <span class="badge-status ${stockBadge} font-mono">
            ${stock} Units
          </span>
        </td>
        <td class="text-center space-x-1">
          <button onclick="editProduct('${p.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="quickAdjustStock('${p.id}')" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Adjust Stock">
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
      showToast("Product updated successfully!");
    }
  } else {
    const newProd = {
      id: "prod_" + Date.now(),
      name,
      sku: sku || "SKU-" + Math.floor(1000 + Math.random() * 9000),
      category: category || "General",
      costPrice,
      retailPrice,
      wholesalePrice,
      currentStock: openingStock,
      minStockAlert: minStock
    };
    state.products.push(newProd);
    showToast("New product added successfully!");
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

  document.getElementById("productModalTitle").textContent = "Edit Product";
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

// ==================== SALES MANAGEMENT ====================
function initSaleModal(saleType = 'retail_online') {
  const form = document.getElementById("saleForm");
  if (form) form.reset();

  const today = new Date().toISOString().split('T')[0];
  document.getElementById("saleDate").value = today;
  document.getElementById("saleEditId").value = "";
  document.getElementById("saleModalTitle").textContent = "New Sale Entry";
  document.getElementById("saleItemsContainer").innerHTML = "";

  const discPct = document.getElementById("saleDiscountPercent");
  const discAmt = document.getElementById("saleDiscountAmount");
  if (discPct) discPct.value = "";
  if (discAmt) discAmt.value = "";
  const discSummary = document.getElementById("saleDiscountSummaryDisplay");
  if (discSummary) discSummary.classList.add("hidden");

  const radio = form.querySelector(`input[name="saleType"][value="${saleType || 'retail_online'}"]`);
  if (radio) radio.checked = true;

  toggleSaleTypeUI();
  addSaleItemRow();
  calculateSaleTotal();
}

function editSale(id) {
  const sale = state.sales.find(s => s.id === id);
  if (!sale) return;

  const form = document.getElementById("saleForm");
  if (form) form.reset();

  document.getElementById("saleEditId").value = sale.id;
  document.getElementById("saleDate").value = sale.date;
  document.getElementById("saleModalTitle").textContent = `Edit Sale (${sale.invoiceNo})`;

  const radio = form.querySelector(`input[name="saleType"][value="${sale.type}"]`);
  if (radio) radio.checked = true;

  toggleSaleTypeUI();

  if (sale.type === 'retail_online') {
    document.getElementById("saleChannel").value = sale.channel || "Amazon";
    document.getElementById("saleCustomerName").value = sale.customerName || "";
  } else {
    document.getElementById("saleCustomerName").value = sale.customerName || "";
    document.getElementById("saleCustomerPhone").value = sale.customerPhone || "";
    document.getElementById("saleCustomerCity").value = sale.customerCity || "";
  }

  const discPct = document.getElementById("saleDiscountPercent");
  const discAmt = document.getElementById("saleDiscountAmount");
  if (discPct) discPct.value = sale.discountPercent > 0 ? sale.discountPercent : "";
  if (discAmt) discAmt.value = sale.discountAmount > 0 ? sale.discountAmount : "";

  document.getElementById("salePaymentStatus").value = sale.paymentStatus || "Paid";
  document.getElementById("salePaidAmount").value = sale.paidAmount !== undefined ? sale.paidAmount : (sale.paymentStatus === 'Pending' ? 0 : sale.totalAmount);
  if (document.getElementById("saleReceivedBy")) {
    document.getElementById("saleReceivedBy").value = sale.receivedBy || "partner1";
  }
  document.getElementById("saleNotes").value = sale.notes || "";

  const container = document.getElementById("saleItemsContainer");
  container.innerHTML = "";

  (sale.items || []).forEach(it => {
    addSaleItemRow(it.productId, it.qty, it.price);
  });

  calculateSaleTotal(false);
  openModal('saleModal', 'edit');
}

function toggleSaleTypeUI() {
  const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'retail_online';
  const wholesaleFields = document.getElementById("wholesaleExtraFields");
  const channelGroup = document.getElementById("saleChannelGroup");
  const custLabel = document.getElementById("saleCustomerLabel");

  if (saleType === 'wholesale') {
    if (wholesaleFields) wholesaleFields.classList.remove("hidden");
    if (channelGroup) channelGroup.classList.add("hidden");
    if (custLabel) custLabel.textContent = "Customer / Business Name *";
  } else {
    if (wholesaleFields) wholesaleFields.classList.add("hidden");
    if (channelGroup) channelGroup.classList.remove("hidden");
    if (custLabel) custLabel.textContent = "Customer Name / Order ID";
  }

  updateSaleItemPricesBasedOnType(saleType);
}

function addSaleItemRow(prodId = "", qty = 1, customPrice = null) {
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

  const row = document.createElement("div");
  row.className = "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 sale-item-row hover:border-indigo-300 transition-colors";
  row.id = `sale_row_${rowIndex}`;

  row.innerHTML = `
    <div class="flex-grow sm:w-5/12">
      <select onchange="onSaleProductSelect('${rowIndex}')" id="sale_prod_${rowIndex}" required class="input-pro py-1.5 text-xs font-semibold">
        <option value="">-- Select Product --</option>
        ${state.products.map(p => `<option value="${p.id}" ${p.id === prodId ? 'selected' : ''}>${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
      </select>
    </div>
    <div class="w-full sm:w-2/12">
      <div class="relative">
        <input type="number" id="sale_qty_${rowIndex}" min="1" value="${qty}" oninput="calculateSaleTotal()" placeholder="Qty" required class="input-pro py-1.5 text-xs text-center font-bold font-mono">
      </div>
    </div>
    <div class="w-full sm:w-3/12">
      <div class="relative">
        <input type="number" id="sale_price_${rowIndex}" min="0" step="any" value="${initialPrice > 0 ? initialPrice : ''}" oninput="calculateSaleTotal()" placeholder="Rate ₹" required class="input-pro py-1.5 text-xs text-right font-bold text-emerald-600 font-mono" title="You can freely enter any custom selling price for this customer">
      </div>
    </div>
    <div class="w-full sm:w-2/12 text-right font-bold text-slate-900 text-xs px-1 flex items-center justify-between sm:justify-end gap-2">
      <span id="sale_subtotal_${rowIndex}" class="font-mono text-sm">₹0</span>
      <button type="button" onclick="removeSaleItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1" title="Remove">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  calculateSaleTotal();
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
  calculateSaleTotal();
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
      }
    }
  });
  calculateSaleTotal();
}

function getSaleItemsSubtotal() {
  const rows = document.querySelectorAll(".sale-item-row");
  let subtotal = 0;
  rows.forEach(row => {
    const id = row.id.replace("sale_row_", "");
    const qty = parseFloat(document.getElementById(`sale_qty_${id}`)?.value) || 0;
    const price = parseFloat(document.getElementById(`sale_price_${id}`)?.value) || 0;
    subtotal += (qty * price);
  });
  return subtotal;
}

function onSaleDiscountPercentChange() {
  const percentInput = document.getElementById("saleDiscountPercent");
  const amountInput = document.getElementById("saleDiscountAmount");
  let percent = parseFloat(percentInput?.value) || 0;
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  if (percentInput && percentInput.value !== "" && percentInput.value != percent) percentInput.value = percent;

  const subtotal = getSaleItemsSubtotal();
  if (percent > 0 && subtotal > 0) {
    const discAmount = Math.round(((subtotal * percent) / 100) * 100) / 100;
    if (amountInput) amountInput.value = discAmount;
  } else {
    if (amountInput) amountInput.value = "";
  }
  calculateSaleTotal(false);
}

function onSaleDiscountAmountChange() {
  const percentInput = document.getElementById("saleDiscountPercent");
  const amountInput = document.getElementById("saleDiscountAmount");
  let amount = parseFloat(amountInput?.value) || 0;
  if (amount < 0) amount = 0;

  const subtotal = getSaleItemsSubtotal();
  if (amount > 0 && subtotal > 0) {
    const percent = Math.round(((amount / subtotal) * 100) * 100) / 100;
    if (percentInput) percentInput.value = percent;
  } else {
    if (percentInput) percentInput.value = "";
  }
  calculateSaleTotal(false);
}

function calculateSaleTotal(recalcDiscount = true) {
  const rows = document.querySelectorAll(".sale-item-row");
  let itemsSubtotal = 0;
  let totalEstimatedCost = 0;

  rows.forEach(row => {
    const id = row.id.replace("sale_row_", "");
    const prodId = document.getElementById(`sale_prod_${id}`)?.value;
    const qty = parseFloat(document.getElementById(`sale_qty_${id}`)?.value) || 0;
    const price = parseFloat(document.getElementById(`sale_price_${id}`)?.value) || 0;
    const subtotal = qty * price;
    itemsSubtotal += subtotal;

    const prod = state.products.find(p => p.id === prodId);
    if (prod) {
      totalEstimatedCost += (qty * (Number(prod.costPrice) || 0));
    }

    const subEl = document.getElementById(`sale_subtotal_${id}`);
    if (subEl) subEl.textContent = formatCurrency(subtotal);
  });

  const subtotalDisplay = document.getElementById("saleSubtotalDisplay");
  if (subtotalDisplay) subtotalDisplay.textContent = formatCurrency(itemsSubtotal);

  const percentInput = document.getElementById("saleDiscountPercent");
  const amountInput = document.getElementById("saleDiscountAmount");

  let discountAmount = 0;
  if (recalcDiscount && percentInput && percentInput.value !== "") {
    const percent = parseFloat(percentInput.value) || 0;
    discountAmount = Math.round(((itemsSubtotal * percent) / 100) * 100) / 100;
    if (amountInput) amountInput.value = discountAmount > 0 ? discountAmount : "";
  } else if (amountInput && amountInput.value !== "") {
    discountAmount = parseFloat(amountInput.value) || 0;
  }

  const netTotal = Math.max(0, itemsSubtotal - discountAmount);

  const dTotal = document.getElementById("saleTotalDisplay");
  if (dTotal) dTotal.textContent = formatCurrency(netTotal);

  const profitEl = document.getElementById("saleProfitDisplay");
  if (profitEl) {
    const profit = netTotal - totalEstimatedCost;
    profitEl.textContent = `Profit: +${formatCurrency(profit)}`;
  }

  const discSummary = document.getElementById("saleDiscountSummaryDisplay");
  if (discSummary) {
    if (discountAmount > 0) {
      const pct = percentInput && percentInput.value ? percentInput.value : (itemsSubtotal > 0 ? Math.round(((discountAmount / itemsSubtotal) * 100) * 10) / 10 : 0);
      discSummary.textContent = `Discount: -${formatCurrency(discountAmount)} (${pct}%)`;
      discSummary.classList.remove("hidden");
    } else {
      discSummary.classList.add("hidden");
    }
  }

  const status = document.getElementById("salePaymentStatus")?.value;
  const paidInput = document.getElementById("salePaidAmount");
  if (status === 'Paid' && paidInput && !document.getElementById("saleEditId").value) {
    paidInput.value = netTotal;
  }
}

function toggleSalePaidAmount() {
  const status = document.getElementById("salePaymentStatus").value;
  const paidInput = document.getElementById("salePaidAmount");
  const total = parseFloat(document.getElementById("saleTotalDisplay").textContent.replace(/[₹,]/g, '')) || 0;

  if (status === 'Paid' && paidInput) {
    paidInput.value = total;
  } else if (status === 'Pending' && paidInput) {
    paidInput.value = 0;
  }
}

function handleSaveSale(e) {
  e.preventDefault();

  const editId = document.getElementById("saleEditId").value;
  const saleType = document.querySelector('input[name="saleType"]:checked').value;
  const date = document.getElementById("saleDate").value;
  const channel = saleType === 'wholesale' ? 'Wholesale Party' : document.getElementById("saleChannel").value;
  const customerName = document.getElementById("saleCustomerName").value.trim() || (saleType === 'wholesale' ? 'Wholesale Customer' : 'Online Customer');
  const customerPhone = document.getElementById("saleCustomerPhone")?.value.trim() || "";
  const customerCity = document.getElementById("saleCustomerCity")?.value.trim() || "";
  let paymentStatus = document.getElementById("salePaymentStatus").value;
  const notes = document.getElementById("saleNotes").value.trim();

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
  let itemsSubtotal = 0;

  rows.forEach(row => {
    const id = row.id.replace("sale_row_", "");
    const prodId = document.getElementById(`sale_prod_${id}`).value;
    const qty = parseInt(document.getElementById(`sale_qty_${id}`).value) || 0;
    const price = parseFloat(document.getElementById(`sale_price_${id}`).value) || 0;

    if (!prodId) return;

    const prod = state.products.find(p => p.id === prodId);
    if (!prod) return;

    const subtotal = qty * price;
    itemsSubtotal += subtotal;

    items.push({
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      qty,
      price,
      costPrice: prod.costPrice,
      total: subtotal
    });
  });

  if (items.length === 0) {
    showToast("Please select a valid product!", true);
    return;
  }

  const discountPercent = parseFloat(document.getElementById("saleDiscountPercent")?.value) || 0;
  const discountAmount = parseFloat(document.getElementById("saleDiscountAmount")?.value) || 0;
  const netTotal = Math.max(0, itemsSubtotal - discountAmount);

  let paidAmount = parseFloat(document.getElementById("salePaidAmount").value);
  if (isNaN(paidAmount)) paidAmount = (paymentStatus === 'Paid' ? netTotal : 0);

  if (paidAmount >= netTotal) {
    paymentStatus = 'Paid';
    paidAmount = netTotal;
  } else if (paidAmount <= 0) {
    paymentStatus = 'Pending';
    paidAmount = 0;
  } else {
    paymentStatus = 'Partial';
  }

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
      existing.type = saleType;
      existing.channel = channel;
      existing.customerName = customerName;
      existing.customerPhone = customerPhone;
      existing.customerCity = customerCity;
      existing.items = items;
      existing.subtotal = itemsSubtotal;
      existing.discountPercent = discountPercent;
      existing.discountAmount = discountAmount;
      existing.totalAmount = netTotal;
      existing.paymentStatus = paymentStatus;
      existing.paidAmount = paidAmount;
      existing.receivedBy = receivedBy;
      existing.notes = notes;
      showToast(`Sale Invoice ${existing.invoiceNo} updated!`);
    }
  } else {
    const invoiceNo = (saleType === 'wholesale' ? 'WS-' : 'INV-') + (state.sales.length + 101);
    const newSale = {
      id: "sale_" + Date.now(),
      invoiceNo,
      date,
      type: saleType,
      channel,
      customerName,
      customerPhone,
      customerCity,
      items,
      subtotal: itemsSubtotal,
      discountPercent,
      discountAmount,
      totalAmount: netTotal,
      paymentStatus,
      paidAmount,
      receivedBy,
      paymentHistory: paidAmount > 0 ? [{ date, amount: paidAmount, receivedBy, notes }] : [],
      notes
    };
    state.sales.push(newSale);
    showToast(`Sale Invoice ${invoiceNo} saved!`);
  }

  saveState();
  closeModal('saleModal');
  refreshAllUI();
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
    tbody.innerHTML = `<tr><td colspan="9" class="py-5 text-center text-slate-400">No wholesale bills found. Click "New Wholesale Bill" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const itemsSummary = (s.items || []).map(it => `${it.productName} (${it.qty} pcs @ ₹${it.price})`).join(", ");
    const total = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
    const pending = Math.max(0, total - paid);

    let billProfit = 0;
    if (s.items && s.items.length) {
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
        <td class="font-mono font-bold text-slate-900">${s.invoiceNo}</td>
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
          <button onclick="editSale('${s.id}')" class="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded" title="Edit">
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
  let recvLabel = "Business Account";
  if (sale.receivedBy === 'partner1') recvLabel = `${p1}'s A/c`;
  else if (sale.receivedBy === 'partner2') recvLabel = `${p2}'s A/c`;

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
        <p><span class="text-slate-500">Payment In:</span> <b>${escapeHtml(recvLabel)}</b></p>
      </div>
      <div class="text-right">
        <p><span class="text-slate-500">Customer:</span> <b>${escapeHtml(sale.customerName)}</b></p>
        ${sale.customerPhone ? `<p><span class="text-slate-500">Phone:</span> <b class="font-mono">${escapeHtml(sale.customerPhone)}</b></p>` : ''}
        ${sale.customerCity ? `<p><span class="text-slate-500">City:</span> <b>${escapeHtml(sale.customerCity)}</b></p>` : ''}
      </div>
    </div>

    <table class="w-full text-xs text-left my-2.5">
      <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
        <tr>
          <th class="py-1.5 px-2">Item</th>
          <th class="py-1.5 px-2 text-center">Qty</th>
          <th class="py-1.5 px-2 text-right">Price</th>
          <th class="py-1.5 px-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${(sale.items || []).map(it => `
          <tr>
            <td class="py-1.5 px-2 font-medium text-slate-900">${escapeHtml(it.productName)}</td>
            <td class="py-1.5 px-2 text-center font-mono">${it.qty}</td>
            <td class="py-1.5 px-2 text-right font-mono">${formatCurrency(it.price)}</td>
            <td class="py-1.5 px-2 text-right font-mono font-bold">${formatCurrency(it.total)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="border-t border-slate-200 pt-2 space-y-1 text-xs">
      ${sale.discountAmount > 0 ? `
        <div class="flex justify-between text-slate-600">
          <span>Items Subtotal:</span>
          <span class="font-mono">${formatCurrency(sale.subtotal || (total + sale.discountAmount))}</span>
        </div>
        <div class="flex justify-between text-rose-600 font-semibold">
          <span>Discount (${sale.discountPercent || 0}%):</span>
          <span class="font-mono">-${formatCurrency(sale.discountAmount)}</span>
        </div>
      ` : ''}
      <div class="flex justify-between font-bold text-slate-900 text-sm">
        <span>Total Amount:</span>
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

  const accs = getSellerAccounts().filter(a => a.platform === platform || (platform === 'Other' && a.platform !== 'Meesho' && a.platform !== 'Amazon' && a.platform !== 'Flipkart'));

  if (accs.length === 0) {
    select.innerHTML = `<option value="">-- No ${platform} accounts yet. Click "+ New Account" --</option>`;
    return;
  }

  select.innerHTML = accs.map(a => `
    <option value="${a.id}">${escapeHtml(a.name)}</option>
  `).join('');
}

function quickAddNewSellerAccount() {
  const currentPlatform = document.getElementById("payoutPlatform")?.value || "Amazon";
  const existingCount = getSellerAccounts().filter(a => a.platform === currentPlatform).length;
  const defaultName = `${currentPlatform} - ID ${existingCount + 1}`;
  const accName = prompt(`Enter new seller account name for ${currentPlatform}:`, defaultName);

  if (accName && accName.trim()) {
    const newId = "acc_" + Date.now();
    if (!state.settings.sellerAccounts) state.settings.sellerAccounts = [];
    state.settings.sellerAccounts.push({
      id: newId,
      platform: currentPlatform,
      name: accName.trim()
    });
    saveState();
    updatePayoutAccountsDropdown();
    const select = document.getElementById("payoutAccountId");
    if (select) select.value = newId;
    renderOnlinePayouts();
    showToast(`New account "${accName.trim()}" added to ${currentPlatform}!`);
  }
}

function handleAddNewSellerAccount(e) {
  e.preventDefault();
  const platform = document.getElementById("newAccountPlatform").value;
  const name = document.getElementById("newAccountName").value.trim();
  if (!name) return;

  if (!state.settings.sellerAccounts) state.settings.sellerAccounts = [];
  const newId = "acc_" + Date.now();
  state.settings.sellerAccounts.push({
    id: newId,
    platform,
    name
  });
  saveState();
  document.getElementById("newAccountName").value = "";
  renderSellerAccountsManager();
  renderOnlinePayouts();
  updatePayoutAccountsDropdown();
  showToast(`Account "${name}" added successfully!`);
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
      <div class="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5 shadow-sm">
        <div class="flex items-center justify-between pb-1 border-b border-slate-100">
          <span class="text-xs font-bold px-2 py-0.5 rounded ${badgeClass}">${escapeHtml(platform)} (${groups[platform].length} Accounts)</span>
        </div>
        <div class="space-y-1">
          ${groups[platform].map(a => `
            <div class="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 text-xs">
              <span class="font-semibold text-slate-800">${escapeHtml(a.name)}</span>
              <div class="flex items-center gap-1">
                <button type="button" onclick="renameSellerAccount('${a.id}')" class="p-1 text-slate-400 hover:text-amber-600 rounded" title="Rename Account">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button type="button" onclick="deleteSellerAccount('${a.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded" title="Delete Account">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          `).join('')}
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

  accs.forEach(a => {
    accountTotals[a.id] = 0;
    if (!platformTotals[a.platform]) platformTotals[a.platform] = 0;
  });

  state.onlinePayouts.forEach(op => {
    const amt = Number(op.bankAmount) || 0;
    const plat = op.platform || "Other";
    if (platformTotals[plat] !== undefined) platformTotals[plat] += amt;
    else platformTotals[plat] = (platformTotals[plat] || 0) + amt;

    if (accountTotals[op.accountId] !== undefined) {
      accountTotals[op.accountId] += amt;
    }
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

      container.innerHTML = platforms.map(plat => {
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
              ${platAccs.map(a => `
                <div class="flex justify-between py-0.5 border-b border-slate-100">
                  <span class="truncate pr-2">${escapeHtml(a.name)}:</span>
                  <b class="font-mono text-slate-800 flex-shrink-0">${formatCurrency(accountTotals[a.id] || 0)}</b>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');
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
    const bank = Number(op.bankAmount) || 0;
    const cost = Number(op.approxCost) || 0;
    const margin = bank - cost;

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
        <td class="font-bold text-slate-800">${escapeHtml(accName)}</td>
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

// ==================== PURCHASES & STOCK INWARD ====================
function initPurchaseModal() {
  const form = document.getElementById("purchaseForm");
  if (form) form.reset();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("purchaseDate").value = today;
  document.getElementById("purchaseEditId").value = "";
  document.getElementById("purchaseModalTitle").textContent = "New Purchase Bill";
  document.getElementById("purchaseItemsContainer").innerHTML = "";

  const discPct = document.getElementById("purchaseDiscountPercent");
  const discAmt = document.getElementById("purchaseDiscountAmount");
  if (discPct) discPct.value = "";
  if (discAmt) discAmt.value = "";
  const discSummary = document.getElementById("purchaseDiscountSummaryDisplay");
  if (discSummary) discSummary.classList.add("hidden");

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

  document.getElementById("purchaseEditId").value = purch.id;
  document.getElementById("purchaseDate").value = purch.date;
  document.getElementById("purchaseVendor").value = purch.vendor;
  document.getElementById("purchaseBillNo").value = purch.billNo;
  document.getElementById("purchaseNotes").value = purch.notes || "";

  const discPct = document.getElementById("purchaseDiscountPercent");
  const discAmt = document.getElementById("purchaseDiscountAmount");
  if (discPct) discPct.value = purch.discountPercent > 0 ? purch.discountPercent : "";
  if (discAmt) discAmt.value = purch.discountAmount > 0 ? purch.discountAmount : "";

  document.getElementById("purchasePaymentStatus").value = purch.paymentStatus || "Paid";
  document.getElementById("purchasePaidAmount").value = purch.paidAmount !== undefined ? purch.paidAmount : (purch.paymentStatus === 'Pending' ? 0 : purch.totalAmount);
  document.getElementById("purchaseModalTitle").textContent = `Edit Purchase (${purch.billNo})`;

  const radio = form.querySelector(`input[name="purchasePaidBy"][value="${purch.paidBy || 'partner1'}"]`);
  if (radio) radio.checked = true;

  togglePurchasePaymentUI();

  const container = document.getElementById("purchaseItemsContainer");
  container.innerHTML = "";

  (purch.items || []).forEach(it => {
    addPurchaseItemRow(it.productId, it.qty, it.costPrice);
  });

  calculatePurchaseTotal(false);
  openModal('purchaseModal', 'edit');
}

function addPurchaseItemRow(prodId = "", qty = 10, customCost = null) {
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

  const row = document.createElement("div");
  row.className = "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 purchase-item-row hover:border-indigo-300 transition-colors";
  row.id = `purch_row_${rowIndex}`;

  row.innerHTML = `
    <div class="flex-grow sm:w-5/12">
      <select onchange="onPurchaseProductSelect('${rowIndex}')" id="purch_prod_${rowIndex}" required class="input-pro py-1.5 text-xs font-semibold">
        <option value="">-- Select Item --</option>
        ${state.products.map(p => `<option value="${p.id}" ${p.id === prodId ? 'selected' : ''}>${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
      </select>
    </div>
    <div class="w-full sm:w-2/12">
      <div class="relative">
        <input type="number" id="purch_qty_${rowIndex}" min="1" value="${qty}" oninput="calculatePurchaseTotal()" placeholder="Qty" required class="input-pro py-1.5 text-xs text-center font-bold font-mono">
      </div>
    </div>
    <div class="w-full sm:w-3/12">
      <div class="relative">
        <input type="number" id="purch_cost_${rowIndex}" min="0" step="any" value="${initialCost > 0 ? initialCost : ''}" oninput="calculatePurchaseTotal()" placeholder="Cost ₹" required class="input-pro py-1.5 text-xs text-right font-bold text-slate-800 font-mono" title="You can freely enter any custom purchase cost for this batch">
      </div>
    </div>
    <div class="w-full sm:w-2/12 text-right font-bold text-slate-900 text-xs px-1 flex items-center justify-between sm:justify-end gap-2">
      <span id="purch_subtotal_${rowIndex}" class="font-mono text-sm">₹0</span>
      <button type="button" onclick="removePurchaseItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1" title="Remove">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
  calculatePurchaseTotal();
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
  calculatePurchaseTotal();
}

function getPurchaseItemsSubtotal() {
  const rows = document.querySelectorAll(".purchase-item-row");
  let subtotal = 0;
  rows.forEach(row => {
    const id = row.id.replace("purch_row_", "");
    const qty = parseFloat(document.getElementById(`purch_qty_${id}`)?.value) || 0;
    const cost = parseFloat(document.getElementById(`purch_cost_${id}`)?.value) || 0;
    subtotal += (qty * cost);
  });
  return subtotal;
}

function onPurchaseDiscountPercentChange() {
  const percentInput = document.getElementById("purchaseDiscountPercent");
  const amountInput = document.getElementById("purchaseDiscountAmount");
  let percent = parseFloat(percentInput?.value) || 0;
  if (percent < 0) percent = 0;
  if (percent > 100) percent = 100;
  if (percentInput && percentInput.value !== "" && percentInput.value != percent) percentInput.value = percent;

  const subtotal = getPurchaseItemsSubtotal();
  if (percent > 0 && subtotal > 0) {
    const discAmount = Math.round(((subtotal * percent) / 100) * 100) / 100;
    if (amountInput) amountInput.value = discAmount;
  } else {
    if (amountInput) amountInput.value = "";
  }
  calculatePurchaseTotal(false);
}

function onPurchaseDiscountAmountChange() {
  const percentInput = document.getElementById("purchaseDiscountPercent");
  const amountInput = document.getElementById("purchaseDiscountAmount");
  let amount = parseFloat(amountInput?.value) || 0;
  if (amount < 0) amount = 0;

  const subtotal = getPurchaseItemsSubtotal();
  if (amount > 0 && subtotal > 0) {
    const percent = Math.round(((amount / subtotal) * 100) * 100) / 100;
    if (percentInput) percentInput.value = percent;
  } else {
    if (percentInput) percentInput.value = "";
  }
  calculatePurchaseTotal(false);
}

function calculatePurchaseTotal(recalcDiscount = true) {
  const rows = document.querySelectorAll(".purchase-item-row");
  let itemsSubtotal = 0;

  rows.forEach(row => {
    const id = row.id.replace("purch_row_", "");
    const qty = parseFloat(document.getElementById(`purch_qty_${id}`)?.value) || 0;
    const cost = parseFloat(document.getElementById(`purch_cost_${id}`)?.value) || 0;
    const subtotal = qty * cost;
    itemsSubtotal += subtotal;

    const subEl = document.getElementById(`purch_subtotal_${id}`);
    if (subEl) subEl.textContent = formatCurrency(subtotal);
  });

  const subtotalDisplay = document.getElementById("purchaseSubtotalDisplay");
  if (subtotalDisplay) subtotalDisplay.textContent = formatCurrency(itemsSubtotal);

  const percentInput = document.getElementById("purchaseDiscountPercent");
  const amountInput = document.getElementById("purchaseDiscountAmount");

  let discountAmount = 0;
  if (recalcDiscount && percentInput && percentInput.value !== "") {
    const percent = parseFloat(percentInput.value) || 0;
    discountAmount = Math.round(((itemsSubtotal * percent) / 100) * 100) / 100;
    if (amountInput) amountInput.value = discountAmount > 0 ? discountAmount : "";
  } else if (amountInput && amountInput.value !== "") {
    discountAmount = parseFloat(amountInput.value) || 0;
  }

  const netTotal = Math.max(0, itemsSubtotal - discountAmount);

  const dTotal = document.getElementById("purchaseTotalDisplay");
  if (dTotal) dTotal.textContent = formatCurrency(netTotal);

  const discSummary = document.getElementById("purchaseDiscountSummaryDisplay");
  if (discSummary) {
    if (discountAmount > 0) {
      const pct = percentInput && percentInput.value ? percentInput.value : (itemsSubtotal > 0 ? Math.round(((discountAmount / itemsSubtotal) * 100) * 10) / 10 : 0);
      discSummary.textContent = `Discount: -${formatCurrency(discountAmount)} (${pct}%)`;
      discSummary.classList.remove("hidden");
    } else {
      discSummary.classList.add("hidden");
    }
  }

  const status = document.getElementById("purchasePaymentStatus")?.value;
  const paidInput = document.getElementById("purchasePaidAmount");
  if (status === 'Paid' && paidInput && !document.getElementById("purchaseEditId").value) {
    paidInput.value = netTotal;
  }
}

function handleSavePurchase(e) {
  e.preventDefault();

  const editId = document.getElementById("purchaseEditId").value;
  const date = document.getElementById("purchaseDate").value;
  const vendor = document.getElementById("purchaseVendor").value.trim();
  const billNo = document.getElementById("purchaseBillNo").value.trim() || ("PB-" + (state.purchases.length + 101));
  let paymentStatus = document.getElementById("purchasePaymentStatus").value;
  const paidBy = document.querySelector('input[name="purchasePaidBy"]:checked')?.value || 'partner1';
  const notes = document.getElementById("purchaseNotes").value.trim();

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
  let itemsSubtotal = 0;
  const shouldUpdateMasterCost = document.getElementById("purchaseUpdateMasterCost") ? document.getElementById("purchaseUpdateMasterCost").checked : true;

  rows.forEach(row => {
    const id = row.id.replace("purch_row_", "");
    const prodId = document.getElementById(`purch_prod_${id}`).value;
    const qty = parseInt(document.getElementById(`purch_qty_${id}`).value) || 0;
    const costPrice = parseFloat(document.getElementById(`purch_cost_${id}`).value) || 0;

    if (!prodId) return;

    const prod = state.products.find(p => p.id === prodId);
    if (!prod) return;

    const subtotal = qty * costPrice;
    itemsSubtotal += subtotal;

    items.push({
      productId: prod.id,
      productName: prod.name,
      qty,
      costPrice,
      total: subtotal
    });

    prod.currentStock = (Number(prod.currentStock) || 0) + qty;
    if (shouldUpdateMasterCost && costPrice > 0) {
      prod.costPrice = costPrice;
    }
  });

  if (items.length === 0) {
    showToast("Please select a valid item!", true);
    return;
  }

  const discountPercent = parseFloat(document.getElementById("purchaseDiscountPercent")?.value) || 0;
  const discountAmount = parseFloat(document.getElementById("purchaseDiscountAmount")?.value) || 0;
  const netTotal = Math.max(0, itemsSubtotal - discountAmount);

  let paidAmount = parseFloat(document.getElementById("purchasePaidAmount").value);
  if (isNaN(paidAmount)) paidAmount = (paymentStatus === 'Paid' ? netTotal : 0);

  if (paidAmount >= netTotal) {
    paymentStatus = 'Paid';
    paidAmount = netTotal;
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
      existing.billNo = billNo;
      existing.paidBy = paidBy;
      existing.items = items;
      existing.subtotal = itemsSubtotal;
      existing.discountPercent = discountPercent;
      existing.discountAmount = discountAmount;
      existing.totalAmount = netTotal;
      existing.paymentStatus = paymentStatus;
      existing.paidAmount = paidAmount;
      existing.notes = notes;
      showToast(`Purchase bill ${existing.billNo} updated!`);
    }
  } else {
    const newPurchase = {
      id: "purch_" + Date.now(),
      billNo,
      vendor,
      date,
      paidBy,
      items,
      subtotal: itemsSubtotal,
      discountPercent,
      discountAmount,
      totalAmount: netTotal,
      paymentStatus,
      paidAmount,
      notes
    };
    state.purchases.push(newPurchase);
    showToast(`Purchase bill saved!`);
  }

  saveState();
  closeModal('purchaseModal');
  refreshAllUI();
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

    return `
      <tr>
        <td>
          <span class="font-mono font-bold text-slate-900 block">${escapeHtml(p.billNo)}</span>
          <span class="text-[10px] text-slate-400 font-mono">${formatDate(p.date)}</span>
        </td>
        <td class="font-bold text-slate-900">${escapeHtml(p.vendor)}</td>
        <td class="text-slate-600 max-w-xs truncate" title="${escapeHtml(itemsSummary)}">${escapeHtml(itemsSummary)}</td>
        <td>
          ${paid > 0 ? `<span class="badge-status badge-neutral font-medium">${escapeHtml(payerName)} (₹${paid})</span>` : `<span class="text-xs text-slate-400 font-medium">Unpaid (Credit)</span>`}
        </td>
        <td class="text-right">
          <span class="font-bold text-slate-900 block font-mono">${formatCurrency(total)}</span>
          ${pending > 0 ? `<span class="text-[10px] text-rose-600 font-bold block font-mono">Due: ${formatCurrency(pending)}</span>` : `<span class="text-[10px] text-emerald-600 block">Paid</span>`}
        </td>
        <td class="text-center space-x-1">
          ${pending > 0 ? `
            <button onclick="openVendorPayModal('${p.id}')" class="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold">
              Pay
            </button>
          ` : ''}
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

  const total = Number(purch.totalAmount) || 0;
  const paid = purch.paidAmount !== undefined ? Number(purch.paidAmount) : (purch.paymentStatus === 'Pending' ? 0 : total);
  const pending = Math.max(0, total - paid);

  document.getElementById("vendorPayPurchId").value = purch.id;
  document.getElementById("vpVendorName").textContent = purch.vendor;
  document.getElementById("vpBillNo").textContent = purch.billNo;
  document.getElementById("vpPendingAmount").textContent = formatCurrency(pending);
  document.getElementById("vpAmount").value = pending;
  document.getElementById("vpAmount").max = pending;
  document.getElementById("vpDate").value = new Date().toISOString().split('T')[0];
  document.getElementById("vpNotes").value = "";

  openModal('vendorPayModal');
}

function handleSaveVendorPay(e) {
  e.preventDefault();
  const purchId = document.getElementById("vendorPayPurchId").value;
  const amount = parseFloat(document.getElementById("vpAmount").value) || 0;
  const date = document.getElementById("vpDate").value;
  const paidBy = document.querySelector('input[name="vpPaidBy"]:checked').value;
  const notes = document.getElementById("vpNotes").value.trim();

  const purch = state.purchases.find(p => p.id === purchId);
  if (!purch) return;

  if (amount <= 0) {
    showToast("Amount must be greater than 0!", true);
    return;
  }

  const currentPaid = purch.paidAmount !== undefined ? Number(purch.paidAmount) : (purch.paymentStatus === 'Pending' ? 0 : purch.totalAmount);
  const newPaid = currentPaid + amount;
  purch.paidAmount = newPaid;
  purch.paidBy = paidBy;

  if (newPaid >= purch.totalAmount) {
    purch.paymentStatus = 'Paid';
    purch.paidAmount = purch.totalAmount;
  } else {
    purch.paymentStatus = 'Partial';
  }

  if (notes) {
    purch.notes = (purch.notes ? purch.notes + " | " : "") + `Paid ₹${amount} on ${formatDate(date)} by ${paidBy === 'partner1' ? state.settings.partner1Name : (paidBy === 'partner2' ? state.settings.partner2Name : 'Business')} (${notes})`;
  }

  saveState();
  closeModal('vendorPayModal');
  refreshAllUI();
  showToast(`Payment of ₹${amount} recorded to supplier!`);
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
        "Selling Price (₹)": it.price,
        "Item Total (₹)": it.total,
        "Bill Subtotal (₹)": s.subtotal || total,
        "Discount (%)": s.discountPercent || 0,
        "Discount (₹)": s.discountAmount || 0,
        "Net Bill Total (₹)": total,
        "Paid Amount (₹)": paid,
        "Pending Due (₹)": pending,
        "Payment Received In": recvName,
        "Gross Profit (₹)": (Number(it.price) - (Number(it.costPrice) || 0)) * Number(it.qty),
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
        "Item Total (₹)": (Number(it.costPrice) || 0) * (Number(it.qty) || 0),
        "Bill Subtotal (₹)": p.subtotal || total,
        "Discount (%)": p.discountPercent || 0,
        "Discount (₹)": p.discountAmount || 0,
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
  const stockData = state.products.map(p => ({
    "SKU": p.sku,
    "Product Name": p.name,
    "Category": p.category,
    "Current Stock": p.currentStock,
    "Cost Price": p.costPrice,
    "Retail Price": p.retailPrice,
    "Wholesale Price": p.wholesalePrice,
    "Stock Valuation": p.currentStock * p.costPrice
  }));
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
      "City": s.customerCity || '',
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
  const purchData = state.purchases.map(p => {
    const total = Number(p.totalAmount) || 0;
    const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Pending' ? 0 : total);
    return {
      "Bill No": p.billNo,
      "Date": p.date,
      "Supplier": p.vendor,
      "Paid By": p.paidBy === 'partner1' ? state.settings.partner1Name : (p.paidBy === 'partner2' ? state.settings.partner2Name : 'Business Account'),
      "Total Amount": total,
      "Paid Amount": paid,
      "Pending Balance": Math.max(0, total - paid),
      "Payment Status": p.paymentStatus
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(purchData);
  XLSX.utils.book_append_sheet(wb, ws, "Purchases");
  XLSX.writeFile(wb, `Purchases_Report_${Date.now()}.xlsx`);
  showToast("Purchases report downloaded!");
}

function exportExpensesToExcel() {
  const expData = state.expenses.map(e => ({
    "Date": e.date,
    "Category": e.category,
    "Paid By": e.paidBy === 'partner1' ? state.settings.partner1Name : (e.paidBy === 'partner2' ? state.settings.partner2Name : 'Business Account'),
    "Amount": e.amount,
    "Description": e.description
  }));
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

function refreshAllUI() {
  renderDashboard();
  renderOnlinePayouts();
  renderProductsTable();
  renderDispatchesTable();
  renderSalesTable();
  renderPurchasesTable();
  renderExpensesTable();
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

