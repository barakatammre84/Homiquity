import { Link } from "wouter";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function NoApplicationCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No application open yet</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
          Start your pre-approval and we'll open your loan file here — most people
          finish it in about three minutes.
        </p>
        <Button asChild className="mt-6">
          <Link href="/apply">Start pre-approval</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
