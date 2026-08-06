import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Heart, Share2 } from "lucide-react";

const SAVED_IDS_KEY = ["/api/saved-properties/ids"];

/**
 * The listing "save" heart.
 *
 * Every one of these was inert: saved_properties and its storage methods have
 * existed since the property schema landed, but no HTTP route ever exposed
 * them, so the control had nothing to call. The routes exist now and this is
 * the single component all three surfaces use, so the heart cannot mean one
 * thing on the detail page and another on a card.
 *
 * Signed-out visitors still see the heart — hiding it would make the feature
 * invisible to exactly the people being asked to sign up — but clicking it
 * says what is needed rather than failing with a 401.
 */
export function SavePropertyButton({
  propertyId,
  variant = "ghost",
  className,
}: {
  propertyId: string;
  variant?: "ghost" | "secondary";
  className?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: savedIds = [] } = useQuery<string[]>({
    queryKey: SAVED_IDS_KEY,
    enabled: !!user,
  });

  const isSaved = savedIds.includes(propertyId);

  const toggle = useMutation({
    mutationFn: async () => {
      await apiRequest(
        isSaved ? "DELETE" : "POST",
        `/api/saved-properties/${propertyId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_IDS_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/saved-properties"] });
    },
    onError: (error: Error) => {
      toast({
        title: isSaved ? "Couldn't remove that" : "Couldn't save that",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      variant={variant}
      size="icon"
      className={className}
      aria-label={isSaved ? "Remove from saved" : "Save property"}
      aria-pressed={isSaved}
      disabled={toggle.isPending}
      onClick={() => {
        if (!user) {
          toast({
            title: "Sign in to save",
            description: "Saved properties are kept with your account.",
          });
          return;
        }
        toggle.mutate();
      }}
      data-testid={`button-save-property-${propertyId}`}
    >
      <Heart className={`h-4 w-4 ${isSaved ? "fill-current text-destructive" : ""}`} />
    </Button>
  );
}

/**
 * The listing "share" control.
 *
 * Uses the Web Share API where the browser has it (which on mobile is the
 * native share sheet) and falls back to copying the link. Both paths confirm
 * what happened; a share button that silently does nothing is what this
 * replaces.
 *
 * An AbortError means the user dismissed the share sheet — that is a
 * cancellation, not a failure, and must not raise an error toast.
 */
export function SharePropertyButton({
  title,
  variant = "ghost",
  className,
}: {
  title: string;
  variant?: "ghost" | "secondary";
  className?: string;
}) {
  const { toast } = useToast();

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "The property link is on your clipboard." });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast({
        title: "Couldn't share that",
        description: "Copy the address from your browser's address bar instead.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant={variant}
      size="icon"
      className={className}
      aria-label="Share property"
      onClick={handleShare}
      data-testid="button-share-property"
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
