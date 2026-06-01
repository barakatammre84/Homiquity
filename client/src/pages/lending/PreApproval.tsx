import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, Link } from "wouter";
import { SEOHead } from "@/components/SEOHead";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { preApprovalFormSchema, type PreApprovalFormData, type RentalPropertyEntry, type IncomeSourceEntry } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity, useTrackFormStart, useTrackFormAbandon } from "@/hooks/useActivityTracker";
import { 
  ArrowRight, 
  ChevronLeft, 
  DollarSign, 
  Home,
  Briefcase,
  Building2,
  TrendingUp,
  Clock,
  CreditCard,
  MapPin,
  Shield,
  Users,
  Loader2,
  Check,
  AlertCircle,
  Info,
  Plus,
  Trash2,
  LogIn,
  HelpCircle
} from "lucide-react";

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" }
];

type QuestionType = "intro" | "choice" | "currency" | "number" | "state" | "boolean_pair" | "income_sources" | "final";

interface QuestionOption {
  value: string;
  label: string;
  icon?: typeof Home;
}

interface Question {
  id: string;
  field?: keyof PreApprovalFormData;
  type: QuestionType;
  question?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  options?: QuestionOption[];
  placeholder?: string;
  subtext?: string;
  icon?: typeof Home;
  booleanFields?: { field: keyof PreApprovalFormData; label: string; icon: typeof Home }[];
}

const QUESTIONS: Question[] = [
  {
    id: "intro",
    type: "intro",
    title: "Let's get you home.",
    subtitle: "We'll get you a verified pre-approval letter in about 3 minutes. No hard credit check.",
    buttonText: "Start My Pre-Approval"
  },
  {
    id: "loanPurpose",
    field: "loanPurpose",
    type: "choice",
    question: "What are you looking to do?",
    icon: Home,
    options: [
      { value: "purchase", label: "Buying a Home", icon: Home },
      { value: "refinance", label: "Refinancing My Home", icon: TrendingUp },
      { value: "cash_out", label: "Cash-Out Refinance", icon: DollarSign }
    ]
  },
  {
    id: "propertyType",
    field: "propertyType",
    type: "choice",
    question: "What kind of property are we looking at?",
    icon: Building2,
    options: [
      { value: "single_family", label: "Single Family Home", icon: Home },
      { value: "condo", label: "Condo", icon: Building2 },
      { value: "townhouse", label: "Townhouse", icon: Building2 },
      { value: "multi_family", label: "Multi-Family (2-4 Units)", icon: Users }
    ]
  },
  {
    id: "purchasePrice",
    field: "purchasePrice",
    type: "currency",
    question: "What is the estimated purchase price?",
    placeholder: "500,000",
    subtext: "It's okay to estimate if you haven't found 'the one' yet.",
    icon: DollarSign
  },
  {
    id: "downPayment",
    field: "downPayment",
    type: "currency",
    question: "How much are you planning to put down?",
    placeholder: "100,000",
    subtext: "We can adjust this later to fine-tune your monthly payment.",
    icon: DollarSign
  },
  {
    id: "propertyState",
    field: "propertyState",
    type: "state",
    question: "Which state are you looking to buy in?",
    icon: MapPin,
    subtext: "Select from the list below"
  },
  {
    id: "annualIncome",
    field: "annualIncome",
    type: "currency",
    question: "What is your total annual household income?",
    placeholder: "120,000",
    subtext: "Gross income before taxes. Include salary, bonuses, etc.",
    icon: Briefcase
  },
  {
    id: "employmentType",
    field: "employmentType",
    type: "choice",
    question: "How are you employed?",
    icon: Briefcase,
    options: [
      { value: "employed", label: "W-2 Employee", icon: Briefcase },
      { value: "self_employed", label: "Self-Employed / 1099", icon: Users },
      { value: "retired", label: "Retired", icon: Clock },
      { value: "other", label: "Other", icon: Users }
    ]
  },
  {
    id: "employmentYears",
    field: "employmentYears",
    type: "number",
    question: "How many years have you been at your current job?",
    placeholder: "5",
    subtext: "Round to the nearest year",
    icon: Clock
  },
  {
    id: "hasAdditionalIncome",
    field: "hasAdditionalIncome",
    type: "choice",
    question: "Do you have additional sources of income?",
    icon: TrendingUp,
    options: [
      { value: "yes", label: "Yes, I have other income", icon: TrendingUp },
      { value: "no", label: "No, this is my only income", icon: Check }
    ]
  },
  {
    id: "incomeSources",
    type: "income_sources",
    question: "What other income do you receive?",
    subtext: "Select all that apply, then provide details for each."
  },
  {
    id: "monthlyDebts",
    field: "monthlyDebts",
    type: "currency",
    question: "What are your total monthly debt payments?",
    placeholder: "1,500",
    subtext: "Car, student, and personal loans, credit card minimums, child support. Don't include rent, utilities, or groceries.",
    icon: CreditCard
  },
  {
    id: "creditScore",
    field: "creditScore",
    type: "choice",
    question: "Roughly, what is your credit score?",
    subtext: "An estimate is fine -- we'll verify this later with a soft check that won't affect your score.",
    icon: CreditCard,
    options: [
      { value: "760", label: "760+", icon: Check },
      { value: "720", label: "720-759", icon: Check },
      { value: "680", label: "680-719", icon: Check },
      { value: "640", label: "640-679", icon: Check },
      { value: "600", label: "Under 640", icon: Check },
      { value: "not_sure", label: "Not sure", icon: HelpCircle }
    ]
  },
  {
    id: "veteranAndFirstTime",
    type: "boolean_pair",
    question: "These help us find programs you may qualify for",
    icon: Shield,
    booleanFields: [
      { field: "isVeteran", label: "I am a U.S. military veteran or active duty", icon: Shield },
      { field: "isFirstTimeBuyer", label: "I am a first-time home buyer", icon: Home }
    ]
  },
  {
    id: "final",
    type: "final",
    question: "You're almost there!",
    subtitle: "Click submit to get your personalized loan options. Soft credit check only -- won't affect your score."
  }
];

interface AdvisoryPanelProps {
  formValues: PreApprovalFormData;
  currentStepId: string;
}

function AdvisoryPanel({ formValues, currentStepId }: AdvisoryPanelProps) {
  const stats = useMemo(() => {
    let income = parseFloat(String(formValues.annualIncome || "").replace(/[^0-9.]/g, "")) || 0;
    if (formValues.incomeSources && formValues.incomeSources.length > 0) {
      for (const src of formValues.incomeSources) {
        income += parseFloat(String(src.annualAmount || "").replace(/[^0-9.]/g, "")) || 0;
      }
    }
    const debts = parseFloat(String(formValues.monthlyDebts || "").replace(/[^0-9.]/g, "")) || 0;
    const price = parseFloat(String(formValues.purchasePrice || "").replace(/[^0-9.]/g, "")) || 0;
    const down = parseFloat(String(formValues.downPayment || "").replace(/[^0-9.]/g, "")) || 0;
    
    const loanAmount = price - down;
    const estRate = 0.065;
    const monthlyRate = estRate / 12;
    const numPayments = 360;
    
    let estMortgage = 0;
    if (loanAmount > 0 && monthlyRate > 0) {
      estMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                    (Math.pow(1 + monthlyRate, numPayments) - 1);
      estMortgage += (price * 0.0125) / 12;
    }
    
    const monthlyIncome = income / 12;
    const totalMonthlyObligation = debts + estMortgage;
    
    const dti = monthlyIncome > 0 ? (totalMonthlyObligation / monthlyIncome) * 100 : 0;
    const ltv = price > 0 ? ((price - down) / price) * 100 : 0;
    const downPaymentPercent = price > 0 ? (down / price) * 100 : 0;
    
    return { dti, estMortgage, loanAmount, ltv, downPaymentPercent };
  }, [formValues]);

  if (currentStepId === "intro" || currentStepId === "loanPurpose" || currentStepId === "propertyType") {
    return null;
  }

  const getContextualAdvice = () => {
    switch (currentStepId) {
      case "purchasePrice":
        return "We use this to estimate your monthly payment and closing costs.";
      case "downPayment":
        if (stats.loanAmount > 766550) {
          return (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Note: This loan amount enters 'Jumbo' territory, which may require a higher credit score and larger down payment.
            </span>
          );
        }
        if (stats.downPaymentPercent >= 20) {
          return (
            <span className="text-green-600 dark:text-green-400">
              Great! Putting 20%+ down avoids PMI (Private Mortgage Insurance), saving you money each month.
            </span>
          );
        }
        return "Tip: A 20% down payment avoids Private Mortgage Insurance (PMI).";
      case "propertyState":
        return "Location affects property taxes and available loan programs.";
      case "annualIncome":
        return "We use gross income to calculate your debt-to-income ratio. We'll verify with W-2s or tax returns later.";
      case "employmentType":
        return "Employment type helps us determine which documents we'll need to verify your income.";
      case "employmentYears":
        return "Most lenders prefer 2+ years of stable employment history.";
      case "hasAdditionalIncome":
        return "Including all income sources gives a more complete picture for underwriting.";
      case "incomeSources":
        return "Each income source may require different documentation. We'll let you know what's needed.";
      case "monthlyDebts":
        return "Include car payments, student loans, credit cards, and other monthly obligations.";
      case "creditScore":
        return "A score above 740 typically qualifies for the best interest rates. Not sure? Most Americans score between 670-739. Check yours free at annualcreditreport.com.";
      case "veteranAndFirstTime":
        return "Veterans may qualify for VA loans with no down payment. First-time buyers may access special programs.";
      case "final":
        return "Review complete! Click submit to see your personalized loan options.";
      default:
        return "Keep going! We're building your financial profile.";
    }
  };

  const getDtiStatus = () => {
    if (stats.dti <= 0) return { color: "bg-muted", text: "Enter your info to see DTI" };
    if (stats.dti < 36) return { color: "bg-green-500", text: "Looking great! Lenders love a DTI under 36%." };
    if (stats.dti < 43) return { color: "bg-yellow-500", text: "You're in the approval zone, but consider the budget." };
    if (stats.dti < 50) return { color: "bg-orange-500", text: "This is getting tight. You may need to reduce the loan amount." };
    return { color: "bg-red-500", text: "This loan amount might be a stretch for standard approval." };
  };

  const dtiStatus = getDtiStatus();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden lg:block fixed right-8 top-1/2 -translate-y-1/2 w-80 bg-card rounded-2xl shadow-xl border p-6 transition-all duration-500 z-30"
      data-testid="advisory-panel"
    >
      <div className="flex items-center gap-2 mb-4 border-b pb-3">
        <div className="bg-primary/10 p-1.5 rounded-lg">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <span className="font-bold text-foreground text-sm uppercase tracking-wider">Live Analysis</span>
      </div>

      <div className="space-y-5">
        {(stats.dti > 0 || stats.estMortgage > 0) && (
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Debt-to-Income Ratio</span>
              <span className={`font-bold ${stats.dti > 43 ? "text-red-500" : stats.dti > 36 ? "text-yellow-600" : "text-green-600"}`}>
                {stats.dti > 0 ? `${stats.dti.toFixed(0)}%` : "—"}
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div 
                className={`h-full transition-colors duration-500 ${dtiStatus.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Math.max(stats.dti, 0), 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {dtiStatus.text}
            </p>
          </div>
        )}

        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex gap-3">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getContextualAdvice()}
            </p>
          </div>
        </div>

        {stats.estMortgage > 0 && (
          <div className="text-center pt-2 border-t">
            <div className="text-xs text-muted-foreground uppercase mb-1">Est. Monthly Payment</div>
            <div className="text-2xl font-bold text-foreground" data-testid="text-est-payment">
              ${stats.estMortgage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-sm text-muted-foreground font-normal">/mo</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Based on 6.5% rate, 30-year fixed
            </p>
          </div>
        )}

        {stats.ltv > 0 && stats.ltv < 100 && (
          <div className="flex justify-between text-xs border-t pt-3">
            <span className="text-muted-foreground">Loan-to-Value (LTV)</span>
            <span className={`font-medium ${stats.ltv <= 80 ? "text-green-600" : "text-yellow-600"}`}>
              {stats.ltv.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function getDynamicTitle(currentQ: Question, formValues: PreApprovalFormData): string {
  const { purchasePrice, loanPurpose, employmentType, downPayment } = formValues;

  switch (currentQ.id) {
    case "downPayment":
      if (purchasePrice) {
        return `On a $${purchasePrice} home, how much can you put down?`;
      }
      break;
    case "creditScore":
      if (loanPurpose === "cash_out") {
        return "Since you're pulling cash out, credit score is key. What's yours?";
      }
      break;
    case "annualIncome":
      return "What's your total household income?";
    case "employmentYears":
      if (employmentType === "self_employed") {
        return "How many years have you been self-employed?";
      }
      if (employmentType === "retired") {
        return "How many years have you been retired?";
      }
      break;
    case "monthlyDebts":
      return "What are your current monthly debt payments?";
  }

  return currentQ.question || "";
}

export default function PreApproval() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [selectedIncomeTypes, setSelectedIncomeTypes] = useState<string[]>([]);
  const [incomeDetails, setIncomeDetails] = useState<Record<string, { annualAmount: string; employerName: string; yearsInRole: string }>>({});
  const [rentalProperties, setRentalProperties] = useState<RentalPropertyEntry[]>([]);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  usePageView("/apply");
  const track = useTrackActivity();
  const trackFormStart = useTrackFormStart();
  useTrackFormAbandon("preapproval", currentStep > 0 && currentStep < QUESTIONS.length - 1);
  const prevStepRef = useRef(0);

  const urlParams = new URLSearchParams(window.location.search);
  const urlType = urlParams.get("type");
  const urlPrice = urlParams.get("price");
  const urlState = urlParams.get("state");
  const urlPropertyType = urlParams.get("propertyType");
  const urlPropertyId = urlParams.get("propertyId");
  const urlSource = urlParams.get("source");
  const defaultLoanPurpose = urlType === "refinance" ? "refinance" : urlType === "heloc" ? "cash_out" : "purchase";

  const inviteId = useRef(sessionStorage.getItem("inviteId"));

  const form = useForm<PreApprovalFormData>({
    resolver: zodResolver(preApprovalFormSchema),
    mode: "onChange",
    defaultValues: {
      annualIncome: "",
      employmentType: "employed",
      employmentYears: "",
      monthlyDebts: "",
      creditScore: "",
      loanPurpose: defaultLoanPurpose,
      propertyType: (urlPropertyType as any) || "single_family",
      purchasePrice: urlPrice || "",
      downPayment: "",
      isVeteran: false,
      isFirstTimeBuyer: false,
      propertyState: urlState || "",
      hasAdditionalIncome: false,
      incomeSources: [],
    },
  });

  const { data: serverDraft, isLoading: serverDraftLoading } = useQuery<any>({
    queryKey: ["/api/loan-applications/draft/latest"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("calculatorPrefill");
      if (!raw) return;
      const prefill = JSON.parse(raw);
      sessionStorage.removeItem("calculatorPrefill");
      const current = form.getValues();
      if (prefill.annualIncome && !current.annualIncome) {
        form.setValue("annualIncome", String(prefill.annualIncome));
      }
      if (prefill.monthlyDebts && !current.monthlyDebts) {
        form.setValue("monthlyDebts", String(prefill.monthlyDebts));
      }
      if (prefill.downPayment && !current.downPayment) {
        form.setValue("downPayment", String(prefill.downPayment));
      }
      if (prefill.creditScore && !current.creditScore) {
        const score = prefill.creditScore;
        const bucket = score >= 740 ? "excellent" : score >= 700 ? "good" : score >= 660 ? "fair" : "poor";
        form.setValue("creditScore", bucket);
      }
      if (prefill.purchasePrice && !current.purchasePrice) {
        form.setValue("purchasePrice", String(prefill.purchasePrice));
      }
    } catch {}
  }, []);

  const AUTOSAVE_KEY = "homiquity_preapproval_draft";
  const AUTOSAVE_STEP_KEY = "homiquity_preapproval_step";
  const PENDING_SUBMIT_KEY = "homiquity_preapproval_pending_submit";
  const [autosaveRestored, setAutosaveRestored] = useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToLocalStorage = useCallback((values: PreApprovalFormData, step: number) => {
    try {
      const hasData = Object.entries(values).some(([k, v]) => {
        if (k === "isVeteran" || k === "isFirstTimeBuyer") return false;
        if (k === "employmentType" && v === "employed") return false;
        if (k === "propertyType" && v === "single_family") return false;
        if (k === "loanPurpose" && v === defaultLoanPurpose) return false;
        return typeof v === "string" && v.length > 0;
      });
      if (hasData) {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(values));
        localStorage.setItem(AUTOSAVE_STEP_KEY, String(step));
      }
    } catch {}
  }, [defaultLoanPurpose]);

  const clearAutosave = useCallback(() => {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
      localStorage.removeItem(AUTOSAVE_STEP_KEY);
      localStorage.removeItem(PENDING_SUBMIT_KEY);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const pending = localStorage.getItem(PENDING_SUBMIT_KEY);
      if (!pending) return;
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (!saved) { localStorage.removeItem(PENDING_SUBMIT_KEY); return; }
      const formData = JSON.parse(saved) as PreApprovalFormData;
      form.reset(formData);
      localStorage.removeItem(PENDING_SUBMIT_KEY);
      setTimeout(() => {
        submitMutation.mutate(formData);
      }, 500);
    } catch {
      localStorage.removeItem(PENDING_SUBMIT_KEY);
    }
  }, [isAuthenticated]);

  const currentQ = QUESTIONS[currentStep];
  
  const watchedValues = form.watch();
  const dynamicTitle = useMemo(() => getDynamicTitle(currentQ, watchedValues), [currentQ, watchedValues]);

  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      if (currentStep > 0) {
        saveToLocalStorage(watchedValues, currentStep);
      }
    }, 800);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [watchedValues, currentStep, saveToLocalStorage]);

  useEffect(() => {
    if (autosaveRestored) return;
    if (isAuthenticated && serverDraftLoading) return;

    if (isAuthenticated && serverDraft) {
      const d = serverDraft as any;
      const hasMeaningfulData = d.annualIncome || d.purchasePrice || d.creditScore || d.monthlyDebts;
      if (hasMeaningfulData) {
        setShowRestoreBanner(true);
        setAutosaveRestored(true);
        return;
      }
    }

    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      const savedStep = localStorage.getItem(AUTOSAVE_STEP_KEY);
      if (saved && savedStep) {
        const step = parseInt(savedStep, 10);
        if (step > 0 && step < QUESTIONS.length) {
          setShowRestoreBanner(true);
          setAutosaveRestored(true);
          return;
        }
      }
    } catch {}
    setAutosaveRestored(true);
  }, [autosaveRestored, isAuthenticated, serverDraft, serverDraftLoading]);

  const handleRestoreDraft = useCallback(() => {
    if (isAuthenticated && serverDraft && (serverDraft as any).annualIncome) {
      const draft = serverDraft as any;
      form.reset({
        ...form.getValues(),
        annualIncome: draft.annualIncome || "",
        employmentType: draft.employmentType || "employed",
        employmentYears: draft.employmentYears ? String(draft.employmentYears) : "",
        monthlyDebts: draft.monthlyDebts || "",
        creditScore: draft.creditScore ? String(draft.creditScore) : "",
        loanPurpose: draft.loanPurpose || "purchase",
        propertyType: draft.propertyType || "single_family",
        purchasePrice: draft.purchasePrice || "",
        downPayment: draft.downPayment || "",
        isVeteran: !!draft.isVeteran,
        isFirstTimeBuyer: !!draft.isFirstTimeBuyer,
        propertyState: draft.propertyState || "",
        hasAdditionalIncome: Array.isArray(draft.incomeSources) && draft.incomeSources.length > 0,
        incomeSources: Array.isArray(draft.incomeSources) ? draft.incomeSources : [],
      });
      if (Array.isArray(draft.incomeSources) && draft.incomeSources.length > 0) {
        const types: string[] = [];
        const details: Record<string, { annualAmount: string; employerName: string; yearsInRole: string }> = {};
        for (const src of draft.incomeSources) {
          types.push(src.type);
          details[src.type] = {
            annualAmount: src.annualAmount || "",
            employerName: src.employerName || "",
            yearsInRole: src.yearsInRole || "",
          };
          if (src.type === "rental" && Array.isArray(src.rentalProperties)) {
            setRentalProperties(src.rentalProperties);
          }
        }
        setSelectedIncomeTypes(types);
        setIncomeDetails(details);
      }
      setCurrentStep(1);
      setShowRestoreBanner(false);
      toast({ title: "Draft restored from your account", description: "We loaded your saved progress." });
      return;
    }
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      const savedStep = localStorage.getItem(AUTOSAVE_STEP_KEY);
      if (saved && savedStep) {
        const parsed = JSON.parse(saved);
        const step = parseInt(savedStep, 10);
        form.reset({ ...form.getValues(), ...parsed });
        if (Array.isArray(parsed.incomeSources) && parsed.incomeSources.length > 0) {
          const types: string[] = [];
          const details: Record<string, { annualAmount: string; employerName: string; yearsInRole: string }> = {};
          for (const src of parsed.incomeSources) {
            types.push(src.type);
            details[src.type] = {
              annualAmount: src.annualAmount || "",
              employerName: src.employerName || "",
              yearsInRole: src.yearsInRole || "",
            };
            if (src.type === "rental" && Array.isArray(src.rentalProperties)) {
              setRentalProperties(src.rentalProperties);
            }
          }
          setSelectedIncomeTypes(types);
          setIncomeDetails(details);
        }
        setCurrentStep(step);
        setShowRestoreBanner(false);
        toast({ title: "Progress restored", description: "We picked up where you left off." });
      }
    } catch {
      setShowRestoreBanner(false);
    }
  }, [form, toast, isAuthenticated, serverDraft]);

  const handleDismissRestore = useCallback(() => {
    setShowRestoreBanner(false);
    clearAutosave();
  }, [clearAutosave]);

  useEffect(() => {
    if (currentStep !== prevStepRef.current && currentStep > 0) {
      track("preapproval_step", "/apply", {
        step: currentStep,
        step_id: currentQ?.id || "",
        total: QUESTIONS.length - 1,
      });
      prevStepRef.current = currentStep;
    }
  }, [currentStep, currentQ, track]);

  // Load draft application if user is authenticated
  const { data: draftApp } = useQuery({
    queryKey: ["/api/loan-applications/draft/latest"],
    queryFn: async () => {
      if (!isAuthenticated) return null;
      const response = await apiRequest("GET", "/api/loan-applications/draft/latest");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Load coach intake data to pre-fill empty fields
  const { data: coachIntake } = useQuery<{
    intake: {
      annualIncome?: string;
      monthlyDebts?: string;
      creditScore?: string;
      employmentType?: string;
      employmentYears?: string;
      downPayment?: string;
      purchasePrice?: string;
      propertyType?: string;
      loanPurpose?: string;
      isVeteran?: boolean;
      isFirstTimeBuyer?: boolean;
    } | null;
    readinessTier?: string;
    completionPercentage?: number;
  } | null>({
    queryKey: ["/api/coach/intake/latest"],
    enabled: isAuthenticated,
  });

  const [prefillApplied, setPrefillApplied] = useState(false);

  // Initialize with draft data, then fill remaining gaps with coach intake
  useEffect(() => {
    if (prefillApplied) return;

    const formData: Partial<PreApprovalFormData> = {};
    let hasData = false;

    if (draftApp) {
      setApplicationId(draftApp.id);
      if (draftApp.annualIncome) formData.annualIncome = String(draftApp.annualIncome);
      if (draftApp.employmentType) formData.employmentType = draftApp.employmentType;
      if (draftApp.employmentYears) formData.employmentYears = String(draftApp.employmentYears);
      if (draftApp.monthlyDebts) formData.monthlyDebts = String(draftApp.monthlyDebts);
      if (draftApp.creditScore) formData.creditScore = String(draftApp.creditScore);
      if (draftApp.loanPurpose) formData.loanPurpose = draftApp.loanPurpose;
      if (draftApp.propertyType) formData.propertyType = draftApp.propertyType;
      if (draftApp.purchasePrice) formData.purchasePrice = String(draftApp.purchasePrice);
      if (draftApp.downPayment) formData.downPayment = String(draftApp.downPayment);
      formData.isVeteran = draftApp.isVeteran || false;
      formData.isFirstTimeBuyer = draftApp.isFirstTimeBuyer || false;
      if (draftApp.propertyState) formData.propertyState = draftApp.propertyState;
      hasData = true;
    }

    const ci = coachIntake?.intake;
    if (ci) {
      const validEmploymentTypes = ["employed", "self_employed", "retired", "other"] as const;
      const validPropertyTypes = ["single_family", "condo", "townhouse", "multi_family"] as const;
      const validLoanPurposes = ["purchase", "refinance", "cash_out"] as const;
      const validCreditScores = ["760", "720", "680", "640", "600", "not_sure"] as const;

      if (!formData.annualIncome && ci.annualIncome) formData.annualIncome = ci.annualIncome.replace(/[^0-9.]/g, "");
      if (!formData.monthlyDebts && ci.monthlyDebts) formData.monthlyDebts = ci.monthlyDebts.replace(/[^0-9.]/g, "");
      if (!formData.creditScore && ci.creditScore) {
        const score = parseInt(ci.creditScore.replace(/[^0-9]/g, ""), 10);
        const matched = validCreditScores.find(v => Math.abs(parseInt(v) - score) <= 30);
        if (matched) formData.creditScore = matched;
      }
      if (!formData.employmentType && ci.employmentType && validEmploymentTypes.includes(ci.employmentType as any)) {
        formData.employmentType = ci.employmentType as PreApprovalFormData["employmentType"];
      }
      if (!formData.employmentYears && ci.employmentYears) formData.employmentYears = ci.employmentYears.replace(/[^0-9]/g, "");
      if (!formData.downPayment && ci.downPayment) formData.downPayment = ci.downPayment.replace(/[^0-9.]/g, "");
      if (!formData.purchasePrice && ci.purchasePrice) formData.purchasePrice = ci.purchasePrice.replace(/[^0-9.]/g, "");
      if (!formData.propertyType && ci.propertyType && validPropertyTypes.includes(ci.propertyType as any)) {
        formData.propertyType = ci.propertyType as PreApprovalFormData["propertyType"];
      }
      if (!formData.loanPurpose && ci.loanPurpose && validLoanPurposes.includes(ci.loanPurpose as any)) {
        formData.loanPurpose = ci.loanPurpose as PreApprovalFormData["loanPurpose"];
      }
      if (formData.isVeteran === undefined && ci.isVeteran !== undefined) formData.isVeteran = ci.isVeteran;
      if (formData.isFirstTimeBuyer === undefined && ci.isFirstTimeBuyer !== undefined) formData.isFirstTimeBuyer = ci.isFirstTimeBuyer;
      hasData = true;
    }

    if (hasData) {
      form.reset({ ...form.getValues(), ...formData } as PreApprovalFormData);
      setPrefillApplied(true);
    }
  }, [draftApp, coachIntake, form, prefillApplied]);

  // Create/update application mutation
  const submitMutation = useMutation({
    mutationFn: async (data: PreApprovalFormData) => {
      const payload: Record<string, unknown> = {
        ...data,
        annualIncome: data.annualIncome.replace(/,/g, ""),
        purchasePrice: data.purchasePrice.replace(/,/g, ""),
        downPayment: data.downPayment.replace(/,/g, ""),
        monthlyDebts: data.monthlyDebts.replace(/,/g, ""),
      };

      if (inviteId.current) {
        payload.inviteId = inviteId.current;
      }

      if (applicationId) {
        const response = await apiRequest("PATCH", `/api/loan-applications/${applicationId}`, payload);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/loan-applications", payload);
        return response.json();
      }
    },
    onSuccess: async (result) => {
      clearAutosave();
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });

      if (inviteId.current) {
        sessionStorage.removeItem("inviteId");
        sessionStorage.removeItem("prefillName");
        sessionStorage.removeItem("prefillEmail");
      }

      toast({
        title: "Pre-Approval Complete!",
        description: "Analyzing your profile with AI...",
      });
      navigate(`/loan-options/${result.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNext = async () => {
    if (currentQ.type === "intro") {
      trackFormStart("preapproval");
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
      return;
    }

    if (currentQ.type === "final") {
      const isValid = await form.trigger();
      if (isValid) {
        if (!isAuthenticated) {
          saveToLocalStorage(form.getValues(), currentStep);
          localStorage.setItem(PENDING_SUBMIT_KEY, "true");
          setShowAuthGate(true);
          return;
        }
        submitMutation.mutate(form.getValues());
      } else {
        toast({ 
          title: "Please complete all fields", 
          description: "Some required information is missing.",
          variant: "destructive" 
        });
      }
      return;
    }

    if (currentQ.type === "boolean_pair") {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
      return;
    }

    if (currentQ.id === "incomeSources") {
      const sources = form.getValues("incomeSources") || [];
      const allValid = sources.length > 0 && sources.every((s: IncomeSourceEntry) => {
        if (s.type === "rental") {
          const props = s.rentalProperties || [];
          return props.length > 0 && props.every((p: RentalPropertyEntry) => p.address && p.monthlyRentalIncome && parseFloat(String(p.monthlyRentalIncome).replace(/,/g, "")) > 0);
        }
        return s.annualAmount && s.annualAmount.length > 0;
      });
      if (!allValid && sources.length > 0) {
        toast({
          title: "Please complete all income details",
          description: "Each income source needs at least an annual amount. Rental properties need an address and monthly income.",
          variant: "destructive"
        });
        return;
      }
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
      return;
    }

    if (currentQ.field) {
      const isValid = await form.trigger(currentQ.field);
      if (isValid) {
        setDirection(1);
        const nextStep = currentStep + 1;
        const nextQ = QUESTIONS[nextStep];
        if (nextQ && nextQ.id === "incomeSources" && !form.getValues("hasAdditionalIncome")) {
          setCurrentStep(nextStep + 1);
        } else {
          setCurrentStep(nextStep);
        }
      } else {
        toast({ 
          title: "Please fill out this field", 
          description: "This information is required to continue.",
          variant: "destructive" 
        });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      const prevStep = currentStep - 1;
      const prevQ = QUESTIONS[prevStep];
      if (prevQ && prevQ.id === "incomeSources" && !form.getValues("hasAdditionalIncome")) {
        setCurrentStep(prevStep - 1);
      } else {
        setCurrentStep(prevStep);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentQ.type !== "choice" && currentQ.type !== "state" && currentQ.type !== "income_sources") {
      e.preventDefault();
      handleNext();
    }
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const renderInput = () => {
    const IconComponent = currentQ.icon;

    switch (currentQ.type) {
      case "currency": {
        const fieldName = currentQ.field as keyof PreApprovalFormData;
        const watchedValue = form.watch(fieldName);
        const displayValue = typeof watchedValue === 'string' ? watchedValue : "";
        const fieldError = form.formState.errors[fieldName];
        return (
          <div className="w-full max-w-md mx-auto">
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />
              <Input
                key={`currency-${fieldName}`}
                autoFocus
                data-testid={`input-${currentQ.field}`}
                value={displayValue}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value);
                  form.setValue(fieldName, formatted as never, { shouldValidate: true, shouldDirty: true });
                }}
                className={`pl-16 h-20 text-4xl border-0 border-b-2 rounded-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40 ${fieldError ? "border-destructive focus-visible:border-destructive" : "border-muted focus-visible:border-primary"}`}
                placeholder={currentQ.placeholder}
                onKeyDown={handleKeyDown}
              />
            </div>
            {fieldError && (
              <p className="mt-2 text-sm text-destructive flex items-center gap-1.5" data-testid={`error-${currentQ.field}`}>
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {fieldError.message as string}
              </p>
            )}
          </div>
        );
      }

      case "number": {
        const fieldName = currentQ.field as keyof PreApprovalFormData;
        const watchedValue = form.watch(fieldName);
        const displayValue = typeof watchedValue === 'string' ? watchedValue : "";
        const fieldError = form.formState.errors[fieldName];
        return (
          <div className="w-full max-w-md mx-auto">
            <div className="relative">
              {IconComponent && <IconComponent className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />}
              <Input
                key={`number-${fieldName}`}
                autoFocus
                data-testid={`input-${currentQ.field}`}
                type="text"
                inputMode="numeric"
                value={displayValue}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  form.setValue(fieldName, value as never, { shouldValidate: true, shouldDirty: true });
                }}
                className={`pl-16 h-20 text-4xl border-0 border-b-2 rounded-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40 ${fieldError ? "border-destructive focus-visible:border-destructive" : "border-muted focus-visible:border-primary"}`}
                placeholder={currentQ.placeholder}
                onKeyDown={handleKeyDown}
              />
            </div>
            {fieldError && (
              <p className="mt-2 text-sm text-destructive flex items-center gap-1.5" data-testid={`error-${currentQ.field}`}>
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {fieldError.message as string}
              </p>
            )}
          </div>
        );
      }

      case "choice":
        return (
          <div className="grid gap-3 w-full max-w-lg mx-auto">
            {currentQ.options?.map((option) => {
              const OptionIcon = option.icon;
              const fieldVal = form.watch(currentQ.field as keyof PreApprovalFormData);
              const isSelected = currentQ.id === "hasAdditionalIncome"
                ? (option.value === "yes" ? fieldVal === true : fieldVal === false)
                : fieldVal === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`option-${currentQ.field}-${option.value}`}
                  onClick={() => {
                    if (currentQ.id === "hasAdditionalIncome") {
                      if (option.value === "yes") {
                        form.setValue("hasAdditionalIncome", true as never);
                      } else {
                        form.setValue("hasAdditionalIncome", false as never);
                        form.setValue("incomeSources", [] as never);
                      }
                      setTimeout(() => {
                        setDirection(1);
                        setCurrentStep((prev) => option.value === "no" ? prev + 2 : prev + 1);
                      }, 200);
                      return;
                    }
                    form.setValue(currentQ.field as keyof PreApprovalFormData, option.value as never);
                    setTimeout(() => {
                      setDirection(1);
                      setCurrentStep((prev) => prev + 1);
                    }, 200);
                  }}
                  className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200 group
                    ${isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-primary/50 hover:bg-muted/50"
                    }`}
                >
                  {OptionIcon && (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                      ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                      <OptionIcon className="h-5 w-5" />
                    </div>
                  )}
                  <span className={`flex-1 ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {option.label}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case "state":
        const selectedState = form.watch("propertyState");
        return (
          <div className="w-full max-w-lg mx-auto">
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {US_STATES.map((state) => (
                <button
                  key={state.value}
                  type="button"
                  data-testid={`option-state-${state.value}`}
                  onClick={() => {
                    form.setValue("propertyState", state.value, { shouldValidate: true });
                    setTimeout(() => {
                      setDirection(1);
                      setCurrentStep((prev) => prev + 1);
                    }, 200);
                  }}
                  className={`p-3 text-center font-medium border-2 rounded-lg transition-all duration-150
                    ${selectedState === state.value 
                      ? "border-primary bg-primary text-primary-foreground" 
                      : "border-muted hover:border-primary/50 hover:bg-muted/50"
                    }`}
                >
                  {state.value}
                </button>
              ))}
            </div>
          </div>
        );

      case "income_sources": {
        const employmentTypeMap: Record<string, string> = { employed: "w2", self_employed: "self_employed", retired: "pension" };
        const primaryType = employmentTypeMap[form.getValues("employmentType") || ""] || "";
        const allIncomeTypes = [
          { value: "w2", label: "W-2 Employment", icon: Briefcase },
          { value: "self_employed", label: "Self-Employment / 1099", icon: Users },
          { value: "rental", label: "Rental Income", icon: Home },
          { value: "social_security", label: "Social Security", icon: Shield },
          { value: "pension", label: "Pension / Retirement", icon: Clock },
          { value: "investment", label: "Investment Income", icon: TrendingUp },
          { value: "other", label: "Other Income", icon: DollarSign },
        ].filter((t) => t.value !== primaryType);

        const buildFormEntries = (types: string[], details: typeof incomeDetails, rentals: RentalPropertyEntry[]) => {
          return types.map((t) => {
            const d = details[t] || { annualAmount: "", employerName: "", yearsInRole: "" };
            const entry: IncomeSourceEntry & { rentalProperties?: RentalPropertyEntry[] } = {
              type: t as IncomeSourceEntry["type"],
              annualAmount: d.annualAmount || "",
              employerName: d.employerName || "",
              yearsInRole: d.yearsInRole || "",
            };
            if (t === "rental" && rentals.length > 0) {
              entry.rentalProperties = rentals;
              const totalMonthly = rentals.reduce((sum, p) => sum + (parseFloat(p.monthlyRentalIncome.replace(/,/g, "")) || 0), 0);
              entry.annualAmount = totalMonthly > 0 ? formatCurrency(String(Math.round(totalMonthly * 12))) : "";
            }
            return entry;
          });
        };

        const toggleIncomeType = (typeValue: string) => {
          const isSelected = selectedIncomeTypes.includes(typeValue);
          let newTypes: string[];
          if (isSelected) {
            newTypes = selectedIncomeTypes.filter((t) => t !== typeValue);
            const newDetails = { ...incomeDetails };
            delete newDetails[typeValue];
            setIncomeDetails(newDetails);
            if (typeValue === "rental") {
              setRentalProperties([]);
            }
          } else {
            newTypes = [...selectedIncomeTypes, typeValue];
            if (!incomeDetails[typeValue]) {
              setIncomeDetails({ ...incomeDetails, [typeValue]: { annualAmount: "", employerName: "", yearsInRole: "" } });
            }
            if (typeValue === "rental" && rentalProperties.length === 0) {
              setRentalProperties([{ address: "", monthlyRentalIncome: "", monthlyDebtPayment: "" }]);
            }
          }
          setSelectedIncomeTypes(newTypes);
          form.setValue("incomeSources", buildFormEntries(newTypes, isSelected ? incomeDetails : { ...incomeDetails, [typeValue]: incomeDetails[typeValue] || { annualAmount: "", employerName: "", yearsInRole: "" } }, typeValue === "rental" && isSelected ? [] : rentalProperties) as never);
        };

        const updateDetail = (typeValue: string, field: string, value: string) => {
          const newDetails = {
            ...incomeDetails,
            [typeValue]: { ...incomeDetails[typeValue], [field]: value },
          };
          setIncomeDetails(newDetails);
          form.setValue("incomeSources", buildFormEntries(selectedIncomeTypes, newDetails, rentalProperties) as never);
        };

        const addRentalProperty = () => {
          const updated = [...rentalProperties, { address: "", monthlyRentalIncome: "", monthlyDebtPayment: "" }];
          setRentalProperties(updated);
          form.setValue("incomeSources", buildFormEntries(selectedIncomeTypes, incomeDetails, updated) as never);
        };

        const removeRentalProperty = (index: number) => {
          const updated = rentalProperties.filter((_, i) => i !== index);
          setRentalProperties(updated);
          form.setValue("incomeSources", buildFormEntries(selectedIncomeTypes, incomeDetails, updated) as never);
        };

        const updateRentalProperty = (index: number, field: keyof RentalPropertyEntry, value: string) => {
          const updated = rentalProperties.map((p, i) => i === index ? { ...p, [field]: value } : p);
          setRentalProperties(updated);
          form.setValue("incomeSources", buildFormEntries(selectedIncomeTypes, incomeDetails, updated) as never);
        };

        const needsEmployerDetails = (typeValue: string) => typeValue === "w2" || typeValue === "self_employed";

        const rentalAnnualTotal = rentalProperties.reduce((sum, p) => sum + (parseFloat(p.monthlyRentalIncome.replace(/,/g, "")) || 0), 0) * 12;

        return (
          <div className="w-full max-w-lg mx-auto space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {allIncomeTypes.map((incomeType) => {
                const TypeIcon = incomeType.icon;
                const isActive = selectedIncomeTypes.includes(incomeType.value);
                return (
                  <button
                    key={incomeType.value}
                    type="button"
                    data-testid={`toggle-income-${incomeType.value}`}
                    onClick={() => toggleIncomeType(incomeType.value)}
                    className={`flex items-center gap-3 p-4 text-left text-sm font-medium border-2 rounded-xl transition-all duration-200
                      ${isActive
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                      }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors shrink-0
                      ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <span className={`flex-1 ${isActive ? "text-primary" : "text-foreground"}`}>
                      {incomeType.label}
                    </span>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0
                      ${isActive ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                      {isActive && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedIncomeTypes.length > 0 && (
              <div className="space-y-4">
                {selectedIncomeTypes.map((typeValue) => {
                  const typeInfo = allIncomeTypes.find((t) => t.value === typeValue);
                  const details = incomeDetails[typeValue] || { annualAmount: "", employerName: "", yearsInRole: "" };

                  if (typeValue === "rental") {
                    return (
                      <div key={typeValue} className="border-2 rounded-xl p-5 space-y-4 text-left" data-testid="card-income-rental">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Home className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-foreground">Rental Properties</span>
                          {rentalAnnualTotal > 0 && (
                            <span className="text-sm text-muted-foreground ml-auto">
                              ${formatCurrency(String(Math.round(rentalAnnualTotal)))}/yr total
                            </span>
                          )}
                        </div>

                        {rentalProperties.map((prop, idx) => (
                          <div key={idx} className="border rounded-xl p-4 space-y-3 bg-muted/30" data-testid={`rental-property-${idx}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">Property {idx + 1}</span>
                              {rentalProperties.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  data-testid={`button-remove-rental-${idx}`}
                                  onClick={() => removeRentalProperty(idx)}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                            <div>
                              <label className="text-sm text-muted-foreground mb-1 block">Property Address</label>
                              <AddressInput
                                placeholder="Start typing a property address..."
                                defaultValue={prop.address}
                                onSelect={(result) => updateRentalProperty(idx, "address", result.formattedAddress)}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Monthly Rental Income</label>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    data-testid={`input-rental-income-${idx}`}
                                    value={prop.monthlyRentalIncome}
                                    onChange={(e) => updateRentalProperty(idx, "monthlyRentalIncome", formatCurrency(e.target.value))}
                                    className="pl-9"
                                    placeholder="2,000"
                                    inputMode="decimal"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Monthly Debt Payment</label>
                                <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    data-testid={`input-rental-debt-${idx}`}
                                    value={prop.monthlyDebtPayment || ""}
                                    onChange={(e) => updateRentalProperty(idx, "monthlyDebtPayment", formatCurrency(e.target.value))}
                                    className="pl-9"
                                    placeholder="1,200"
                                    inputMode="decimal"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        <Button
                          type="button"
                          variant="outline"
                          data-testid="button-add-rental-property"
                          onClick={addRentalProperty}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Another Property
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <div key={typeValue} className="border-2 rounded-xl p-5 space-y-4 text-left" data-testid={`card-income-${typeValue}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {typeInfo && <typeInfo.icon className="h-4 w-4 text-primary" />}
                        <span className="font-semibold text-foreground">{typeInfo?.label}</span>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Annual Amount</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            data-testid={`input-income-amount-${typeValue}`}
                            value={details.annualAmount}
                            onChange={(e) => updateDetail(typeValue, "annualAmount", formatCurrency(e.target.value))}
                            className="pl-9"
                            placeholder="75,000"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">
                          {needsEmployerDetails(typeValue) ? "Employer Name" : "Source"}
                        </label>
                        <Input
                          data-testid={`input-income-employer-${typeValue}`}
                          value={details.employerName}
                          onChange={(e) => updateDetail(typeValue, "employerName", e.target.value)}
                          placeholder={needsEmployerDetails(typeValue) ? "Company name" : "Source name (optional)"}
                        />
                      </div>
                      {needsEmployerDetails(typeValue) && (
                        <div>
                          <label className="text-sm text-muted-foreground mb-1 block">Years in Role</label>
                          <Input
                            data-testid={`input-income-years-${typeValue}`}
                            value={details.yearsInRole}
                            onChange={(e) => updateDetail(typeValue, "yearsInRole", e.target.value.replace(/\D/g, ""))}
                            placeholder="3"
                            inputMode="numeric"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case "boolean_pair":
        return (
          <div className="grid gap-4 w-full max-w-lg mx-auto">
            {currentQ.booleanFields?.map((field) => {
              const FieldIcon = field.icon;
              const isChecked = form.watch(field.field) as boolean;
              return (
                <button
                  key={field.field}
                  type="button"
                  data-testid={`toggle-${field.field}`}
                  onClick={() => {
                    form.setValue(field.field, !isChecked as never);
                  }}
                  className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200
                    ${isChecked 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-primary/50"
                    }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                    ${isChecked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <FieldIcon className="h-5 w-5" />
                  </div>
                  <span className={`flex-1 ${isChecked ? "text-primary" : "text-foreground"}`}>
                    {field.label}
                  </span>
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                    ${isChecked ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {isChecked && <Check className="w-4 h-4 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        );
        
      default:
        return null;
    }
  };

  const restoreBanner = showRestoreBanner ? (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      data-testid="banner-restore-draft"
    >
      <div className="bg-card border shadow-lg rounded-xl p-4 flex items-center gap-3">
        <div className="bg-primary/10 rounded-lg p-2 shrink-0">
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">You have unsaved progress</p>
          <p className="text-xs text-muted-foreground">Pick up where you left off?</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="ghost" onClick={handleDismissRestore} data-testid="button-dismiss-restore">
            No
          </Button>
          <Button size="sm" onClick={handleRestoreDraft} data-testid="button-restore-draft">
            Restore
          </Button>
        </div>
      </div>
    </motion.div>
  ) : null;

  if (currentQ.type === "intro") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
        {restoreBanner}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <div className="mb-8 flex justify-center">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Home className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6"
            data-testid="text-intro-title"
          >
            {currentQ.title}
          </h1>
          <p className="text-xl text-muted-foreground mb-12">{currentQ.subtitle}</p>
          <Button 
            onClick={handleNext} 
            size="lg" 
            className="text-lg px-8 py-6 h-auto rounded-full"
            data-testid="button-start-preapproval"
          >
            {currentQ.buttonText} <ArrowRight className="ml-2" />
          </Button>
          <p className="mt-8 text-sm text-muted-foreground">
            Have a saved application?{" "}
            <a href="/login" className="text-primary hover:underline">
              Sign in to resume
            </a>
          </p>
          {urlPropertyId && urlSource === "property-detail" && (
            <Link href={`/properties/${urlPropertyId}`}>
              <Button variant="ghost" size="sm" className="mt-4 gap-1.5 text-muted-foreground" data-testid="button-back-to-property">
                <ChevronLeft className="h-3.5 w-3.5" /> Back to property listing
              </Button>
            </Link>
          )}
        </motion.div>
      </div>
    );
  }

  // The Conversational Form Steps
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      <SEOHead title="Get Pre-Approved in 3 Minutes" description="Start your mortgage pre-approval application. Answer a few questions about your income and finances to get a clear, confident approval decision." />
      {restoreBanner}
      
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-muted z-50">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${(currentStep / (QUESTIONS.length - 1)) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Navigation Header */}
      <div className="fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-40 bg-background/80 backdrop-blur-sm">
        <button 
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`p-2 rounded-full hover:bg-muted transition-all ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          data-testid="button-back"
        >
          <ChevronLeft className="w-6 h-6 text-muted-foreground" />
        </button>
        <div className="flex flex-col items-center" data-testid="text-step-counter">
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStep} of {QUESTIONS.length - 1}
          </span>
          <span className="text-[11px] text-muted-foreground/60">
            {currentStep <= 3 ? "~2 min left" : currentStep <= 7 ? "~1 min left" : "Almost done"}
          </span>
        </div>
        <div className="flex items-center gap-1 w-10 justify-end">
          {currentStep > 0 && (
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1" data-testid="text-autosave-indicator">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Advisory Panel (Desktop only) */}
      <AdvisoryPanel formValues={watchedValues} currentStepId={currentQ.id} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 pt-20 pb-0 w-full max-w-4xl mx-auto relative lg:pr-96">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            initial={{ x: direction * 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -50, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full text-center"
          >
            {/* Question Title */}
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight"
              data-testid="text-question"
            >
              {dynamicTitle}
            </h2>
            
            {currentQ.subtitle && (
              <p className="text-lg text-muted-foreground mb-8">{currentQ.subtitle}</p>
            )}

            {currentQ.subtext && (
               <p className="text-base text-muted-foreground/70 mb-8 max-w-lg mx-auto">{currentQ.subtext}</p>
            )}

            {/* Input Area */}
            <div className="mb-10">
              {renderInput()}
            </div>

            {/* Continue Button (for non-choice inputs) */}
            {(currentQ.type === "currency" || currentQ.type === "number" || currentQ.type === "boolean_pair" || currentQ.type === "income_sources" || currentQ.type === "final") && (
              <Button 
                onClick={handleNext} 
                size="lg" 
                disabled={submitMutation.isPending}
                className="text-lg px-10 py-6 h-auto rounded-full shadow-lg hover:shadow-xl transition-all"
                data-testid={currentQ.type === "final" ? "button-submit" : "button-continue"}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : currentQ.type === "final" ? (
                  "Get My Loan Options"
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {showAuthGate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          data-testid="auth-gate-overlay"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border rounded-xl shadow-lg p-8 max-w-md w-full text-center"
          >
            <div className="mx-auto mb-6 h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-3" data-testid="text-auth-gate-title">
              One last step
            </h3>
            <p className="text-muted-foreground mb-6">
              Sign in to see your pre-approval results. Your answers are already saved.
            </p>
            <div className="space-y-3">
              <a href="/login" className="block">
                <Button size="lg" className="w-full" data-testid="button-auth-gate-login">
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthGate(false)}
                data-testid="button-auth-gate-dismiss"
              >
                Go back to form
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
              <Shield className="h-3 w-3" />
              Your data is encrypted and never shared
            </p>
          </motion.div>
        </motion.div>
      )}

      {/* Compliance Footer */}
      <footer className="border-t border-muted bg-muted/30 mt-auto" data-testid="footer-compliance">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <div className="text-xs text-muted-foreground leading-relaxed space-y-4">
            <p>
              <sup>1</sup> Homiquity&apos;s pre-approval process uses self-reported information and a soft credit inquiry to provide an initial determination. A soft credit check will not affect your credit score. Final loan approval is subject to full underwriting review, including verification of income, assets, employment, and property appraisal. Pre-approval is not a commitment to lend and does not guarantee final approval. All loans are subject to credit and property approval. Terms and conditions apply.
            </p>
          </div>

          <div className="border-t border-muted pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <p className="font-semibold text-foreground text-base mb-3">Homiquity</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Homiquity Mortgage Corporation is a direct lender dedicated to providing a fast, transparent digital mortgage experience backed by superior customer support.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">Contact Us</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>support@homiquity.com</p>
                  <p>(555) 123-4567</p>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="font-medium text-foreground text-xs">Resources</p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>FAQ</p>
                    <p>Privacy Policy</p>
                    <p>Terms of Use</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">Legal</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>NMLS Consumer Access</p>
                  <p>Disclosures & Licensing</p>
                  <p>Equal Housing Lender</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-muted pt-4 text-xs text-muted-foreground leading-relaxed space-y-3">
            <p>
              &copy; {new Date().getFullYear()} Homiquity Mortgage Corporation. All rights reserved. Homiquity is a family of companies serving the homeownership ecosystem including mortgage lending, property search, and AI-powered guidance.
            </p>
            <p>
              Home lending products offered by Homiquity Mortgage Corporation. NMLS #PENDING. Loans made or arranged pursuant to applicable state licensing. Not available in all states. Equal Housing Lender. NMLS Consumer Access.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <div className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                <span>Soft credit check only</span>
              </div>
              <div className="flex items-center gap-1">
                <Home className="h-3.5 w-3.5" />
                <span>Equal Housing Lender</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
