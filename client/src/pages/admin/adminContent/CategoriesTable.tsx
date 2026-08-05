import type { UseMutationResult } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContentCategory } from "./types";

export interface CategoriesTableProps {
  categories: ContentCategory[] | undefined;
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (category: ContentCategory) => void;
  removeMutation: UseMutationResult<Response, Error, string>;
}

export function CategoriesTable({ categories, isLoading, onAdd, onEdit, removeMutation }: CategoriesTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Organize articles and FAQs by category</CardDescription>
        </div>
        <Button onClick={onAdd} data-testid="button-add-category">
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : categories && categories.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                  <TableCell>{category.displayOrder || 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon" aria-label="Edit"
                      onClick={() => onEdit(category)}
                      data-testid={`button-edit-category-${category.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon" aria-label="Delete"
                      onClick={() => removeMutation.mutate(category.id)}
                      disabled={removeMutation.isPending}
                      data-testid={`button-delete-category-${category.id}`}
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
            No categories yet. Click "Add Category" to create one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
