import { useRef, useState } from "react";
import { DollarSign, FileText, Home, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatInputCurrency, parseCurrencyInput } from "@/lib/formatters";

export interface RentCardProps {
  monthlyRent: number;
  onChange: (value: number) => void;
}

export function RentCard({ monthlyRent, onChange }: RentCardProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleLeaseUpload = async (file: File) => {
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/calculators/extract-lease", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      if (data.monthlyRent && data.monthlyRent > 0) {
        onChange(Math.round(data.monthlyRent));
        toast({
          title: "Rent detected",
          description: `We found ${formatCurrency(Math.round(data.monthlyRent))}/mo on your lease. Adjust it if needed.`,
        });
      } else {
        toast({
          title: "Couldn't read the rent",
          description: "We couldn't find a monthly rent on that file. Please enter it manually.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Upload issue",
        description: "We couldn't process that file. Please enter your rent manually.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Your Rent
          </CardTitle>
          <Button
            variant="outline"
            size="sm" className="touch-target"
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting}
            data-testid="button-upload-lease"
          >
            {isExtracting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {isExtracting ? "Reading..." : "Upload Lease"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLeaseUpload(file);
              e.target.value = "";
            }}
            data-testid="input-lease-file"
          />
        </div>
        <CardDescription>
          Enter your current monthly rent, or upload your lease to auto-fill it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="monthlyRent">Monthly Rent</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="monthlyRent"
              value={formatInputCurrency(monthlyRent)}
              onChange={(e) => onChange(parseCurrencyInput(e.target.value))}
              className="pl-9"
              data-testid="input-monthly-rent"
            />
          </div>
          <div className="mt-3">
            <Slider
              value={[monthlyRent]}
              onValueChange={([v]) => onChange(v)}
              min={500}
              max={6000}
              step={50}
              data-testid="slider-monthly-rent"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>$500</span>
              <span>$6,000</span>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            Lease upload is optional — your results work without it.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
