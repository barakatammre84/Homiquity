import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { PrivateLayout } from "@/components/layouts/PrivateLayout";
import { EmailCaptureModal } from "@/components/EmailCaptureModal";
import { Loader2 } from "lucide-react";

const Landing = lazy(() => import("@/pages/public/Landing"));
const Privacy = lazy(() => import("@/pages/public/Privacy"));
const Terms = lazy(() => import("@/pages/public/Terms"));
const Disclosures = lazy(() => import("@/pages/public/Disclosures"));
const TestLogin = lazy(() => import("@/pages/public/TestLogin"));
const RedeemInvite = lazy(() => import("@/pages/public/RedeemInvite"));
const Login = lazy(() => import("@/pages/public/Login"));
const Signup = lazy(() => import("@/pages/public/Signup"));
const AffordabilityCheck = lazy(() => import("@/pages/public/AffordabilityCheck"));

const PreApproval = lazy(() => import("@/pages/lending/PreApproval"));
const LoanOptions = lazy(() => import("@/pages/lending/LoanOptions"));
const LoanPipeline = lazy(() => import("@/pages/lending/LoanPipeline"));
const LoanEstimate = lazy(() => import("@/pages/lending/LoanEstimate"));
const ApplicationSummary = lazy(() => import("@/pages/lending/ApplicationSummary"));
const BorrowerDealComparison = lazy(() => import("@/pages/lending/BorrowerDealComparison"));

const Dashboard = lazy(() => import("@/pages/borrower/Dashboard"));
const Documents = lazy(() => import("@/pages/borrower/Documents"));
const Tasks = lazy(() => import("@/pages/borrower/Tasks"));
const TaskDetail = lazy(() => import("@/pages/borrower/TaskDetail"));
const Messages = lazy(() => import("@/pages/borrower/Messages"));
const URLAForm = lazy(() => import("@/pages/borrower/URLAForm"));
const CreditConsent = lazy(() => import("@/pages/borrower/CreditConsent"));
const Verification = lazy(() => import("@/pages/borrower/Verification"));
const IdentityVerification = lazy(() => import("@/pages/borrower/IdentityVerification"));
const OnboardingJourney = lazy(() => import("@/pages/borrower/OnboardingJourney"));
const EConsent = lazy(() => import("@/pages/borrower/EConsent"));
const GapCalculator = lazy(() => import("@/pages/borrower/GapCalculator"));
const BuyerProperties = lazy(() => import("@/pages/borrower/BuyerProperties"));
const HmdaDemographics = lazy(() => import("@/pages/borrower/HmdaDemographics"));

const StaffDashboard = lazy(() => import("@/pages/staff/StaffDashboard"));
const BorrowerFile = lazy(() => import("@/pages/staff/BorrowerFile"));
const PolicyOps = lazy(() => import("@/pages/staff/PolicyOps"));
const PricingMatrices = lazy(() => import("@/pages/staff/PricingMatrices"));
const TaskOperations = lazy(() => import("@/pages/staff/TaskOperations"));

const AgentCoBranding = lazy(() => import("@/pages/agent-broker/AgentCoBranding"));
const AgentDashboard = lazy(() => import("@/pages/agent-broker/AgentDashboard"));
const AgentEdit = lazy(() => import("@/pages/agent-broker/AgentEdit"));
const AgentPipeline = lazy(() => import("@/pages/agent-broker/AgentPipeline"));
const BrokerDashboard = lazy(() => import("@/pages/agent-broker/BrokerDashboard"));
const InviteGenerator = lazy(() => import("@/pages/agent-broker/InviteGenerator"));
const PartnerServices = lazy(() => import("@/pages/agent-broker/PartnerServices"));
const ReferralLanding = lazy(() => import("@/pages/agent-broker/ReferralLanding"));
const PartnerLanding = lazy(() => import("@/pages/agent-broker/PartnerLanding"));
const ApplyInvite = lazy(() => import("@/pages/agent-broker/ApplyInvite"));
const FindAnAgent = lazy(() => import("@/pages/agent-broker/FindAnAgent"));

const ScenarioDesk = lazy(() => import("@/pages/realtor-engine/ScenarioDesk"));
const DealRescue = lazy(() => import("@/pages/realtor-engine/DealRescue"));
const StrategySessions = lazy(() => import("@/pages/realtor-engine/StrategySessions"));
const ClosingGuarantee = lazy(() => import("@/pages/realtor-engine/ClosingGuarantee"));

const Properties = lazy(() => import("@/pages/property/Properties"));
const PropertyDetail = lazy(() => import("@/pages/property/PropertyDetail"));
const LivePropertyDetail = lazy(() => import("@/pages/property/LivePropertyDetail"));
const PropertyForm = lazy(() => import("@/pages/property/PropertyForm"));

const FirstTimeBuyerHub = lazy(() => import("@/pages/education/FirstTimeBuyerHub"));
const DownPaymentWizard = lazy(() => import("@/pages/education/DownPaymentWizard"));
const LearningCenter = lazy(() => import("@/pages/education/LearningCenter"));
const ArticleDetail = lazy(() => import("@/pages/education/ArticleDetail"));
const FAQ = lazy(() => import("@/pages/education/FAQ"));
const Resources = lazy(() => import("@/pages/education/Resources"));
const AcceleratorProgram = lazy(() => import("@/pages/education/AcceleratorProgram"));
const AICoach = lazy(() => import("@/pages/education/AICoach"));

const HomeownerDashboard = lazy(() => import("@/pages/homeowner/HomeownerDashboard"));

const PurchaseRates = lazy(() => import("@/pages/rates/PurchaseRates"));
const RefinanceRates = lazy(() => import("@/pages/rates/RefinanceRates"));
const CashOutRates = lazy(() => import("@/pages/rates/CashOutRates"));
const HelocRates = lazy(() => import("@/pages/rates/HelocRates"));
const VaRates = lazy(() => import("@/pages/rates/VaRates"));
const MortgageRates = lazy(() => import("@/pages/rates/MortgageRates"));

const RentVsBuyCalculator = lazy(() => import("@/pages/calculators/RentVsBuyCalculator"));
const AffordabilityCalculator = lazy(() => import("@/pages/calculators/AffordabilityCalculator"));
const MortgageCalculator = lazy(() => import("@/pages/calculators/MortgageCalculator"));
const RentToOwnReadiness = lazy(() => import("@/pages/calculators/RentToOwnReadiness"));

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminRates = lazy(() => import("@/pages/admin/AdminRates"));
const AdminContent = lazy(() => import("@/pages/admin/AdminContent"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));

import NotFound from "@/pages/not-found";

const isProduction = import.meta.env.PROD;

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" data-testid="page-loader">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function PublicPage({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}

function BorrowerPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout requiredRoles={["aspiring_owner", "active_buyer"]}>{children}</PrivateLayout>;
}

function StaffPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout requiredRoles={["admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"]}>{children}</PrivateLayout>;
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout requiredRoles={["admin"]}>{children}</PrivateLayout>;
}

function AnyAuthPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout>{children}</PrivateLayout>;
}

function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public Pages - Anyone can access */}
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        {!isProduction && <Route path="/test-login" component={TestLogin} />}
        <Route path="/redeem-invite" component={RedeemInvite} />
        <Route path="/redeem-invite/:code" component={RedeemInvite} />
        <Route path="/apply" component={PreApproval} />
        <Route path="/apply/:token">
          {(params) => <ApplyInvite />}
        </Route>
        <Route path="/ref/:code">
          {(params) => <ReferralLanding />}
        </Route>
        <Route path="/partner/:profileId">
          {(params) => <PartnerLanding />}
        </Route>
        <Route path="/find-an-agent">
          <PublicPage><FindAnAgent /></PublicPage>
        </Route>
        <Route path="/resources">
          <PublicPage><Resources /></PublicPage>
        </Route>
        <Route path="/learn">
          <PublicPage><LearningCenter /></PublicPage>
        </Route>
        <Route path="/learn/:slug">
          {(params) => <PublicPage><ArticleDetail /></PublicPage>}
        </Route>
        <Route path="/faq">
          <PublicPage><FAQ /></PublicPage>
        </Route>
        <Route path="/privacy">
          <Privacy />
        </Route>
        <Route path="/terms">
          <Terms />
        </Route>
        <Route path="/disclosures">
          <Disclosures />
        </Route>
        
        {/* Property Pages - Public */}
        <Route path="/first-time-buyer">
          <PublicPage><FirstTimeBuyerHub /></PublicPage>
        </Route>
        <Route path="/down-payment-wizard">
          <PublicPage><DownPaymentWizard /></PublicPage>
        </Route>
        <Route path="/properties">
          <PublicPage><Properties /></PublicPage>
        </Route>
        <Route path="/properties/live">
          <PublicPage><LivePropertyDetail /></PublicPage>
        </Route>
        <Route path="/properties/:id">
          {(params) => <PublicPage><PropertyDetail /></PublicPage>}
        </Route>

        {/* Rate Pages - Public with navigation header */}
        <Route path="/rates">
          <PublicPage><MortgageRates /></PublicPage>
        </Route>
        <Route path="/rates/purchase">
          <PublicPage><PurchaseRates /></PublicPage>
        </Route>
        <Route path="/rates/refinance">
          <PublicPage><RefinanceRates /></PublicPage>
        </Route>
        <Route path="/rates/cash-out">
          <PublicPage><CashOutRates /></PublicPage>
        </Route>
        <Route path="/rates/heloc">
          <PublicPage><HelocRates /></PublicPage>
        </Route>
        <Route path="/rates/va">
          <PublicPage><VaRates /></PublicPage>
        </Route>

        {/* Calculator Pages - Public with navigation header */}
        <Route path="/calculators/rent-vs-buy">
          <PublicPage><RentVsBuyCalculator /></PublicPage>
        </Route>
        <Route path="/calculators/affordability">
          <PublicPage><AffordabilityCalculator /></PublicPage>
        </Route>
        <Route path="/calculators/mortgage">
          <PublicPage><MortgageCalculator /></PublicPage>
        </Route>
        <Route path="/calculators/rent-to-own">
          <PublicPage><RentToOwnReadiness /></PublicPage>
        </Route>

        {/* Affordability Check - "Can I Afford This Home?" */}
        <Route path="/afford" component={AffordabilityCheck} />

        {/* Private Pages - Any authenticated user (role-aware content) */}
        <Route path="/dashboard">
          <AnyAuthPage><Dashboard /></AnyAuthPage>
        </Route>
        <Route path="/tasks">
          <AnyAuthPage><Tasks /></AnyAuthPage>
        </Route>
        <Route path="/task/:id">
          {(params) => <AnyAuthPage><TaskDetail /></AnyAuthPage>}
        </Route>
        <Route path="/messages">
          <AnyAuthPage><Messages /></AnyAuthPage>
        </Route>
        <Route path="/messages/:memberId">
          {(params) => <AnyAuthPage><Messages /></AnyAuthPage>}
        </Route>
        <Route path="/documents">
          <AnyAuthPage><Documents /></AnyAuthPage>
        </Route>

        {/* Private Pages - Borrower only (clients working on their mortgage) */}
        <Route path="/gap-calculator">
          <BorrowerPage><GapCalculator /></BorrowerPage>
        </Route>
        <Route path="/loan-options/:id">
          {(params) => <BorrowerPage><LoanOptions /></BorrowerPage>}
        </Route>
        <Route path="/pipeline/:id">
          {(params) => <BorrowerPage><LoanPipeline /></BorrowerPage>}
        </Route>
        <Route path="/application-summary">
          <BorrowerPage><ApplicationSummary /></BorrowerPage>
        </Route>
        <Route path="/verification">
          <BorrowerPage><Verification /></BorrowerPage>
        </Route>
        <Route path="/identity-verification">
          <BorrowerPage><IdentityVerification /></BorrowerPage>
        </Route>
        <Route path="/onboarding">
          <BorrowerPage><OnboardingJourney /></BorrowerPage>
        </Route>
        <Route path="/credit-consent/:id">
          {(params) => <BorrowerPage><CreditConsent /></BorrowerPage>}
        </Route>
        <Route path="/hmda/:id">
          {(params) => <BorrowerPage><HmdaDemographics /></BorrowerPage>}
        </Route>
        <Route path="/urla-form">
          <BorrowerPage><URLAForm /></BorrowerPage>
        </Route>
        <Route path="/compare-offers/:id">
          {(params) => <BorrowerPage><BorrowerDealComparison /></BorrowerPage>}
        </Route>

        {/* Private Pages - Staff (brokers, lenders processing mortgage applications) */}
        <Route path="/staff-dashboard">
          <StaffPage><StaffDashboard /></StaffPage>
        </Route>
        <Route path="/pipeline-queue">
          <Redirect to="/staff-dashboard" />
        </Route>
        <Route path="/borrower-file/:id">
          {(params) => <StaffPage><BorrowerFile /></StaffPage>}
        </Route>
        <Route path="/loan-estimate/:id">
          {(params) => <StaffPage><LoanEstimate /></StaffPage>}
        </Route>
        <Route path="/compliance">
          <Redirect to="/staff-dashboard" />
        </Route>
        <Route path="/staff">
          <Redirect to="/staff-dashboard" />
        </Route>
        <Route path="/broker-dashboard">
          <StaffPage><BrokerDashboard /></StaffPage>
        </Route>
        <Route path="/invite-clients">
          <StaffPage><InviteGenerator /></StaffPage>
        </Route>
        <Route path="/analytics">
          <Redirect to="/staff-dashboard" />
        </Route>
        <Route path="/partner-services">
          <StaffPage><PartnerServices /></StaffPage>
        </Route>
        <Route path="/co-branding">
          <StaffPage><AgentCoBranding /></StaffPage>
        </Route>
        <Route path="/agent-pipeline">
          <StaffPage><AgentPipeline /></StaffPage>
        </Route>
        <Route path="/scenario-desk">
          <StaffPage><ScenarioDesk /></StaffPage>
        </Route>
        <Route path="/deal-rescue">
          <StaffPage><DealRescue /></StaffPage>
        </Route>
        <Route path="/strategy-sessions">
          <StaffPage><StrategySessions /></StaffPage>
        </Route>
        <Route path="/closing-guarantee">
          <StaffPage><ClosingGuarantee /></StaffPage>
        </Route>
        <Route path="/policy-ops">
          <StaffPage><PolicyOps /></StaffPage>
        </Route>
        <Route path="/task-operations">
          <StaffPage><TaskOperations /></StaffPage>
        </Route>
        <Route path="/pricing-matrices">
          <StaffPage><PricingMatrices /></StaffPage>
        </Route>
        <Route path="/accelerator">
          <BorrowerPage><AcceleratorProgram /></BorrowerPage>
        </Route>
        <Route path="/ai-coach">
          <AnyAuthPage><AICoach /></AnyAuthPage>
        </Route>
        <Route path="/homeowner-dashboard">
          <BorrowerPage><HomeownerDashboard /></BorrowerPage>
        </Route>
        <Route path="/e-consent">
          <BorrowerPage><EConsent /></BorrowerPage>
        </Route>
        <Route path="/buy">
          <BorrowerPage><BuyerProperties /></BorrowerPage>
        </Route>

        {/* Private Pages - Agent (real estate agents managing listings) */}
        <Route path="/agent/dashboard">
          <StaffPage><AgentDashboard /></StaffPage>
        </Route>
        <Route path="/agent/edit">
          <StaffPage><AgentEdit /></StaffPage>
        </Route>
        <Route path="/property/new">
          <StaffPage><PropertyForm /></StaffPage>
        </Route>
        <Route path="/property/:id/edit">
          {(params) => <StaffPage><PropertyForm /></StaffPage>}
        </Route>

        {/* Private Pages - Admin only (manage content, rates, users) */}
        <Route path="/admin">
          <AdminPage><AdminDashboard /></AdminPage>
        </Route>
        <Route path="/admin/rates">
          <AdminPage><AdminRates /></AdminPage>
        </Route>
        <Route path="/admin/content">
          <AdminPage><AdminContent /></AdminPage>
        </Route>
        <Route path="/admin/users">
          <AdminPage><AdminUsers /></AdminPage>
        </Route>
        <Route path="/admin/policy-ops">
          <AdminPage><PolicyOps /></AdminPage>
        </Route>
        <Route path="/admin/pricing-matrices">
          <AdminPage><PricingMatrices /></AdminPage>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <EmailCaptureModal />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
