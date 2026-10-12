import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Receipt,
  Users,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Split,
  Utensils,
  ArrowDown,
  Sun,
  Moon,
  Trash2,
  CheckSquare,
  Square,
  CircleDollarSign,
  LayoutDashboard,
  History as HistoryIcon,
  RefreshCw,
  Plus,
  Calendar,
  BookmarkCheck,
  Search,
  ArrowRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

// Storage keys
const ACTIVE_STORAGE_KEY = 'expense_splitter_active_data_v3';
const HISTORY_STORAGE_KEY = 'expense_splitter_history_v3';
const THEME_STORAGE_KEY = 'expense_splitter_theme_v3';

export interface HistoryItem {
  id: string;
  occasion: string;
  date: string;
  timestamp: number;
  totalBill: number;
  participantsCount: number;
  shares: { name: string; share: number; isPaid: boolean }[];
  settlements: { from: string; to: string; amount: number; isSettled: boolean }[];
  isFullySettled: boolean;
}

// Safely load active bill from localStorage
function getStoredActiveData() {
  try {
    const raw = localStorage.getItem(ACTIVE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load active bill from storage:', e);
  }
  return null;
}

// Safely load history from localStorage
function getStoredHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load history from storage:', e);
  }
  // Default sample history items so dashboard has rich initial data
  return [
    {
      id: 'hist-1',
      occasion: 'Bistro Bella Dinner',
      date: 'Yesterday, 8:45 PM',
      timestamp: Date.now() - 86400000,
      totalBill: 3420,
      participantsCount: 4,
      shares: [
        { name: 'Rahul', share: 855, isPaid: true },
        { name: 'Priya', share: 855, isPaid: true },
        { name: 'Amit', share: 855, isPaid: true },
        { name: 'Sneha', share: 855, isPaid: true },
      ],
      settlements: [
        { from: 'Priya', to: 'Rahul', amount: 855, isSettled: true },
        { from: 'Amit', to: 'Rahul', amount: 855, isSettled: true },
        { from: 'Sneha', to: 'Rahul', amount: 855, isSettled: true },
      ],
      isFullySettled: true,
    },
    {
      id: 'hist-2',
      occasion: 'Weekend Rooftop Brunch',
      date: '3 Oct 2026, 1:30 PM',
      timestamp: Date.now() - 172800000,
      totalBill: 2150,
      participantsCount: 3,
      shares: [
        { name: 'Kavya', share: 716.67, isPaid: true },
        { name: 'Arjun', share: 716.67, isPaid: true },
        { name: 'Rohan', share: 716.66, isPaid: false },
      ],
      settlements: [
        { from: 'Arjun', to: 'Kavya', amount: 716.67, isSettled: true },
        { from: 'Rohan', to: 'Kavya', amount: 716.66, isSettled: false },
      ],
      isFullySettled: false,
    },
  ];
}

export default function App() {
  // Navigation tabs: 'dashboard' | 'splitter' | 'history'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'splitter' | 'history'>('splitter');

  // Theme state: dark / light mode
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // fallback
    }
    return 'light';
  });

  // Apply theme class to document
  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
      }
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Load initial stored active state synchronously (IMMUNE TO PAGE RELOAD)
  const initialActive = useMemo(() => getStoredActiveData(), []);

  // Core input states initialized from stored data
  const [occasionName, setOccasionName] = useState<string>(
    () => initialActive?.occasionName ?? 'Dinner with Friends'
  );
  const [billAmountInput, setBillAmountInput] = useState<string>(
    () => initialActive?.billAmountInput ?? '2400'
  );
  const [participantsCountInput, setParticipantsCountInput] = useState<string>(
    () => initialActive?.participantsCountInput ?? '4'
  );

  // Optional tip state
  const [tipPercent, setTipPercent] = useState<number>(() => initialActive?.tipPercent ?? 0);
  const [customTipInput, setCustomTipInput] = useState<string>(
    () => initialActive?.customTipInput ?? ''
  );

  // Primary payer selection or custom payments mode
  const [payerMode, setPayerMode] = useState<'single' | 'custom'>(
    () => initialActive?.payerMode ?? 'single'
  );
  const [singlePayerIndex, setSinglePayerIndex] = useState<number>(
    () => initialActive?.singlePayerIndex ?? 0
  );
  const [customPaidAmounts, setCustomPaidAmounts] = useState<Record<number, string>>(
    () => initialActive?.customPaidAmounts ?? {}
  );

  // Participant custom names
  const [participantNames, setParticipantNames] = useState<Record<number, string>>(
    () =>
      initialActive?.participantNames ?? {
        0: 'Rahul',
        1: 'Priya',
        2: 'Amit',
        3: 'Sneha',
      }
  );

  // "Mark as Paid" status tracking per participant
  const [markedAsPaid, setMarkedAsPaid] = useState<Record<number, boolean>>(
    () => initialActive?.markedAsPaid ?? {}
  );

  // Split calculation submitted state
  const [hasSplitSubmitted, setHasSplitSubmitted] = useState<boolean>(
    () => initialActive?.hasSplitSubmitted ?? true
  );

  // Toggle for "Show what each person paid" view
  const [showPaidBreakdown, setShowPaidBreakdown] = useState<boolean>(
    () => initialActive?.showPaidBreakdown ?? true
  );

  // Split History State
  const [historyList, setHistoryList] = useState<HistoryItem[]>(() => getStoredHistory());
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');

  // UI state for notifications
  const [copied, setCopied] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Ref to results section for smooth scrolling
  const resultsRef = useRef<HTMLDivElement>(null);

  // ALWAYS SAVE active state to localStorage on any modification
  // This guarantees that refreshing/reloading the browser NEVER wipes the calculation!
  useEffect(() => {
    try {
      const dataToSave = {
        occasionName,
        billAmountInput,
        participantsCountInput,
        tipPercent,
        customTipInput,
        payerMode,
        singlePayerIndex,
        customPaidAmounts,
        participantNames,
        markedAsPaid,
        hasSplitSubmitted,
        showPaidBreakdown,
      };
      localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('Failed to save active data:', e);
    }
  }, [
    occasionName,
    billAmountInput,
    participantsCountInput,
    tipPercent,
    customTipInput,
    payerMode,
    singlePayerIndex,
    customPaidAmounts,
    participantNames,
    markedAsPaid,
    hasSplitSubmitted,
    showPaidBreakdown,
  ]);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyList));
    } catch (e) {
      console.error('Failed to save history to storage:', e);
    }
  }, [historyList]);

  // Parse numeric values
  const rawBill = parseFloat(billAmountInput);
  const rawCount = parseInt(participantsCountInput, 10);

  // Validation: empty, zero or negative check
  const isBillInvalid = isNaN(rawBill) || rawBill <= 0 || billAmountInput.trim() === '';
  const isCountInvalid = isNaN(rawCount) || rawCount <= 0 || participantsCountInput.trim() === '';
  const isInvalid = isBillInvalid || isCountInvalid;

  // Tip calculation
  const tipAmount = useMemo(() => {
    if (isBillInvalid) return 0;
    if (customTipInput && !isNaN(parseFloat(customTipInput)) && parseFloat(customTipInput) >= 0) {
      return parseFloat(customTipInput);
    }
    if (tipPercent > 0) {
      return (rawBill * tipPercent) / 100;
    }
    return 0;
  }, [rawBill, tipPercent, customTipInput, isBillInvalid]);

  // Total bill to split in Rupees
  const totalBillToSplit = useMemo(() => {
    if (isBillInvalid) return 0;
    return rawBill + tipAmount;
  }, [rawBill, tipAmount, isBillInvalid]);

  // Exact share calculation down to the rupee and paise
  // Guarantees sum(shares) === totalBillToSplit exactly
  const shareCalculation = useMemo(() => {
    if (isInvalid) return null;

    const totalPaise = Math.round(totalBillToSplit * 100);
    const count = rawCount;

    const baseSharePaise = Math.floor(totalPaise / count);
    const remainderPaise = totalPaise % count;

    // Distribute shares so exact paise are matched
    const shares: {
      index: number;
      name: string;
      share: number;
      sharePaise: number;
      getsExtraPaise: boolean;
      isPaid: boolean;
    }[] = [];

    for (let i = 0; i < count; i++) {
      const extra = i < remainderPaise;
      const sharePaise = baseSharePaise + (extra ? 1 : 0);
      const name = participantNames[i]?.trim() || `Participant ${i + 1}`;
      const isPaid = !!markedAsPaid[i];
      shares.push({
        index: i,
        name,
        share: sharePaise / 100,
        sharePaise,
        getsExtraPaise: extra,
        isPaid,
      });
    }

    const calculatedSumPaise = shares.reduce((acc, curr) => acc + curr.sharePaise, 0);
    const calculatedSum = calculatedSumPaise / 100;
    const isExactMatch = calculatedSumPaise === totalPaise;

    const paidCount = shares.filter((s) => s.isPaid).length;
    const paidAmount = shares.filter((s) => s.isPaid).reduce((acc, s) => acc + s.share, 0);

    return {
      totalPaise,
      totalBill: totalBillToSplit,
      count,
      baseShare: baseSharePaise / 100,
      remainderPaise,
      shares,
      calculatedSum,
      isExactMatch,
      paidCount,
      paidAmount,
      progressPercent: count > 0 ? Math.round((paidCount / count) * 100) : 0,
    };
  }, [isInvalid, totalBillToSplit, rawCount, participantNames, markedAsPaid]);

  // Calculate what each person paid and net balances
  const paymentBreakdown = useMemo(() => {
    if (!shareCalculation) return null;

    const count = rawCount;
    const totalToPay = totalBillToSplit;

    const payments: {
      index: number;
      name: string;
      paid: number;
      share: number;
      netBalance: number;
      isMarkedPaid: boolean;
    }[] = [];

    if (payerMode === 'single') {
      const safePayerIdx = singlePayerIndex < count ? singlePayerIndex : 0;
      for (let i = 0; i < count; i++) {
        const share = shareCalculation.shares[i]?.share || 0;
        const paid = i === safePayerIdx ? totalToPay : 0;
        const net = paid - share;
        payments.push({
          index: i,
          name: shareCalculation.shares[i]?.name || `Participant ${i + 1}`,
          paid,
          share,
          netBalance: net,
          isMarkedPaid: !!markedAsPaid[i],
        });
      }
    } else {
      // Custom paid per person
      for (let i = 0; i < count; i++) {
        const share = shareCalculation.shares[i]?.share || 0;
        const entered = parseFloat(customPaidAmounts[i] || '0');
        const paid = isNaN(entered) || entered < 0 ? 0 : entered;
        const net = paid - share;
        payments.push({
          index: i,
          name: shareCalculation.shares[i]?.name || `Participant ${i + 1}`,
          paid,
          share,
          netBalance: net,
          isMarkedPaid: !!markedAsPaid[i],
        });
      }
    }

    // Settlements
    type Debtor = { name: string; amount: number; index: number };
    type Creditor = { name: string; amount: number; index: number };

    const debtors: Debtor[] = [];
    const creditors: Creditor[] = [];

    payments.forEach((p) => {
      const netPaise = Math.round(p.netBalance * 100);
      if (netPaise < 0) {
        debtors.push({ name: p.name, amount: Math.abs(netPaise), index: p.index });
      } else if (netPaise > 0) {
        creditors.push({ name: p.name, amount: netPaise, index: p.index });
      }
    });

    const settlements: { from: string; to: string; amount: number; isSettled: boolean }[] = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debt = debtors[dIdx].amount;
      const credit = creditors[cIdx].amount;
      const settleAmount = Math.min(debt, credit);

      if (settleAmount > 0) {
        const isSettled = !!markedAsPaid[debtors[dIdx].index];
        settlements.push({
          from: debtors[dIdx].name,
          to: creditors[cIdx].name,
          amount: settleAmount / 100,
          isSettled,
        });
      }

      debtors[dIdx].amount -= settleAmount;
      creditors[cIdx].amount -= settleAmount;

      if (debtors[dIdx].amount === 0) dIdx++;
      if (creditors[cIdx].amount === 0) cIdx++;
    }

    const totalPaidSum = payments.reduce((sum, p) => sum + p.paid, 0);

    return {
      payments,
      settlements,
      totalPaidSum,
    };
  }, [shareCalculation, rawCount, totalBillToSplit, payerMode, singlePayerIndex, customPaidAmounts, markedAsPaid]);

  // Helper to format currency in Indian Rupees format
  const formatRupee = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Handler for 'Split Expense' button
  const handleSplitExpense = () => {
    setHasSplitSubmitted(true);
    showToast('Split updated and verified with exact Rupee precision!');
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // REFRESH BUTTON HANDLER: Refreshes view and calculations WITHOUT wiping data!
  const handleRefreshData = () => {
    // Re-trigger calculation and re-sync without clearing data
    setHasSplitSubmitted(true);
    showToast('Calculations refreshed and up-to-date!');
  };

  // CLEAR ALL: Explicitly clears data ONLY when the user clicks 'Clear All'
  const handleClearAll = () => {
    try {
      localStorage.removeItem(ACTIVE_STORAGE_KEY);
    } catch {
      // ignore
    }
    setOccasionName('');
    setBillAmountInput('');
    setParticipantsCountInput('');
    setTipPercent(0);
    setCustomTipInput('');
    setCustomPaidAmounts({});
    setParticipantNames({});
    setMarkedAsPaid({});
    setSinglePayerIndex(0);
    setHasSplitSubmitted(false);
    showToast('All active bill calculations and inputs cleared!');
  };

  // SAVE CURRENT BILL TO HISTORY
  const handleSaveToHistory = () => {
    if (!shareCalculation || !paymentBreakdown) return;

    const newItem: HistoryItem = {
      id: `split-${Date.now()}`,
      occasion: occasionName.trim() || 'Dinner Split',
      date: new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      timestamp: Date.now(),
      totalBill: shareCalculation.totalBill,
      participantsCount: shareCalculation.count,
      shares: shareCalculation.shares.map((s) => ({
        name: s.name,
        share: s.share,
        isPaid: s.isPaid,
      })),
      settlements: paymentBreakdown.settlements,
      isFullySettled: shareCalculation.paidCount === shareCalculation.count,
    };

    setHistoryList((prev) => [newItem, ...prev]);
    showToast(`Saved "${newItem.occasion}" to History!`);
  };

  // Load a historical split back into the active splitter
  const handleRestoreHistoryItem = (item: HistoryItem) => {
    setOccasionName(item.occasion);
    setBillAmountInput(String(item.totalBill));
    setParticipantsCountInput(String(item.participantsCount));
    setTipPercent(0);
    setCustomTipInput('');

    const newNames: Record<number, string> = {};
    const newPaid: Record<number, boolean> = {};

    item.shares.forEach((s, idx) => {
      newNames[idx] = s.name;
      newPaid[idx] = s.isPaid;
    });

    setParticipantNames(newNames);
    setMarkedAsPaid(newPaid);
    setSinglePayerIndex(0);
    setPayerMode('single');
    setHasSplitSubmitted(true);
    setActiveTab('splitter');
    showToast(`Loaded "${item.occasion}" into Active Splitter!`);
  };

  // Delete an item from history
  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryList((prev) => prev.filter((item) => item.id !== id));
    showToast('Item removed from history.');
  };

  // Toggle "Mark as Paid" for an individual participant
  const toggleMarkAsPaid = (index: number) => {
    setMarkedAsPaid((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Mark all as paid or all as unpaid
  const handleMarkAllPaid = (status: boolean) => {
    if (!shareCalculation) return;
    const updated: Record<number, boolean> = {};
    for (let i = 0; i < shareCalculation.count; i++) {
      updated[i] = status;
    }
    setMarkedAsPaid(updated);
  };

  // Pre-fill sample dinner scenario in Rupees
  const handleLoadSample = (sampleType: 'biryani' | 'pizza' | 'team_lunch') => {
    if (sampleType === 'biryani') {
      setOccasionName('Biryani Night with Friends');
      setBillAmountInput('1850');
      setParticipantsCountInput('4');
      setTipPercent(5);
      setCustomTipInput('');
      setParticipantNames({ 0: 'Rahul', 1: 'Priya', 2: 'Amit', 3: 'Sneha' });
      setMarkedAsPaid({ 0: true, 1: true });
      setSinglePayerIndex(0);
      setPayerMode('single');
    } else if (sampleType === 'pizza') {
      setOccasionName('Friday Pizza Feast');
      setBillAmountInput('1240');
      setParticipantsCountInput('3');
      setTipPercent(0);
      setCustomTipInput('');
      setParticipantNames({ 0: 'Kavya', 1: 'Arjun', 2: 'Rohan' });
      setMarkedAsPaid({ 1: true });
      setSinglePayerIndex(1);
      setPayerMode('single');
    } else {
      setOccasionName('Team Lunch at Barbeque');
      setBillAmountInput('4650');
      setParticipantsCountInput('6');
      setTipPercent(10);
      setCustomTipInput('');
      setParticipantNames({
        0: 'Vikram',
        1: 'Neha',
        2: 'Karan',
        3: 'Pooja',
        4: 'Suresh',
        5: 'Divya',
      });
      setMarkedAsPaid({});
      setSinglePayerIndex(0);
      setPayerMode('single');
    }
    setHasSplitSubmitted(true);
    setActiveTab('splitter');
    showToast('Loaded sample bill into splitter!');
  };

  // Copy share summary for WhatsApp / messaging group chats
  const handleCopySummary = () => {
    if (!shareCalculation || !paymentBreakdown) return;

    let text = `🧾 Expense Splitter: ${occasionName || 'Bill'}\n`;
    text += `💰 Total Bill: ${formatRupee(shareCalculation.totalBill)}\n`;
    text += `👥 Participants: ${shareCalculation.count}\n\n`;
    text += `Individual Real Shares (Exact Split to ${formatRupee(shareCalculation.totalBill)}):\n`;

    shareCalculation.shares.forEach((s) => {
      text += `• ${s.name}: ${formatRupee(s.share)} [${s.isPaid ? 'PAID ✓' : 'PENDING ⏳'}]\n`;
    });

    text += `\n📊 Payment Status: ${shareCalculation.paidCount} of ${shareCalculation.count} paid (${formatRupee(
      shareCalculation.paidAmount
    )} collected)\n`;

    text += `\n💳 What Each Person Paid:\n`;
    paymentBreakdown.payments.forEach((p) => {
      text += `• ${p.name}: Paid ${formatRupee(p.paid)} (Fair share: ${formatRupee(p.share)}) -> ${
        p.netBalance > 0
          ? `Gets back +${formatRupee(p.netBalance)}`
          : p.netBalance < 0
          ? `Owes ${formatRupee(Math.abs(p.netBalance))}`
          : 'Settled'
      }\n`;
    });

    if (paymentBreakdown.settlements.length > 0) {
      text += `\n🤝 Settlement Instructions:\n`;
      paymentBreakdown.settlements.forEach((s) => {
        text += `• ${s.from} ➔ Pay ${formatRupee(s.amount)} to ${s.to} ${s.isSettled ? '(Received ✓)' : ''}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Split summary copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // History filtering
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return historyList;
    const q = historySearchQuery.toLowerCase();
    return historyList.filter(
      (item) =>
        item.occasion.toLowerCase().includes(q) ||
        item.shares.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [historyList, historySearchQuery]);

  // Aggregate stats for Dashboard
  const dashboardStats = useMemo(() => {
    const totalHistoryAmount = historyList.reduce((acc, curr) => acc + curr.totalBill, 0);
    const fullySettledCount = historyList.filter((item) => item.isFullySettled).length;
    const activeAmount = shareCalculation ? shareCalculation.totalBill : 0;
    const activeCollected = shareCalculation ? shareCalculation.paidAmount : 0;
    const activePending = Math.max(0, activeAmount - activeCollected);

    return {
      totalHistoryAmount,
      historyCount: historyList.length,
      fullySettledCount,
      activeAmount,
      activeCollected,
      activePending,
    };
  }, [historyList, shareCalculation]);

  return (
    <div
      className={`min-h-screen font-sans antialiased transition-colors duration-200 ${
        theme === 'dark'
          ? 'bg-slate-950 text-slate-100 selection:bg-slate-800'
          : 'bg-white text-slate-900 selection:bg-slate-200'
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in border border-emerald-500">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header
        className={`border-b sticky top-0 z-30 shadow-xs transition-colors duration-200 ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs transition-colors ${
                theme === 'dark' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-white'
              }`}
            >
              <Split className="w-5 h-5" />
            </div>
            <div>
              <h1
                className={`font-bold text-lg sm:text-xl tracking-tight leading-tight ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}
              >
                Expense Splitter
              </h1>
              <p className={`text-[11px] sm:text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Fair, fast, & exact Rupee (₹) bill splitting
              </p>
            </div>
          </div>

          {/* Action Buttons: Refresh + Dark/Light Mode Toggle + Clear All */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* REFRESH BUTTON: Refresh calculation & view WITHOUT removing data */}
            <button
              type="button"
              onClick={handleRefreshData}
              title="Refresh and recalculate (keeps your data safe)"
              aria-label="Refresh view and calculation"
              className={`text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                theme === 'dark'
                  ? 'border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* DARK / LIGHT MODE TOGGLE KEY (Just beside the refresh button) */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              aria-label="Toggle dark/light mode"
              className={`p-2 rounded-lg border transition-all duration-200 flex items-center justify-center cursor-pointer shadow-2xs ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700 hover:text-amber-200'
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* CLEAR ALL BUTTON: Clears all calculations & data when bill is done */}
            <button
              type="button"
              onClick={handleClearAll}
              title="Clear all calculations and data when bill is done"
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar for Dashboard, Splitter & History */}
        <div
          className={`border-t px-4 sm:px-6 transition-colors duration-200 ${
            theme === 'dark' ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50/70'
          }`}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <nav className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto">
              {/* Tab 1: Dashboard */}
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  activeTab === 'dashboard'
                    ? theme === 'dark'
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'bg-slate-900 text-white shadow-xs'
                    : theme === 'dark'
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              {/* Tab 2: Splitter (Active Bill) */}
              <button
                type="button"
                onClick={() => setActiveTab('splitter')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  activeTab === 'splitter'
                    ? theme === 'dark'
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'bg-slate-900 text-white shadow-xs'
                    : theme === 'dark'
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>Splitter</span>
                {!isInvalid && shareCalculation && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    {formatRupee(shareCalculation.totalBill)}
                  </span>
                )}
              </button>

              {/* Tab 3: History & Tracking */}
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  activeTab === 'history'
                    ? theme === 'dark'
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'bg-slate-900 text-white shadow-xs'
                    : theme === 'dark'
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <HistoryIcon className="w-3.5 h-3.5" />
                <span>Split History</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {historyList.length}
                </span>
              </button>
            </nav>

            {/* Quick Demo Presets */}
            <div className="hidden md:flex items-center gap-1.5 pl-2 text-xs">
              <span className={`font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Presets:
              </span>
              <button
                type="button"
                onClick={() => handleLoadSample('biryani')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-200/80 hover:bg-slate-200 text-slate-800'
                }`}
              >
                Biryani 4x
              </button>
              <button
                type="button"
                onClick={() => handleLoadSample('pizza')}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-200/80 hover:bg-slate-200 text-slate-800'
                }`}
              >
                Pizza 3x
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* ============================================================== */}
        {/* VIEW 1: DASHBOARD (Accessible Overview of All Features & Stats) */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* Dashboard Hero Banner */}
            <div
              className={`rounded-2xl border p-6 sm:p-8 shadow-sm transition-colors duration-200 ${
                theme === 'dark'
                  ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800'
                  : 'bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-3">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Splitter Overview & Control Center
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Dinner Bill Command Dashboard
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mt-1 leading-relaxed">
                    Track your current active bill, view collection progress, record payments, and inspect past split history—all in one place.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('splitter')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <Split className="w-4 h-4" />
                    <span>Open Splitter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2.5 rounded-xl border font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                      theme === 'dark'
                        ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <HistoryIcon className="w-4 h-4 text-emerald-500" />
                    <span>View History</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Active Bill */}
              <div
                className={`p-5 rounded-2xl border shadow-xs transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>Active Bill</span>
                  <Receipt className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-emerald-500">
                  {formatRupee(dashboardStats.activeAmount)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {occasionName.trim() || 'No active dinner'} ({participantsCountInput || 0} people)
                </p>
              </div>

              {/* Card 2: Collected vs Pending */}
              <div
                className={`p-5 rounded-2xl border shadow-xs transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>Collected</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatRupee(dashboardStats.activeCollected)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Pending: <span className="font-semibold text-amber-500">{formatRupee(dashboardStats.activePending)}</span>
                </p>
              </div>

              {/* Card 3: Tracked Splits */}
              <div
                className={`p-5 rounded-2xl border shadow-xs transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>Tracked Splits</span>
                  <BookmarkCheck className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-extrabold font-mono">
                  {dashboardStats.historyCount}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {dashboardStats.fullySettledCount} completely settled
                </p>
              </div>

              {/* Card 4: Total Tracked Amount */}
              <div
                className={`p-5 rounded-2xl border shadow-xs transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>Lifetime Tracked</span>
                  <CircleDollarSign className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-amber-500">
                  {formatRupee(dashboardStats.totalHistoryAmount)}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Across all saved dinner events
                </p>
              </div>
            </div>

            {/* Quick Actions & Recent History Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Active Bill Quick Widget */}
              <div
                className={`lg:col-span-6 p-6 rounded-2xl border shadow-sm transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Split className="w-4 h-4 text-emerald-500" />
                    Active Bill Snapshot
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('splitter')}
                    className="text-xs font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Edit Bill</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {!isInvalid && shareCalculation ? (
                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-xl border flex items-center justify-between ${
                        theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Event Name</p>
                        <p className="text-base font-bold truncate max-w-[220px]">
                          {occasionName.trim() || 'Dinner'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {shareCalculation.count} participants added
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-medium">Total Bill</p>
                        <p className="text-xl font-extrabold font-mono text-emerald-500">
                          {formatRupee(shareCalculation.totalBill)}
                        </p>
                      </div>
                    </div>

                    {/* Collection Status */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span>Paid Status:</span>
                        <span className="text-emerald-500">
                          {shareCalculation.paidCount} of {shareCalculation.count} paid ({shareCalculation.progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${shareCalculation.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveToHistory}
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span>Save to History</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopySummary}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          theme === 'dark'
                            ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                            : 'border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Summary</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-xs text-slate-400 mb-3">No active bill calculated yet.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('splitter')}
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Start New Split
                    </button>
                  </div>
                )}
              </div>

              {/* Recent History Preview Widget */}
              <div
                className={`lg:col-span-6 p-6 rounded-2xl border shadow-sm transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-emerald-500" />
                    Recent Split History
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All ({historyList.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {historyList.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleRestoreHistoryItem(item)}
                      className={`p-3.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-sm leading-tight truncate max-w-[200px]">
                          {item.occasion}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {item.date} • {item.participantsCount} people
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-sm text-emerald-500">
                          {formatRupee(item.totalBill)}
                        </p>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            item.isFullySettled
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {item.isFullySettled ? 'Settled ✓' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: ACTIVE SPLITTER (The Full Precision Splitter Engine)   */}
        {/* ============================================================== */}
        {activeTab === 'splitter' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start animate-fade-in">
            {/* LEFT COLUMN: Input Form */}
            <div className="lg:col-span-5 space-y-6">
              <div
                className={`rounded-2xl border p-5 sm:p-6 shadow-sm transition-colors duration-200 ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2
                    className={`text-base font-bold flex items-center gap-2 ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    <Receipt className="w-4 h-4 text-emerald-500" />
                    Bill & Participant Details
                  </h2>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Currency: INR (₹)
                  </span>
                </div>

                <div className="space-y-4">
                  {/* 1. Occasion Name */}
                  <div>
                    <label
                      htmlFor="occasion"
                      className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      1. Occasion Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Utensils className="w-4 h-4" />
                      </div>
                      <input
                        id="occasion"
                        type="text"
                        placeholder="e.g. Dinner with Friends, Cafe Chill..."
                        value={occasionName}
                        onChange={(e) => setOccasionName(e.target.value)}
                        className={`w-full pl-10 pr-3.5 py-2.5 border rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                          theme === 'dark'
                            ? 'bg-slate-800 border-slate-700 text-white focus:ring-emerald-500 focus:border-emerald-500'
                            : 'bg-white border-slate-300 text-slate-900 focus:ring-slate-900 focus:border-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  {/* 2. Bill Amount in Rupees */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="billAmount"
                        className={`block text-xs font-bold uppercase tracking-wider ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        2. Bill Amount (in ₹)
                      </label>
                      <span className="text-xs text-slate-400">Required</span>
                    </div>
                    <div className="relative">
                      <div
                        className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-base ${
                          theme === 'dark' ? 'text-emerald-400' : 'text-slate-700'
                        }`}
                      >
                        ₹
                      </div>
                      <input
                        id="billAmount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={billAmountInput}
                        onChange={(e) => setBillAmountInput(e.target.value)}
                        className={`w-full pl-9 pr-3.5 py-2.5 border rounded-xl text-base font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 transition ${
                          isBillInvalid && billAmountInput !== ''
                            ? 'border-red-400 focus:ring-red-400'
                            : theme === 'dark'
                            ? 'bg-slate-800 border-slate-700 text-white focus:ring-emerald-500 focus:border-emerald-500'
                            : 'bg-white border-slate-300 text-slate-900 focus:ring-slate-900 focus:border-slate-900'
                        }`}
                      />
                    </div>
                    {isBillInvalid && billAmountInput !== '' && (
                      <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Bill must be a positive number in ₹ greater than 0
                      </p>
                    )}
                  </div>

                  {/* Optional Tip in Rupees */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Tip / Extra Charges (Optional)
                      </span>
                      {tipAmount > 0 && (
                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                          +{formatRupee(tipAmount)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0, 5, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setTipPercent(pct);
                            setCustomTipInput('');
                          }}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                            tipPercent === pct && customTipInput === ''
                              ? theme === 'dark'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-bold'
                                : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : theme === 'dark'
                              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {pct === 0 ? 'None' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Number of Participants */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="participantsCount"
                        className={`block text-xs font-bold uppercase tracking-wider ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        3. Number of Participants
                      </label>
                      <span className="text-xs text-slate-400">Min 1 person</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(participantsCountInput || '0', 10);
                          if (current > 1) {
                            setParticipantsCountInput(String(current - 1));
                          }
                        }}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-lg transition cursor-pointer ${
                          theme === 'dark'
                            ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-white'
                            : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        −
                      </button>
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Users className="w-4 h-4" />
                        </div>
                        <input
                          id="participantsCount"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 4"
                          value={participantsCountInput}
                          onChange={(e) => setParticipantsCountInput(e.target.value)}
                          className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-center text-base font-semibold focus:outline-none focus:ring-2 transition ${
                            isCountInvalid && participantsCountInput !== ''
                              ? 'border-red-400 focus:ring-red-400'
                              : theme === 'dark'
                              ? 'bg-slate-800 border-slate-700 text-white focus:ring-emerald-500 focus:border-emerald-500'
                              : 'bg-white border-slate-300 text-slate-900 focus:ring-slate-900 focus:border-slate-900'
                          }`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(participantsCountInput || '0', 10);
                          setParticipantsCountInput(String(Math.max(1, current + 1)));
                        }}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-lg transition cursor-pointer ${
                          theme === 'dark'
                            ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-white'
                            : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        +
                      </button>
                    </div>

                    {isCountInvalid && participantsCountInput !== '' && (
                      <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Participants count must be 1 or more
                      </p>
                    )}

                    {/* Quick Select Chips */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className="text-xs text-slate-400">Quick:</span>
                      {[2, 3, 4, 5, 6, 8].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setParticipantsCountInput(String(num))}
                          className={`text-xs px-2.5 py-1 rounded-md border font-medium transition cursor-pointer ${
                            rawCount === num
                              ? theme === 'dark'
                                ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-bold'
                                : 'bg-slate-900 text-white border-slate-900'
                              : theme === 'dark'
                              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Edit Participant Names */}
                  {!isCountInvalid && rawCount > 0 && rawCount <= 12 && (
                    <div className={`pt-2 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                      <p className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        Participant Names (Optional):
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: rawCount }).map((_, idx) => (
                          <input
                            key={idx}
                            type="text"
                            placeholder={`Person ${idx + 1}`}
                            value={participantNames[idx] ?? `Person ${idx + 1}`}
                            onChange={(e) =>
                              setParticipantNames((prev) => ({
                                ...prev,
                                [idx]: e.target.value,
                              }))
                            }
                            className={`px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 ${
                              theme === 'dark'
                                ? 'bg-slate-800 border-slate-700 text-slate-100 focus:ring-emerald-500'
                                : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:ring-slate-900'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 'SPLIT EXPENSE' OPTION BUTTON */}
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handleSplitExpense}
                      className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all transform active:scale-[0.99] cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <Split className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-950' : 'text-emerald-400'}`} />
                      <span>Split Expense</span>
                      <ArrowDown className="w-4 h-4 ml-1 hidden sm:inline" />
                    </button>
                    <p className="text-[11px] text-center text-slate-400 mt-1.5">
                      Directly reveals the exact Rupee split for each participant added
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Summary Pill in Rupees */}
              {!isInvalid && shareCalculation && (
                <div
                  className={`border rounded-2xl p-5 shadow-xs flex items-center justify-between transition-colors ${
                    theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <p className="text-xs font-medium text-slate-400">Occasion</p>
                    <p className={`text-sm font-bold truncate max-w-[180px] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {occasionName.trim() || 'Dinner'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-400">Total in Rupees</p>
                    <p className="text-lg font-extrabold font-mono text-emerald-500">
                      {formatRupee(shareCalculation.totalBill)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Results, Real Split Display, Mark as Paid & Save to History */}
            <div ref={resultsRef} className="lg:col-span-7 space-y-6 scroll-mt-20">
              
              {/* CORE FEATURE 4: Show "no result" if bill or no of people is empty, zero or negative */}
              {isInvalid || !hasSplitSubmitted ? (
                <div
                  className={`rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center shadow-xs transition-colors ${
                    theme === 'dark'
                      ? 'bg-slate-900/50 border-slate-800 text-slate-300'
                      : 'bg-white border-slate-300 text-slate-600'
                  }`}
                >
                  <div
                    className={`w-16 h-16 mx-auto rounded-2xl border flex items-center justify-center mb-4 ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-slate-400'
                        : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  >
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    no result
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
                    {isBillInvalid && isCountInvalid
                      ? 'Please enter a valid bill amount greater than ₹0.00 and at least 1 participant, then click Split Expense.'
                      : isBillInvalid
                      ? 'The bill amount is empty, zero, or negative. Please enter a valid positive amount in Rupees (₹).'
                      : isCountInvalid
                      ? 'The number of participants is empty, zero, or negative. Please specify at least 1 person.'
                      : 'Click the "Split Expense" button to calculate the real split among participants.'}
                  </p>

                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Auto-saved: Refreshing or reloading the page will never lose your calculation
                  </div>
                </div>
              ) : (
                shareCalculation && (
                  <>
                    {/* REAL SPLIT DISPLAY WITH MENTIONED AMOUNT & MARK AS PAID */}
                    <div
                      className={`rounded-2xl border p-5 sm:p-6 shadow-sm transition-colors duration-200 ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div
                        className={`flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b gap-3 ${
                          theme === 'dark' ? 'border-slate-800' : 'border-slate-100'
                        }`}
                      >
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Real Split Calculated
                          </span>
                          <h2 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {occasionName.trim() || 'Dinner'} Split ({shareCalculation.count} Participants)
                          </h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* SAVE TO HISTORY BUTTON */}
                          <button
                            type="button"
                            onClick={handleSaveToHistory}
                            title="Save this split to history for future tracking"
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            <span>Save to History</span>
                          </button>

                          {/* COPY SUMMARY BUTTON */}
                          <button
                            type="button"
                            onClick={handleCopySummary}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer ${
                              theme === 'dark'
                                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Settlement Progress Bar (Mark as Paid tracker) */}
                      <div
                        className={`mt-5 p-4 rounded-xl border ${
                          theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-medium mb-2 gap-1.5">
                          <div className="flex items-center gap-2">
                            <CircleDollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className={theme === 'dark' ? 'text-slate-200 font-bold' : 'text-slate-800 font-bold'}>
                              Collection Progress:
                            </span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {shareCalculation.paidCount} of {shareCalculation.count} participants paid ({shareCalculation.progressPercent}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleMarkAllPaid(true)}
                              className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                            >
                              Mark All Paid
                            </button>
                            <span className="text-slate-400">•</span>
                            <button
                              type="button"
                              onClick={() => handleMarkAllPaid(false)}
                              className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                            >
                              Clear All Paid
                            </button>
                          </div>
                        </div>

                        {/* Progress Track */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden mb-2">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${shareCalculation.progressPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Collected: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatRupee(shareCalculation.paidAmount)}</strong></span>
                          <span>Pending: <strong className="font-mono text-amber-500">{formatRupee(Math.max(0, shareCalculation.totalBill - shareCalculation.paidAmount))}</strong></span>
                        </div>
                      </div>

                      {/* Exact Rupee Verification Box */}
                      <div
                        className={`mt-4 p-4 rounded-xl border ${
                          theme === 'dark' ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-medium mb-1.5 gap-1">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <strong className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>
                              Exact Rupee & Paise Guarantee:
                            </strong>
                          </span>
                          <span className="font-mono font-bold text-emerald-500 text-sm">
                            Sum of shares = {formatRupee(shareCalculation.calculatedSum)}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          Total bill of{' '}
                          <span className="font-semibold text-emerald-500">{formatRupee(shareCalculation.totalBill)}</span> is
                          divided among{' '}
                          <span className="font-semibold">{shareCalculation.count} participants</span>. All remainder paise
                          are balanced so the shares match <strong>exactly to {formatRupee(shareCalculation.totalBill)} with zero difference</strong>.
                        </p>
                      </div>

                      {/* Real Split: Each Added Participant with their Exact Mentioned Amount & "Mark as Paid" option */}
                      <div className="mt-5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Individual Share for Each Participant ({shareCalculation.count} Added)
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            Toggle &apos;Mark as Paid&apos; when settled
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {shareCalculation.shares.map((person) => {
                            const isPaid = person.isPaid;
                            return (
                              <div
                                key={person.index}
                                className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 shadow-2xs ${
                                  isPaid
                                    ? theme === 'dark'
                                      ? 'bg-emerald-950/20 border-emerald-800/60'
                                      : 'bg-emerald-50/60 border-emerald-200'
                                    : theme === 'dark'
                                    ? 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                        isPaid
                                          ? 'bg-emerald-500 text-slate-950'
                                          : theme === 'dark'
                                          ? 'bg-slate-700 text-white'
                                          : 'bg-slate-900 text-white'
                                      }`}
                                    >
                                      {isPaid ? <Check className="w-4 h-4" /> : person.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p
                                        className={`text-sm font-bold leading-tight truncate ${
                                          isPaid
                                            ? 'text-emerald-700 dark:text-emerald-300 line-through decoration-emerald-500/50'
                                            : theme === 'dark'
                                            ? 'text-white'
                                            : 'text-slate-900'
                                        }`}
                                      >
                                        {person.name}
                                      </p>
                                      <p className="text-[11px] text-slate-400">
                                        {person.getsExtraPaise ? 'Share (+₹0.01 rounded)' : 'Equal share'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right pl-2">
                                    <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                                      {formatRupee(person.share)}
                                    </span>
                                  </div>
                                </div>

                                {/* MARK AS PAID OPTION BUTTON */}
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => toggleMarkAsPaid(person.index)}
                                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                                      isPaid
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                        : theme === 'dark'
                                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {isPaid ? (
                                      <>
                                        <CheckSquare className="w-4 h-4 text-white" />
                                        <span>Marked as Paid ✓</span>
                                      </>
                                    ) : (
                                      <>
                                        <Square className="w-4 h-4 text-slate-400" />
                                        <span>Mark as Paid</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Total Verification Row */}
                        <div
                          className={`mt-4 pt-3 border-t flex items-center justify-between text-xs sm:text-sm ${
                            theme === 'dark' ? 'border-slate-800' : 'border-slate-100'
                          }`}
                        >
                          <span className={`font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                            Total of All Shares:
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                              Exact Match ✓
                            </span>
                            <span className="font-mono font-extrabold text-base sm:text-lg text-emerald-500">
                              {formatRupee(shareCalculation.calculatedSum)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* CORE FEATURE 3: Button to show what each person paid */}
                    <div
                      className={`rounded-2xl border p-5 sm:p-6 shadow-sm transition-colors duration-200 ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            <CreditCard className="w-4 h-4 text-emerald-500" />
                            Payment & Settlement Details
                          </h3>
                          <p className="text-xs text-slate-400">
                            See who paid what and calculate who owes whom in ₹
                          </p>
                        </div>

                        {/* BUTTON TO SHOW WHAT EACH PERSON PAID */}
                        <button
                          type="button"
                          onClick={() => setShowPaidBreakdown((prev) => !prev)}
                          className={`px-4 py-2 rounded-xl border font-semibold text-xs transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer ${
                            theme === 'dark'
                              ? 'border-slate-700 hover:border-slate-600 bg-slate-800 text-slate-200'
                              : 'border-slate-300 hover:border-slate-900 bg-white text-slate-800'
                          }`}
                        >
                          <span>{showPaidBreakdown ? 'Hide Payment Breakdown' : 'Show What Each Person Paid'}</span>
                          {showPaidBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Breakdown section toggled by the button */}
                      {showPaidBreakdown && paymentBreakdown && (
                        <div className={`mt-5 pt-5 border-t space-y-5 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                          
                          {/* Who Paid Configuration */}
                          <div
                            className={`rounded-xl p-4 border ${
                              theme === 'dark' ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Who Paid The Bill At The Restaurant?
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPayerMode('single')}
                                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                                    payerMode === 'single'
                                      ? theme === 'dark'
                                        ? 'bg-emerald-500 text-slate-950 font-bold'
                                        : 'bg-slate-900 text-white'
                                      : theme === 'dark'
                                      ? 'bg-slate-700 text-slate-300'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  One person paid all
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPayerMode('custom')}
                                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                                    payerMode === 'custom'
                                      ? theme === 'dark'
                                        ? 'bg-emerald-500 text-slate-950 font-bold'
                                        : 'bg-slate-900 text-white'
                                      : theme === 'dark'
                                      ? 'bg-slate-700 text-slate-300'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  Multiple paid
                                </button>
                              </div>
                            </div>

                            {payerMode === 'single' ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {shareCalculation.shares.map((person) => (
                                  <button
                                    key={person.index}
                                    type="button"
                                    onClick={() => setSinglePayerIndex(person.index)}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                                      singlePayerIndex === person.index
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                                        : theme === 'dark'
                                        ? 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {person.name} paid full ({formatRupee(shareCalculation.totalBill)})
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs text-slate-400">
                                  Enter the amount in ₹ paid by each person at the counter:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {shareCalculation.shares.map((person) => (
                                    <div
                                      key={person.index}
                                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                                        theme === 'dark'
                                          ? 'bg-slate-800 border-slate-700'
                                          : 'bg-white border-slate-200'
                                      }`}
                                    >
                                      <span className="text-xs font-medium truncate">
                                        {person.name}
                                      </span>
                                      <div className="relative w-32">
                                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-xs text-slate-400 font-bold">
                                          ₹
                                        </span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder="0.00"
                                          value={customPaidAmounts[person.index] ?? ''}
                                          onChange={(e) =>
                                            setCustomPaidAmounts((prev) => ({
                                              ...prev,
                                              [person.index]: e.target.value,
                                            }))
                                          }
                                          className={`w-full pl-5 pr-2 py-1 text-xs text-right border rounded font-semibold focus:outline-none focus:ring-1 ${
                                            theme === 'dark'
                                              ? 'bg-slate-900 border-slate-600 text-white focus:ring-emerald-500'
                                              : 'bg-white border-slate-200 text-slate-900 focus:ring-slate-900'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* What Each Person Paid Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[500px]">
                              <thead>
                                <tr className={`border-b text-[11px] font-bold uppercase tracking-wider text-slate-400 ${
                                  theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
                                }`}>
                                  <th className="py-2.5 px-3">Participant</th>
                                  <th className="py-2.5 px-3 text-right">What They Paid</th>
                                  <th className="py-2.5 px-3 text-right">Their Fair Share</th>
                                  <th className="py-2.5 px-3 text-right">Status / Paid Status</th>
                                </tr>
                              </thead>
                              <tbody className={`divide-y text-xs ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                {paymentBreakdown.payments.map((p) => {
                                  const getsBack = p.netBalance > 0.001;
                                  const owes = p.netBalance < -0.001;
                                  return (
                                    <tr key={p.index} className={theme === 'dark' ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/50'}>
                                      <td className={`py-3 px-3 font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        <div className="flex items-center gap-1.5">
                                          <span>{p.name}</span>
                                          {p.isMarkedPaid && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                              Paid ✓
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono font-medium">
                                        {formatRupee(p.paid)}
                                      </td>
                                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                                        {formatRupee(p.share)}
                                      </td>
                                      <td className="py-3 px-3 text-right">
                                        {getsBack && (
                                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                                            Gets back +{formatRupee(p.netBalance)}
                                          </span>
                                        )}
                                        {owes && (
                                          <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                                            Owes {formatRupee(Math.abs(p.netBalance))}
                                          </span>
                                        )}
                                        {!getsBack && !owes && (
                                          <span className="font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                            Settled (₹0.00)
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Settlement Matrix (Who Pays Whom) */}
                          {paymentBreakdown.settlements.length > 0 && (
                            <div className={`pt-3 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                                Settlement Transfers (Direct Pay Instructions):
                              </h4>
                              <div className="space-y-2">
                                {paymentBreakdown.settlements.map((settle, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className={`p-3 border rounded-xl flex items-center justify-between text-xs ${
                                      settle.isSettled
                                        ? theme === 'dark'
                                          ? 'bg-emerald-950/20 border-emerald-800/40 opacity-75'
                                          : 'bg-emerald-50/50 border-emerald-200 opacity-80'
                                        : theme === 'dark'
                                        ? 'bg-slate-800 border-slate-700'
                                        : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {settle.from}
                                      </span>
                                      <span className="text-slate-400">pays</span>
                                      <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                        {settle.to}
                                      </span>
                                      {settle.isSettled && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 ml-1">
                                          Received ✓
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono font-extrabold text-sm text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                                      {formatRupee(settle.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: SPLIT HISTORY (Track past bills, dates & payments)     */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-fade-in">
            {/* History Header & Search */}
            <div
              className={`rounded-2xl border p-6 shadow-sm transition-colors duration-200 ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-emerald-500" />
                    Split History & Tracking
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Every dinner split saved is recorded here. Click any record to reload it into the active calculator.
                  </p>
                </div>

                {/* Search in History */}
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by occasion or name..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-1 ${
                      theme === 'dark'
                        ? 'bg-slate-800 border-slate-700 text-white focus:ring-emerald-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:ring-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* History List */}
            {filteredHistory.length > 0 ? (
              <div className="space-y-4">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-5 shadow-xs transition-colors hover:shadow-md ${
                      theme === 'dark'
                        ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold">{item.occasion}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.isFullySettled
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {item.isFullySettled ? 'Fully Settled ✓' : 'Settlement Pending'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{item.date}</span>
                          <span>•</span>
                          <span>{item.participantsCount} participants</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Total Bill</p>
                          <p className="text-xl font-extrabold font-mono text-emerald-500">
                            {formatRupee(item.totalBill)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pl-3 border-l border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleRestoreHistoryItem(item)}
                            title="Load into active splitter"
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                          >
                            <Split className="w-3.5 h-3.5" />
                            <span>Load</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                            title="Delete this record"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Participant Shares Grid */}
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Shares & Payment Status:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {item.shares.map((s, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                              s.isPaid
                                ? theme === 'dark'
                                  ? 'bg-emerald-950/20 border-emerald-900/60'
                                  : 'bg-emerald-50/70 border-emerald-200'
                                : theme === 'dark'
                                ? 'bg-slate-800/60 border-slate-700'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <span className="truncate font-medium">{s.name}</span>
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              <span className="font-mono font-bold">{formatRupee(s.share)}</span>
                              {s.isPaid ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <span className="text-[10px] text-amber-500 font-bold">⏳</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`rounded-2xl border-2 border-dashed p-12 text-center shadow-xs ${
                  theme === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-300'
                }`}
              >
                <HistoryIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold mb-1">No split history found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  {historySearchQuery
                    ? `No split records matched "${historySearchQuery}". Try clearing search.`
                    : 'Calculate a dinner split in the Splitter tab and click "Save to History" to track it here.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('splitter')}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Go to Splitter
                </button>
              </div>
            )}
          </div>
        )}

        {/* Feature Highlights Footer */}
        <section className={`mt-16 pt-8 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className={`font-bold mb-1 flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <LayoutDashboard className="w-4 h-4 text-emerald-500" />
                Feature Dashboard
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Centralized dashboard showing metrics, collection progress, active bill status, and quick shortcuts.
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className={`font-bold mb-1 flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <HistoryIcon className="w-4 h-4 text-emerald-500" />
                Split History Tracking
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Save and track past dinner splits with exact participant shares, dates, and settlement records.
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className={`font-bold mb-1 flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Reload Immune Persistence
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Reloading or refreshing the page will never wipe your data. Refresh safely recalculates.
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <h4 className={`font-bold mb-1 flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                <Trash2 className="w-4 h-4 text-rose-500" />
                &apos;Clear All&apos; Button
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Cleanly wipe all calculations and active data when dinner is finished and settled.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
