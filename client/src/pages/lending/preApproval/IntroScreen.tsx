import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, ChevronLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Question } from "./questions";

export interface IntroScreenProps {
  currentQ: Question;
  onStart: () => void;
  urlPropertyId: string | null;
  urlSource: string | null;
  restoreBanner: React.ReactNode;
}

export function IntroScreen({ currentQ, onStart, urlPropertyId, urlSource, restoreBanner }: IntroScreenProps) {
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
          onClick={onStart}
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
