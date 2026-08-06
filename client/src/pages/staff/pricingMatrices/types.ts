import { formatDate as formatDateShared } from "@/lib/formatters";

export type LifecycleStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export interface LookupMatrix {
  id: string;
  matrixCode: string;
  description: string | null;
  version: number;
  lifecycleStatus: LifecycleStatus;
  previousVersionId: string | null;
  effectiveDate: string;
  expirationDate: string | null;
  createdAt: string;
}

export interface LookupMatrixListItem extends LookupMatrix {
  cellCount: number;
}

export interface LookupMatrixCell {
  id: string;
  matrixId: string;
  dim1Min: string | null;
  dim1Max: string | null;
  dim2Min: string | null;
  dim2Max: string | null;
  dim3Identifier: string | null;
  outputValue: string;
}

export interface LookupMatrixDetail extends LookupMatrix {
  cells: LookupMatrixCell[];
}

export interface DraftCell {
  dim1Min: string;
  dim1Max: string;
  dim2Min: string;
  dim2Max: string;
  dim3Identifier: string;
  outputValue: string;
}

export const formatDate = (value: string | null) => formatDateShared(value, "—");

export function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function num(value: string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value;
  return n.toString();
}

export const emptyCell = (): DraftCell => ({
  dim1Min: "",
  dim1Max: "",
  dim2Min: "",
  dim2Max: "",
  dim3Identifier: "",
  outputValue: "",
});
