import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Document } from "@shared/schema";
import {
  countPendingCatalogDocs,
  getCategoryStatus,
  rowFromCatalogDoc,
} from "@/lib/documentChecklist";
import type { DOCUMENT_CATEGORIES } from "../documentCategories";
import { ChecklistRows } from "./ChecklistRows";
import type { UploadControls } from "./types";

type Category = (typeof DOCUMENT_CATEGORIES)[number];

/** A category of the static document catalog — collapsible, unlike the personalized cards. */
export function CatalogCategoryCard({
  category,
  documentsByType,
  focusTypes,
  isExpanded,
  onToggle,
  upload,
}: {
  category: Category;
  documentsByType: Record<string, Document[]>;
  /** Document types that clear the focused condition — spotlighted in the rows. */
  focusTypes: Set<string>;
  isExpanded: boolean;
  onToggle: () => void;
  upload: UploadControls;
}) {
  const CategoryIcon = category.icon;

  const requiredInCategory = category.documents.filter(d => d.required);
  const pendingInCategory = countPendingCatalogDocs(category.documents, documentsByType);
  const uploadedCount = category.documents.filter(d => documentsByType[d.type]?.length > 0).length;

  const allCaughtUp = pendingInCategory === 0;
  const hasUploads = uploadedCount > 0;

  const categoryStatus = getCategoryStatus(requiredInCategory.length, pendingInCategory);

  return (
    <Card className="shadow-lg border-0" data-testid={`card-category-${category.id}`}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${category.bgColor}`}>
              <CategoryIcon className={`h-5 w-5 ${category.color}`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {category.name}
                {allCaughtUp && requiredInCategory.length > 0 && (
                  <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground" />
                )}
              </CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge className={categoryStatus.color}>
              {categoryStatus.text}
            </Badge>
            {hasUploads && !isExpanded && (
              <Badge variant="secondary" className="text-xs">
                {uploadedCount} uploaded
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-4">
            <ChecklistRows
              rows={category.documents.map((docType) => {
                const row = rowFromCatalogDoc(docType, documentsByType, focusTypes);
                return { key: row.key, row };
              })}
              upload={upload}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
