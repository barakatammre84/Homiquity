import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Plus,
  Package,
  FileText,
  GripVertical,
  Trash2,
  Send,
  Download,
  FolderOpen,
  CheckCircle2,
} from "lucide-react";
import type { Document, DocumentPackage } from "@shared/schema";

const packageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  packageType: z.enum(["initial_submission", "condition_response", "final_package", "title_package", "custom"]),
  description: z.string().optional(),
  recipientType: z.enum(["lender", "title", "underwriter", "investor"]).optional(),
  recipientName: z.string().optional(),
  internalNotes: z.string().optional(),
  deliveryNotes: z.string().optional(),
});

type PackageFormData = z.infer<typeof packageSchema>;

const PACKAGE_TYPES = [
  { value: "initial_submission", label: "Initial Lender Submission", icon: Send },
  { value: "condition_response", label: "Condition Response", icon: FileText },
  { value: "final_package", label: "Final Closing Package", icon: Package },
  { value: "title_package", label: "Title Company Package", icon: FolderOpen },
  { value: "custom", label: "Custom Package", icon: Package },
];

const RECIPIENT_TYPES = [
  { value: "lender", label: "Lender" },
  { value: "title", label: "Title Company" },
  { value: "underwriter", label: "Underwriter" },
  { value: "investor", label: "Investor" },
];

const DOCUMENT_SECTIONS = [
  "Income Documents",
  "Asset Documents",
  "Property Documents",
  "Credit & Liabilities",
  "Identity & Compliance",
  "Title Documents",
  "Closing Documents",
  "Miscellaneous",
];

interface DocumentPackageBuilderProps {
  applicationId: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

interface PackageDocument {
  documentId: string;
  document: Document;
  sectionName: string;
  displayOrder: number;
  customLabel?: string;
}

export function DocumentPackageBuilder({
  applicationId,
  onSuccess,
  trigger,
}: DocumentPackageBuilderProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"info" | "documents" | "review">("info");
  const [selectedDocuments, setSelectedDocuments] = useState<PackageDocument[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: "",
      packageType: "initial_submission",
      description: "",
      recipientType: undefined,
      recipientName: "",
      internalNotes: "",
      deliveryNotes: "",
    },
  });

  const { data: documents, isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ["/api/applications", applicationId, "documents"],
    enabled: open,
  });

  const createPackageMutation = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const packageRes = await apiRequest("POST", "/api/document-packages", {
        ...data,
        applicationId,
        sections: Array.from(new Set(selectedDocuments.map(d => d.sectionName))),
      });
      const pkg = await packageRes.json();
      
      for (const doc of selectedDocuments) {
        await apiRequest("POST", `/api/document-packages/${pkg.id}/items`, {
          documentId: doc.documentId,
          sectionName: doc.sectionName,
          displayOrder: doc.displayOrder,
          customLabel: doc.customLabel,
        });
      }
      
      return pkg;
    },
    onSuccess: () => {
      toast({
        title: "Package created",
        description: "Document package has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/document-packages"] });
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create document package. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    form.reset();
    setSelectedDocuments([]);
    setStep("info");
  };

  const handleDocumentToggle = (doc: Document, checked: boolean) => {
    if (checked) {
      const section = getDocumentSection(doc.documentType);
      setSelectedDocuments(prev => [
        ...prev,
        {
          documentId: doc.id,
          document: doc,
          sectionName: section,
          displayOrder: prev.length,
        },
      ]);
    } else {
      setSelectedDocuments(prev => prev.filter(d => d.documentId !== doc.id));
    }
  };

  const getDocumentSection = (docType: string): string => {
    const sectionMap: Record<string, string> = {
      w2: "Income Documents",
      pay_stub: "Income Documents",
      tax_return: "Income Documents",
      employment_letter: "Income Documents",
      bank_statement: "Asset Documents",
      asset_statement: "Asset Documents",
      gift_letter: "Asset Documents",
      appraisal: "Property Documents",
      insurance: "Property Documents",
      title: "Title Documents",
      id: "Identity & Compliance",
      drivers_license: "Identity & Compliance",
      passport: "Identity & Compliance",
    };
    return sectionMap[docType] || "Miscellaneous";
  };

  const updateDocumentSection = (documentId: string, sectionName: string) => {
    setSelectedDocuments(prev =>
      prev.map(d =>
        d.documentId === documentId ? { ...d, sectionName } : d
      )
    );
  };

  const removeDocument = (documentId: string) => {
    setSelectedDocuments(prev => prev.filter(d => d.documentId !== documentId));
  };

  const onSubmit = (data: PackageFormData) => {
    if (step === "info") {
      setStep("documents");
    } else if (step === "documents") {
      if (selectedDocuments.length === 0) {
        toast({
          title: "No documents selected",
          description: "Please select at least one document for the package.",
          variant: "destructive",
        });
        return;
      }
      setStep("review");
    } else {
      createPackageMutation.mutate(data);
    }
  };

  const groupedDocuments = selectedDocuments.reduce((acc, doc) => {
    if (!acc[doc.sectionName]) {
      acc[doc.sectionName] = [];
    }
    acc[doc.sectionName].push(doc);
    return acc;
  }, {} as Record<string, PackageDocument[]>);

  const verifiedDocuments = documents?.filter(d => d.status === "verified") || [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2" data-testid="button-create-package">
            <Package className="h-4 w-4" />
            Create Package
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {step === "info" && "Create Document Package"}
            {step === "documents" && "Select Documents"}
            {step === "review" && "Review Package"}
          </DialogTitle>
          <DialogDescription>
            {step === "info" && "Set up the package details for lender delivery."}
            {step === "documents" && "Choose which verified documents to include in this package."}
            {step === "review" && "Review and organize the documents before creating the package."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {step === "info" && (
              <>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Initial Submission - Smith Loan"
                          {...field}
                          data-testid="input-package-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="packageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Package Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-package-type">
                            <SelectValue placeholder="Select package type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PACKAGE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className="h-4 w-4" />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="recipientType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-recipient-type">
                              <SelectValue placeholder="Select recipient" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RECIPIENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
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
                    name="recipientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., ABC Lending" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the package contents..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="internalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notes for internal team reference..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        These notes are not included in the delivery
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {step === "documents" && (
              <div className="space-y-4">
                {documentsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : verifiedDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No verified documents available</p>
                    <p className="text-sm">Documents must be verified before they can be added to a package</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {selectedDocuments.length} document(s) selected
                      </p>
                      <Badge variant="outline">{verifiedDocuments.length} available</Badge>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {verifiedDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 p-3 border rounded-lg hover-elevate"
                        >
                          <Checkbox
                            checked={selectedDocuments.some(d => d.documentId === doc.id)}
                            onCheckedChange={(checked) => handleDocumentToggle(doc, checked as boolean)}
                            data-testid={`checkbox-doc-${doc.id}`}
                          />
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doc.fileName}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {doc.documentType.replace(/_/g, " ")}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === "review" && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{form.getValues("name")}</CardTitle>
                    <CardDescription className="text-xs">
                      {PACKAGE_TYPES.find(t => t.value === form.getValues("packageType"))?.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-sm text-muted-foreground">
                      {form.getValues("recipientName") && (
                        <p>To: {form.getValues("recipientName")}</p>
                      )}
                      <p>{selectedDocuments.length} documents</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  {Object.entries(groupedDocuments).map(([section, docs]) => (
                    <div key={section} className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {section}
                        <Badge variant="secondary" className="text-xs">{docs.length}</Badge>
                      </h4>
                      <div className="space-y-1 pl-6">
                        {docs.map((doc) => (
                          <div
                            key={doc.documentId}
                            className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm"
                          >
                            <GripVertical className="h-3 w-3 text-muted-foreground" />
                            <FileText className="h-3 w-3" />
                            <span className="flex-1 truncate">{doc.document.fileName}</span>
                            <Select
                              value={doc.sectionName}
                              onValueChange={(v) => updateDocumentSection(doc.documentId, v)}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DOCUMENT_SECTIONS.map((s) => (
                                  <SelectItem key={s} value={s} className="text-xs">
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => removeDocument(doc.documentId)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              {step !== "info" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step === "review" ? "documents" : "info")}
                >
                  Back
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => { setOpen(false); resetForm(); }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPackageMutation.isPending}
                className="gap-2"
                data-testid="button-next-step"
              >
                {createPackageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === "review" ? (
                  <Package className="h-4 w-4" />
                ) : null}
                {step === "info" && "Next: Select Documents"}
                {step === "documents" && "Next: Review"}
                {step === "review" && "Create Package"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentPackageBuilder;
