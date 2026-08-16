/**
 * CommerceHub ERP - Professional SaaS Application Logic
 * Comprehensive Inventory, Multi-Channel Sales, Purchases, Daily Expenses & 2-Partner Ledger
 */

// Global State (Pre-seeded with Complete Business Database)
const INITIAL_STORE_DATABASE = {
  settings: {
    bizName: "Dwarkadhish Enterprise",
    partner1Name: "Kenil (You)",
    partner2Name: "Alpesh",
    partner1Ratio: 50,
    partner2Ratio: 50,
    firebaseConfig: ""
  },
  products: [
    { id: "p1", sku: "DE-101", name: "Premium Cotton Printed Kurti", category: "Apparel", costPrice: 320, retailPrice: 599, wholesalePrice: 420, currentStock: 18, minStock: 5 },
    { id: "p2", sku: "DE-102", name: "Rayon Anarkali Kurta Set", category: "Apparel", costPrice: 480, retailPrice: 899, wholesalePrice: 620, currentStock: 12, minStock: 4 },
    { id: "p3", sku: "DE-103", name: "Georgette Designer Dupatta", category: "Accessories", costPrice: 150, retailPrice: 349, wholesalePrice: 220, currentStock: 15, minStock: 5 },
    { id: "p4", sku: "DE-104", name: "Heavy Embroidered Silk Gown", category: "Apparel", costPrice: 750, retailPrice: 1499, wholesalePrice: 980, currentStock: 2, minStock: 2 },
    { id: "p5", sku: "DE-105", name: "Linen Casual Shirt", category: "Apparel", costPrice: 290, retailPrice: 649, wholesalePrice: 390, currentStock: 1, minStock: 3 },
    { id: "p6", sku: "DE-106", name: "Chanderi Saree Sample", category: "Traditional", costPrice: 281.5, retailPrice: 699, wholesalePrice: 450, currentStock: 1, minStock: 2 },
    { id: "p7", sku: "DE-107", name: "Digital Print Night Suit", category: "Nightwear", costPrice: 210, retailPrice: 499, wholesalePrice: 290, currentStock: 0, minStock: 5 },
    { id: "p8", sku: "DE-108", name: "Stretchable Denim Jeans", category: "Bottomwear", costPrice: 380, retailPrice: 799, wholesalePrice: 510, currentStock: 0, minStock: 3 }
  ],
  sales: [
    {
      id: "sale_1",
      invoiceNo: "INV-1001",
      date: "2026-08-16",
      type: "retail_online",
      channel: "Meesho",
      customerName: "Pooja Sharma",
      customerPhone: "9876543210",
      customerCity: "Surat",
      items: [{ productId: "p1", productName: "Premium Cotton Printed Kurti", qty: 2, price: 599, total: 1198 }],
      totalAmount: 1198,
      paidAmount: 1198,
      paymentStatus: "Paid",
      notes: "Meesho Online Order"
    },
    {
      id: "sale_2",
      invoiceNo: "INV-1002",
      date: "2026-08-16",
      type: "retail_online",
      channel: "Amazon",
      customerName: "Rahul Patel",
      customerPhone: "9988776655",
      customerCity: "Ahmedabad",
      items: [{ productId: "p2", productName: "Rayon Anarkali Kurta Set", qty: 1, price: 899, total: 899 }],
      totalAmount: 899,
      paidAmount: 899,
      paymentStatus: "Paid",
      notes: "Amazon Prime Order"
    }
  ],
  purchases: [
    {
      id: "pur_1",
      billNo: "PB-901",
      date: "2026-08-15",
      vendor: "Surat Textile Hub",
      paidBy: "partner1",
      items: [{ productId: "p1", productName: "Premium Cotton Printed Kurti", qty: 20, costPrice: 320, total: 6400 }],
      totalAmount: 6400,
      paidAmount: 6400,
      paymentStatus: "Paid",
      notes: "Stock Inward"
    }
  ],
  expenses: [
    { id: "exp_1", date: "2026-08-16", category: "Packaging Materials", amount: 490, paidBy: "partner1", description: "Cricket box" },
    { id: "exp_2", date: "2026-08-16", category: "Tea, Snacks & Refreshments", amount: 200, paidBy: "partner2", description: "nasto" },
    { id: "exp_3", date: "2026-08-16", category: "Packaging Materials", amount: 300, paidBy: "partner1", description: "Amazon Box" },
    { id: "exp_4", date: "2026-08-01", category: "Shop / Godown Rent", amount: 10000, paidBy: "partner1", description: "Monthly Godown Rent" },
    { id: "exp_5", date: "2026-08-05", category: "Courier & Shipping", amount: 4527, paidBy: "partner2", description: "Delhivery & SpeedPost Courier" },
    { id: "exp_6", date: "2026-08-10", category: "Electricity & Internet", amount: 2000, paidBy: "partner2", description: "Office Electricity & Wi-Fi" }
  ],
  adjustments: [],
  partnerTransactions: [
    { id: "tx_1", date: "2026-08-15", type: "capital", payer: "partner1", receiver: "business", amount: 47048.5, notes: "Initial Inventory & Capital Investment" },
    { id: "tx_2", date: "2026-08-15", type: "capital", payer: "partner2", receiver: "business", amount: 23473, notes: "Initial Partner Capital" }
  ],
  _syncTime: Date.now()
};

let state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));

const STORAGE_KEY = "VYAPAR_STOCK_MANAGER_DB_CLEAN_V1";
const CLOUD_SYNC_KEY = "dwarkadhish_enterprise_db_master_v1";
const CLOUD_ENDPOINT_URL = `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/2d9f8e7a/${CLOUD_SYNC_KEY}/`;
const CLOUD_FETCH_URL = `https://keyvalue.immanuel.co/api/KeyVal/GetValue/2d9f8e7a/${CLOUD_SYNC_KEY}`;

let firebaseDb = null;
let isSyncingFromCloud = false;
let cloudSyncTimer = null;

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  
  const today = new Date().toISOString().split('T')[0];
  const dateInputs = ["saleDate", "purchaseDate", "expenseDate", "settleDate", "capitalDate", "vpDate", "ccDate"];
  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  updatePartnerLabelsInUI();
  refreshAllUI();

  // 1. Initial Cloud Sync Fetch
  fetchFromInstantCloud();

  // 2. Periodic Live Sync (Every 15 Seconds)
  if (cloudSyncTimer) clearInterval(cloudSyncTimer);
  cloudSyncTimer = setInterval(fetchFromInstantCloud, 15000);

  // 3. Sync on tab focus
  window.addEventListener("focus", fetchFromInstantCloud);
});

// ==================== ZERO-SETUP INSTANT CLOUD SYNC ====================
async function fetchFromInstantCloud() {
  if (isSyncingFromCloud) return;
  try {
    const res = await fetch(CLOUD_FETCH_URL, { cache: "no-store" });
    if (res.ok) {
      const raw = await res.text();
      if (raw && raw !== "null" && raw.trim().startsWith("{")) {
        const cloudState = JSON.parse(raw);
        const cloudTime = cloudState._syncTime || 0;
        const localTime = state._syncTime || 0;

        // If cloud data is newer or has entries when local is empty
        if (cloudTime > localTime || (!state.sales.length && cloudState.sales && cloudState.sales.length)) {
          isSyncingFromCloud = true;
          state = { ...state, ...cloudState };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          updatePartnerLabelsInUI();
          refreshAllUI();
          isSyncingFromCloud = false;
        }
      }
      updateCloudStatusUI(true);
    }
  } catch (err) {
    console.log("Cloud sync check (offline/local fallback):", err);
    updateCloudStatusUI(navigator.onLine);
  }
}

async function pushToInstantCloud() {
  if (isSyncingFromCloud) return;
  try {
    state._syncTime = Date.now();
    const payload = encodeURIComponent(JSON.stringify(state));
    await fetch(CLOUD_ENDPOINT_URL + payload, { method: "POST" });
    updateCloudStatusUI(true);
  } catch (err) {
    console.warn("Cloud push error (saved locally):", err);
  }
}

function updateCloudStatusUI(isOnline) {
  const badge = document.getElementById("cloudSyncStatusBadge");
  const dot = document.getElementById("cloudSyncDot");
  const text = document.getElementById("cloudSyncText");
  const settingStatus = document.getElementById("settingCloudStatus");

  if (isOnline) {
    if (badge) {
      badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200";
    }
    if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse";
    if (text) text.textContent = "Cloud Live (100% Safe)";
    if (settingStatus) {
      settingStatus.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200";
      settingStatus.textContent = "Cloud Active";
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
      if (parsed && (parsed.products && parsed.products.length || parsed.expenses && parsed.expenses.length)) {
        state = { ...state, ...parsed };
      } else {
        state = JSON.parse(JSON.stringify(INITIAL_STORE_DATABASE));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
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

  if (settlePayer) settlePayer.innerHTML = `<option value="partner1">${p1}</option><option value="partner2">${p2}</option>`;
  if (settleReceiver) settleReceiver.innerHTML = `<option value="partner2">${p2}</option><option value="partner1">${p1}</option>`;
  if (capitalPartner) capitalPartner.innerHTML = `<option value="partner1">${p1}</option><option value="partner2">${p2}</option>`;

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

  if (modalId === 'saleModal') {
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

// ==================== DASHBOARD ====================
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

  // 2. Sales & Wholesale Receivables
  let totalReceivables = 0;
  let pendingReceivablesCount = 0;

  state.sales.forEach(s => {
    const amt = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? amt : 0);
    const pending = Math.max(0, amt - paid);

    if (pending > 0) {
      totalReceivables += pending;
      pendingReceivablesCount++;
    }
  });

  const dTotRec = document.getElementById("dashTotalReceivables");
  const dRecCnt = document.getElementById("dashReceivablesCount");
  if (dTotRec) dTotRec.textContent = formatCurrency(totalReceivables);
  if (dRecCnt) dRecCnt.textContent = `${pendingReceivablesCount} parties with pending balance`;

  // 3. Purchases & Supplier Payables
  let totalPayables = 0;
  let pendingPayablesCount = 0;

  state.purchases.forEach(p => {
    const amt = Number(p.totalAmount) || 0;
    const paid = p.paidAmount !== undefined ? Number(p.paidAmount) : (p.paymentStatus === 'Pending' ? 0 : amt);
    const pending = Math.max(0, amt - paid);

    if (pending > 0) {
      totalPayables += pending;
      pendingPayablesCount++;
    }
  });

  const dTotPay = document.getElementById("dashTotalPayables");
  const dPayCnt = document.getElementById("dashPayablesCount");
  if (dTotPay) dTotPay.textContent = formatCurrency(totalPayables);
  if (dPayCnt) dPayCnt.textContent = `${pendingPayablesCount} bills pending payment`;

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

  // 5. Low Stock Alerts
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

  // 6. 2-Partner Calculation
  calculatePartnerBalances();

  // 7. Recent Activity Table
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

  // 4. Direct Settlements
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

  const p1TotalPaid = p1Purchases + p1Expenses + p1Capital + p1SettlementAdj;
  const p2TotalPaid = p2Purchases + p2Expenses + p2Capital + p2SettlementAdj;
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
  const cP1Set = document.getElementById("cardP1Settlements");
  const cP1Grand = document.getElementById("cardP1GrandTotal");

  if (cP1Purch) cP1Purch.textContent = formatCurrency(p1Purchases);
  if (cP1Exp) cP1Exp.textContent = formatCurrency(p1Expenses);
  if (cP1Cap) cP1Cap.textContent = formatCurrency(p1Capital);
  if (cP1Set) cP1Set.textContent = (p1SettlementAdj >= 0 ? "+" : "") + formatCurrency(p1SettlementAdj);
  if (cP1Grand) cP1Grand.textContent = formatCurrency(p1TotalPaid);

  const cP2Purch = document.getElementById("cardP2Purchases");
  const cP2Exp = document.getElementById("cardP2Expenses");
  const cP2Cap = document.getElementById("cardP2Capital");
  const cP2Set = document.getElementById("cardP2Settlements");
  const cP2Grand = document.getElementById("cardP2GrandTotal");

  if (cP2Purch) cP2Purch.textContent = formatCurrency(p2Purchases);
  if (cP2Exp) cP2Exp.textContent = formatCurrency(p2Expenses);
  if (cP2Cap) cP2Cap.textContent = formatCurrency(p2Capital);
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
    tbody.innerHTML = `<tr><td colspan="7" class="py-5 text-center text-slate-400">No capital or settlement transactions found.</td></tr>`;
    return;
  }

  const p1 = state.settings.partner1Name;
  const p2 = state.settings.partner2Name;

  tbody.innerHTML = state.partnerTransactions.map(tx => {
    const isCapital = tx.type === 'capital';
    const payerName = tx.payer === 'partner1' ? p1 : p2;
    const receiverName = tx.receiver ? (tx.receiver === 'partner1' ? p1 : (tx.receiver === 'partner2' ? p2 : 'Business Account')) : 'Business Account';

    return `
      <tr>
        <td class="text-slate-500 font-mono">${formatDate(tx.date)}</td>
        <td>
          <span class="badge-status ${isCapital ? 'badge-neutral' : 'badge-paid'}">
            ${isCapital ? 'Capital Added' : 'Settlement'}
          </span>
        </td>
        <td class="font-semibold text-slate-900">${escapeHtml(payerName)}</td>
        <td class="text-slate-600">${escapeHtml(receiverName)}</td>
        <td class="text-slate-500">${escapeHtml(tx.notes || '-')}</td>
        <td class="text-right font-bold font-mono text-slate-900">${formatCurrency(tx.amount)}</td>
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

// ==================== SALES MANAGEMENT ====================
function initSaleModal(saleType = 'retail_online') {
  const form = document.getElementById("saleForm");
  if (form) form.reset();

  const today = new Date().toISOString().split('T')[0];
  document.getElementById("saleDate").value = today;
  document.getElementById("saleEditId").value = "";
  document.getElementById("saleModalTitle").textContent = "New Sale Entry";
  document.getElementById("saleItemsContainer").innerHTML = "";

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

  document.getElementById("salePaymentStatus").value = sale.paymentStatus || "Paid";
  document.getElementById("salePaidAmount").value = sale.paidAmount !== undefined ? sale.paidAmount : (sale.paymentStatus === 'Pending' ? 0 : sale.totalAmount);
  document.getElementById("saleNotes").value = sale.notes || "";

  const container = document.getElementById("saleItemsContainer");
  container.innerHTML = "";

  (sale.items || []).forEach(it => {
    const rowIndex = Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const row = document.createElement("div");
    row.className = "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 sale-item-row";
    row.id = `sale_row_${rowIndex}`;

    row.innerHTML = `
      <div class="flex-grow">
        <select onchange="onSaleProductSelect('${rowIndex}')" id="sale_prod_${rowIndex}" required class="input-pro py-1 text-xs font-semibold">
          <option value="">-- Select Product --</option>
          ${state.products.map(p => `<option value="${p.id}" ${p.id === it.productId ? 'selected' : ''}>${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
        </select>
      </div>
      <div class="w-full sm:w-20">
        <input type="number" id="sale_qty_${rowIndex}" min="1" value="${it.qty}" oninput="calculateSaleTotal()" placeholder="Qty" required class="input-pro py-1 text-xs text-center font-bold font-mono">
      </div>
      <div class="w-full sm:w-28">
        <input type="number" id="sale_price_${rowIndex}" min="0" step="any" value="${it.price}" oninput="calculateSaleTotal()" placeholder="Price ₹" required class="input-pro py-1 text-xs text-right font-bold text-emerald-600 font-mono">
      </div>
      <div class="w-full sm:w-24 text-right font-bold text-slate-800 text-xs px-1 flex items-center justify-between sm:justify-end gap-2">
        <span id="sale_subtotal_${rowIndex}" class="font-mono">₹${it.total}</span>
        <button type="button" onclick="removeSaleItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1" title="Remove">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    container.appendChild(row);
  });

  calculateSaleTotal();
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

function addSaleItemRow() {
  const container = document.getElementById("saleItemsContainer");
  if (!container) return;

  const rowIndex = Date.now() + "_" + Math.random().toString(36).substr(2, 4);

  const row = document.createElement("div");
  row.className = "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 sale-item-row";
  row.id = `sale_row_${rowIndex}`;

  row.innerHTML = `
    <div class="flex-grow">
      <select onchange="onSaleProductSelect('${rowIndex}')" id="sale_prod_${rowIndex}" required class="input-pro py-1 text-xs font-semibold">
        <option value="">-- Select Product --</option>
        ${state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
      </select>
    </div>
    <div class="w-full sm:w-20">
      <input type="number" id="sale_qty_${rowIndex}" min="1" value="1" oninput="calculateSaleTotal()" placeholder="Qty" required class="input-pro py-1 text-xs text-center font-bold font-mono">
    </div>
    <div class="w-full sm:w-28">
      <input type="number" id="sale_price_${rowIndex}" min="0" step="any" oninput="calculateSaleTotal()" placeholder="Price ₹" required class="input-pro py-1 text-xs text-right font-bold text-emerald-600 font-mono">
    </div>
    <div class="w-full sm:w-24 text-right font-bold text-slate-800 text-xs px-1 flex items-center justify-between sm:justify-end gap-2">
      <span id="sale_subtotal_${rowIndex}" class="font-mono">₹0</span>
      <button type="button" onclick="removeSaleItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1" title="Remove">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
}

function removeSaleItemRow(rowIndex) {
  const row = document.getElementById(`sale_row_${rowIndex}`);
  if (row) row.remove();
  calculateSaleTotal();
}

function onSaleProductSelect(rowIndex) {
  const prodId = document.getElementById(`sale_prod_${rowIndex}`).value;
  const prod = state.products.find(p => p.id === prodId);
  const saleType = document.querySelector('input[name="saleType"]:checked')?.value || 'retail_online';

  if (prod) {
    const priceInput = document.getElementById(`sale_price_${rowIndex}`);
    if (priceInput) {
      priceInput.value = saleType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
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
        priceInput.value = saleType === 'wholesale' ? prod.wholesalePrice : prod.retailPrice;
      }
    }
  });
  calculateSaleTotal();
}

function calculateSaleTotal() {
  const rows = document.querySelectorAll(".sale-item-row");
  let grandTotal = 0;

  rows.forEach(row => {
    const id = row.id.replace("sale_row_", "");
    const qty = parseFloat(document.getElementById(`sale_qty_${id}`)?.value) || 0;
    const price = parseFloat(document.getElementById(`sale_price_${id}`)?.value) || 0;
    const subtotal = qty * price;
    grandTotal += subtotal;

    const subEl = document.getElementById(`sale_subtotal_${id}`);
    if (subEl) subEl.textContent = formatCurrency(subtotal);
  });

  const dTotal = document.getElementById("saleTotalDisplay");
  if (dTotal) dTotal.textContent = formatCurrency(grandTotal);

  const status = document.getElementById("salePaymentStatus")?.value;
  const paidInput = document.getElementById("salePaidAmount");
  if (status === 'Paid' && paidInput && !document.getElementById("saleEditId").value) {
    paidInput.value = grandTotal;
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
  let grandTotal = 0;

  rows.forEach(row => {
    const id = row.id.replace("sale_row_", "");
    const prodId = document.getElementById(`sale_prod_${id}`).value;
    const qty = parseInt(document.getElementById(`sale_qty_${id}`).value) || 0;
    const price = parseFloat(document.getElementById(`sale_price_${id}`).value) || 0;

    if (!prodId) return;

    const prod = state.products.find(p => p.id === prodId);
    if (!prod) return;

    const subtotal = qty * price;
    grandTotal += subtotal;

    items.push({
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      qty,
      price,
      total: subtotal
    });
  });

  if (items.length === 0) {
    showToast("Please select a valid product!", true);
    return;
  }

  let paidAmount = parseFloat(document.getElementById("salePaidAmount").value);
  if (isNaN(paidAmount)) paidAmount = (paymentStatus === 'Paid' ? grandTotal : 0);

  if (paidAmount >= grandTotal) {
    paymentStatus = 'Paid';
    paidAmount = grandTotal;
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
      existing.totalAmount = grandTotal;
      existing.paymentStatus = paymentStatus;
      existing.paidAmount = paidAmount;
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
      totalAmount: grandTotal,
      paymentStatus,
      paidAmount,
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
  const filterType = document.getElementById("salesFilterType")?.value || "all";
  const filterPayment = document.getElementById("salesFilterPayment")?.value || "all";

  const filtered = state.sales.filter(s => {
    const matchSearch = (s.invoiceNo && s.invoiceNo.toLowerCase().includes(search)) ||
                        (s.customerName && s.customerName.toLowerCase().includes(search)) ||
                        (s.customerPhone && s.customerPhone.includes(search));
    if (!matchSearch) return false;

    if (filterType !== 'all' && s.type !== filterType) return false;
    if (filterPayment !== 'all' && s.paymentStatus !== filterPayment) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-5 text-center text-slate-400">No sales recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const isWholesale = s.type === 'wholesale';
    const itemsSummary = (s.items || []).map(it => `${it.productName} (${it.qty})`).join(", ");
    const total = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
    const pending = Math.max(0, total - paid);

    let statusBadge = "badge-paid";
    let statusText = "Paid";
    if (s.paymentStatus === 'Pending' || pending === total) {
      statusBadge = "badge-pending";
      statusText = "Due";
    } else if (s.paymentStatus === 'Partial' || pending > 0) {
      statusBadge = "badge-partial";
      statusText = `Due: ${formatCurrency(pending)}`;
    }

    return `
      <tr>
        <td class="font-mono font-bold text-slate-900">${s.invoiceNo}</td>
        <td class="text-slate-500 font-mono">${formatDate(s.date)}</td>
        <td>
          <span class="badge-status ${isWholesale ? 'badge-partial' : 'badge-paid'}">
            ${isWholesale ? 'Wholesale' : s.channel}
          </span>
        </td>
        <td class="font-semibold text-slate-800">
          ${escapeHtml(s.customerName)}
          ${s.customerPhone ? `<span class="block text-[10px] text-slate-400 font-mono">${escapeHtml(s.customerPhone)}</span>` : ''}
        </td>
        <td class="text-slate-600 max-w-xs truncate" title="${escapeHtml(itemsSummary)}">${escapeHtml(itemsSummary)}</td>
        <td class="text-right">
          <span class="font-bold text-slate-900 block font-mono">${formatCurrency(total)}</span>
          ${pending > 0 ? `<span class="text-[10px] text-rose-600 font-bold block font-mono">Due: ${formatCurrency(pending)}</span>` : `<span class="text-[10px] text-emerald-600 block">Paid</span>`}
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
          <button onclick="viewInvoiceReceipt('${s.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="Print Invoice">
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

  openModal('customerCollectModal');
}

function handleSaveCustomerCollect(e) {
  e.preventDefault();
  const saleId = document.getElementById("ccSaleId").value;
  const amount = parseFloat(document.getElementById("ccAmount").value) || 0;
  const date = document.getElementById("ccDate").value;
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

  if (notes) {
    sale.notes = (sale.notes ? sale.notes + " | " : "") + `Received ₹${amount} on ${formatDate(date)} (${notes})`;
  }

  saveState();
  closeModal('customerCollectModal');
  refreshAllUI();
  showToast(`Collected ₹${amount} from customer!`);
}

function viewInvoiceReceipt(id) {
  const sale = state.sales.find(s => s.id === id);
  if (!sale) return;

  const content = document.getElementById("invoicePrintContent");
  const bizName = state.settings.bizName || "CommerceHub Store";
  const total = Number(sale.totalAmount) || 0;
  const paid = sale.paidAmount !== undefined ? Number(sale.paidAmount) : (sale.paymentStatus === 'Paid' ? total : 0);
  const pending = Math.max(0, total - paid);

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
        <p><span class="text-slate-500">Channel:</span> <b>${sale.channel || sale.type}</b></p>
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

// ==================== PURCHASES ====================
function initPurchaseModal() {
  const form = document.getElementById("purchaseForm");
  if (form) form.reset();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("purchaseDate").value = today;
  document.getElementById("purchaseEditId").value = "";
  document.getElementById("purchaseModalTitle").textContent = "New Purchase Bill";
  document.getElementById("purchaseItemsContainer").innerHTML = "";
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
  document.getElementById("purchasePaymentStatus").value = purch.paymentStatus || "Paid";
  document.getElementById("purchasePaidAmount").value = purch.paidAmount !== undefined ? purch.paidAmount : (purch.paymentStatus === 'Pending' ? 0 : purch.totalAmount);
  document.getElementById("purchaseModalTitle").textContent = `Edit Purchase (${purch.billNo})`;

  const radio = form.querySelector(`input[name="purchasePaidBy"][value="${purch.paidBy || 'partner1'}"]`);
  if (radio) radio.checked = true;

  togglePurchasePaymentUI();

  const container = document.getElementById("purchaseItemsContainer");
  container.innerHTML = "";

  (purch.items || []).forEach(it => {
    const rowIndex = Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const row = document.createElement("div");
    row.className = "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 purchase-item-row";
    row.id = `purch_row_${rowIndex}`;

    row.innerHTML = `
      <div class="flex-grow">
        <select onchange="onPurchaseProductSelect('${rowIndex}')" id="purch_prod_${rowIndex}" required class="input-pro py-1 text-xs font-semibold">
          <option value="">-- Select Item --</option>
          ${state.products.map(p => `<option value="${p.id}" ${p.id === it.productId ? 'selected' : ''}>${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
        </select>
      </div>
      <div class="w-full sm:w-20">
        <input type="number" id="purch_qty_${rowIndex}" min="1" value="${it.qty}" oninput="calculatePurchaseTotal()" placeholder="Qty" required class="input-pro py-1 text-xs text-center font-bold font-mono">
      </div>
      <div class="w-full sm:w-28">
        <input type="number" id="purch_cost_${rowIndex}" min="0" step="any" value="${it.costPrice}" oninput="calculatePurchaseTotal()" placeholder="Cost ₹" required class="input-pro py-1 text-xs text-right font-bold text-slate-800 font-mono">
      </div>
      <div class="w-full sm:w-24 text-right font-bold text-slate-800 text-xs px-1 flex items-center justify-between sm:justify-end gap-2">
        <span id="purch_subtotal_${rowIndex}" class="font-mono">₹${it.total}</span>
        <button type="button" onclick="removePurchaseItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1" title="Remove">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    container.appendChild(row);
  });

  calculatePurchaseTotal();
  openModal('purchaseModal', 'edit');
}

function addPurchaseItemRow() {
  const container = document.getElementById("purchaseItemsContainer");
  if (!container) return;

  const rowIndex = Date.now() + "_" + Math.random().toString(36).substr(2, 4);

  const row = document.createElement("div");
  row.className = "flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 purchase-item-row";
  row.id = `purch_row_${rowIndex}`;

  row.innerHTML = `
    <div class="flex-grow">
      <select onchange="onPurchaseProductSelect('${rowIndex}')" id="purch_prod_${rowIndex}" required class="input-pro py-1 text-xs font-semibold">
        <option value="">-- Select Item --</option>
        ${state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (Stock: ${p.currentStock})</option>`).join('')}
      </select>
    </div>
    <div class="w-full sm:w-20">
      <input type="number" id="purch_qty_${rowIndex}" min="1" value="10" oninput="calculatePurchaseTotal()" placeholder="Qty" required class="input-pro py-1 text-xs text-center font-bold font-mono">
    </div>
    <div class="w-full sm:w-28">
      <input type="number" id="purch_cost_${rowIndex}" min="0" step="any" oninput="calculatePurchaseTotal()" placeholder="Cost ₹" required class="input-pro py-1 text-xs text-right font-bold text-slate-800 font-mono">
    </div>
    <div class="w-full sm:w-24 text-right font-bold text-slate-800 text-xs px-1 flex items-center justify-between sm:justify-end gap-2">
      <span id="purch_subtotal_${rowIndex}" class="font-mono">₹0</span>
      <button type="button" onclick="removePurchaseItemRow('${rowIndex}')" class="text-slate-400 hover:text-rose-600 p-1" title="Remove">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
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

function calculatePurchaseTotal() {
  const rows = document.querySelectorAll(".purchase-item-row");
  let grandTotal = 0;

  rows.forEach(row => {
    const id = row.id.replace("purch_row_", "");
    const qty = parseFloat(document.getElementById(`purch_qty_${id}`)?.value) || 0;
    const cost = parseFloat(document.getElementById(`purch_cost_${id}`)?.value) || 0;
    const subtotal = qty * cost;
    grandTotal += subtotal;

    const subEl = document.getElementById(`purch_subtotal_${id}`);
    if (subEl) subEl.textContent = formatCurrency(subtotal);
  });

  const dTotal = document.getElementById("purchaseTotalDisplay");
  if (dTotal) dTotal.textContent = formatCurrency(grandTotal);
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
  let grandTotal = 0;

  rows.forEach(row => {
    const id = row.id.replace("purch_row_", "");
    const prodId = document.getElementById(`purch_prod_${id}`).value;
    const qty = parseInt(document.getElementById(`purch_qty_${id}`).value) || 0;
    const costPrice = parseFloat(document.getElementById(`purch_cost_${id}`).value) || 0;

    if (!prodId) return;

    const prod = state.products.find(p => p.id === prodId);
    if (!prod) return;

    const subtotal = qty * costPrice;
    grandTotal += subtotal;

    items.push({
      productId: prod.id,
      productName: prod.name,
      qty,
      costPrice,
      total: subtotal
    });

    prod.currentStock = (Number(prod.currentStock) || 0) + qty;
    if (costPrice > 0) prod.costPrice = costPrice;
  });

  if (items.length === 0) {
    showToast("Please select a valid item!", true);
    return;
  }

  let paidAmount = parseFloat(document.getElementById("purchasePaidAmount").value);
  if (isNaN(paidAmount)) paidAmount = (paymentStatus === 'Paid' ? grandTotal : 0);

  if (paidAmount >= grandTotal) {
    paymentStatus = 'Paid';
    paidAmount = grandTotal;
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
      existing.totalAmount = grandTotal;
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
      totalAmount: grandTotal,
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
  e.preventDefault();
  state.settings.bizName = document.getElementById("settingBizName").value.trim() || "Dwarkadhish Enterprise";
  state.settings.partner1Name = document.getElementById("settingP1Name").value.trim() || "Partner 1 (You)";
  state.settings.partner2Name = document.getElementById("settingP2Name").value.trim() || "Partner 2";
  state.settings.partner1Ratio = parseInt(document.getElementById("settingP1Ratio").value) || 50;
  state.settings.partner2Ratio = parseInt(document.getElementById("settingP2Ratio").value) || 50;

  const fbConfig = document.getElementById("settingFirebaseConfig").value.trim();
  state.settings.firebaseConfig = fbConfig;
  if (fbConfig) {
    localStorage.setItem("FIREBASE_CONFIG_KEY", fbConfig);
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

  // Stock Sheet
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

  // Sales Sheet
  const salesData = [];
  state.sales.forEach(s => {
    const total = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
    const pending = Math.max(0, total - paid);

    (s.items || []).forEach(it => {
      salesData.push({
        "Invoice #": s.invoiceNo,
        "Date": s.date,
        "Type": s.type === 'wholesale' ? 'Wholesale' : 'Online',
        "Channel": s.channel,
        "Customer": s.customerName,
        "Phone": s.customerPhone || '',
        "Product": it.productName,
        "Qty": it.qty,
        "Price (₹)": it.price,
        "Item Total (₹)": it.total,
        "Bill Total (₹)": total,
        "Amount Received (₹)": paid,
        "Pending Due (₹)": pending,
        "Payment Status": s.paymentStatus,
        "Remarks": s.notes || ''
      });
    });
  });
  const wsSales = XLSX.utils.json_to_sheet(salesData);
  XLSX.utils.book_append_sheet(wb, wsSales, "Sales Register");

  // Purchases Sheet
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
        "Bill Total (₹)": total,
        "Amount Paid (₹)": paid,
        "Pending Due (₹)": pending,
        "Payment Status": p.paymentStatus,
        "Remarks": p.notes || ''
      });
    });
  });
  const wsPurch = XLSX.utils.json_to_sheet(purchData);
  XLSX.utils.book_append_sheet(wb, wsPurch, "Purchases");

  // Expenses Sheet
  const expData = state.expenses.map(e => ({
    "Date": e.date,
    "Category": e.category,
    "Amount (₹)": e.amount,
    "Paid By": e.paidBy === 'partner1' ? state.settings.partner1Name : (e.paidBy === 'partner2' ? state.settings.partner2Name : 'Business Account'),
    "Description": e.description || ''
  }));
  const wsExp = XLSX.utils.json_to_sheet(expData);
  XLSX.utils.book_append_sheet(wb, wsExp, "Daily Expenses");

  // Partner Ledger Sheet
  const partnerData = state.partnerTransactions.map(t => ({
    "Date": t.date,
    "Type": t.type === 'capital' ? 'Capital' : 'Settlement',
    "Paid By": t.payer === 'partner1' ? state.settings.partner1Name : state.settings.partner2Name,
    "Received By": t.receiver === 'partner1' ? state.settings.partner1Name : (t.receiver === 'partner2' ? state.settings.partner2Name : 'Business Account'),
    "Amount (₹)": t.amount,
    "Remarks": t.notes || ''
  }));
  const wsPartner = XLSX.utils.json_to_sheet(partnerData);
  XLSX.utils.book_append_sheet(wb, wsPartner, "Partner Ledger");

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `CommerceHub_Master_Report_${dateStr}.xlsx`);
  showToast("Master Excel report downloaded!");
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

function exportSalesToExcel() {
  const salesData = state.sales.map(s => {
    const total = Number(s.totalAmount) || 0;
    const paid = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'Paid' ? total : 0);
    return {
      "Invoice No": s.invoiceNo,
      "Date": s.date,
      "Type": s.type,
      "Channel": s.channel,
      "Customer": s.customerName,
      "Total Amount": total,
      "Paid Amount": paid,
      "Pending Balance": Math.max(0, total - paid),
      "Payment Status": s.paymentStatus
    };
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(salesData);
  XLSX.utils.book_append_sheet(wb, ws, "Sales");
  XLSX.writeFile(wb, `Sales_Report_${Date.now()}.xlsx`);
  showToast("Sales report downloaded!");
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
      if (restored && (restored.products || restored.sales)) {
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
    state = {
      settings: {
        bizName: "CommerceHub Store",
        partner1Name: "Partner 1 (You)",
        partner2Name: "Partner 2",
        partner1Ratio: 50,
        partner2Ratio: 50
      },
      products: [],
      sales: [],
      purchases: [],
      expenses: [],
      adjustments: [],
      partnerTransactions: []
    };
    saveState();
    updatePartnerLabelsInUI();
    refreshAllUI();
    showToast("All data reset successfully!");
  }
}

function refreshAllUI() {
  renderDashboard();
  renderProductsTable();
  renderSalesTable();
  renderPurchasesTable();
  renderExpensesTable();
  setTimeout(init3DTiltEffects, 50);
}

// ==================== 3D TILT & INTERACTION ENGINE ====================
function init3DTiltEffects() {
  const cards = document.querySelectorAll(".pro-card");
  cards.forEach(card => {
    if (card.dataset.tiltInitialized) return;
    card.dataset.tiltInitialized = "true";

    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -10; // 10 deg dynamic tilt
      const rotateY = ((x - centerX) / centerX) * 10;

      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-8px) scale3d(1.02, 1.02, 1.02)`;
      card.style.borderColor = '#94a3b8';
      card.style.borderBottomColor = '#64748b';
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)";
      card.style.borderColor = '#e2e8f0';
      card.style.borderBottomColor = '#cbd5e1';
    });

    card.addEventListener("touchstart", () => {
      card.style.transform = "perspective(1000px) translateY(-5px) scale3d(1.02, 1.02, 1.02)";
    }, { passive: true });

    card.addEventListener("touchend", () => {
      card.style.transform = "perspective(1000px) translateY(0px) scale3d(1, 1, 1)";
    }, { passive: true });
  });
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

