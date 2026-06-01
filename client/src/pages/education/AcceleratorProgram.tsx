import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap,
  Target,
  CheckCircle2,
  Trophy,
  Rocket,
  Home,
  Briefcase,
  CreditCard,
  DollarSign,
  Percent,
  Calendar,
  MessageSquare,
  Plus,
  Clock,
  Circle,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

interface AcceleratorEnrollment {
  id: string;
  userId: string;
  programType: string;
  currentPhase: number;
  totalPhases: number;
  targetDate: string | null;
  currentCreditScore: number | null;
  targetCreditScore: number | null;
  currentSavings: string | null;
  targetDownPayment: string | null;
  currentDti: string | null;
  targetDti: string | null;
  monthlyBudget: string | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
}

interface AcceleratorMilestone {
  id: string;
  enrollmentId: string;
  phase: number;
  title: string;
  description: string | null;
  category: string;
  targetValue: string | null;
  currentValue: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  dueDate: string | null;
}

interface CoachingSession {
  id: string;
  enrollmentId: string;
  scheduledAt: string;
  durationMinutes: number;
  topic: string | null;
  notes: string | null;
  actionItems: string[] | null;
  status: string;
  completedAt: string | null;
}

const PROGRAM_TYPES = [
  {
    key: "first_time_buyer",
    title: "First-Time Buyer",
    description: "For those buying their first home. We guide you through every step from pre-approval to closing day.",
    icon: Home,
  },
  {
    key: "self_employed",
    title: "Self-Employed",
    description: "For business owners and freelancers navigating non-traditional income documentation and lending requirements.",
    icon: Briefcase,
  },
  {
    key: "credit_builder",
    title: "Credit Builder",
    description: "For those working on credit improvement. Build your score strategically to unlock better rates and terms.",
    icon: CreditCard,
  },
];

const PHASE_NAMES: Record<number, string> = {
  1: "Foundation",
  2: "Financial Fitness",
  3: "Pre-Approval Ready",
  4: "House Hunting",
  5: "Under Contract",
  6: "Closing & Beyond",
};

function EnrollmentView() {
  const { toast } = useToast();

  const enrollMutation = useMutation({
    mutationFn: (programType: string) =>
      apiRequest("POST", "/api/accelerator/enrollment", { programType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/enrollment"] });
      toast({ title: "Enrolled", description: "Welcome to the Homebuyer Accelerator Program!" });
    },
    onError: () => toast({ title: "Error", description: "Failed to enroll. Please try again.", variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="accelerator-enrollment">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-accelerator-title">
              Homebuyer Accelerator Program
            </h1>
            <p className="text-sm text-muted-foreground">
              A structured coaching program that takes you from aspiring homeowner to confident buyer in 6 phases.
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6 border-primary/20" data-testid="card-program-intro">
        <CardContent className="py-5">
          <div className="flex items-start gap-3">
            <Rocket className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Your personalized path to homeownership</p>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a program track below to get started. Each track includes milestone tracking,
                coaching sessions, and financial goal monitoring tailored to your situation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Choose Your Program Track
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="program-type-grid">
        {PROGRAM_TYPES.map((program) => {
          const Icon = program.icon;
          return (
            <Card key={program.key} className="hover-elevate" data-testid={`card-program-${program.key}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground" data-testid={`text-program-title-${program.key}`}>
                    {program.title}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4" data-testid={`text-program-desc-${program.key}`}>
                  {program.description}
                </p>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => enrollMutation.mutate(program.key)}
                  disabled={enrollMutation.isPending}
                  data-testid={`button-enroll-${program.key}`}
                >
                  {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function FinancialUpdateDialog({ enrollment }: { enrollment: AcceleratorEnrollment }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    currentCreditScore: enrollment.currentCreditScore?.toString() || "",
    currentSavings: enrollment.currentSavings || "",
    currentDti: enrollment.currentDti || "",
    targetDate: enrollment.targetDate || "",
    targetCreditScore: enrollment.targetCreditScore?.toString() || "",
    targetDownPayment: enrollment.targetDownPayment || "",
    targetDti: enrollment.targetDti || "",
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/accelerator/enrollment/${enrollment.id}`, {
        currentCreditScore: values.currentCreditScore ? parseInt(values.currentCreditScore) : null,
        currentSavings: values.currentSavings || null,
        currentDti: values.currentDti || null,
        targetDate: values.targetDate || null,
        targetCreditScore: values.targetCreditScore ? parseInt(values.targetCreditScore) : null,
        targetDownPayment: values.targetDownPayment || null,
        targetDti: values.targetDti || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/enrollment"] });
      toast({ title: "Updated", description: "Financial values have been updated." });
      setOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update values.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-update-financials">
          <TrendingUp className="h-4 w-4 mr-1" /> Update Financials
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Financial Values</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Target Date</label>
            <Input
              type="date"
              value={values.targetDate}
              onChange={(e) => setValues({ ...values, targetDate: e.target.value })}
              className="mt-1"
              data-testid="input-target-date"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Current Credit Score</label>
              <Input
                type="number"
                value={values.currentCreditScore}
                onChange={(e) => setValues({ ...values, currentCreditScore: e.target.value })}
                placeholder="720"
                className="mt-1"
                data-testid="input-current-credit-score"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Target Credit Score</label>
              <Input
                type="number"
                value={values.targetCreditScore}
                onChange={(e) => setValues({ ...values, targetCreditScore: e.target.value })}
                placeholder="740"
                className="mt-1"
                data-testid="input-target-credit-score"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Current Savings ($)</label>
              <Input
                type="number"
                value={values.currentSavings}
                onChange={(e) => setValues({ ...values, currentSavings: e.target.value })}
                placeholder="15000"
                className="mt-1"
                data-testid="input-current-savings"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Target Down Payment ($)</label>
              <Input
                type="number"
                value={values.targetDownPayment}
                onChange={(e) => setValues({ ...values, targetDownPayment: e.target.value })}
                placeholder="50000"
                className="mt-1"
                data-testid="input-target-down-payment"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Current DTI (%)</label>
              <Input
                type="number"
                value={values.currentDti}
                onChange={(e) => setValues({ ...values, currentDti: e.target.value })}
                placeholder="35"
                className="mt-1"
                data-testid="input-current-dti"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Target DTI (%)</label>
              <Input
                type="number"
                value={values.targetDti}
                onChange={(e) => setValues({ ...values, targetDti: e.target.value })}
                placeholder="28"
                className="mt-1"
                data-testid="input-target-dti"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              data-testid="button-save-financials"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleSessionDialog({ enrollmentId }: { enrollmentId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sessionData, setSessionData] = useState({ scheduledAt: "", topic: "" });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/accelerator/coaching", {
        enrollmentId,
        scheduledAt: sessionData.scheduledAt,
        topic: sessionData.topic || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/coaching", enrollmentId] });
      toast({ title: "Scheduled", description: "Coaching session has been scheduled." });
      setOpen(false);
      setSessionData({ scheduledAt: "", topic: "" });
    },
    onError: () => toast({ title: "Error", description: "Failed to schedule session.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-schedule-session">
          <Plus className="h-4 w-4 mr-1" /> Schedule Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Coaching Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Date & Time</label>
            <Input
              type="datetime-local"
              value={sessionData.scheduledAt}
              onChange={(e) => setSessionData({ ...sessionData, scheduledAt: e.target.value })}
              className="mt-1"
              data-testid="input-session-date"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Topic</label>
            <Input
              value={sessionData.topic}
              onChange={(e) => setSessionData({ ...sessionData, topic: e.target.value })}
              placeholder="e.g., Credit improvement strategy"
              className="mt-1"
              data-testid="input-session-topic"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => scheduleMutation.mutate()}
              disabled={!sessionData.scheduledAt || scheduleMutation.isPending}
              data-testid="button-confirm-schedule"
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    scheduled: { label: "Scheduled", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
    no_show: { label: "No Show", variant: "destructive" },
  };
  const c = config[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={c.variant} data-testid={`badge-session-status-${status}`}>{c.label}</Badge>;
}

function DashboardView({ enrollment }: { enrollment: AcceleratorEnrollment }) {
  const { toast } = useToast();
  const progressPercent = Math.round((enrollment.currentPhase / enrollment.totalPhases) * 100);

  const programLabel = PROGRAM_TYPES.find((p) => p.key === enrollment.programType)?.title || enrollment.programType;

  const { data: milestones = [], isLoading: milestonesLoading } = useQuery<AcceleratorMilestone[]>({
    queryKey: ["/api/accelerator/milestones", enrollment.id],
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<CoachingSession[]>({
    queryKey: ["/api/accelerator/coaching", enrollment.id],
  });

  const toggleMilestone = useMutation({
    mutationFn: (milestone: AcceleratorMilestone) =>
      apiRequest("PUT", `/api/accelerator/milestones/${milestone.id}`, {
        isCompleted: !milestone.isCompleted,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/milestones", enrollment.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/enrollment"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update milestone.", variant: "destructive" }),
  });

  const milestonesByPhase = milestones.reduce<Record<number, AcceleratorMilestone[]>>((acc, m) => {
    if (!acc[m.phase]) acc[m.phase] = [];
    acc[m.phase].push(m);
    return acc;
  }, {});

  const formatCurrency = (val: string | null) => {
    if (!val) return "--";
    const num = parseFloat(val);
    return isNaN(num) ? val : `$${num.toLocaleString()}`;
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="accelerator-dashboard">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <div className="p-2 bg-primary/10 rounded-lg">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-dashboard-title">
                Accelerator Program
              </h1>
              <Badge variant="secondary" data-testid="badge-program-type">{programLabel}</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span data-testid="text-phase-info">Phase {enrollment.currentPhase} of {enrollment.totalPhases}</span>
              {enrollment.targetDate && (
                <span className="flex items-center gap-1" data-testid="text-target-date">
                  <Calendar className="h-3 w-3" />
                  Target: {format(new Date(enrollment.targetDate), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </div>
          <FinancialUpdateDialog enrollment={enrollment} />
        </div>

        <div className="mt-3" data-testid="progress-bar-container">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{PHASE_NAMES[enrollment.currentPhase] || `Phase ${enrollment.currentPhase}`}</span>
            <span data-testid="text-progress-percent">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted" data-testid="progress-bar">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
              data-testid="progress-bar-fill"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6" data-testid="financial-snapshot">
        <Card data-testid="card-credit-score">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Credit Score</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-foreground" data-testid="text-current-credit">
                {enrollment.currentCreditScore ?? "--"}
              </span>
              {enrollment.targetCreditScore && (
                <span className="text-xs text-muted-foreground" data-testid="text-target-credit">
                  / {enrollment.targetCreditScore}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-savings">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Savings</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-foreground" data-testid="text-current-savings">
                {formatCurrency(enrollment.currentSavings)}
              </span>
              {enrollment.targetDownPayment && (
                <span className="text-xs text-muted-foreground" data-testid="text-target-savings">
                  / {formatCurrency(enrollment.targetDownPayment)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-dti">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">DTI Ratio</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-foreground" data-testid="text-current-dti">
                {enrollment.currentDti ? `${enrollment.currentDti}%` : "--"}
              </span>
              {enrollment.targetDti && (
                <span className="text-xs text-muted-foreground" data-testid="text-target-dti">
                  / {enrollment.targetDti}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Phase Milestones
        </h2>
        {milestonesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : milestones.length === 0 ? (
          <Card data-testid="card-no-milestones">
            <CardContent className="py-8 text-center">
              <Target className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">No milestones yet</p>
              <p className="text-sm text-muted-foreground mt-1">Milestones will appear as your program progresses.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="milestones-list">
            {Object.keys(milestonesByPhase)
              .map(Number)
              .sort((a, b) => a - b)
              .map((phase) => (
                <div key={phase} data-testid={`milestone-phase-${phase}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" data-testid={`badge-phase-${phase}`}>
                      Phase {phase}
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">
                      {PHASE_NAMES[phase] || ""}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {milestonesByPhase[phase].map((milestone) => (
                      <Card key={milestone.id} data-testid={`card-milestone-${milestone.id}`}>
                        <CardContent className="py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleMilestone.mutate(milestone)}
                              className="shrink-0"
                              data-testid={`button-toggle-milestone-${milestone.id}`}
                            >
                              {milestone.isCompleted ? (
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-sm font-medium ${milestone.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}
                                  data-testid={`text-milestone-title-${milestone.id}`}
                                >
                                  {milestone.title}
                                </span>
                                <Badge variant="secondary" className="text-[10px]" data-testid={`badge-milestone-category-${milestone.id}`}>
                                  {milestone.category}
                                </Badge>
                              </div>
                              {(milestone.targetValue || milestone.currentValue) && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                  {milestone.currentValue && (
                                    <span data-testid={`text-milestone-current-${milestone.id}`}>
                                      Current: {milestone.currentValue}
                                    </span>
                                  )}
                                  {milestone.targetValue && (
                                    <span data-testid={`text-milestone-target-${milestone.id}`}>
                                      Target: {milestone.targetValue}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Coaching Sessions
          </h2>
          <ScheduleSessionDialog enrollmentId={enrollment.id} />
        </div>
        {sessionsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : sessions.length === 0 ? (
          <Card data-testid="card-no-sessions">
            <CardContent className="py-8 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">No coaching sessions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Schedule your first session to get personalized guidance.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2" data-testid="sessions-list">
            {sessions.map((session) => (
              <Card key={session.id} data-testid={`card-session-${session.id}`}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground" data-testid={`text-session-topic-${session.id}`}>
                          {session.topic || "Coaching Session"}
                        </span>
                        <SessionStatusBadge status={session.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="flex items-center gap-1" data-testid={`text-session-date-${session.id}`}>
                          <Calendar className="h-3 w-3" />
                          {format(new Date(session.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                        <span className="flex items-center gap-1" data-testid={`text-session-duration-${session.id}`}>
                          <Clock className="h-3 w-3" />
                          {session.durationMinutes} min
                        </span>
                      </div>
                      {session.notes && (
                        <p className="text-xs text-muted-foreground mt-2" data-testid={`text-session-notes-${session.id}`}>
                          {session.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceleratorProgram() {
  const { data: enrollment, isLoading } = useQuery<AcceleratorEnrollment | null>({
    queryKey: ["/api/accelerator/enrollment"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!enrollment) {
    return <EnrollmentView />;
  }

  return <DashboardView enrollment={enrollment} />;
}
