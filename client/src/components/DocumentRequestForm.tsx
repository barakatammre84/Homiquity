import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, FileText, Send } from "lucide-react";

const documentRequestSchema = z.object({
  title: z.string().min(1, "Document title is required"),
  documentCategory: z.string().optional(),
  documentYear: z.string().optional(),
  documentInstructions: z.string().min(1, "Instructions are required"),
  requestingTeam: z.enum(["processing", "underwriting", "title", "closing"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  isCustomRequest: z.boolean().default(false),
  dueDate: z.string().optional(),
});

type DocumentRequestFormData = z.infer<typeof documentRequestSchema>;

const DOCUMENT_CATEGORIES = [
  { value: "w2", label: "W-2 Forms" },
  { value: "pay_stub", label: "Pay Stubs" },
  { value: "tax_return", label: "Tax Returns" },
  { value: "bank_statement", label: "Bank Statements" },
  { value: "id", label: "Government ID" },
  { value: "employment_letter", label: "Employment Verification" },
  { value: "asset_statement", label: "Asset Statements" },
  { value: "gift_letter", label: "Gift Letter" },
  { value: "insurance", label: "Insurance Documents" },
  { value: "title", label: "Title Documents" },
  { value: "appraisal", label: "Appraisal" },
  { value: "other", label: "Other / Custom" },
];

const REQUESTING_TEAMS = [
  { value: "processing", label: "Processing", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "underwriting", label: "Underwriting", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "title", label: "Title", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "closing", label: "Closing", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
];

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-muted text-muted-foreground" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-800" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-800" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800" },
];

interface DocumentRequestFormProps {
  applicationId: string;
  borrowerUserId: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function DocumentRequestForm({
  applicationId,
  borrowerUserId,
  onSuccess,
  trigger,
}: DocumentRequestFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DocumentRequestFormData>({
    resolver: zodResolver(documentRequestSchema),
    defaultValues: {
      title: "",
      documentCategory: "",
      documentYear: "",
      documentInstructions: "",
      requestingTeam: "processing",
      priority: "normal",
      isCustomRequest: false,
      dueDate: "",
    },
  });

  const isCustom = form.watch("isCustomRequest");

  const mutation = useMutation({
    mutationFn: async (data: DocumentRequestFormData) => {
      return apiRequest("POST", "/api/tasks", {
        applicationId,
        assignedToUserId: borrowerUserId,
        taskType: "document_request",
        title: data.title,
        documentCategory: data.isCustomRequest ? "other" : data.documentCategory,
        documentYear: data.documentYear,
        documentInstructions: data.documentInstructions,
        requestingTeam: data.requestingTeam,
        priority: data.priority,
        isCustomRequest: data.isCustomRequest,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
        status: "pending",
      });
    },
    onSuccess: () => {
      toast({
        title: "Document requested",
        description: "The borrower will be notified of the new document request.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId] });
      setOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create document request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DocumentRequestFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2" data-testid="button-request-document">
            <Plus className="h-4 w-4" />
            Request Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Request Document from Borrower
          </DialogTitle>
          <DialogDescription>
            Create a document request that will be sent to the borrower's dashboard.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="isCustomRequest"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Custom Request</FormLabel>
                    <FormDescription className="text-xs">
                      Enable for unique or non-standard documents
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-custom-request"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Title *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={isCustom ? "e.g., LLC Operating Agreement" : "e.g., 2024 W-2 from Current Employer"}
                      {...field}
                      data-testid="input-document-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isCustom && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="documentCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-document-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOCUMENT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="documentYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year (if applicable)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 2024" {...field} data-testid="input-document-year" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="documentInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions for Borrower *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide clear instructions on what document is needed and any specific requirements..."
                      className="min-h-[80px]"
                      {...field}
                      data-testid="textarea-document-instructions"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Be specific about format, date ranges, or other requirements
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="requestingTeam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requesting Team *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-requesting-team">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REQUESTING_TEAMS.map((team) => (
                          <SelectItem key={team.value} value={team.value}>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={team.color}>
                                {team.label}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITIES.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-due-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="gap-2"
                data-testid="button-send-request"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentRequestForm;
