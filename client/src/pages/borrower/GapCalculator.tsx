import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Target, 
  TrendingUp, 
  PiggyBank, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Sparkles,
  Calendar,
  DollarSign,
  Home,
  Plus,
  Trophy,
  Loader2,
  Bot,
} from "lucide-react";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HomeownershipGoal, CreditAction, SavingsTransaction, JourneyMilestone } from "@shared/schema";

const goalFormSchema = z.object({
  currentCreditScore: z.coerce.number().min(300).max(850),
  monthlyIncome: z.coerce.number().min(0),
  monthlyDebts: z.coerce.number().min(0),
  currentRent: z.coerce.number().min(0),
  currentSavingsBalance: z.coerce.number().min(0),
  currentMonthlySavings: z.coerce.number().min(0),
  targetHomePrice: z.coerce.number().min(0),
  targetDownPayment: z.coerce.number().min(0),
  targetCity: z.string().optional(),
  targetState: z.string().optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

const savingsFormSchema = z.object({
  amount: z.coerce.number().min(0.01),
  description: z.string().optional(),
});

type SavingsFormValues = z.infer<typeof savingsFormSchema>;

interface GapAnalysis {
  hasGoal: boolean;
  analysis?: {
    credit: {
      current: number;
      target: number;
      gap: number;
      progress: number;
      status: "ready" | "close" | "working";
    };
    savings: {
      current: number;
      target: number;
      gap: number;
      progress: number;
      monthlyRate: number;
      monthsToGoal: number | null;
      status: "ready" | "close" | "working";
    };
    dti: {
      current: number;
      maxAllowed: number;
      availableForPayment: number;
      status: "within_guideline" | "above_guideline";
    };
    overall: {
      progress: number;
      phase: string;
      journeyDay: number;
      goalsComplete: boolean;
    };
  };
}

interface CreditRecommendation {
  priority: "high" | "medium" | "low";
  actionType: string;
  title: string;
  description: string;
  estimatedPointsGain: number;
  timeframe: string;
}

export default function GapCalculator() {
  const { toast } = useToast();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSavingsDialog, setShowSavingsDialog] = useState(false);

  const { data: goalData, isLoading: goalLoading } = useQuery<{
    goal: HomeownershipGoal | null;
    creditActions: CreditAction[];
    savingsTransactions: SavingsTransaction[];
    milestones: JourneyMilestone[];
  }>({
    queryKey: ["/api/homeownership-goal"],
  });

  const { data: gapAnalysis, isLoading: analysisLoading } = useQuery<GapAnalysis>({
    queryKey: ["/api/homeownership-goal/gap-analysis"],
    enabled: !!goalData?.goal,
  });

  const { data: recommendations } = useQuery<{
    recommendations: CreditRecommendation[];
    currentScore: number;
    targetScore: number;
  }>({
    queryKey: ["/api/homeownership-goal/credit-recommendations"],
    enabled: !!goalData?.goal,
  });

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      currentCreditScore: 600,
      monthlyIncome: 5000,
      monthlyDebts: 500,
      currentRent: 1500,
      currentSavingsBalance: 0,
      currentMonthlySavings: 300,
      targetHomePrice: 350000,
      targetDownPayment: 17500,
      targetCity: "",
      targetState: "",
    },
  });

  const savingsForm = useForm<SavingsFormValues>({
    resolver: zodResolver(savingsFormSchema),
    defaultValues: {
      amount: 0,
      description: "",
    },
  });

  useEffect(() => {
    if (goalData?.goal && showOnboarding) {
      const goal = goalData.goal;
      form.reset({
        currentCreditScore: goal.currentCreditScore || 600,
        monthlyIncome: parseFloat(goal.monthlyIncome?.toString() || "5000"),
        monthlyDebts: parseFloat(goal.monthlyDebts?.toString() || "500"),
        currentRent: parseFloat(goal.currentRent?.toString() || "1500"),
        currentSavingsBalance: parseFloat(goal.currentSavingsBalance?.toString() || "0"),
        currentMonthlySavings: parseFloat(goal.currentMonthlySavings?.toString() || "300"),
        targetHomePrice: parseFloat(goal.targetHomePrice?.toString() || "350000"),
        targetDownPayment: parseFloat(goal.targetDownPayment?.toString() || "17500"),
        targetCity: goal.targetCity || "",
        targetState: goal.targetState || "",
      });
    }
  }, [goalData?.goal, showOnboarding, form]);

  const createGoalMutation = useMutation({
    mutationFn: async (data: GoalFormValues) => {
      const payload = {
        currentCreditScore: data.currentCreditScore,
        monthlyIncome: String(data.monthlyIncome),
        monthlyDebts: String(data.monthlyDebts),
        currentRent: String(data.currentRent),
        currentSavingsBalance: String(data.currentSavingsBalance),
        currentMonthlySavings: String(data.currentMonthlySavings),
        targetHomePrice: String(data.targetHomePrice),
        targetDownPayment: String(data.targetDownPayment),
        targetCity: data.targetCity || undefined,
        targetState: data.targetState || undefined,
      };
      const response = await apiRequest("POST", "/api/homeownership-goal", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeownership-goal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homeownership-goal/gap-analysis"] });
      setShowOnboarding(false);
      toast({
        title: "Journey Started!",
        description: "Your homeownership journey has begun. Let's reach your goals together!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start your journey. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async (data: Partial<GoalFormValues>) => {
      const payload: Record<string, string | number | undefined> = {};
      if (data.currentCreditScore !== undefined) payload.currentCreditScore = data.currentCreditScore;
      if (data.monthlyIncome !== undefined) payload.monthlyIncome = String(data.monthlyIncome);
      if (data.monthlyDebts !== undefined) payload.monthlyDebts = String(data.monthlyDebts);
      if (data.currentRent !== undefined) payload.currentRent = String(data.currentRent);
      if (data.currentSavingsBalance !== undefined) payload.currentSavingsBalance = String(data.currentSavingsBalance);
      if (data.currentMonthlySavings !== undefined) payload.currentMonthlySavings = String(data.currentMonthlySavings);
      if (data.targetHomePrice !== undefined) payload.targetHomePrice = String(data.targetHomePrice);
      if (data.targetDownPayment !== undefined) payload.targetDownPayment = String(data.targetDownPayment);
      if (data.targetCity !== undefined) payload.targetCity = data.targetCity;
      if (data.targetState !== undefined) payload.targetState = data.targetState;
      const response = await apiRequest("PATCH", "/api/homeownership-goal", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeownership-goal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homeownership-goal/gap-analysis"] });
      toast({
        title: "Updated",
        description: "Your financial information has been updated.",
      });
    },
  });

  const addSavingsMutation = useMutation({
    mutationFn: async (data: SavingsFormValues) => {
      const response = await apiRequest("POST", "/api/homeownership-goal/savings", {
        amount: String(data.amount),
        description: data.description || undefined,
        transactionType: "manual_deposit",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeownership-goal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homeownership-goal/gap-analysis"] });
      setShowSavingsDialog(false);
      savingsForm.reset();
      toast({
        title: "Deposit Added!",
        description: "Your savings have been updated.",
      });
    },
  });

  const onSubmitGoal = (data: GoalFormValues) => {
    if (goalData?.goal) {
      updateGoalMutation.mutate(data);
      setShowOnboarding(false);
    } else {
      createGoalMutation.mutate(data);
    }
  };

  const onSubmitSavings = (data: SavingsFormValues) => {
    addSavingsMutation.mutate(data);
  };

  if (goalLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!goalData?.goal || showOnboarding) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Gap to Homeownership</h1>
          <p className="text-muted-foreground">
            Let's see where you are today and build your personalized path to homeownership
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Financial Snapshot</CardTitle>
            <CardDescription>
              Tell us about your current situation so we can create your personalized plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitGoal)} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="currentCreditScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Credit Score</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="600" 
                            {...field}
                            data-testid="input-credit-score"
                          />
                        </FormControl>
                        <FormDescription>Your estimated credit score (300-850)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthlyIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Income</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="5000" 
                            {...field}
                            data-testid="input-monthly-income"
                          />
                        </FormControl>
                        <FormDescription>Your gross monthly income</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthlyDebts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Debts</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="500" 
                            {...field}
                            data-testid="input-monthly-debts"
                          />
                        </FormControl>
                        <FormDescription>Car payments, credit cards, loans, etc.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentRent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Rent</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="1500" 
                            {...field}
                            data-testid="input-current-rent"
                          />
                        </FormControl>
                        <FormDescription>Your current monthly rent payment</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentSavingsBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Savings</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field}
                            data-testid="input-current-savings"
                          />
                        </FormControl>
                        <FormDescription>Amount saved for a down payment</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentMonthlySavings"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Savings Rate</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="300" 
                            {...field}
                            data-testid="input-monthly-savings"
                          />
                        </FormControl>
                        <FormDescription>How much you can save each month</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetHomePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Home Price</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="350000" 
                            {...field}
                            data-testid="input-target-price"
                          />
                        </FormControl>
                        <FormDescription>The price range you're targeting</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetDownPayment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Down Payment</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="17500" 
                            {...field}
                            data-testid="input-target-down-payment"
                          />
                        </FormControl>
                        <FormDescription>Recommended: 5-20% of home price</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  {goalData?.goal && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowOnboarding(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button 
                    type="submit" 
                    disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                    data-testid="button-start-journey"
                  >
                    {(createGoalMutation.isPending || updateGoalMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {goalData?.goal ? "Update My Info" : "Start My Journey"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analysis = gapAnalysis?.analysis;

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gap to Homeownership</h1>
          <p className="text-muted-foreground">
            Day {analysis?.overall.journeyDay || 1} of your journey
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={analysis?.overall.goalsComplete ? "default" : "secondary"}>
            {analysis?.overall.phase === "discovery" && "Discovery Phase"}
            {analysis?.overall.phase === "credit_cleanup" && "Credit Cleanup"}
            {analysis?.overall.phase === "saving" && "Saving Phase"}
            {analysis?.overall.phase === "ready" && "Goals Complete"}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowOnboarding(true)}
            data-testid="button-update-info"
          >
            Update Info
          </Button>
        </div>
      </div>

      {analysis?.overall.goalsComplete && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-green-800 dark:text-green-200">
                  Goals Complete
                </h3>
                <p className="text-green-700 dark:text-green-300">
                  Your credit and savings goals have been met. You can now proceed with your mortgage application.
                </p>
              </div>
              <Button className="ml-auto" data-testid="button-apply-now">
                Apply Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Score</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis?.credit.current || 0}</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={analysis?.credit.progress || 0} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                /{analysis?.credit.target || 640}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analysis?.credit.gap || 0} points to go
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Progress</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(analysis?.savings.current || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={analysis?.savings.progress || 0} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                /${(analysis?.savings.target || 0).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analysis?.savings.monthsToGoal 
                ? `${analysis.savings.monthsToGoal} months to goal` 
                : "Set a savings rate"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DTI Ratio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analysis?.dti.current || 0).toFixed(1)}%
            </div>
            <Badge 
              variant={analysis?.dti.status === "within_guideline" ? "default" : "destructive"}
              className="mt-1"
            >
              {analysis?.dti.status === "within_guideline" ? "Within Guideline" : "Above Guideline"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Max allowed: {analysis?.dti.maxAllowed || 43}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analysis?.overall.progress || 0).toFixed(0)}%
            </div>
            <Progress value={analysis?.overall.progress || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Toward homeownership
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="credit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="credit" data-testid="tab-credit">Credit Coach</TabsTrigger>
          <TabsTrigger value="savings" data-testid="tab-savings">Savings Vault</TabsTrigger>
          <TabsTrigger value="roadmap" data-testid="tab-roadmap">30-Day Roadmap</TabsTrigger>
          <TabsTrigger value="milestones" data-testid="tab-milestones">Milestones</TabsTrigger>
        </TabsList>

        <TabsContent value="credit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Credit Coach
              </CardTitle>
              <CardDescription>
                Personalized actions to improve your credit score
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendations?.recommendations.map((rec, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                >
                  <div className={`p-2 rounded-full ${
                    rec.priority === "high" 
                      ? "bg-red-100 dark:bg-red-900" 
                      : rec.priority === "medium"
                      ? "bg-yellow-100 dark:bg-yellow-900"
                      : "bg-blue-100 dark:bg-blue-900"
                  }`}>
                    {rec.priority === "high" && <AlertCircle className="h-4 w-4 text-red-600" />}
                    {rec.priority === "medium" && <TrendingUp className="h-4 w-4 text-yellow-600" />}
                    {rec.priority === "low" && <Sparkles className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{rec.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        +{rec.estimatedPointsGain} pts
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Timeframe: {rec.timeframe}
                    </p>
                  </div>
                </div>
              ))}

              {(!recommendations?.recommendations || recommendations.recommendations.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>Your credit is in great shape! Keep up the good work.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="savings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" />
                  Savings Vault
                </CardTitle>
                <CardDescription>
                  Track your progress toward your down payment goal
                </CardDescription>
              </div>
              <Dialog open={showSavingsDialog} onOpenChange={setShowSavingsDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-savings">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Deposit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add to Savings</DialogTitle>
                    <DialogDescription>
                      Record a deposit to your home savings fund
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...savingsForm}>
                    <form onSubmit={savingsForm.handleSubmit(onSubmitSavings)} className="space-y-4">
                      <FormField
                        control={savingsForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01"
                                placeholder="100.00" 
                                {...field}
                                data-testid="input-deposit-amount"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={savingsForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Monthly savings" 
                                {...field}
                                data-testid="input-deposit-note"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={addSavingsMutation.isPending}
                        data-testid="button-submit-deposit"
                      >
                        {addSavingsMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Add Deposit
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center p-6 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                <DollarSign className="h-12 w-12 mx-auto mb-2 text-primary" />
                <div className="text-4xl font-bold">
                  ${(analysis?.savings.current || 0).toLocaleString()}
                </div>
                <p className="text-muted-foreground">
                  of ${(analysis?.savings.target || 0).toLocaleString()} goal
                </p>
                <Progress 
                  value={analysis?.savings.progress || 0} 
                  className="mt-4 h-3"
                />
              </div>

              <div>
                <h4 className="font-medium mb-3">Recent Transactions</h4>
                {goalData?.savingsTransactions.slice(0, 5).map((tx) => (
                  <div 
                    key={tx.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {tx.transactionType === "manual_deposit" && "Deposit"}
                        {tx.transactionType === "round_up" && "Round-up"}
                        {tx.transactionType === "recurring" && "Recurring"}
                        {tx.transactionType === "bonus" && "Bonus"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.description || new Date(tx.createdAt!).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-medium text-green-600">
                      +${parseFloat(tx.amount).toLocaleString()}
                    </span>
                  </div>
                ))}

                {(!goalData?.savingsTransactions || goalData.savingsTransactions.length === 0) && (
                  <p className="text-center text-muted-foreground py-4">
                    No transactions yet. Add your first deposit!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                30-Day Roadmap
              </CardTitle>
              <CardDescription>
                Your personalized path to mortgage readiness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <RoadmapPhase
                  title="Days 1-3: Truth & Transparency"
                  description="Get your baseline financial snapshot"
                  tasks={[
                    { label: "Complete financial profile", done: true },
                    { label: "Review credit score", done: (analysis?.credit.current || 0) > 0 },
                    { label: "Set savings goal", done: (analysis?.savings.target || 0) > 0 },
                  ]}
                  isActive={(analysis?.overall.journeyDay || 1) <= 3}
                  isComplete={(analysis?.overall.journeyDay || 1) > 3}
                />

                <RoadmapPhase
                  title="Days 4-14: Credit Cleanup Sprint"
                  description="Quick wins to boost your credit score"
                  tasks={[
                    { label: "Review credit recommendations", done: (analysis?.overall.journeyDay || 1) > 4 },
                    { label: "Pay down high-utilization cards", done: false },
                    { label: "Dispute any errors", done: false },
                  ]}
                  isActive={(analysis?.overall.journeyDay || 1) >= 4 && (analysis?.overall.journeyDay || 1) <= 14}
                  isComplete={(analysis?.overall.journeyDay || 1) > 14}
                />

                <RoadmapPhase
                  title="Days 15-25: Save-to-Own Habit"
                  description="Build your savings momentum"
                  tasks={[
                    { label: "Set up automatic savings", done: false },
                    { label: "Track round-up savings", done: false },
                    { label: "Reach first milestone", done: (goalData?.milestones?.length || 0) > 1 },
                  ]}
                  isActive={(analysis?.overall.journeyDay || 1) >= 15 && (analysis?.overall.journeyDay || 1) <= 25}
                  isComplete={(analysis?.overall.journeyDay || 1) > 25}
                />

                <RoadmapPhase
                  title="Day 30: Progress Report"
                  description="Review your progress and next steps"
                  tasks={[
                    { label: "Check updated credit score", done: false },
                    { label: "Review savings progress", done: false },
                    { label: "Connect with a loan officer", done: false },
                  ]}
                  isActive={(analysis?.overall.journeyDay || 1) >= 26}
                  isComplete={false}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Your Achievements
              </CardTitle>
              <CardDescription>
                Celebrate every step toward your goal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {goalData?.milestones.map((milestone) => (
                  <div 
                    key={milestone.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20"
                  >
                    <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                      <Trophy className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{milestone.title}</h4>
                      <p className="text-sm text-muted-foreground">{milestone.description}</p>
                      {milestone.celebrationMessage && (
                        <p className="text-sm mt-2 italic text-muted-foreground">
                          "{milestone.celebrationMessage}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Achieved {new Date(milestone.achievedAt!).toLocaleDateString()}
                      </p>
                    </div>
                    {milestone.pointsAwarded && milestone.pointsAwarded > 0 && (
                      <Badge variant="secondary">+{milestone.pointsAwarded} pts</Badge>
                    )}
                  </div>
                ))}

                {(!goalData?.milestones || goalData.milestones.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Complete actions to earn achievements!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6" data-testid="card-gap-apply-cta">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Ready to take the next step?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Based on your numbers, see what you qualify for with a 3-minute pre-approval.
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Link href="/apply">
                  <Button size="sm" className="gap-1" data-testid="button-gap-apply">
                    Start Pre-Approval
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
                <Link href="/ai-coach">
                  <Button variant="outline" size="sm" className="gap-1" data-testid="button-gap-coach">
                    <Bot className="h-3 w-3" />
                    Ask AI Coach
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RoadmapPhase({ 
  title, 
  description, 
  tasks, 
  isActive, 
  isComplete 
}: { 
  title: string;
  description: string;
  tasks: { label: string; done: boolean }[];
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className={`relative pl-8 pb-6 border-l-2 last:border-l-0 last:pb-0 ${
      isComplete 
        ? "border-green-500" 
        : isActive 
        ? "border-primary" 
        : "border-muted"
    }`}>
      <div className={`absolute -left-2.5 top-0 w-5 h-5 rounded-full ${
        isComplete 
          ? "bg-green-500" 
          : isActive 
          ? "bg-primary" 
          : "bg-muted"
      } flex items-center justify-center`}>
        {isComplete && <CheckCircle2 className="h-3 w-3 text-white" />}
      </div>
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground mb-2">{description}</p>
        <div className="space-y-1">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {task.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted" />
              )}
              <span className={task.done ? "line-through text-muted-foreground" : ""}>
                {task.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}