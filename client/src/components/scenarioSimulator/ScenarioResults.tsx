import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatCurrencyDecimal } from "@/lib/formatters";
import { Info, Scale } from "lucide-react";
import { gapHeadline } from "./scenarioPayload";
import {
  DECISION_BADGE,
  OPTION_LABELS,
  type EvaluatedOffer,
  type ScenarioResponse,
} from "./types";

/**
 * Non-OK result: the engine ran but could not price the scenario. Each status
 * gets its own headline — "no income evaluation on file" and "no product
 * matches" are different problems with different fixes, and collapsing them
 * into one message sends the LO looking in the wrong place.
 */
export function ScenarioGapCard({ result }: { result: ScenarioResponse }) {
  if (result.status === "OK") return null;
  return (
    <Card className="border-warning-subtle-foreground/25 bg-warning-subtle" data-testid="scenario-gap-card">
      <CardContent className="p-4 text-warning-subtle-foreground">
        <p className="font-medium">{gapHeadline(result.status)}</p>
        {result.missingItems.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-sm">
            {result.missingItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** I10 provenance banner. Rendered on every simulated result, not on request. */
function SimulatedBanner() {
  return (
    <Card className="border-warning-subtle-foreground/25 bg-warning-subtle" data-testid="scenario-simulated-banner">
      <CardContent className="flex items-start gap-2 p-3 text-sm text-warning-subtle-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Simulated rate data — deterministic rate sheets stand in until the PPE contract.
          Directionally useful; not lockable terms.
        </span>
      </CardContent>
    </Card>
  );
}

function IncomeStrip({ result }: { result: ScenarioResponse }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" data-testid="scenario-income-strip">
      <span>
        Qualifying income:{" "}
        <span className="font-medium tabular-nums">
          {formatCurrencyDecimal(result.income?.primaryMonthlyQualifyingIncome ?? 0)}/mo
        </span>{" "}
        <span className="text-muted-foreground">
          ({result.income?.incomeBasis === "urla_line_items" ? "URLA line items" : "application summary"})
        </span>
      </span>
      <span>
        Monthly debts:{" "}
        <span className="font-medium tabular-nums">{formatCurrencyDecimal(result.monthlyDebts ?? 0)}</span>
      </span>
      <span className="text-muted-foreground">Engine time {result.serverMs}ms</span>
    </div>
  );
}

/**
 * §1026.36(e)(2)-(3) anti-steering set. Rendered above the full table on
 * purpose: the required option set is what the LO must present, so it must not
 * be something they have to scroll to find.
 */
function AntiSteeringSection({
  result,
  offersById,
}: {
  result: ScenarioResponse;
  offersById: Map<string, EvaluatedOffer>;
}) {
  if (!result.antiSteering || result.antiSteering.options.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Scale className="h-4 w-4 text-primary" aria-hidden="true" />
        Anti-steering options ({result.antiSteering.citation}) —{" "}
        {result.antiSteering.creditorsQuoted} lenders quoted
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {result.antiSteering.options.map((option) => {
          const offer = offersById.get(`${option.lenderId}:${option.productId}`);
          if (!offer) return null;
          const badge = DECISION_BADGE[offer.qualification.decision];
          return (
            <Card key={option.key} data-testid={`anti-steering-${option.key}`}>
              <CardContent className="space-y-1.5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {OPTION_LABELS[option.key]}
                </p>
                <p className="text-sm font-medium">{offer.productName}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {offer.adjustedRate.toFixed(3)}%
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    APR {offer.apr.toFixed(3)}%
                  </span>
                </p>
                <p className="text-sm tabular-nums">
                  {formatCurrencyDecimal(offer.payment.totalPiti)}/mo ·{" "}
                  {formatCurrency(offer.costs.cashToClose)} to close
                </p>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function OfferTable({ offers }: { offers: EvaluatedOffer[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm" data-testid="scenario-offer-table">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-3 py-2">Product</th>
            <th scope="col" className="px-3 py-2 text-right">Rate</th>
            <th scope="col" className="px-3 py-2 text-right">APR</th>
            <th scope="col" className="px-3 py-2 text-right">P&I</th>
            <th scope="col" className="px-3 py-2 text-right">PITI</th>
            <th scope="col" className="px-3 py-2 text-right">Cash to close</th>
            <th scope="col" className="px-3 py-2 text-right">DTI</th>
            <th scope="col" className="px-3 py-2">Decision</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => {
            const badge = DECISION_BADGE[offer.qualification.decision];
            return (
              <tr
                key={`${offer.lenderId}:${offer.productId}`}
                className="border-b border-border last:border-0"
                data-testid={`offer-row-${offer.productCode}`}
              >
                <td className="px-3 py-2">
                  <span className="font-medium">{offer.productName}</span>{" "}
                  <span className="text-muted-foreground">
                    ({offer.productType}, {offer.loanTerm / 12}y)
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{offer.adjustedRate.toFixed(3)}%</td>
                <td className="px-3 py-2 text-right tabular-nums">{offer.apr.toFixed(3)}%</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrencyDecimal(offer.payment.principalAndInterest)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrencyDecimal(offer.payment.totalPiti)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(offer.costs.cashToClose)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {/* An em dash, not "0%" — an unknown DTI is not a zero DTI. */}
                  {offer.qualification.dti !== null ? `${offer.qualification.dti.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Full OK result: provenance banner, income strip, anti-steering set, table. */
export function ScenarioResults({ result }: { result: ScenarioResponse }) {
  const offersById = useMemo(() => {
    const map = new Map<string, EvaluatedOffer>();
    for (const offer of result.offers) map.set(`${offer.lenderId}:${offer.productId}`, offer);
    return map;
  }, [result.offers]);

  if (result.status !== "OK") return null;

  const withReasons = result.offers.filter((o) => o.qualification.reasons.length > 0);

  return (
    <div className="space-y-4" data-testid="scenario-results">
      {result.simulated && <SimulatedBanner />}
      <IncomeStrip result={result} />
      <AntiSteeringSection result={result} offersById={offersById} />
      <OfferTable offers={result.offers} />

      {withReasons.length > 0 && (
        <div className="space-y-1 text-sm text-muted-foreground" data-testid="scenario-reasons">
          {withReasons.slice(0, 3).map((o) => (
            <p key={`${o.lenderId}:${o.productId}`}>
              <span className="font-medium text-foreground">{o.productCode}:</span>{" "}
              {o.qualification.reasons.join("; ")}
            </p>
          ))}
        </div>
      )}

      {result.excludedProducts.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="scenario-excluded">
          Excluded: {result.excludedProducts.join(" · ")}
        </p>
      )}
    </div>
  );
}
