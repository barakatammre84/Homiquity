import type { IStorage } from "../storage";
import type { UnderwritingRuleDsl, RuleExecutionLog } from "@shared/schema";

interface DSLCondition {
  field: string;
  operator: string;
  value: any;
}

interface DSLConditionGroup {
  operator: "AND" | "OR";
  conditions: (DSLCondition | DSLConditionGroup)[];
}

interface RuleAction {
  type: string;
  [key: string]: any;
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split(".").reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    return current[key];
  }, obj as any);
}

function evaluateCondition(condition: DSLCondition, context: Record<string, any>): { met: boolean; detail: string } {
  const actualValue = getNestedValue(context, condition.field);
  const expectedValue = condition.value;
  let met = false;

  switch (condition.operator) {
    case "==":
    case "===":
    case "EQUALS":
      met = actualValue === expectedValue;
      break;
    case "!=":
    case "!==":
    case "NOT_EQUALS":
      met = actualValue !== expectedValue;
      break;
    case "<":
    case "LESS_THAN":
      met = typeof actualValue === "number" && actualValue < expectedValue;
      break;
    case "<=":
    case "LESS_THAN_OR_EQUAL":
      met = typeof actualValue === "number" && actualValue <= expectedValue;
      break;
    case ">":
    case "GREATER_THAN":
      met = typeof actualValue === "number" && actualValue > expectedValue;
      break;
    case ">=":
    case "GREATER_THAN_OR_EQUAL":
      met = typeof actualValue === "number" && actualValue >= expectedValue;
      break;
    case "IN":
      met = Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      break;
    case "NOT_IN":
      met = Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      break;
    case "BETWEEN":
      if (Array.isArray(expectedValue) && expectedValue.length === 2 && typeof actualValue === "number") {
        met = actualValue >= expectedValue[0] && actualValue <= expectedValue[1];
      }
      break;
    case "EXISTS":
      met = actualValue !== undefined && actualValue !== null;
      break;
    case "NOT_EXISTS":
      met = actualValue === undefined || actualValue === null;
      break;
    case "CONTAINS":
      met = typeof actualValue === "string" && actualValue.includes(expectedValue);
      break;
    case "STARTS_WITH":
      met = typeof actualValue === "string" && actualValue.startsWith(expectedValue);
      break;
    default:
      met = false;
  }

  return {
    met,
    detail: `${condition.field} ${condition.operator} ${JSON.stringify(expectedValue)} => actual: ${JSON.stringify(actualValue)} => ${met}`,
  };
}

function evaluateConditionGroup(
  group: DSLConditionGroup,
  context: Record<string, any>,
): { met: boolean; details: string[] } {
  const details: string[] = [];
  const results: boolean[] = [];

  for (const condition of group.conditions) {
    if ("conditions" in condition) {
      const subResult = evaluateConditionGroup(condition as DSLConditionGroup, context);
      results.push(subResult.met);
      details.push(...subResult.details.map(d => `  ${d}`));
    } else {
      const result = evaluateCondition(condition as DSLCondition, context);
      results.push(result.met);
      details.push(result.detail);
    }
  }

  const met = group.operator === "AND"
    ? results.every(r => r)
    : results.some(r => r);

  return { met, details };
}

function executeActions(actions: RuleAction[], context: Record<string, any>): { type: string; result: any }[] {
  return actions.map(action => {
    switch (action.type) {
      case "set_qualification_status":
        return { type: action.type, result: { status: action.status, reason: action.reason } };
      case "log_explanation":
        return { type: action.type, result: { category: action.category, ruleId: action.ruleId, message: action.message } };
      case "flag_for_review":
        return { type: action.type, result: { reason: action.reason, severity: action.severity || "warning" } };
      case "set_field":
        return { type: action.type, result: { field: action.field, value: action.value } };
      case "add_condition":
        return { type: action.type, result: { condition: action.condition, priority: action.priority } };
      default:
        return { type: action.type, result: { raw: action } };
    }
  });
}

export async function executeRules(
  storage: IStorage,
  snapshotId: string,
  context: Record<string, any>,
  ruleIds?: string[],
): Promise<(Omit<RuleExecutionLog, "id" | "executedAt"> & { conditionsMet: boolean })[]> {
  let rules: UnderwritingRuleDsl[];

  if (ruleIds && ruleIds.length > 0) {
    const allRules = await Promise.all(ruleIds.map(id => storage.getUnderwritingRule(id)));
    rules = allRules.filter((r): r is UnderwritingRuleDsl => r !== undefined && r.isActive === true);
  } else {
    rules = await storage.getUnderwritingRules({ isActive: true });
  }

  rules.sort((a, b) => (a.priority || 100) - (b.priority || 100));

  const results: (Omit<RuleExecutionLog, "id" | "executedAt"> & { conditionsMet: boolean })[] = [];

  for (const rule of rules) {
    const conditionsDsl = rule.conditionsDsl as DSLConditionGroup;
    const evaluation = evaluateConditionGroup(conditionsDsl, context);

    let actionResults: { type: string; result: any }[] = [];
    if (evaluation.met) {
      const actions = rule.actions as RuleAction[];
      actionResults = executeActions(actions, context);
    }

    const logEntry = {
      snapshotId,
      ruleId: rule.id,
      ruleCode: rule.ruleCode,
      ruleVersion: rule.version || 1,
      triggerType: rule.triggerType,
      triggerContext: context,
      conditionsMet: evaluation.met,
      evaluationDetails: { conditions: evaluation.details },
      actionsExecuted: evaluation.met ? (rule.actions as RuleAction[]).map(a => a.type) : [],
      actionResults: evaluation.met ? actionResults : [],
      impactedEntities: null,
    };

    await storage.createRuleExecutionLog(logEntry);
    results.push(logEntry);

    if (evaluation.met && rule.stopOnMatch) {
      break;
    }
  }

  return results;
}
