import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, onboardingStatusKeys } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Fingerprint, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { KbaQuestion, KbaResult, OnboardingStatus } from "./types";

/**
 * Knowledge-based authentication: five public-record questions, four correct
 * to pass, with a server-enforced attempt limit.
 *
 * Answers accumulate locally and are submitted as one batch on the last
 * question — the server scores them, this component never decides pass/fail.
 */
export function KBAFlow({ kbaStatus, applicationId, onComplete }: { kbaStatus: OnboardingStatus["kba"]; applicationId: string | null; onComplete: () => void }) {
  const [questions, setQuestions] = useState<KbaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; selectedIndex: number }[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<KbaResult | null>(null);
  const { toast } = useToast();

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/kba/start", { applicationId }),
    onSuccess: async (res) => {
      const data = await res.json();
      if (data.alreadyPassed) {
        setResult({ passed: true, score: data.session.score, totalQuestions: 5 });
        return;
      }
      setSessionId(data.session.id);
      setQuestions(data.session.questions);
      setCurrentIndex(0);
      setAnswers([]);
    },
    onError: () => toast({ title: "Error", description: "Failed to start verification", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: (finalAnswers: { questionId: string; selectedIndex: number }[]) =>
      apiRequest("POST", `/api/onboarding/kba/${sessionId}/submit`, { answers: finalAnswers }),
    onSuccess: async (res) => {
      const data = await res.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: onboardingStatusKeys.root() });
      if (data.passed) {
        onComplete();
        toast({ title: "Identity Verified", description: "You passed the knowledge-based authentication." });
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to submit answers", variant: "destructive" }),
  });

  const handleAnswer = (selectedIndex: number) => {
    const newAnswers = [...answers, { questionId: questions[currentIndex].id, selectedIndex }];
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      submitMutation.mutate(newAnswers);
    }
  };

  if (kbaStatus?.status === "passed" || result?.passed) {
    return (
      <div className="text-center py-6" data-testid="kba-passed">
        <CheckCircle2 className="h-12 w-12 text-success-subtle-foreground mx-auto mb-3" />
        <p className="font-semibold text-foreground">Identity Verified</p>
        <p className="text-sm text-muted-foreground mt-1">Your identity has been confirmed through knowledge-based authentication.</p>
      </div>
    );
  }

  if (result && !result.passed) {
    return (
      <div className="text-center py-6" data-testid="kba-failed">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
        <p className="font-semibold text-foreground">Verification Unsuccessful</p>
        <p className="text-sm text-muted-foreground mt-1">
          You answered {result.score} of {result.totalQuestions} correctly. {(result.remainingAttempts ?? 0) > 0 ? `You have ${result.remainingAttempts} attempt(s) remaining.` : "Maximum attempts reached."}
        </p>
        {(result.remainingAttempts ?? 0) > 0 && (
          <Button onClick={() => { setResult(null); startMutation.mutate(); }} className="mt-4" data-testid="button-kba-retry">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (questions.length > 0 && !result) {
    const q = questions[currentIndex];
    return (
      <div data-testid="kba-questions">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline">Question {currentIndex + 1} of {questions.length}</Badge>
          <span className="text-xs text-muted-foreground">Session expires in 15 minutes</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <p className="font-medium text-foreground mb-4" data-testid="text-kba-question">{q.question}</p>
            <div className="space-y-2">
              {q.choices.map((choice, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => handleAnswer(idx)}
                  disabled={submitMutation.isPending}
                  data-testid={`button-kba-choice-${idx}`}
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full border text-xs font-medium mr-3 shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {choice}
                </Button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-1 mt-4">
          {questions.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx < currentIndex ? "bg-success" : idx === currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-6">
      <Fingerprint className="h-12 w-12 text-primary mx-auto mb-3" />
      <p className="font-semibold text-foreground mb-2">Knowledge-Based Authentication</p>
      <p className="text-sm text-muted-foreground mb-4">
        Answer 5 security questions based on your public records to confirm your identity. You need 4 correct answers to pass.
      </p>
      {kbaStatus && kbaStatus.attemptNumber > 1 && (
        <p className="text-xs text-warning-subtle-foreground mb-3">Attempt {kbaStatus.attemptNumber} of {kbaStatus.maxAttempts}</p>
      )}
      <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending} data-testid="button-kba-start">
        {startMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Begin Verification
      </Button>
    </div>
  );
}
