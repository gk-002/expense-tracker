import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Receipt,
  Users,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Split,
  Utensils,
  Sun,
  Moon,
  Trash2,
  CheckSquare,
  Square,
  CircleDollarSign,
  LayoutDashboard,
  History as HistoryIcon,
  RefreshCw,
  Calendar,
  BookmarkCheck,
  Search,
  ArrowRight,
  TrendingUp,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  LogIn,
  LogOut,
  QrCode,
  ExternalLink,
  Laptop,
  CloudCheck,
  Edit3
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  auth,
  db,
  signInWithGoogle,
  logOut,
  testConnection,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Storage keys
const ACTIVE_STORAGE_KEY = 'expense_splitter_active_data_v5';
const HISTORY_STORAGE_KEY = 'expense_splitter_history_v5';
const THEME_STORAGE_KEY = 'expense_splitter_theme_v5';
const UPI_STORAGE_KEY = 'expense_splitter_upi_ids_v5';

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
  ownerId?: string;
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
    console.error('Failed to load active bill:', e);
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
    console.error('Failed to load history:', e);
  }
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

// Safely load UPI IDs from localStorage
function getStoredUpiIds(): Record<string, string> {
  try {
    const raw = localStorage.getItem(UPI_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    Rahul: 'rahul@okaxis',
    Priya: 'priya@upi',
    Amit: 'amit@paytm',
    Sneha: 'sneha@ybl',
  };
}

// Download helper function
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function App() {
  // Navigation tabs: 'dashboard' | 'splitter' | 'history'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'splitter' | 'history'>('splitter');

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Modals state
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);

  // UPI QR Code Modal State
  const [selectedUpiModal, setSelectedUpiModal] = useState<{
    payeeName: string;
    payerName?: string;
    amount: number;
    upiId: string;
    note: string;
  } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isEditingUpiId, setIsEditingUpiId] = useState<boolean>(false);
  const [customUpiInput, setCustomUpiInput] = useState<string>('');

  // UPI IDs mapped by participant name
  const [upiIds, setUpiIds] = useState<Record<string, string>>(() => getStoredUpiIds());

  // Save UPI IDs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(UPI_STORAGE_KEY, JSON.stringify(upiIds));
    } catch {
      // ignore
    }
  }, [upiIds]);

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

  // Test Firestore connection on boot
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        try {
          await setDoc(
            userRef,
            {
              id: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'User',
              photoURL: user.photoURL || '',
              createdAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.warn('Could not sync user profile to Firestore:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Load initial stored active state synchronously (IMMUNE TO PAGE RELOAD)
  const initialActive = useMemo(() => getStoredActiveData(), []);

  // Core input states
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

  // Payer selection or custom payments mode
  const [payerMode, setPayerMode] = useState<'single' | 'custom'>(
    () => initialActive?.payerMode ?? 'single'
  );
  const [singlePayerIndex, setSinglePayerIndex] = useState<number>(
    () => initialActive?.singlePayerIndex ?? 0
  );
  const [customPaidAmounts, setCustomPaidAmounts] = useState<Record<number, string>>(
    () => initialActive?.customPaidAmounts ?? {}
  );

  // Participant names
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

  // Real-time Firestore sync for Split History when authenticated
  useEffect(() => {
    if (!currentUser) return;

    const path = `users/${currentUser.uid}/splits`;
    const splitsCol = collection(db, 'users', currentUser.uid, 'splits');

    const unsubscribe = onSnapshot(
      splitsCol,
      (snapshot) => {
        const firestoreSplits: HistoryItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          firestoreSplits.push({
            id: docSnap.id,
            occasion: data.occasion || 'Dinner Split',
            date: data.date || '',
            timestamp: data.timestamp || Date.now(),
            totalBill: data.totalBill || 0,
            participantsCount: data.participantsCount || 1,
            shares: data.shares || [],
            settlements: data.settlements || [],
            isFullySettled: !!data.isFullySettled,
            ownerId: data.ownerId,
          });
        });

        if (firestoreSplits.length > 0) {
          firestoreSplits.sort((a, b) => b.timestamp - a.timestamp);
          setHistoryList(firestoreSplits);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Toast notification
  const [copied, setCopied] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Ref to results section for smooth scrolling
  const resultsRef = useRef<HTMLDivElement>(null);

  // Always save active state to localStorage
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
      console.error('Failed to save history:', e);
    }
  }, [historyList]);

  // Parse numeric values
  const rawBill = parseFloat(billAmountInput);
  const rawCount = parseInt(participantsCountInput, 10);

  // Strict validation
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

  // Total bill to split
  const totalBillToSplit = useMemo(() => {
    if (isBillInvalid) return 0;
    return rawBill + tipAmount;
  }, [rawBill, tipAmount, isBillInvalid]);

  // Exact share calculation down to the rupee and paise
  const shareCalculation = useMemo(() => {
    if (isInvalid) return null;

    const totalPaise = Math.round(totalBillToSplit * 100);
    const count = rawCount;

    const baseSharePaise = Math.floor(totalPaise / count);
    const remainderPaise = totalPaise % count;

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

  // Calculate payments and net balances
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

  // Format currency in Indian Rupees format
  const formatRupee = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Google Login Handler
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      showToast('Signed in with Google');
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      showToast('Sign in was interrupted. Please try again.');
    }
  };

  // Log Out Handler
  const handleSignOut = async () => {
    try {
      await logOut();
      showToast('Signed out successfully');
    } catch (error) {
      console.error('Sign-Out failed:', error);
    }
  };

  // Split Expense Trigger
  const handleSplitExpense = () => {
    setHasSplitSubmitted(true);
    showToast('Split calculated with exact precision');
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // Refresh Trigger
  const handleRefreshData = () => {
    setHasSplitSubmitted(true);
    showToast('Ledger refreshed');
  };

  // Clear All
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
    showToast('Active bill cleared');
  };

  // Save to History (local + Firestore)
  const handleSaveToHistory = async () => {
    if (!shareCalculation || !paymentBreakdown) return;

    const splitId = `split-${Date.now()}`;
    const newItem: HistoryItem = {
      id: splitId,
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
      ownerId: currentUser?.uid,
    };

    setHistoryList((prev) => [newItem, ...prev.filter((i) => i.id !== splitId)]);

    if (currentUser) {
      const splitDocRef = doc(db, 'users', currentUser.uid, 'splits', splitId);
      const path = `users/${currentUser.uid}/splits/${splitId}`;
      try {
        await setDoc(splitDocRef, {
          ...newItem,
          ownerId: currentUser.uid,
        });
        showToast('Saved to Cloud Firestore');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } else {
      showToast('Saved to local history');
    }
  };

  // Restore history record
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
    showToast(`Loaded ${item.occasion}`);
  };

  // Delete history record
  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryList((prev) => prev.filter((item) => item.id !== id));

    if (currentUser) {
      const splitDocRef = doc(db, 'users', currentUser.uid, 'splits', id);
      const path = `users/${currentUser.uid}/splits/${id}`;
      try {
        await deleteDoc(splitDocRef);
        showToast('Record deleted from Firestore');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    } else {
      showToast('Record removed');
    }
  };

  // Toggle "Mark as Paid"
  const toggleMarkAsPaid = (index: number) => {
    setMarkedAsPaid((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Batch mark as paid
  const handleMarkAllPaid = (status: boolean) => {
    if (!shareCalculation) return;
    const updated: Record<number, boolean> = {};
    for (let i = 0; i < shareCalculation.count; i++) {
      updated[i] = status;
    }
    setMarkedAsPaid(updated);
  };

  // Presets
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
    showToast('Loaded preset');
  };

  // Copy share summary
  const handleCopySummary = () => {
    if (!shareCalculation || !paymentBreakdown) return;

    let text = `Expense Splitter: ${occasionName || 'Bill'}\n`;
    text += `Total Bill: ${formatRupee(shareCalculation.totalBill)}\n`;
    text += `Participants: ${shareCalculation.count}\n\n`;
    text += `Individual Shares:\n`;

    shareCalculation.shares.forEach((s) => {
      text += `• ${s.name}: ${formatRupee(s.share)} [${s.isPaid ? 'PAID' : 'PENDING'}]\n`;
    });

    text += `\nPayment Status: ${shareCalculation.paidCount} of ${shareCalculation.count} paid (${formatRupee(
      shareCalculation.paidAmount
    )} collected)\n`;

    text += `\nWhat Each Person Paid:\n`;
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
      text += `\nSettlement Transfers:\n`;
      paymentBreakdown.settlements.forEach((s) => {
        text += `• ${s.from} -> Pay ${formatRupee(s.amount)} to ${s.to} ${s.isSettled ? '(Received)' : ''}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Summary copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  // UPI QR Code Generator
  const handleOpenUpiModal = async (payeeName: string, amount: number, payerName?: string) => {
    const existingUpi = upiIds[payeeName] || `${payeeName.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`;
    const note = `Dinner Share for ${occasionName || 'Bill'}`;
    const upiUri = `upi://pay?pa=${encodeURIComponent(existingUpi)}&pn=${encodeURIComponent(
      payeeName
    )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;

    try {
      const dataUrl = await QRCode.toDataURL(upiUri, {
        margin: 2,
        width: 320,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(dataUrl);
      setSelectedUpiModal({
        payeeName,
        payerName,
        amount,
        upiId: existingUpi,
        note,
      });
      setCustomUpiInput(existingUpi);
      setIsEditingUpiId(false);
    } catch (err) {
      console.error('Failed to generate UPI QR:', err);
      showToast('Could not generate UPI QR Code');
    }
  };

  // Regenerate QR when UPI ID is updated
  const handleUpdateUpiId = async () => {
    if (!selectedUpiModal || !customUpiInput.trim()) return;
    const trimmed = customUpiInput.trim();
    setUpiIds((prev) => ({
      ...prev,
      [selectedUpiModal.payeeName]: trimmed,
    }));

    const upiUri = `upi://pay?pa=${encodeURIComponent(trimmed)}&pn=${encodeURIComponent(
      selectedUpiModal.payeeName
    )}&am=${selectedUpiModal.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(selectedUpiModal.note)}`;

    try {
      const dataUrl = await QRCode.toDataURL(upiUri, {
        margin: 2,
        width: 320,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(dataUrl);
      setSelectedUpiModal((prev) => (prev ? { ...prev, upiId: trimmed } : null));
      setIsEditingUpiId(false);
      showToast(`Updated UPI ID for ${selectedUpiModal.payeeName}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Download QR Code
  const handleDownloadQrCode = () => {
    if (!qrCodeDataUrl || !selectedUpiModal) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `UPI-QR-${selectedUpiModal.payeeName}-${selectedUpiModal.amount.toFixed(0)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloaded UPI QR Code');
  };

  // File Exporters
  const handleDownloadJSON = () => {
    if (!shareCalculation || !paymentBreakdown) return;
    const exportData = {
      occasion: occasionName || 'Expense Split',
      exportedAt: new Date().toISOString(),
      currency: 'INR (₹)',
      billAmount: rawBill,
      tipAmount: tipAmount,
      totalBill: shareCalculation.totalBill,
      participantsCount: shareCalculation.count,
      shares: shareCalculation.shares,
      payments: paymentBreakdown.payments,
      settlements: paymentBreakdown.settlements,
    };
    downloadFile(
      JSON.stringify(exportData, null, 2),
      `${(occasionName || 'expense-split').toLowerCase().replace(/\s+/g, '-')}.json`,
      'application/json'
    );
    showToast('Downloaded JSON file');
    setShowDownloadModal(false);
  };

  const handleDownloadCSV = () => {
    if (!shareCalculation || !paymentBreakdown) return;
    let csv = `Participant,Fair Share (INR),Amount Paid (INR),Net Balance (INR),Status\n`;
    paymentBreakdown.payments.forEach((p) => {
      const isPaid = markedAsPaid[p.index] ? 'PAID' : 'PENDING';
      csv += `"${p.name}",${p.share.toFixed(2)},${p.paid.toFixed(2)},${p.netBalance.toFixed(2)},${isPaid}\n`;
    });
    csv += `\nTotal Bill,${shareCalculation.totalBill.toFixed(2)}\n`;
    csv += `Total Participants,${shareCalculation.count}\n`;
    downloadFile(
      csv,
      `${(occasionName || 'expense-split').toLowerCase().replace(/\s+/g, '-')}.csv`,
      'text/csv'
    );
    showToast('Downloaded CSV file');
    setShowDownloadModal(false);
  };

  const handleDownloadTXT = () => {
    if (!shareCalculation || !paymentBreakdown) return;
    let receipt = `=================================================\n`;
    receipt += `             EXPENSE SPLITTER RECEIPT            \n`;
    receipt += `=================================================\n`;
    receipt += `Occasion:       ${occasionName || 'Dinner with Friends'}\n`;
    receipt += `Date:           ${new Date().toLocaleString('en-IN')}\n`;
    receipt += `Total Bill:     ${formatRupee(shareCalculation.totalBill)}\n`;
    receipt += `Participants:   ${shareCalculation.count}\n`;
    receipt += `-------------------------------------------------\n`;
    receipt += `INDIVIDUAL SHARES (Exact to the paisa):\n`;
    shareCalculation.shares.forEach((s) => {
      receipt += `  ${s.name.padEnd(20)} : ${formatRupee(s.share)} [${s.isPaid ? 'PAID' : 'PENDING'}]\n`;
    });
    receipt += `-------------------------------------------------\n`;
    receipt += `WHAT EACH PERSON PAID:\n`;
    paymentBreakdown.payments.forEach((p) => {
      const balanceStr =
        p.netBalance > 0
          ? `+${formatRupee(p.netBalance)} (Gets back)`
          : p.netBalance < 0
          ? `-${formatRupee(Math.abs(p.netBalance))} (Owes)`
          : `Settled`;
      receipt += `  ${p.name.padEnd(20)} : Paid ${formatRupee(p.paid)} | ${balanceStr}\n`;
    });
    if (paymentBreakdown.settlements.length > 0) {
      receipt += `-------------------------------------------------\n`;
      receipt += `SETTLEMENT INSTRUCTIONS:\n`;
      paymentBreakdown.settlements.forEach((s) => {
        receipt += `  ${s.from} -> Pay ${formatRupee(s.amount)} to ${s.to}\n`;
      });
    }
    receipt += `=================================================\n`;
    downloadFile(
      receipt,
      `${(occasionName || 'expense-split').toLowerCase().replace(/\s+/g, '-')}-receipt.txt`,
      'text/plain'
    );
    showToast('Downloaded receipt file');
    setShowDownloadModal(false);
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    if (!historySearchQuery.trim()) return historyList;
    const q = historySearchQuery.toLowerCase();
    return historyList.filter(
      (item) =>
        item.occasion.toLowerCase().includes(q) ||
        item.shares.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [historyList, historySearchQuery]);

  // Aggregate stats
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
      className={`min-h-screen font-sans antialiased relative selection:bg-emerald-500/30 ${
        theme === 'dark'
          ? 'bg-slate-950 text-slate-100'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Ambient background glows for Glassmorphism depth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-25 ${
            theme === 'dark' ? 'bg-emerald-600' : 'bg-emerald-300'
          }`}
        />
        <div
          className={`absolute top-1/3 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20 ${
            theme === 'dark' ? 'bg-cyan-600' : 'bg-blue-200'
          }`}
        />
        <div
          className={`absolute -bottom-40 left-1/3 w-96 h-96 rounded-full blur-3xl opacity-20 ${
            theme === 'dark' ? 'bg-teal-600' : 'bg-teal-200'
          }`}
        />
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 backdrop-blur-xl bg-slate-900/90 dark:bg-emerald-950/90 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700/50 dark:border-emerald-700/50">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODAL: UPI QR Code for settlement */}
      {selectedUpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div
            className={`w-full max-w-sm rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl transition-all ${
              theme === 'dark'
                ? 'bg-slate-900/85 border-slate-800 text-white shadow-emerald-950/30'
                : 'bg-white/90 border-white/60 text-slate-900 shadow-slate-200/50'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base tracking-tight">UPI Payment QR</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUpiModal(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-center space-y-3">
              {/* Payee & Amount details */}
              <div>
                <p className="text-xs text-slate-400 font-medium">
                  {selectedUpiModal.payerName ? (
                    <>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {selectedUpiModal.payerName}
                      </span>{' '}
                      pays to
                    </>
                  ) : (
                    'Pay to'
                  )}
                </p>
                <h4 className="text-lg font-extrabold tracking-tight mt-0.5">
                  {selectedUpiModal.payeeName}
                </h4>
                <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xl font-extrabold">
                  {formatRupee(selectedUpiModal.amount)}
                </div>
              </div>

              {/* QR Code Container with sleek frosted border */}
              <div className="p-3 bg-white rounded-2xl shadow-inner border border-slate-200/60 inline-block">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="UPI QR Code"
                    className="w-56 h-56 mx-auto rounded-lg"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                    Generating QR...
                  </div>
                )}
              </div>

              {/* Payee UPI ID with edit capability */}
              <div className="px-3 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-xs">
                {isEditingUpiId ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. name@okhdfcbank"
                      value={customUpiInput}
                      onChange={(e) => setCustomUpiInput(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleUpdateUpiId}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-slate-400 font-medium">UPI ID:</span>
                      <span className="font-mono font-semibold truncate text-slate-800 dark:text-slate-200">
                        {selectedUpiModal.upiId}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingUpiId(true)}
                      className="text-[11px] text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer ml-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Scan with Google Pay, PhonePe, Paytm, or BHIM UPI
              </p>

              {/* Actions: Download QR + Open UPI App */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadQrCode}
                  className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    theme === 'dark'
                      ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
                      : 'border-slate-300 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save QR</span>
                </button>

                <a
                  href={`upi://pay?pa=${encodeURIComponent(selectedUpiModal.upiId)}&pn=${encodeURIComponent(
                    selectedUpiModal.payeeName
                  )}&am=${selectedUpiModal.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
                    selectedUpiModal.note
                  )}`}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pay App</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Server & Hosting Links */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl transition-all ${
              theme === 'dark'
                ? 'bg-slate-900/85 border-slate-800 text-white'
                : 'bg-white/90 border-white/60 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base">Server & Host Information</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                    <Laptop className="w-4 h-4 text-emerald-500" />
                    Local Server Link
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    Port 3000
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 p-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 font-mono text-xs select-all">
                    http://localhost:3000
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('http://localhost:3000');
                      showToast('Copied local server link');
                    }}
                    className="p-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs hover:opacity-90 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                    <CloudCheck className="w-4 h-4 text-emerald-500" />
                    Live Cloud App URL
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 p-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 font-mono text-[11px] truncate select-all">
                    https://ais-dev-i4ys7dybooehnia44acw2n-691660099830.asia-east1.run.app
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('https://ais-dev-i4ys7dybooehnia44acw2n-691660099830.asia-east1.run.app');
                      showToast('Copied Cloud App URL');
                    }}
                    className="p-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs hover:opacity-90 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200/50 dark:border-slate-800/80 text-right">
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Download Export Options */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl backdrop-blur-2xl transition-all ${
              theme === 'dark'
                ? 'bg-slate-900/85 border-slate-800 text-white'
                : 'bg-white/90 border-white/60 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base">Export Bill Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDownloadModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Select an export format for your current dinner settlement:
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleDownloadTXT}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-left transition hover:scale-[1.01] cursor-pointer ${
                  theme === 'dark'
                    ? 'border-slate-800 bg-slate-800/50 hover:border-emerald-500/50'
                    : 'border-slate-200/70 bg-white/60 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm">Itemized Receipt (.txt)</h4>
                    <p className="text-[11px] text-slate-400">
                      Printable formatted ledger with all individual balances
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-left transition hover:scale-[1.01] cursor-pointer ${
                  theme === 'dark'
                    ? 'border-slate-800 bg-slate-800/50 hover:border-emerald-500/50'
                    : 'border-slate-200/70 bg-white/60 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm">Spreadsheet (.csv)</h4>
                    <p className="text-[11px] text-slate-400">
                      Excel and Google Sheets compatible table
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={handleDownloadJSON}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between text-left transition hover:scale-[1.01] cursor-pointer ${
                  theme === 'dark'
                    ? 'border-slate-800 bg-slate-800/50 hover:border-emerald-500/50'
                    : 'border-slate-200/70 bg-white/60 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm">Structured Ledger (.json)</h4>
                    <p className="text-[11px] text-slate-400">
                      Complete object format with integer cent distributions
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200/50 dark:border-slate-800/80 text-right">
              <button
                type="button"
                onClick={() => setShowDownloadModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Glassmorphic Navigation Bar */}
      <header
        className={`sticky top-0 z-30 backdrop-blur-xl border-b transition-colors duration-200 ${
          theme === 'dark'
            ? 'bg-slate-900/75 border-slate-800/80'
            : 'bg-white/75 border-white/60 shadow-xs'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between relative z-10">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl tracking-tight leading-tight">
                  Expense Splitter
                </h1>
                {currentUser && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <CloudCheck className="w-3 h-3" />
                    <span>Cloud Active</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                Fair & exact Rupee settlement engine
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setShowServerModal(true)}
              title="View Local & Cloud Server Links"
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border backdrop-blur-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                theme === 'dark'
                  ? 'border-slate-800 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'border-slate-200/80 bg-white/60 text-slate-700 hover:bg-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden md:inline">Server</span>
            </button>

            {/* Google Authentication Button / User Chip */}
            {currentUser ? (
              <div
                className={`flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-2xl border backdrop-blur-md text-xs font-medium ${
                  theme === 'dark'
                    ? 'border-slate-800 bg-slate-800/60'
                    : 'border-slate-200/80 bg-white/80'
                }`}
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="User"
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-[10px]">
                    {currentUser.displayName ? currentUser.displayName.charAt(0) : 'U'}
                  </div>
                )}
                <span className="max-w-[70px] sm:max-w-[100px] truncate text-xs font-bold">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer ml-0.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                title="Sign in with Google"
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {/* Recalculate / Refresh */}
            <button
              type="button"
              onClick={handleRefreshData}
              title="Refresh ledger"
              className={`p-2 rounded-xl border backdrop-blur-md transition-colors flex items-center justify-center cursor-pointer ${
                theme === 'dark'
                  ? 'border-slate-800 bg-slate-800/50 text-slate-300 hover:text-white'
                  : 'border-slate-200/80 bg-white/60 text-slate-700 hover:bg-white'
              }`}
            >
              <RefreshCw className="w-4 h-4 text-emerald-500" />
            </button>

            {/* Dark/Light Mode Switch */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              className={`p-2 rounded-xl border backdrop-blur-md transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-slate-800/60 border-slate-700/80 text-amber-300 hover:bg-slate-750'
                  : 'bg-white/70 border-slate-200/80 text-slate-700 hover:bg-white'
              }`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Clear All */}
            <button
              type="button"
              onClick={handleClearAll}
              title="Clear calculations"
              className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className={`border-t px-4 sm:px-6 transition-colors duration-200 ${
            theme === 'dark' ? 'border-slate-800/80 bg-slate-900/40' : 'border-slate-200/60 bg-white/40'
          }`}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <nav className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('splitter')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  activeTab === 'splitter'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>Splitter</span>
                {!isInvalid && shareCalculation && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/20 text-white">
                    {formatRupee(shareCalculation.totalBill)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 ${
                  activeTab === 'history'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <HistoryIcon className="w-3.5 h-3.5" />
                <span>History</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-500/20">
                  {historyList.length}
                </span>
              </button>
            </nav>

            {/* Presets */}
            <div className="hidden md:flex items-center gap-1.5 pl-2 text-xs">
              <span className="font-medium text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => handleLoadSample('biryani')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-200/50 dark:bg-slate-800/50 hover:bg-emerald-500/10 hover:text-emerald-500 transition cursor-pointer"
              >
                Biryani 4x
              </button>
              <button
                type="button"
                onClick={() => handleLoadSample('pizza')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-200/50 dark:bg-slate-800/50 hover:bg-emerald-500/10 hover:text-emerald-500 transition cursor-pointer"
              >
                Pizza 3x
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
        
        {/* ============================================================== */}
        {/* VIEW 1: DASHBOARD                                              */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* Glassmorphic Overview Card */}
            <div
              className={`rounded-3xl border p-6 sm:p-8 backdrop-blur-xl shadow-lg transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900/60 border-slate-800/80 shadow-black/20'
                  : 'bg-white/70 border-white/60 shadow-slate-200/50'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-3">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Dining & Bill Management
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Expense Split Command Center
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-xl mt-1 leading-relaxed">
                    Instant UPI settlements, zero-paise discrepancy distribution, and cross-device sync.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('splitter')}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <Split className="w-4 h-4" />
                    <span>Open Calculator</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDownloadModal(true)}
                    className={`px-4 py-2.5 rounded-2xl border font-bold text-xs sm:text-sm flex items-center gap-2 backdrop-blur-md transition cursor-pointer ${
                      theme === 'dark'
                        ? 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-white'
                        : 'border-slate-200/80 bg-white/70 hover:bg-white text-slate-800'
                    }`}
                  >
                    <Download className="w-4 h-4 text-emerald-500" />
                    <span>Export Bill</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className={`p-5 rounded-3xl border backdrop-blur-xl transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80'
                    : 'bg-white/70 border-white/60 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>Current Bill</span>
                  <Receipt className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-emerald-500">
                  {formatRupee(dashboardStats.activeAmount)}
                </div>
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {occasionName.trim() || 'No active bill'}
                </p>
              </div>

              <div
                className={`p-5 rounded-3xl border backdrop-blur-xl transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80'
                    : 'bg-white/70 border-white/60 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>Collected</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatRupee(dashboardStats.activeCollected)}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Pending: <span className="font-semibold text-amber-500">{formatRupee(dashboardStats.activePending)}</span>
                </p>
              </div>

              <div
                className={`p-5 rounded-3xl border backdrop-blur-xl transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80'
                    : 'bg-white/70 border-white/60 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>Tracked Records</span>
                  <BookmarkCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-extrabold font-mono">
                  {dashboardStats.historyCount}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {dashboardStats.fullySettledCount} completed
                </p>
              </div>

              <div
                className={`p-5 rounded-3xl border backdrop-blur-xl transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80'
                    : 'bg-white/70 border-white/60 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>Lifetime Tracked</span>
                  <CircleDollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-emerald-500">
                  {formatRupee(dashboardStats.totalHistoryAmount)}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Across all occasions
                </p>
              </div>
            </div>

            {/* Quick Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Active Bill Preview */}
              <div
                className={`lg:col-span-6 p-6 rounded-3xl border backdrop-blur-xl transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80'
                    : 'bg-white/70 border-white/60 shadow-xs'
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
                    <span>View Full Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {!isInvalid && shareCalculation ? (
                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        theme === 'dark'
                          ? 'bg-slate-800/50 border-slate-700/60'
                          : 'bg-white/80 border-slate-200/70'
                      }`}
                    >
                      <div>
                        <p className="text-xs text-slate-400">Occasion</p>
                        <p className="text-base font-bold truncate max-w-[200px]">
                          {occasionName.trim() || 'Dinner'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {shareCalculation.count} participants
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Total</p>
                        <p className="text-xl font-extrabold font-mono text-emerald-500">
                          {formatRupee(shareCalculation.totalBill)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span>Collection Status:</span>
                        <span className="text-emerald-500">
                          {shareCalculation.paidCount} of {shareCalculation.count} paid ({shareCalculation.progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${shareCalculation.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveToHistory}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDownloadModal(true)}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          theme === 'dark'
                            ? 'border-slate-800 hover:bg-slate-800 text-slate-300'
                            : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-xs text-slate-400 mb-3">No active bill calculated yet.</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('splitter')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                    >
                      Start New Calculation
                    </button>
                  </div>
                )}
              </div>

              {/* Recent History */}
              <div
                className={`lg:col-span-6 p-6 rounded-3xl border backdrop-blur-xl transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80'
                    : 'bg-white/70 border-white/60 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-emerald-500" />
                    Recent History
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-bold text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>All ({historyList.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {historyList.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleRestoreHistoryItem(item)}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                          : 'bg-white/60 border-slate-200/80 hover:border-slate-300'
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
                              ? 'bg-emerald-500/20 text-emerald-500'
                              : 'bg-amber-500/20 text-amber-500'
                          }`}
                        >
                          {item.isFullySettled ? 'Settled' : 'Pending'}
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
        {/* VIEW 2: SPLITTER (Precision Calculator & UPI QR Codes)         */}
        {/* ============================================================== */}
        {activeTab === 'splitter' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start animate-fade-in">
            {/* Input Form Card */}
            <div className="lg:col-span-5 space-y-6">
              <div
                className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl shadow-lg transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/60 border-slate-800/80 shadow-black/20'
                    : 'bg-white/70 border-white/60 shadow-slate-200/50'
                }`}
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-500" />
                    Bill Specifications
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                    INR (₹)
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Occasion */}
                  <div>
                    <label
                      htmlFor="occasion"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5"
                    >
                      Occasion / Merchant
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Utensils className="w-4 h-4" />
                      </div>
                      <input
                        id="occasion"
                        type="text"
                        placeholder="e.g. Dinner with Friends"
                        value={occasionName}
                        onChange={(e) => setOccasionName(e.target.value)}
                        className={`w-full pl-10 pr-3.5 py-2.5 border rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                          theme === 'dark'
                            ? 'bg-slate-800/60 border-slate-700/70 text-white placeholder:text-slate-500'
                            : 'bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Bill Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="billAmount"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-400"
                      >
                        Total Bill Amount (₹)
                      </label>
                      <span className="text-xs text-slate-400">Exact amount</span>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-base text-emerald-500">
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
                        className={`w-full pl-9 pr-3.5 py-2.5 border rounded-2xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                          isBillInvalid && billAmountInput !== ''
                            ? 'border-red-400 focus:ring-red-400'
                            : theme === 'dark'
                            ? 'bg-slate-800/60 border-slate-700/70 text-white placeholder:text-slate-500'
                            : 'bg-white/80 border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>
                    {isBillInvalid && billAmountInput !== '' && (
                      <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Amount must be a positive number greater than 0
                      </p>
                    )}
                  </div>

                  {/* Tip / Surcharge */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Tip / Gratuity (Optional)
                      </span>
                      {tipAmount > 0 && (
                        <span className="text-xs font-bold text-emerald-500 font-mono">
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
                          className={`py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                            tipPercent === pct && customTipInput === ''
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold'
                              : theme === 'dark'
                              ? 'bg-slate-800/50 text-slate-300 border-slate-700/70 hover:bg-slate-800'
                              : 'bg-white/60 text-slate-700 border-slate-200 hover:bg-white'
                          }`}
                        >
                          {pct === 0 ? 'None' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="participantsCount"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-400"
                      >
                        Number of Participants
                      </label>
                      <span className="text-xs text-slate-400">Min 1</span>
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
                        className={`w-10 h-10 rounded-2xl border flex items-center justify-center font-bold text-lg transition cursor-pointer ${
                          theme === 'dark'
                            ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white'
                            : 'border-slate-300 bg-white/80 hover:bg-white text-slate-700'
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
                          className={`w-full pl-9 pr-3 py-2.5 border rounded-2xl text-center text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                            isCountInvalid && participantsCountInput !== ''
                              ? 'border-red-400 focus:ring-red-400'
                              : theme === 'dark'
                              ? 'bg-slate-800/60 border-slate-700/70 text-white'
                              : 'bg-white/80 border-slate-200 text-slate-900'
                          }`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const current = parseInt(participantsCountInput || '0', 10);
                          setParticipantsCountInput(String(Math.max(1, current + 1)));
                        }}
                        className={`w-10 h-10 rounded-2xl border flex items-center justify-center font-bold text-lg transition cursor-pointer ${
                          theme === 'dark'
                            ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white'
                            : 'border-slate-300 bg-white/80 hover:bg-white text-slate-700'
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

                    {/* Quick Stepper Chips */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className="text-xs text-slate-400">Quick:</span>
                      {[2, 3, 4, 5, 6, 8].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setParticipantsCountInput(String(num))}
                          className={`text-xs px-2.5 py-1 rounded-xl border font-medium transition cursor-pointer ${
                            rawCount === num
                              ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                              : theme === 'dark'
                              ? 'bg-slate-800/40 text-slate-300 border-slate-700/60 hover:bg-slate-800'
                              : 'bg-white/60 text-slate-600 border-slate-200 hover:bg-white'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Names customization */}
                  {!isCountInvalid && rawCount > 0 && rawCount <= 12 && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                      <p className="text-xs font-semibold text-slate-400 mb-2">
                        Participant Names:
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
                            className={`px-3 py-1.5 text-xs border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                              theme === 'dark'
                                ? 'bg-slate-800/60 border-slate-700/60 text-slate-100'
                                : 'bg-white/80 border-slate-200 text-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Primary Trigger */}
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={handleSplitExpense}
                      className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-md shadow-emerald-600/20 active:scale-[0.99] transition cursor-pointer"
                    >
                      <Split className="w-5 h-5" />
                      <span>Split Expense</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results & UPI Settlement Column */}
            <div ref={resultsRef} className="lg:col-span-7 space-y-6 scroll-mt-20">
              {isInvalid || !hasSplitSubmitted ? (
                <div
                  className={`rounded-3xl border-2 border-dashed p-10 text-center backdrop-blur-xl transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-900/40 border-slate-800/80 text-slate-300'
                      : 'bg-white/50 border-slate-300/80 text-slate-600'
                  }`}
                >
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-4">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 tracking-tight">no result</h3>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
                    {isBillInvalid && isCountInvalid
                      ? 'Please enter a valid bill amount greater than ₹0.00 and at least 1 participant, then click Split Expense.'
                      : isBillInvalid
                      ? 'The bill amount is empty, zero, or negative. Please enter a valid positive bill amount.'
                      : isCountInvalid
                      ? 'The number of participants is empty, zero, or negative. Please specify at least 1 person.'
                      : 'Click the "Split Expense" button to calculate the shares.'}
                  </p>
                </div>
              ) : (
                shareCalculation && (
                  <>
                    {/* Real Split Card */}
                    <div
                      className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl shadow-lg transition-all ${
                        theme === 'dark'
                          ? 'bg-slate-900/60 border-slate-800/80 shadow-black/20'
                          : 'bg-white/70 border-white/60 shadow-slate-200/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200/60 dark:border-slate-800/80 gap-3">
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Exact Shares Computed
                          </span>
                          <h2 className="text-xl font-bold tracking-tight">
                            {occasionName.trim() || 'Dinner'} Split ({shareCalculation.count} Persons)
                          </h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveToHistory}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowDownloadModal(true)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                              theme === 'dark'
                                ? 'border-slate-700 bg-slate-800/60 text-white hover:bg-slate-800'
                                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Export</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCopySummary}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                              theme === 'dark'
                                ? 'border-slate-700 bg-slate-800/60 text-white hover:bg-slate-800'
                                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Collection Progress Tracker */}
                      <div
                        className={`mt-5 p-4 rounded-2xl border ${
                          theme === 'dark'
                            ? 'bg-slate-800/40 border-slate-800/80'
                            : 'bg-white/60 border-slate-200/70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-medium mb-2 gap-1.5">
                          <div className="flex items-center gap-2">
                            <CircleDollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="font-bold">
                              Collected:
                            </span>
                            <span className="font-semibold text-emerald-500">
                              {shareCalculation.paidCount} of {shareCalculation.count} participants ({shareCalculation.progressPercent}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleMarkAllPaid(true)}
                              className="text-[11px] font-semibold text-emerald-500 hover:underline cursor-pointer"
                            >
                              Mark All Paid
                            </button>
                            <span className="text-slate-400">•</span>
                            <button
                              type="button"
                              onClick={() => handleMarkAllPaid(false)}
                              className="text-[11px] font-semibold text-slate-400 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-2">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${shareCalculation.progressPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Paid: <strong className="text-emerald-500 font-mono">{formatRupee(shareCalculation.paidAmount)}</strong></span>
                          <span>Pending: <strong className="font-mono text-amber-500">{formatRupee(Math.max(0, shareCalculation.totalBill - shareCalculation.paidAmount))}</strong></span>
                        </div>
                      </div>

                      {/* Exact Rupee Guarantee */}
                      <div
                        className={`mt-4 p-4 rounded-2xl border ${
                          theme === 'dark'
                            ? 'bg-slate-800/30 border-slate-800/60'
                            : 'bg-white/60 border-slate-200/60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-medium mb-1.5 gap-1">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <strong>Exact Paisa Balancing:</strong>
                          </span>
                          <span className="font-mono font-bold text-emerald-500 text-sm">
                            Sum of shares = {formatRupee(shareCalculation.calculatedSum)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Total bill of <span className="font-semibold text-emerald-500">{formatRupee(shareCalculation.totalBill)}</span> is balanced across {shareCalculation.count} participants with zero penny difference.
                        </p>
                      </div>

                      {/* Participant Shares Grid with UPI QR Buttons */}
                      <div className="mt-5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                          Individual Shares & Instant UPI Settlement
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {shareCalculation.shares.map((person) => {
                            const isPaid = person.isPaid;
                            return (
                              <div
                                key={person.index}
                                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                                  isPaid
                                    ? theme === 'dark'
                                      ? 'bg-emerald-950/20 border-emerald-800/40'
                                      : 'bg-emerald-50/70 border-emerald-200/80'
                                    : theme === 'dark'
                                    ? 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                                    : 'bg-white/80 border-slate-200/80 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 ${
                                        isPaid
                                          ? 'bg-emerald-500 text-slate-950'
                                          : 'bg-slate-900 dark:bg-slate-700 text-white'
                                      }`}
                                    >
                                      {isPaid ? <Check className="w-4 h-4" /> : person.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p
                                        className={`text-sm font-bold leading-tight truncate ${
                                          isPaid
                                            ? 'text-emerald-700 dark:text-emerald-300 line-through decoration-emerald-500/50'
                                            : ''
                                        }`}
                                      >
                                        {person.name}
                                      </p>
                                      <p className="text-[11px] text-slate-400">
                                        {person.getsExtraPaise ? '+₹0.01 rounded' : 'Equal share'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right pl-2">
                                    <span className="text-base sm:text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                                      {formatRupee(person.share)}
                                    </span>
                                  </div>
                                </div>

                                {/* Action Buttons: Mark as Paid & UPI QR */}
                                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleMarkAsPaid(person.index)}
                                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                                      isPaid
                                        ? 'bg-emerald-600 text-white'
                                        : theme === 'dark'
                                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {isPaid ? (
                                      <>
                                        <CheckSquare className="w-3.5 h-3.5" />
                                        <span>Paid ✓</span>
                                      </>
                                    ) : (
                                      <>
                                        <Square className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Mark Paid</span>
                                      </>
                                    )}
                                  </button>

                                  {/* UPI QR Code Generator Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenUpiModal(person.name, person.share)}
                                    title={`Generate UPI QR Code to pay ${person.name}`}
                                    className="py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>UPI QR</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* What Each Person Paid & Settlement Transfers Card */}
                    <div
                      className={`rounded-3xl border p-5 sm:p-6 backdrop-blur-xl shadow-lg transition-all ${
                        theme === 'dark'
                          ? 'bg-slate-900/60 border-slate-800/80 shadow-black/20'
                          : 'bg-white/70 border-white/60 shadow-slate-200/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-bold flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-emerald-500" />
                            Settlement Ledger & UPI Transfers
                          </h3>
                          <p className="text-xs text-slate-400">
                            Who covered the initial bill and direct UPI payment instructions
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowPaidBreakdown((prev) => !prev)}
                          className={`px-4 py-2 rounded-2xl border font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                            theme === 'dark'
                              ? 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-slate-200'
                              : 'border-slate-200 bg-white/80 hover:bg-white text-slate-800'
                          }`}
                        >
                          <span>{showPaidBreakdown ? 'Hide Breakdown' : 'Show What Each Person Paid'}</span>
                          {showPaidBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {showPaidBreakdown && paymentBreakdown && (
                        <div className="mt-5 pt-5 border-t border-slate-200/60 dark:border-slate-800/80 space-y-5">
                          {/* Payer Configuration */}
                          <div
                            className={`rounded-2xl p-4 border ${
                              theme === 'dark'
                                ? 'bg-slate-800/40 border-slate-800/80'
                                : 'bg-white/60 border-slate-200/70'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Who Paid At The Table?
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPayerMode('single')}
                                  className={`text-xs px-2.5 py-1 rounded-xl font-medium transition cursor-pointer ${
                                    payerMode === 'single'
                                      ? 'bg-emerald-600 text-white font-bold'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  One person paid
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPayerMode('custom')}
                                  className={`text-xs px-2.5 py-1 rounded-xl font-medium transition cursor-pointer ${
                                    payerMode === 'custom'
                                      ? 'bg-emerald-600 text-white font-bold'
                                      : 'text-slate-400 hover:text-slate-200'
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
                                    className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                                      singlePayerIndex === person.index
                                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                                        : theme === 'dark'
                                        ? 'bg-slate-800/60 text-slate-300 border-slate-700/60'
                                        : 'bg-white text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {person.name} paid full ({formatRupee(shareCalculation.totalBill)})
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs text-slate-400">
                                  Enter amount contributed by each person:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {shareCalculation.shares.map((person) => (
                                    <div
                                      key={person.index}
                                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                                        theme === 'dark'
                                          ? 'bg-slate-800/60 border-slate-700/60'
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
                                          className="w-full pl-5 pr-2 py-1 text-xs text-right border rounded-lg font-semibold focus:outline-none"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Ledger Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[500px]">
                              <thead>
                                <tr className="border-b border-slate-200/60 dark:border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  <th className="py-2.5 px-3">Participant</th>
                                  <th className="py-2.5 px-3 text-right">What They Paid</th>
                                  <th className="py-2.5 px-3 text-right">Fair Share</th>
                                  <th className="py-2.5 px-3 text-right">Net Balance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                {paymentBreakdown.payments.map((p) => {
                                  const getsBack = p.netBalance > 0.001;
                                  const owes = p.netBalance < -0.001;
                                  return (
                                    <tr key={p.index} className="hover:bg-slate-500/5">
                                      <td className="py-3 px-3 font-semibold">
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
                                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg">
                                            Gets back +{formatRupee(p.netBalance)}
                                          </span>
                                        )}
                                        {owes && (
                                          <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg">
                                            Owes {formatRupee(Math.abs(p.netBalance))}
                                          </span>
                                        )}
                                        {!getsBack && !owes && (
                                          <span className="font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
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

                          {/* Direct Settlement Transfers with UPI QR Buttons */}
                          {paymentBreakdown.settlements.length > 0 && (
                            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/80">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                                Direct Settlement Transfers:
                              </h4>
                              <div className="space-y-2">
                                {paymentBreakdown.settlements.map((settle, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className={`p-3.5 border rounded-2xl flex items-center justify-between text-xs backdrop-blur-md ${
                                      settle.isSettled
                                        ? 'bg-emerald-500/10 border-emerald-500/20 opacity-80'
                                        : theme === 'dark'
                                        ? 'bg-slate-800/40 border-slate-800/80'
                                        : 'bg-white/80 border-slate-200/80'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold">{settle.from}</span>
                                      <span className="text-slate-400">pays</span>
                                      <span className="font-bold">{settle.to}</span>
                                      {settle.isSettled && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-500 ml-1">
                                          Paid ✓
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-extrabold text-sm text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-xl">
                                        {formatRupee(settle.amount)}
                                      </span>

                                      {/* One-click UPI QR Code for this exact transfer */}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenUpiModal(settle.to, settle.amount, settle.from)
                                        }
                                        title={`Pay ${settle.to} via UPI QR`}
                                        className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition cursor-pointer"
                                      >
                                        <QrCode className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Pay UPI</span>
                                      </button>
                                    </div>
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
        {/* VIEW 3: SPLIT HISTORY                                          */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-fade-in">
            <div
              className={`rounded-3xl border p-6 backdrop-blur-xl shadow-lg transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900/60 border-slate-800/80'
                  : 'bg-white/70 border-white/60 shadow-slate-200/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-emerald-500" />
                    Split History & Ledger
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Saved dinner bills with participant records and UPI settlement statuses.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search occasion or name..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 text-xs border rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                      theme === 'dark'
                        ? 'bg-slate-800/60 border-slate-700 text-white'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>

            {filteredHistory.length > 0 ? (
              <div className="space-y-4">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-3xl border p-5 backdrop-blur-xl transition-all hover:scale-[1.005] ${
                      theme === 'dark'
                        ? 'bg-slate-900/60 border-slate-800/80'
                        : 'bg-white/70 border-white/60 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/50 dark:border-slate-800/80">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold">{item.occasion}</h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.isFullySettled
                                ? 'bg-emerald-500/20 text-emerald-500'
                                : 'bg-amber-500/20 text-amber-500'
                            }`}
                          >
                            {item.isFullySettled ? 'Settled' : 'Pending'}
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

                        <div className="flex items-center gap-2 pl-3 border-l border-slate-200/50 dark:border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleRestoreHistoryItem(item)}
                            title="Load into splitter"
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                          >
                            <Split className="w-3.5 h-3.5" />
                            <span>Load</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                            title="Delete"
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Shares */}
                    <div className="mt-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {item.shares.map((s, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                              s.isPaid
                                ? 'bg-emerald-500/10 border-emerald-500/20'
                                : theme === 'dark'
                                ? 'bg-slate-800/40 border-slate-700/50'
                                : 'bg-white/80 border-slate-200/70'
                            }`}
                          >
                            <span className="truncate font-medium">{s.name}</span>
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              <span className="font-mono font-bold">{formatRupee(s.share)}</span>
                              {s.isPaid && <Check className="w-3 h-3 text-emerald-500" />}
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
                className={`rounded-3xl border-2 border-dashed p-12 text-center backdrop-blur-xl ${
                  theme === 'dark' ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white/50 border-slate-200'
                }`}
              >
                <HistoryIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold mb-1">No records found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  {historySearchQuery ? 'No match found for your search query.' : 'Calculate and save a bill to view it in history.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('splitter')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                >
                  Start New Split
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
