import { motion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";

export interface FunnelHeaderProps {
  percent: number;
  index: number;
  total: number;
  onBack: () => void;
}

/** Fixed progress bar + nav header (back button, step counter, autosave indicator). */
export function FunnelHeader({ percent, index, total, onBack }: FunnelHeaderProps) {
  return (
    <>
      <div className="fixed top-0 left-0 w-full h-1 bg-muted z-50">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-40 bg-background/80 backdrop-blur-sm">
        <button
          onClick={onBack}
          disabled={index === 0}
          className={`p-2 rounded-full hover:bg-muted transition-all ${index === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          data-testid="button-back"
        >
          <ChevronLeft className="w-6 h-6 text-muted-foreground" />
        </button>
        <div className="flex flex-col items-center" data-testid="text-step-counter">
          <span className="text-sm font-medium text-muted-foreground">
            Step {index} of {total}
          </span>
          <span className="text-[11px] text-muted-foreground/60">
            {index <= 4 ? "~2 min left" : index <= 8 ? "~1 min left" : "Almost done"}
          </span>
        </div>
        <div className="flex items-center gap-1 w-10 justify-end">
          {index > 0 && (
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1" data-testid="text-autosave-indicator">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>
    </>
  );
}
