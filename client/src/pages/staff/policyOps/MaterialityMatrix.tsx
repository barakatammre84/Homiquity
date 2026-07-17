// The materiality rule matrix.
// Extracted verbatim from PolicyOps.tsx.
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Edit, Save } from "lucide-react";

export function MaterialityMatrix() {
  const [editMode, setEditMode] = useState(false);
  const { toast } = useToast();

  const metrics = [
    { metric: "Credit Score Drop", fannie: 20, freddie: 15, fha: 20, va: 20, unit: "pts" },
    { metric: "DTI Change", fannie: 3, freddie: 2, fha: 3, va: 3, unit: "%" },
    { metric: "Asset Loss", fannie: 10, freddie: 10, fha: 5, va: 10, unit: "%" },
    { metric: "Income Decrease", fannie: 10, freddie: 8, fha: 10, va: 10, unit: "%" },
    { metric: "LTV Increase", fannie: 5, freddie: 5, fha: 5, va: 5, unit: "%" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Materiality Threshold Matrix</CardTitle>
            <CardDescription>
              Thresholds that trigger re-evaluation by GSE. Hover for guideline source.
            </CardDescription>
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => {
              if (editMode) {
                toast({
                  title: "Changes Saved",
                  description: "Materiality thresholds updated in draft.",
                });
              }
              setEditMode(!editMode);
            }}
            data-testid="button-toggle-edit"
          >
            {editMode ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit Thresholds
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>Fannie Mae</TooltipTrigger>
                  <TooltipContent>
                    <p>Source: Fannie Mae Selling Guide</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>Freddie Mac</TooltipTrigger>
                  <TooltipContent>
                    <p>Source: Freddie Mac Seller/Servicer Guide</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>FHA</TooltipTrigger>
                  <TooltipContent>
                    <p>Source: HUD Handbook 4000.1</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>VA</TooltipTrigger>
                  <TooltipContent>
                    <p>Source: VA Lender's Handbook</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((row) => (
              <TableRow key={row.metric}>
                <TableCell className="font-medium">{row.metric}</TableCell>
                <TableCell className="text-center">
                  {editMode ? (
                    <Input
                      type="number"
                      defaultValue={row.fannie}
                      className="w-20 mx-auto text-center"
                    />
                  ) : (
                    <span>{row.fannie}{row.unit}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editMode ? (
                    <Input
                      type="number"
                      defaultValue={row.freddie}
                      className="w-20 mx-auto text-center"
                    />
                  ) : (
                    <span>{row.freddie}{row.unit}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editMode ? (
                    <Input
                      type="number"
                      defaultValue={row.fha}
                      className="w-20 mx-auto text-center"
                    />
                  ) : (
                    <span>{row.fha}{row.unit}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editMode ? (
                    <Input
                      type="number"
                      defaultValue={row.va}
                      className="w-20 mx-auto text-center"
                    />
                  ) : (
                    <span>{row.va}{row.unit}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground mt-4">
          Lower values = stricter monitoring. Freddie Mac typically has stricter thresholds.
        </p>
      </CardContent>
    </Card>
  );
}

