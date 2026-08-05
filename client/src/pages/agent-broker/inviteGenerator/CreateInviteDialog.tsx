import type { UseFormReturn } from "react-hook-form";
import { Copy, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { InviteFormValues } from "./types";

export interface CreateInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<InviteFormValues>;
  onSubmit: (data: InviteFormValues) => void;
  isPending: boolean;
  /** Set once the invite exists — swaps the form for the shareable link. */
  generatedLink: string | null;
  onCopy: (text: string) => void;
  /** Clears the form and closes; also the Cancel path. */
  onReset: () => void;
  onCreateAnother: () => void;
}

export function CreateInviteDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  isPending,
  generatedLink,
  onCopy,
  onReset,
  onCreateAnother,
}: CreateInviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-invite">
          <Plus className="w-4 h-4 mr-2" />
          Create Invite Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Client Invite</DialogTitle>
          <DialogDescription>
            Generate a personalized link to send to your client via email or text.
          </DialogDescription>
        </DialogHeader>
        {generatedLink ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground mb-2">Share this link with your client:</p>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="flex-1 text-xs"
                  data-testid="input-generated-link"
                />
                <Button
                  size="icon" aria-label="Copy link"
                  variant="outline"
                  onClick={() => onCopy(generatedLink)}
                  data-testid="button-copy-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onReset} data-testid="button-done">
                Done
              </Button>
              <Button
                onClick={onCreateAnother}
                data-testid="button-create-another"
              >
                Create Another
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John Smith"
                        {...field}
                        data-testid="input-client-name"
                      />
                    </FormControl>
                    <FormDescription>
                      Pre-fill the client's name for a personalized experience
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Email (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                        data-testid="input-client-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="(555) 123-4567"
                        {...field}
                        data-testid="input-client-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal Message (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Looking forward to helping you with your mortgage!"
                        {...field}
                        data-testid="input-message"
                      />
                    </FormControl>
                    <FormDescription>
                      This message will be shown when the client opens the link
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresInDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link Valid For</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={90}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 30)}
                        data-testid="input-expires-days"
                      />
                    </FormControl>
                    <FormDescription>Days until the link expires (1-90)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onReset}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid="button-generate-link"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  {isPending ? "Generating..." : "Generate Link"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
