import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FileNotFoundCard() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>File Not Found</CardTitle>
          <CardDescription>
            This borrower file could not be found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/staff-dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
