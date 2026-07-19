# Goals / Loops policy runtime contract

This document is the consumer-facing contract for the workspace policy stored by Omvra.

## Durable records

`omvra.goalPolicy.v1` is the workspace default. It is separate from `omvra.preferences.v1`.

```ts
type GoalPolicyV1 = {
  schemaVersion: 1;
  policyRevision: number;
  currency: string;
  dimensions: {
    financial: Budget<'USD'>;
    tokens: Budget<'tokens'>;
    concurrency: Budget<'loops'>;
    attempts: Budget<'attempts'>;
    retries: Budget<'retries'>;
  };
  acceptance: { actor: 'human' | 'agentic' | 'both' };
  agentMutationConfirmation: 'required' | 'allowed';
  rollover: 'dynamic';
  updatedAt: string;
};

type Budget<Unit> =
  | { constrained: false }
  | { constrained: true; mode: 'hard-cap' | 'goal-pool' | 'approval-required'; value: number; unit: Unit };
```

Constrained values are positive; count dimensions use whole numbers. Invalid or incompatible data fails closed to safe defaults. Unknown fields are preserved for forward compatibility. `policyRevision` increments for every accepted workspace-policy change.

## Effective-policy resolution

Runtime consumers resolve scopes in this order:

`workspace default → Goal policy → upstream subgoal policies → target acceptance-gate policy`

Missing fields inherit. A lower scope may reduce a constrained numeric value, change allocation to a stricter mode, or strengthen acceptance. It may not increase a budget, change a constrained dimension to unbounded, weaken a safety rule, or reduce human confirmation. Acceptance strength is ordered `agentic < human < both`; the strongest requirement wins.

The resolver returns the effective policy, `sourceRevision`, and source markers for workspace, Goal, and target scopes. Contract packets copy the effective policy and workspace `policyRevision`.

## Active-policy impact gate

Policy changes affecting an active execution create records under `omvra.goalPolicyImpacts.v1`:

```ts
type GoalPolicyImpact = {
  impactId: string;
  goalId: string;
  executionId: string;
  priorPolicyRevision: number;
  effectivePolicyRevision: number;
  decision: 'pause-and-review' | 'confirmation-required';
  status: 'pending' | 'paused' | 'confirmed';
  requiresUserConfirmation: boolean;
  previousPolicy: EffectivePolicy;
  effectivePolicy: EffectivePolicy;
  actor: string;
  createdAt: string;
};
```

Stricter changes produce `pause-and-review`; widening a blocking policy produces `confirmation-required`. While an impact is pending, `GoalLifecycleService` rejects continuation commands with `POLICY_IMPACT_GATE_REQUIRED`. The affected execution must pause; a widening change may resume only with an explicit confirmed impact decision. Every decision records both policy revisions and the before/after effective policy.

## MCP/runtime rules

- Lifecycle execution state includes `effectivePolicy`, `contractPacket`, and `policyRevision`.
- Contract packets include the Goal identity, contract revision, execution attempt, effective policy, and policy revision.
- Agent-originated `goals.update`, `goals.update_element`, and `goals.update_connector` writes require `humanConfirmed: true` unless `agentMutationConfirmation` is explicitly `allowed`.
- MCP consumers must treat the policy and impact records as durable authority; renderer state is only an editing surface.
