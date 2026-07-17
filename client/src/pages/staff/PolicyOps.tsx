// Policy Operations — the staff policy-as-data console. The components live
// in ./policyOps/ (split 2026-07-17); this file keeps the lazy-loaded entry.
import { PolicyOpsDashboard } from "./policyOps/Dashboard";

export default function PolicyOps() {
  return <PolicyOpsDashboard />;
}
