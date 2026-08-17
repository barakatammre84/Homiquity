import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, leaseKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Plus } from "lucide-react";
import type { RentPaymentView } from "@shared/leaseView";

/**
 * One lease's rent payment history, plus the form that records a period.
 *
 * WHAT THE COPY HAS TO CARRY. Every row this surface can create is `self_reported` —
 * the API pins provenance server-side and there is no way to claim otherwise. So the
 * history is the borrower's own record, useful to them, and **not** something that has
 * reached a credit bureau. `furnishable` comes back computed from the furnishing gate's
 * own constant rather than assumed here, so this badge cannot disagree with the gate.
 *
 * A missed period is recordable on purpose. A payment history that can only say "paid"
 * is not a history, and the honest version has to admit the months that went wrong —
 * that is also what makes it worth anything later.
 */

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const amount = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Enter an amount like 1450 or 1450.50")
  .refine((v) => Number(v) > 0, "Must be more than zero");

const paymentFormSchema = z
  .object({
    dueDate: dateOnly,
    amountDue: amount,
    status: z.enum(["paid", "late", "missed"]),
    paidDate: dateOnly.or(z.literal("")).optional(),
    amountPaid: amount.or(z.literal("")).optional(),
  })
  .refine((d) => d.status === "missed" || !!d.paidDate, {
    message: "When was it paid?",
    path: ["paidDate"],
  })
  .refine((d) => d.status === "missed" || !!d.amountPaid, {
    message: "How much was paid?",
    path: ["amountPaid"],
  })
  .refine((d) => d.status !== "late" || !d.paidDate || d.paidDate > d.dueDate, {
    message: "A payment made on or before the due date isn't late",
    path: ["status"],
  });

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  late: "Paid late",
  missed: "Missed",
};

export function LeasePayments({ leaseId, monthlyRent }: { leaseId: string; monthlyRent: string }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<{ payments: RentPaymentView[] }>({
    queryKey: leaseKeys.payments(leaseId),
  });
  const payments = data?.payments ?? [];

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      dueDate: "",
      amountDue: monthlyRent,
      status: "paid",
      paidDate: "",
      amountPaid: monthlyRent,
    },
  });
  const status = form.watch("status");

  const record = useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      const body: Record<string, string> = {
        dueDate: values.dueDate,
        amountDue: values.amountDue,
        status: values.status,
      };
      // A missed period carries no paid date or amount — sending "" would be a value,
      // and the API distinguishes absent from empty.
      if (values.status !== "missed") {
        if (values.paidDate) body.paidDate = values.paidDate;
        if (values.amountPaid) body.amountPaid = values.amountPaid;
      }
      const res = await apiRequest("POST", `/api/leases/${leaseId}/payments`, body);
      return res.json();
    },
    onSuccess: () => {
      // `all()` is an element-wise prefix of the payments key, so one invalidation
      // covers the lease and its payments.
      queryClient.invalidateQueries({ queryKey: leaseKeys.all() });
      form.reset({ dueDate: "", amountDue: monthlyRent, status: "paid", paidDate: "", amountPaid: monthlyRent });
      setShowForm(false);
      toast({ title: "Payment recorded" });
    },
    onError: (err: unknown) => {
      const conflict = (err as { status?: number })?.status === 409;
      toast({
        title: conflict ? "Already recorded" : "Couldn't record that",
        description: conflict
          ? "There's already a payment for that period."
          : "Please check the details and try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="mt-4 border-t border-border pt-4" data-testid={`payments-${leaseId}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Payment history</h3>
        {!showForm ? (
          <Button variant="ghost" size="sm" onClick={() => setShowForm(true)} data-testid={`button-add-payment-${leaseId}`}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Record a month
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : payments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid={`text-payments-empty-${leaseId}`}>
          No months recorded yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid={`list-payments-${leaseId}`}>
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm" data-testid={`payment-${p.id}`}>
              <span className="text-foreground">{p.dueDate}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <span>${p.amountPaid ?? p.amountDue}</span>
                <Badge variant={p.status === "missed" ? "destructive" : "secondary"}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}

      {payments.length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground" data-testid={`text-payments-not-reported-${leaseId}`}>
          {payments.some((p) => p.furnishable)
            ? "Some of these months are eligible to be reported."
            : "You recorded these yourself. None of them have been reported to a credit bureau."}
        </p>
      ) : null}

      {showForm ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => record.mutate(v))}
            className="mt-4 space-y-4"
            data-testid={`form-payment-${leaseId}`}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month due</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid={`input-payment-due-${leaseId}`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amountDue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount due</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" data-testid={`input-payment-due-amount-${leaseId}`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What happened?</FormLabel>
                  <div className="flex gap-2" data-testid={`group-payment-status-${leaseId}`}>
                    {(["paid", "late", "missed"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => field.onChange(s)}
                        aria-pressed={field.value === s}
                        data-testid={`option-payment-status-${s}-${leaseId}`}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          field.value === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground hover:border-primary/50 hover:bg-muted"
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {status !== "missed" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="paidDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date paid</FormLabel>
                      <FormControl>
                        <Input type="date" data-testid={`input-payment-paid-${leaseId}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount paid</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" data-testid={`input-payment-paid-amount-${leaseId}`} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={record.isPending} data-testid={`button-save-payment-${leaseId}`}>
                {record.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  form.reset();
                  setShowForm(false);
                }}
                data-testid={`button-cancel-payment-${leaseId}`}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      ) : null}
    </div>
  );
}
