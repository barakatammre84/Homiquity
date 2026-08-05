import { BarChart3, GraduationCap, History, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { LivePropertyDetail } from "./types";

/**
 * The left column below the header: free-text description, the categorized
 * detail grid, nearby schools, and the two historical tables (listing events
 * and assessed tax). Each section self-hides when its slice is empty.
 */
export function PropertyFacts({ property }: { property: LivePropertyDetail }) {
  return (
    <>
      {property.description && (
        <div className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">About This Property</h2>
          <p className="leading-relaxed text-muted-foreground">{property.description}</p>
        </div>
      )}

      {property.details.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Property Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {property.details.map((section, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{section.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {section.items.map((item, j) => (
                      <li key={j} className="text-sm text-muted-foreground">{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {property.schools.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <GraduationCap className="h-5 w-5" />
            Nearby Schools
          </h2>
          <div className="space-y-3">
            {property.schools.map((school, i) => (
              <Card key={i}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{school.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="capitalize">{school.levels.join(", ")}</Badge>
                      {school.fundingType && <span className="capitalize">{school.fundingType}</span>}
                      {school.distance && <span>{school.distance.toFixed(1)} mi</span>}
                      {school.studentCount && <span>{school.studentCount.toLocaleString()} students</span>}
                    </div>
                  </div>
                  {school.rating !== null && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-warning-subtle-foreground" />
                      <span className="font-bold">{school.rating}/10</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {property.propertyHistory.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <History className="h-5 w-5" />
            Property History
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {property.propertyHistory.map((entry, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <Badge variant="secondary">{entry.event}</Badge>
                    </div>
                    <div className="text-right">
                      {entry.price ? (
                        <span className="font-medium">{formatCurrency(entry.price)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">--</span>
                      )}
                      {entry.source && (
                        <p className="text-xs text-muted-foreground">{entry.source}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {property.taxHistory.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <BarChart3 className="h-5 w-5" />
            Tax History
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Year</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Tax</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {property.taxHistory.map((t, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3">{t.year}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(t.tax)}</td>
                        <td className="px-4 py-3 text-right">{t.assessmentTotal ? formatCurrency(t.assessmentTotal) : "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
