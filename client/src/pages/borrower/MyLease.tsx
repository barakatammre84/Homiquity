import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, leaseKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Home, Info, Loader2, Plus, Trash2 } from "lucide-react";
import type { LeaseView } from "@shared/leaseView";
import { LeasePayments } from "./myLease/LeasePayments";

/**
 * My lease — the authenticated capture surface for the rent ledger.
 *
 * Phase 0 shipped the `leases` table and the furnishing gate but no writer, so the
 * encrypted PII columns had a reader and nothing to read. This is the writer.
 *
 * WHAT IT DOES NOT OFFER. There is no "start reporting" control. Enrolling for
 * credit-bureau furnishing is a separate affirmative act that does not exist yet, and
 * nothing in this product can furnish anything while the Metro 2 and FCRA authorities are
 * missing. A toggle here would be a switch wired to nothing that a user would reasonably
 * read as "my rent is now on my credit file" — so the page states the position instead.
 */

/** Dates are date-only strings end to end. The server parses them at UTC midnight. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.literal(""));

const leaseFormSchema = z
  .object({
    monthlyRentAmount: z
      .string()
      .min(1, "Monthly rent is required")
      .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 1450 or 1450.50")
      .refine((v) => Number(v) > 0, "Must be more than zero"),
    landlordName: z.string().max(255).optional(),
    landlordEmail: z.string().email("Enter a valid email").max(255).or(z.literal("")).optional(),
    propertyAddress: z.string().max(500).optional(),
    leaseStartDate: dateOnly.optional(),
    leaseEndDate: dateOnly.optional(),
  })
  .refine(
    (d) => !d.leaseStartDate || !d.leaseEndDate || d.leaseEndDate >= d.leaseStartDate,
    { message: "End date cannot come before the start date", path: ["leaseEndDate"] },
  );

type LeaseFormValues = z.infer<typeof leaseFormSchema>;

/** Drop empty strings so an untouched optional field is absent rather than `""`. */
function toPayload(values: LeaseFormValues) {
  const out: Record<string, string> = { monthlyRentAmount: values.monthlyRentAmount };
  for (const key of ["landlordName", "landlordEmail", "propertyAddress", "leaseStartDate", "leaseEndDate"] as const) {
    const v = values[key];
    if (v) out[key] = v;
  }
  return out;
}

export default function MyLease() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ leases: LeaseView[] }>({
    queryKey: leaseKeys.all(),
  });
  const leases = data?.leases ?? [];

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      monthlyRentAmount: "",
      landlordName: "",
      landlordEmail: "",
      propertyAddress: "",
      leaseStartDate: "",
      leaseEndDate: "",
    },
  });

  const createLease = useMutation({
    mutationFn: async (values: LeaseFormValues) => {
      const res = await apiRequest("POST", "/api/leases", toPayload(values));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all() });
      form.reset();
      setShowForm(false);
      toast({ title: "Lease saved", description: "We've recorded your lease details." });
    },
    onError: () =>
      toast({
        title: "Couldn't save that",
        description: "Please check the details and try again.",
        variant: "destructive",
      }),
  });

  const deleteLease = useMutation({
    mutationFn: async (leaseId: string) => {
      const res = await apiRequest("DELETE", `/api/leases/${leaseId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all() });
      setConfirmingDelete(null);
      toast({ title: "Lease deleted", description: "Your lease details have been removed." });
    },
    onError: (err: unknown) => {
      // 409 is the reported-tradeline refusal, and it deserves its own words: the user
      // asked for removal and is entitled to know it did not happen, and why.
      const reported = (err as { status?: number })?.status === 409;
      toast({
        title: reported ? "This lease can't be deleted" : "Couldn't delete that",
        description: reported
          ? "It's been reported to a credit bureau, so it has to be suppressed instead. Contact us and we'll handle it."
          : "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Home className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-my-lease-title">
            My lease
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your rent is likely your largest monthly payment. Recording it here is the first
            step toward it counting for something.
          </p>
        </div>
      </div>

      <Alert className="mt-6" data-testid="alert-lease-not-reported">
        <Info className="h-4 w-4" />
        <AlertDescription data-testid="text-lease-not-reported">
          <span className="font-medium text-foreground">
            Saving a lease does not report anything to the credit bureaus.
          </span>{" "}
          We are not an approved furnisher yet. Nothing here reaches your credit file, and
          we'll ask you first when that changes.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground" data-testid="state-lease-loading">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your leases…
        </div>
      ) : (
        <div className="mt-8 space-y-4" data-testid="list-leases">
          {leases.map((lease) => (
            <Card key={lease.id} data-testid={`card-lease-${lease.id}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {lease.propertyAddress || "Lease"}
                </CardTitle>
                <CardDescription>
                  ${lease.monthlyRentAmount} per month
                  {lease.leaseStartDate ? ` · from ${lease.leaseStartDate}` : ""}
                  {lease.leaseEndDate ? ` to ${lease.leaseEndDate}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {lease.landlordName ? <div>Landlord: {lease.landlordName}</div> : null}
                {lease.landlordEmail ? <div>{lease.landlordEmail}</div> : null}
                <div className="mt-2 text-xs" data-testid={`text-lease-furnishing-${lease.id}`}>
                  {lease.furnishingEnrolled ? "Reporting to bureaus" : "Not being reported"}
                </div>
                <LeasePayments leaseId={lease.id} monthlyRent={lease.monthlyRentAmount} />

                <div className="mt-4 border-t border-border pt-3">
                  {confirmingDelete === lease.id ? (
                    <div className="space-y-2" data-testid={`confirm-delete-${lease.id}`}>
                      <p className="text-sm text-foreground">
                        Delete this lease and its payment history? Your landlord's details are
                        removed for good — this can't be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm" className="touch-target"
                          disabled={deleteLease.isPending}
                          onClick={() => deleteLease.mutate(lease.id)}
                          data-testid={`button-confirm-delete-${lease.id}`}
                        >
                          {deleteLease.isPending ? "Deleting…" : "Delete permanently"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm" className="touch-target"
                          onClick={() => setConfirmingDelete(null)}
                          data-testid={`button-cancel-delete-${lease.id}`}
                        >
                          Keep it
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm" className="touch-target"
                      onClick={() => setConfirmingDelete(lease.id)}
                      data-testid={`button-delete-lease-${lease.id}`}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete this lease
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {leases.length === 0 && !showForm ? (
            <p className="text-sm text-muted-foreground" data-testid="text-lease-empty">
              You haven't added a lease yet.
            </p>
          ) : null}
        </div>
      )}

      {!showForm ? (
        <Button className="mt-6" onClick={() => setShowForm(true)} data-testid="button-add-lease">
          <Plus className="mr-2 h-4 w-4" /> Add a lease
        </Button>
      ) : (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Lease details</CardTitle>
            <CardDescription>
              Only the monthly amount is required. You can add the rest later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => createLease.mutate(values))}
                className="space-y-5"
                data-testid="form-lease"
              >
                <FormField
                  control={form.control}
                  name="monthlyRentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly rent</FormLabel>
                      <FormControl>
                        <Input placeholder="1450" inputMode="decimal" data-testid="input-lease-rent" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="propertyAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St, Chicago, IL" data-testid="input-lease-address" {...field} />
                      </FormControl>
                      <FormDescription>Stored encrypted.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="landlordName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landlord or management company</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Property Group" data-testid="input-lease-landlord-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="landlordEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landlord email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="leasing@acme.com"
                          data-testid="input-lease-landlord-email"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Stored encrypted. We don't contact your landlord without telling you.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="leaseStartDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease start</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-lease-start" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leaseEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lease end</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-lease-end" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={createLease.isPending} data-testid="button-save-lease">
                    {createLease.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      "Save lease"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      form.reset();
                      setShowForm(false);
                    }}
                    data-testid="button-cancel-lease"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
