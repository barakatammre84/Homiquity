import type { UseMutationResult } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Faq } from "./types";

export interface FaqsTableProps {
  faqs: Faq[] | undefined;
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (faq: Faq) => void;
  removeMutation: UseMutationResult<Response, Error, string>;
}

export function FaqsTable({ faqs, isLoading, onAdd, onEdit, removeMutation }: FaqsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>FAQs</CardTitle>
          <CardDescription>Manage frequently asked questions</CardDescription>
        </div>
        <Button onClick={onAdd} data-testid="button-add-faq">
          <Plus className="h-4 w-4 mr-2" />
          Add FAQ
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : faqs && faqs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {faqs.map((faq) => (
                <TableRow key={faq.id} data-testid={`row-faq-${faq.id}`}>
                  <TableCell className="font-medium max-w-md truncate">{faq.question}</TableCell>
                  <TableCell>{faq.category?.name || "Uncategorized"}</TableCell>
                  <TableCell>
                    <Badge variant={faq.isPublished ? "default" : "secondary"}>
                      {faq.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon" aria-label="Edit"
                      onClick={() => onEdit(faq)}
                      data-testid={`button-edit-faq-${faq.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon" aria-label="Delete"
                      onClick={() => removeMutation.mutate(faq.id)}
                      disabled={removeMutation.isPending}
                      data-testid={`button-delete-faq-${faq.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No FAQs yet. Click "Add FAQ" to create one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
