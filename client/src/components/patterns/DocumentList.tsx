import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { Icons } from "@/lib/icons";
import type { DataProvenance } from "@shared/dataProvenance";
import {
  ProvenanceBadge,
  type ProvenanceMethod,
} from "@/components/patterns/ProvenanceBadge";

// The document vault list (docs/DESIGN-STANDARD.md §6, teardown §6.5 — the
// benchmark shipped raw slugs and a dead "File name" column). Human titles come
// from a slug→title map owned by the DATA layer and passed in (never normalized
// in the view); duplicate document types are disambiguated by subject ("For
// Alex"); dates read as plain English ("Sent to you on Aug 12, 2026" — never
// "disclosed at"); status rides the one canonical <DocumentStatusBadge>.

export interface DocumentRow {
  id: string;
  /** Data-layer slug; resolved via `titles`. Never rendered raw. */
  slug?: string;
  /** Pre-resolved human title (wins over slug lookup). */
  title?: string;
  /** Who the document concerns, when duplicates need disambiguation. */
  subject?: string;
  /** documents.status vocabulary — rendered via DocumentStatusBadge. */
  status?: string | null;
  provenance?: DataProvenance;
  provenanceMethod?: ProvenanceMethod;
  /** Plain-English event, e.g. { verb: "Sent to you", on: "Aug 12, 2026" }. */
  date?: { verb: string; on: string };
  action?: React.ReactNode;
}

export interface DocumentGroup {
  label: string;
  documents: readonly DocumentRow[];
}

export interface DocumentListProps {
  groups: readonly DocumentGroup[];
  /** Slug→human-title map, owned by the data layer. */
  titles?: Readonly<Record<string, string>>;
  className?: string;
  "data-testid"?: string;
}

function resolveTitle(row: DocumentRow, titles: Readonly<Record<string, string>>) {
  if (row.title) return row.title;
  if (row.slug && titles[row.slug]) return titles[row.slug];
  if (import.meta.env.DEV) {
    console.error(
      `[DocumentList] no human title for slug "${row.slug ?? "(none)"}" (id ${row.id}). ` +
        `Add it to the data layer's title map — raw slugs in UI text are banned ` +
        `(DESIGN-STANDARD §8), and so is normalizing names in the view.`,
    );
  }
  return "Document (name missing)";
}

export function DocumentList({
  groups,
  titles = {},
  className,
  "data-testid": testId = "document-list",
}: DocumentListProps) {
  return (
    <div className={className} data-testid={testId}>
      {groups.map((group) => (
        <section key={group.label} className="mt-6 first:mt-0" aria-label={group.label}>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h4>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
            {group.documents.map((row) => {
              const title = resolveTitle(row, titles);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 p-4"
                  data-testid={`${testId}-row-${row.id}`}
                >
                  <Icons.document
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {title}
                      {row.subject && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          · For {row.subject}
                        </span>
                      )}
                    </p>
                    {row.date && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {row.date.verb} on {row.date.on}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {row.provenance && (
                      <ProvenanceBadge
                        provenance={row.provenance}
                        method={row.provenanceMethod}
                        data-testid={`${testId}-${row.id}-provenance`}
                      />
                    )}
                    {row.status !== undefined && (
                      <DocumentStatusBadge
                        status={row.status}
                        data-testid={`${testId}-${row.id}-status`}
                      />
                    )}
                    {row.action}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
