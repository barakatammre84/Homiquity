import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";

export function FeedbackForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/feedback", {
      rating,
      comment: comment || undefined,
      feedbackType: "general",
      step: "onboarding_journey",
    }),
    onSuccess: () => {
      toast({ title: "Thank you!", description: "Your feedback helps us improve." });
      onSubmitted();
    },
    onError: () => toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" }),
  });

  return (
    <div data-testid="feedback-form">
      <p className="text-sm font-medium text-foreground mb-3">How is your experience so far?</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => setRating(value)}
            className="p-1 transition-colors"
            data-testid={`button-rating-${value}`}
          >
            <Star
              className={`h-6 w-6 ${value <= rating ? "fill-warning text-warning-subtle-foreground" : "text-muted-foreground"}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tell us what's working or what could be better..."
        className="mb-3 text-sm"
        rows={3}
        data-testid="input-feedback-comment"
      />
      <Button
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={rating === 0 || mutation.isPending}
        data-testid="button-submit-feedback"
      >
        Submit Feedback
      </Button>
    </div>
  );
}
