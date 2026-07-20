import type { GoalBudgetMode, GoalElement, GoalPolicy, GoalPolicyDimensionOverride, GoalRecord } from '../types.ts';

export const GOAL_POLICY_KEY = 'omvra.goalPolicy.v1';
export const GOAL_POLICY_SCHEMA_VERSION = 1 as const;

export type GoalPolicyBudgetMode = 'hard-cap' | 'goal-pool' | 'approval-required';
export type GoalPolicyUnit = 'USD' | 'tokens' | 'loops' | 'attempts' | 'retries';
export type GoalPolicyAcceptanceActor = 'human' | 'agentic' | 'both';

export const GOAL_POLICY_DIMENSIONS: Array<{ key: GoalPolicyDimension; label: string; unit: GoalPolicyDimensionOverride['unit']; legacyMode: keyof GoalPolicy; legacyValue: keyof GoalPolicy }> = [
  { key: 'financial', label: 'Financial cost', unit: 'USD', legacyMode: 'financialBudgetMode', legacyValue: 'maxFinancialCost' },
  { key: 'tokens', label: 'Tokens', unit: 'tokens', legacyMode: 'tokenBudgetMode', legacyValue: 'maxTokens' },
  { key: 'concurrency', label: 'Concurrent loops', unit: 'loops', legacyMode: 'concurrencyBudgetMode', legacyValue: 'maxConcurrentLoops' },
  { key: 'attempts', label: 'Total loop attempts', unit: 'attempts', legacyMode: 'loopAttemptsBudgetMode', legacyValue: 'maxLoopAttempts' },
  { key: 'retries', label: 'Retries / rework', unit: 'retries', legacyMode: 'retryBudgetMode', legacyValue: 'maxRetries' },
];
export const GOAL_POLICY_SAFE_VALUES: Record<GoalPolicyDimension, number> = { financial: 10, tokens: 100000, concurrency: 1, attempts: 10, retries: 2 };

export type GoalBudgetDimension =
  | { constrained: false }
  | {
      constrained: true;
      mode: GoalPolicyBudgetMode;
      value: number;
      unit: GoalPolicyUnit;
    } & Record<string, unknown>;

export interface GoalPolicyV1 {
  [key: string]: unknown;
  schemaVersion: typeof GOAL_POLICY_SCHEMA_VERSION;
  policyRevision: number;
  currency: string;
  dimensions: {
    financial: GoalBudgetDimension;
    tokens: GoalBudgetDimension;
    concurrency: GoalBudgetDimension;
    attempts: GoalBudgetDimension;
    retries: GoalBudgetDimension;
  };
  acceptance: { actor: GoalPolicyAcceptanceActor };
  agentMutationConfirmation: 'required' | 'allowed';
  rollover: 'dynamic';
  updatedAt: string;
}

export type GoalPolicyDimension = keyof GoalPolicyV1['dimensions'];

export function inspectorDefaultDimension(dimension: GoalPolicyDimension): { constrained: true; mode: Exclude<GoalBudgetMode, 'unbounded'>; value: number; unit: GoalPolicyDimensionOverride['unit'] } {
  const metadata = GOAL_POLICY_DIMENSIONS.find(item => item.key === dimension)!;
  return { constrained: true, mode: 'hard-cap', value: GOAL_POLICY_SAFE_VALUES[dimension], unit: metadata.unit };
}

export function legacyDimensionOverride(policy: GoalPolicy | undefined, dimension: GoalPolicyDimension): GoalPolicyDimensionOverride | undefined {
  if (!policy) return undefined;
  const metadata = GOAL_POLICY_DIMENSIONS.find(item => item.key === dimension)!;
  const mode = policy[metadata.legacyMode];
  const value = policy[metadata.legacyValue];
  if (mode === 'unbounded') return { constrained: false };
  if (typeof mode === 'string' && typeof value === 'number' && value > 0) {
    return { constrained: true, mode: mode as Exclude<GoalBudgetMode, 'unbounded'>, value, unit: metadata.unit };
  }
  return undefined;
}

export function resolveInspectorPolicy(workspacePolicy: GoalPolicyV1 | undefined, goal: GoalRecord, target: GoalElement): Pick<GoalPolicyV1, 'dimensions' | 'acceptance'> {
  const dimensions = { ...(workspacePolicy?.dimensions ?? {}) } as GoalPolicyV1['dimensions'];
  const effective = {
    dimensions: GOAL_POLICY_DIMENSIONS.reduce((result, dimension) => {
      result[dimension.key] = dimensions[dimension.key] ?? inspectorDefaultDimension(dimension.key);
      return result;
    }, {} as GoalPolicyV1['dimensions']),
    acceptance: workspacePolicy?.acceptance ?? { actor: 'human' as const },
  };
  const applyScope = (policy: GoalPolicy | undefined) => {
    for (const dimension of GOAL_POLICY_DIMENSIONS) {
      const override = policy?.dimensions?.[dimension.key] ?? legacyDimensionOverride(policy, dimension.key);
      const current = effective.dimensions[dimension.key];
      if (!override || override.constrained === false) continue;
      if (!current.constrained || (override.value !== undefined && override.value <= current.value && override.unit === current.unit)) {
        effective.dimensions[dimension.key] = { ...current, ...override, constrained: true, unit: dimension.unit } as typeof current;
      }
    }
    const actor = policy?.acceptanceActor;
    const rank = { agentic: 1, human: 2, both: 3 } as const;
    if (actor && rank[actor] > rank[effective.acceptance.actor]) effective.acceptance = { actor };
  };
  applyScope(goal.policy);
  const incoming = new Map<string, string[]>();
  goal.elements.filter(element => element.type === 'connector' && element.sourceId && element.targetId).forEach(connection => {
    const parents = incoming.get(connection.targetId!) ?? [];
    parents.push(connection.sourceId!);
    incoming.set(connection.targetId!, parents);
  });
  const visited = new Set<string>([target.id]);
  const pending = [...(incoming.get(target.id) ?? [])];
  const ancestors: GoalElement[] = [];
  while (pending.length) {
    const id = pending.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const ancestor = goal.elements.find(element => element.id === id);
    if (ancestor) {
      if (ancestor.type === 'subgoal') ancestors.unshift(ancestor);
      pending.push(...(incoming.get(id) ?? []));
    }
  }
  ancestors.forEach(ancestor => applyScope(ancestor.policy));
  applyScope(target.policy);
  return effective;
}

const DEFAULT_DIMENSIONS: GoalPolicyV1['dimensions'] = {
  financial: { constrained: true, mode: 'hard-cap', value: 10, unit: 'USD' },
  tokens: { constrained: true, mode: 'hard-cap', value: 100000, unit: 'tokens' },
  concurrency: { constrained: true, mode: 'hard-cap', value: 1, unit: 'loops' },
  attempts: { constrained: true, mode: 'hard-cap', value: 10, unit: 'attempts' },
  retries: { constrained: true, mode: 'hard-cap', value: 2, unit: 'retries' },
};

const DIMENSION_UNITS: Record<GoalPolicyDimension, GoalPolicyUnit> = {
  financial: 'USD',
  tokens: 'tokens',
  concurrency: 'loops',
  attempts: 'attempts',
  retries: 'retries',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAcceptanceActor(value: unknown): value is GoalPolicyAcceptanceActor {
  return value === 'human' || value === 'agentic' || value === 'both';
}

function isMode(value: unknown): value is GoalPolicyBudgetMode {
  return value === 'hard-cap' || value === 'goal-pool' || value === 'approval-required';
}

function isUnit(value: unknown): value is GoalPolicyUnit {
  return value === 'USD' || value === 'tokens' || value === 'loops' || value === 'attempts' || value === 'retries';
}

function preserveUnknownFields(source: Record<string, unknown>, knownFields: string[]): Record<string, unknown> {
  const known = new Set(knownFields);
  return Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)));
}

function sanitizeDimension(
  value: unknown,
  dimension: GoalPolicyDimension,
  fallback: GoalBudgetDimension,
  warnings: string[],
): GoalBudgetDimension {
  if (!isRecord(value)) {
    warnings.push(`${dimension} policy is missing; using the safe default.`);
    return fallback;
  }

  const unknownFields = preserveUnknownFields(value, ['constrained', 'mode', 'value', 'unit']);
  if (value.constrained === false) {
    if (['mode', 'value', 'unit'].some(field => value[field] !== undefined)) {
      warnings.push(`${dimension} is unbounded; constrained fields were ignored.`);
    }
    return { ...unknownFields, constrained: false };
  }

  const expectedUnit = DIMENSION_UNITS[dimension];
  const numericValue = Number(value.value);
  if (!isMode(value.mode) || !Number.isFinite(numericValue) || numericValue <= 0 || !isUnit(value.unit)) {
    warnings.push(`${dimension} policy is invalid; using the safe default.`);
    return fallback;
  }

  if (value.unit !== expectedUnit) {
    warnings.push(`${dimension} policy uses an incompatible unit; using the safe default.`);
    return fallback;
  }

  if (dimension !== 'financial' && !Number.isInteger(numericValue)) {
    warnings.push(`${dimension} policy must use a whole-number value; using the safe default.`);
    return fallback;
  }

  return { ...unknownFields, constrained: true, mode: value.mode, value: numericValue, unit: expectedUnit };
}

export function getDefaultGoalBudgetDimension(dimension: GoalPolicyDimension): GoalBudgetDimension {
  return { ...DEFAULT_DIMENSIONS[dimension] };
}

export function createDefaultGoalPolicy(now = new Date().toISOString()): GoalPolicyV1 {
  return {
    schemaVersion: GOAL_POLICY_SCHEMA_VERSION,
    policyRevision: 0,
    currency: 'USD',
    dimensions: {
      financial: { ...DEFAULT_DIMENSIONS.financial },
      tokens: { ...DEFAULT_DIMENSIONS.tokens },
      concurrency: { ...DEFAULT_DIMENSIONS.concurrency },
      attempts: { ...DEFAULT_DIMENSIONS.attempts },
      retries: { ...DEFAULT_DIMENSIONS.retries },
    },
    acceptance: { actor: 'human' },
    agentMutationConfirmation: 'required',
    rollover: 'dynamic',
    updatedAt: now,
  };
}

export function sanitizeGoalPolicy(value: unknown, fallback = createDefaultGoalPolicy()): {
  policy: GoalPolicyV1;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (!isRecord(value)) {
    return { policy: fallback, warnings: value === undefined ? [] : ['Goal policy data is invalid; using safe defaults.'] };
  }

  const dimensions = isRecord(value.dimensions) ? value.dimensions : {};
  const policy: GoalPolicyV1 = {
    ...preserveUnknownFields(value, [
      'schemaVersion', 'policyRevision', 'currency', 'dimensions', 'acceptance',
      'agentMutationConfirmation', 'rollover', 'updatedAt',
    ]),
    schemaVersion: GOAL_POLICY_SCHEMA_VERSION,
    policyRevision: Number.isInteger(Number(value.policyRevision)) && Number(value.policyRevision) >= 0
      ? Number(value.policyRevision)
      : fallback.policyRevision,
    currency: typeof value.currency === 'string' && value.currency.trim() ? value.currency.trim().toUpperCase() : fallback.currency,
    dimensions: {
      financial: sanitizeDimension(dimensions.financial, 'financial', fallback.dimensions.financial, warnings),
      tokens: sanitizeDimension(dimensions.tokens, 'tokens', fallback.dimensions.tokens, warnings),
      concurrency: sanitizeDimension(dimensions.concurrency, 'concurrency', fallback.dimensions.concurrency, warnings),
      attempts: sanitizeDimension(dimensions.attempts, 'attempts', fallback.dimensions.attempts, warnings),
      retries: sanitizeDimension(dimensions.retries, 'retries', fallback.dimensions.retries, warnings),
    },
    acceptance: {
      ...(isRecord(value.acceptance) ? preserveUnknownFields(value.acceptance, ['actor']) : {}),
      actor: isRecord(value.acceptance) && isAcceptanceActor(value.acceptance.actor)
        ? value.acceptance.actor
        : fallback.acceptance.actor,
    },
    agentMutationConfirmation: value.agentMutationConfirmation === 'allowed' || value.agentMutationConfirmation === 'required'
      ? value.agentMutationConfirmation
      : fallback.agentMutationConfirmation,
    rollover: 'dynamic',
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt ? value.updatedAt : fallback.updatedAt,
  };

  if (value.policyRevision !== undefined && policy.policyRevision === fallback.policyRevision &&
      !(Number.isInteger(Number(value.policyRevision)) && Number(value.policyRevision) >= 0)) {
    warnings.push('Policy revision is invalid; using the safe revision.');
  }
  if (value.currency !== undefined && (typeof value.currency !== 'string' || !value.currency.trim())) {
    warnings.push('Currency is invalid; using the safe currency.');
  }
  if (value.acceptance !== undefined && (!isRecord(value.acceptance) || !isAcceptanceActor(value.acceptance.actor))) {
    warnings.push('Acceptance boundary is invalid; using the safe boundary.');
  }
  if (value.agentMutationConfirmation !== undefined &&
      value.agentMutationConfirmation !== 'required' && value.agentMutationConfirmation !== 'allowed') {
    warnings.push('Agent mutation confirmation is invalid; requiring confirmation.');
  }
  if (value.rollover !== undefined && value.rollover !== 'dynamic') {
    warnings.push('Unsupported rollover mode was reset to dynamic allocation.');
  }

  if (value.schemaVersion !== GOAL_POLICY_SCHEMA_VERSION) {
    warnings.push('Goal policy schema was migrated to v1 safe defaults where needed.');
  }

  return { policy, warnings };
}

export function updateGoalPolicy(
  current: GoalPolicyV1,
  updates: Partial<Pick<GoalPolicyV1, 'currency' | 'acceptance' | 'agentMutationConfirmation'>> & {
    dimensions?: Partial<GoalPolicyV1['dimensions']>;
  },
  now = new Date().toISOString(),
): GoalPolicyV1 {
  const next = {
    ...current,
    currency: updates.currency ?? current.currency,
    acceptance: updates.acceptance ?? current.acceptance,
    agentMutationConfirmation: updates.agentMutationConfirmation ?? current.agentMutationConfirmation,
    dimensions: { ...current.dimensions, ...updates.dimensions },
    policyRevision: current.policyRevision + 1,
    updatedAt: now,
  };
  return sanitizeGoalPolicy(next, current).policy;
}

export function resetGoalPolicy(current: GoalPolicyV1, now = new Date().toISOString()): GoalPolicyV1 {
  return {
    ...createDefaultGoalPolicy(now),
    policyRevision: current.policyRevision + 1,
  };
}

export function getGoalPolicyUnit(dimension: GoalPolicyDimension): GoalPolicyUnit {
  return DIMENSION_UNITS[dimension];
}
