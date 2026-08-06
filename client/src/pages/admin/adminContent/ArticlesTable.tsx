import type { UseMutationResult } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Article } from "./types";

export interface ArticlesTableProps {
  articles: Article[] | undefined;
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (article: Article) => void;
  removeMutation: UseMutationResult<Response, Error, string>;
}

export function ArticlesTable({ articles, isLoading, onAdd, onEdit, removeMutation }: ArticlesTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Articles</CardTitle>
          <CardDescription>Manage Learning Center articles</CardDescription>
        </div>
        <Button onClick={onAdd} data-testid="button-add-article">
          <Plus className="h-4 w-4 mr-2" />
          Add Article
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : articles && articles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id} data-testid={`row-article-${article.id}`}>
                  <TableCell className="font-medium">{article.title}</TableCell>
                  <TableCell>{article.category?.name || "Uncategorized"}</TableCell>
                  <TableCell>
                    <Badge variant={article.isPublished ? "default" : "secondary"}>
                      {article.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon" aria-label="Edit"
                      onClick={() => onEdit(article)}
                      data-testid={`button-edit-article-${article.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon" aria-label="Delete"
                      onClick={() => removeMutation.mutate(article.id)}
                      disabled={removeMutation.isPending}
                      data-testid={`button-delete-article-${article.id}`}
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
            No articles yet. Click "Add Article" to create one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
