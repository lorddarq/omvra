import type { GoalElement, GoalElementType, GoalRecord } from '../types.ts';

export type GoalTemplate = {
  id: string;
  title: string;
  description: string;
  color: string;
  elements: GoalElement[];
};

type TemplateNode = Omit<GoalElement, 'id'> & { id: string };

const node = (id: string, type: GoalElementType, title: string, body: string, x: number, y: number, extra: Partial<GoalElement> = {}): TemplateNode => ({
  id, type, title, body, x, y, width: type === 'goal' ? 250 : 220, height: type === 'condition' ? 150 : type === 'goal' ? 104 : 90, status: 'draft', ...extra,
});

const ephemeralAgent = (requestedType: string, instructions: string): Partial<GoalElement> => ({
  agentConfiguration: { version: 1, mode: 'ephemeral', requestedName: requestedType.replace(/^\w/, character => character.toUpperCase()), requestedType, instructions },
});

const link = (id: string, title: string, sourceId: string, targetId: string, sourceSide: GoalElement['sourceSide'] = 'right', targetSide: GoalElement['targetSide'] = 'left', extra: Partial<GoalElement> = {}): GoalElement => ({
  id, type: 'connector', title, x: 0, y: 0, sourceId, targetId, sourceSide, targetSide, ...extra,
});

const template = (id: string, title: string, description: string, color: string, nodes: TemplateNode[], links: GoalElement[]): GoalTemplate => ({
  id, title, description, color, elements: [...nodes, ...links],
});

export const GOAL_TEMPLATES: GoalTemplate[] = [
  template('ship-product-release', 'Ship a product release', 'Coordinate shaping, building, verification, and a deliberate human release decision.', '#2563eb', [
    node('goal', 'goal', 'Ship the release', 'Move a validated product change from intent to production.', 80, 220),
    node('shape', 'subgoal', 'Shape the release', 'Clarify scope, risks, and acceptance criteria.', 390, 150),
    node('build', 'subgoal', 'Build the change', 'Implement the smallest working slice.', 680, 150),
    node('verify', 'subgoal', 'Verify the evidence', 'Run checks and resolve blocking findings.', 970, 150),
    node('accept', 'approval-gate', 'Release decision', 'A human approves the evidence before release.', 1260, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('shape-link', 'Shape before build', 'goal', 'shape'), link('build-link', 'Build after shaping', 'shape', 'build'), link('verify-link', 'Verify implementation', 'build', 'verify'), link('accept-link', 'Approve release', 'verify', 'accept'),
  ]),
  template('recover-production-incident', 'Recover a production incident', 'Give agents a bounded path from signal to diagnosis, mitigation, and verified recovery.', '#dc2626', [
    node('goal', 'goal', 'Recover the service', 'Restore a healthy customer experience and capture what changed.', 80, 220),
    node('detect', 'subgoal', 'Confirm the incident', 'Separate a real outage from a noisy signal.', 390, 150),
    node('diagnose', 'agent', 'Diagnose the cause', 'Trace logs, metrics, and recent changes.', 680, 150, ephemeralAgent('incident investigator', 'Trace logs, metrics, and recent changes and identify the most likely cause with evidence.')),
    node('condition', 'condition', 'Is the service stable?', 'Evaluate health checks and customer impact.', 970, 140, { conditionPositiveLabel: 'Stable', conditionNegativeLabel: 'Still failing', conditionPositiveOutcome: 'Health checks and key customer flows are green.', conditionNegativeOutcome: 'Rollback or escalate with fresh evidence.' }),
    node('review', 'approval-gate', 'Incident review', 'A human reviews the mitigation and follow-up actions.', 1260, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('detect-link', 'Confirm signal', 'goal', 'detect'), link('diagnose-link', 'Investigate', 'detect', 'diagnose'), link('condition-link', 'Check recovery', 'diagnose', 'condition'), link('review-link', 'Review recovery', 'condition', 'review', 'right', 'left', { conditionBranch: 'positive' }),
  ]),
  template('launch-campaign', 'Launch a marketing campaign', 'Turn a campaign idea into coordinated creative, distribution, and learning.', '#db2777', [
    node('goal', 'goal', 'Launch the campaign', 'Create demand with a clear message and measurable outcome.', 80, 220),
    node('brief', 'subgoal', 'Write the campaign brief', 'Audience, promise, channel, and success signal.', 390, 150),
    node('creative', 'agent', 'Create the assets', 'Draft copy, visuals, and channel variants.', 680, 150, ephemeralAgent('creative producer', 'Draft copy, visuals, and channel variants for the agreed campaign brief.')),
    node('review', 'approval-gate', 'Approve the message', 'Check brand, claims, and audience fit.', 970, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
    node('learn', 'subgoal', 'Measure and learn', 'Compare the signal to the campaign hypothesis.', 1260, 150),
  ], [
    link('brief-link', 'Define the campaign', 'goal', 'brief'), link('creative-link', 'Produce assets', 'brief', 'creative'), link('review-link', 'Review claims', 'creative', 'review'), link('learn-link', 'Launch and measure', 'review', 'learn'),
  ]),
  template('research-decision-brief', 'Build a research decision brief', 'Use agents to turn an ambiguous question into evidence, options, and a recommendation.', '#7c3aed', [
    node('goal', 'goal', 'Answer the decision', 'Give the team enough evidence to choose a direction.', 80, 220),
    node('question', 'subgoal', 'Frame the question', 'Define what must be true for the decision to be useful.', 390, 150),
    node('gather', 'agent', 'Gather evidence', 'Collect sources, interviews, and competing signals.', 680, 150, ephemeralAgent('researcher', 'Collect sources, interviews, and competing signals, distinguishing evidence from interpretation.')),
    node('synthesize', 'subgoal', 'Synthesize options', 'Compare tradeoffs and identify the strongest path.', 970, 150),
    node('condition', 'condition', 'Is the evidence sufficient?', 'Check coverage, confidence, and unresolved contradictions.', 1260, 140, { conditionPositiveLabel: 'Sufficient', conditionNegativeLabel: 'More research', conditionPositiveOutcome: 'The evidence supports a clear recommendation.', conditionNegativeOutcome: 'Collect the missing evidence before deciding.' }),
  ], [
    link('question-link', 'Frame the decision', 'goal', 'question'), link('gather-link', 'Research the question', 'question', 'gather'), link('synthesize-link', 'Compare options', 'gather', 'synthesize'), link('condition-link', 'Check confidence', 'synthesize', 'condition'),
  ]),
  template('onboard-new-customer', 'Onboard a new customer', 'Coordinate discovery, setup, enablement, and a successful first outcome.', '#0891b2', [
    node('goal', 'goal', 'Reach first value', 'Help a new customer achieve a meaningful first outcome.', 80, 220),
    node('discover', 'subgoal', 'Understand the workflow', 'Capture goals, constraints, and the first success metric.', 390, 150),
    node('configure', 'agent', 'Configure the workspace', 'Set up people, permissions, and the first working flow.', 680, 150, ephemeralAgent('workspace specialist', 'Set up people, permissions, and the first working flow without weakening safety boundaries.')),
    node('enable', 'instructions', 'Enable the team', 'Provide the operating instructions and handoff notes.', 970, 150),
    node('gate', 'approval-gate', 'Confirm first value', 'A human confirms the customer has reached the agreed outcome.', 1260, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('discover-link', 'Discover needs', 'goal', 'discover'), link('configure-link', 'Configure solution', 'discover', 'configure'), link('enable-link', 'Explain the workflow', 'configure', 'enable'), link('gate-link', 'Confirm first value', 'enable', 'gate'),
  ]),
  template('automate-recurring-report', 'Automate a recurring report', 'Create a reliable loop that gathers data, writes a readable report, and asks for review when needed.', '#059669', [
    node('goal', 'goal', 'Deliver the weekly report', 'Make the right signal available without manual assembly.', 80, 220),
    node('define', 'subgoal', 'Define the signal', 'Agree on metrics, audience, and the reporting cadence.', 390, 150),
    node('collect', 'agent', 'Collect the data', 'Gather the latest inputs and flag missing values.', 680, 150, ephemeralAgent('data researcher', 'Gather the latest inputs, validate them, and flag missing or inconsistent values.')),
    node('write', 'agent', 'Write the report', 'Explain movement, context, and recommended action.', 970, 150, ephemeralAgent('report writer', 'Explain movement, context, and recommended action using the validated inputs.')),
    node('review', 'approval-gate', 'Review exceptions', 'Escalate unusual or high-impact changes for human review.', 1260, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: false }),
  ], [
    link('define-link', 'Define reporting contract', 'goal', 'define'), link('collect-link', 'Collect inputs', 'define', 'collect'), link('write-link', 'Explain the signal', 'collect', 'write'), link('review-link', 'Escalate exceptions', 'write', 'review'),
  ]),
  template('run-creative-sprint', 'Run a creative sprint', 'Give a small team a clear loop for exploring, deciding, producing, and learning.', '#ea580c', [
    node('goal', 'goal', 'Run the creative sprint', 'Move from a loose brief to one useful, tested direction.', 80, 220),
    node('brief', 'subgoal', 'Set the brief', 'Name the audience, tension, and desired response.', 390, 150),
    node('explore', 'agent', 'Explore directions', 'Generate a few distinct concepts, not variations of one idea.', 680, 150, ephemeralAgent('creative strategist', 'Generate a few distinct concepts, not variations of one idea, and explain the rationale for each.')),
    node('choose', 'condition', 'Which direction earns the next step?', 'Evaluate fit, distinctiveness, and evidence from feedback.', 970, 140, { conditionPositiveLabel: 'Promising', conditionNegativeLabel: 'Rework', conditionPositiveOutcome: 'One direction has a clear reason to continue.', conditionNegativeOutcome: 'Change the brief or explore a new direction.' }),
    node('produce', 'subgoal', 'Produce and test', 'Make the smallest artifact that can teach the team something.', 1260, 150),
  ], [
    link('brief-link', 'Set direction', 'goal', 'brief'), link('explore-link', 'Explore options', 'brief', 'explore'), link('choose-link', 'Evaluate concepts', 'explore', 'choose'), link('produce-link', 'Make the next artifact', 'choose', 'produce', 'right', 'left', { conditionBranch: 'positive' }),
  ]),
  template('competitive-analysis', 'Run a competitive analysis', 'Compare one or more competitors against a shared rubric and turn evidence into a strategic choice.', '#4f46e5', [
    node('goal', 'goal', 'Understand the competitive field', 'Know where competitors win, where they are weak, and where an opportunity is credible.', 80, 220),
    node('scope', 'subgoal', 'Set the comparison rubric', 'Define segments, use cases, dimensions, and evidence standards.', 390, 150),
    node('research', 'agent', 'Research competitors', 'Collect current product, pricing, positioning, and customer evidence across the selected set.', 680, 150, ephemeralAgent('competitive researcher', 'Collect current product, pricing, positioning, and customer evidence across the selected set.')),
    node('compare', 'instructions', 'Normalize the comparison', 'Separate observed facts from interpretation and keep each competitor comparable.', 970, 150),
    node('condition', 'condition', 'Is the evidence decision-ready?', 'Check source quality, coverage, and unresolved contradictions.', 1260, 140, { conditionPositiveLabel: 'Ready', conditionNegativeLabel: 'More research', conditionPositiveOutcome: 'The comparison supports a defensible strategic conclusion.', conditionNegativeOutcome: 'Fill the evidence gaps before making a recommendation.' }),
    node('decision', 'approval-gate', 'Choose the strategic response', 'A product leader reviews the opportunity, threat, or deliberate non-response.', 1550, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('scope-link', 'Define the rubric', 'goal', 'scope'), link('research-link', 'Gather evidence', 'scope', 'research'), link('compare-link', 'Normalize findings', 'research', 'compare'), link('condition-link', 'Check readiness', 'compare', 'condition'), link('decision-link', 'Make the choice', 'condition', 'decision', 'right', 'left', { conditionBranch: 'positive' }),
  ]),
  template('discover-product-problem', 'Discover whether a product problem exists', 'Test a product idea against a recurring user problem before investing in a solution.', '#0f766e', [
    node('goal', 'goal', 'Validate the problem', 'Decide whether the proposed product solves a real, repeated, costly problem.', 80, 220),
    node('frame', 'subgoal', 'Frame the problem hypothesis', 'Name the target user, current behavior, trigger, cost, and assumed alternative.', 390, 150),
    node('interviews', 'agent', 'Run discovery conversations', 'Find people with the behavior and ask about their last real instance, not their reaction to a pitch.', 680, 150, ephemeralAgent('customer researcher', 'Find people with the behavior and ask about their last real instance, not their reaction to a pitch.')),
    node('condition', 'condition', 'Does the problem repeat?', 'Look for frequency, workarounds, urgency, and evidence of a meaningful cost.', 970, 140, { conditionPositiveLabel: 'Problem repeats', conditionNegativeLabel: 'Weak signal', conditionPositiveOutcome: 'The problem appears recurring and important enough to investigate solutions.', conditionNegativeOutcome: 'Refine the audience or reject the current problem framing.' }),
    node('experiment', 'subgoal', 'Test the smallest promise', 'Run a lightweight landing page, concierge workflow, or prototype experiment.', 1260, 150),
    node('gate', 'approval-gate', 'Make the investment decision', 'A human reviews evidence before funding product discovery or delivery.', 1550, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('frame-link', 'Define the hypothesis', 'goal', 'frame'), link('interviews-link', 'Test the hypothesis', 'frame', 'interviews'), link('condition-link', 'Evaluate problem evidence', 'interviews', 'condition'), link('experiment-link', 'Test the promise', 'condition', 'experiment', 'right', 'left', { conditionBranch: 'positive' }), link('gate-link', 'Decide what to fund', 'experiment', 'gate'),
  ]),
  template('audit-design-system', 'Audit a design system', 'Inspect the system as it exists, collect evidence of drift, and make the gaps actionable.', '#7c3aed', [
    node('goal', 'goal', 'Audit the design system', 'Build a trustworthy picture of consistency, coverage, accessibility, and maintenance cost.', 80, 220),
    node('inventory', 'subgoal', 'Inventory the system', 'Map foundations, components, patterns, documentation, and consuming surfaces.', 390, 150),
    node('audit', 'agent', 'Inspect usage and drift', 'Compare source components to rendered product surfaces and capture concrete examples.', 680, 150, ephemeralAgent('product auditor', 'Compare source components to rendered product surfaces and capture concrete examples.')),
    node('evidence', 'instructions', 'Record findings consistently', 'Classify each issue by impact, frequency, ownership, and confidence.', 970, 150),
    node('condition', 'condition', 'Are the gaps actionable?', 'Check whether each finding has a clear source, consequence, and likely owner.', 1260, 140, { conditionPositiveLabel: 'Actionable', conditionNegativeLabel: 'Needs evidence', conditionPositiveOutcome: 'The audit can drive prioritized system work.', conditionNegativeOutcome: 'Collect stronger examples or narrow the audit scope.' }),
    node('review', 'approval-gate', 'Accept the audit baseline', 'A design-system owner confirms the findings are ready for planning.', 1550, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('inventory-link', 'Map the system', 'goal', 'inventory'), link('audit-link', 'Inspect the product', 'inventory', 'audit'), link('evidence-link', 'Capture findings', 'audit', 'evidence'), link('condition-link', 'Check evidence quality', 'evidence', 'condition'), link('review-link', 'Accept baseline', 'condition', 'review', 'right', 'left', { conditionBranch: 'positive' }),
  ]),
  template('audit-process', 'Run a process audit', 'Evaluate a process from source evidence to prioritized findings, improvement opportunities, and an accepted audit baseline.', '#0f766e', [
    node('goal', 'goal', 'Audit the process', 'Build an evidence-based view of how the process works, where it breaks down, and what should change.', 80, 220),
    node('source', 'human-input', 'Provide the audit source', 'Supply a Confluence page URL or the process document that should be audited.', 390, 150, {
      humanInputPrompt: 'Provide a Confluence page URL, or identify the source document. If the source is a document or other file artifact, ask the user to attach it before continuing.',
    }),
    node('scope', 'subgoal', 'Frame the audit scope', 'Confirm the process owner, participants, trigger, expected outcome, boundaries, time period, and evidence standard.', 680, 150),
    node('inspect', 'agent', 'Inspect the process', 'Map the current process, compare stated and observed practice, and collect concrete evidence of friction, risk, waste, and control gaps.', 970, 150, ephemeralAgent('process auditor', 'Audit the supplied Confluence page or attached document. Map the process end to end, distinguish documented policy from observed practice, cite evidence for every finding, and flag missing source material instead of inventing details.')),
    node('findings', 'instructions', 'Structure the findings', 'Classify findings by impact, frequency, control risk, owner, confidence, and recommended next step. Separate evidence, interpretation, and proposal.', 1260, 150),
    node('condition', 'condition', 'Is the audit evidence sufficient?', 'Check source coverage, traceability, contradictions, and whether the recommendations follow from the evidence.', 1550, 140, { conditionPositiveLabel: 'Ready', conditionNegativeLabel: 'Needs evidence', conditionPositiveOutcome: 'The audit is traceable enough to prioritize improvements.', conditionNegativeOutcome: 'Request the missing attachment or source access, resolve contradictions, and continue the audit.' }),
    node('review', 'approval-gate', 'Accept the audit baseline', 'A process owner reviews the evidence, findings, and prioritized improvements before the audit becomes an accepted baseline.', 1840, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('source-link', 'Start with source material', 'goal', 'source'), link('scope-link', 'Frame the audit', 'source', 'scope'), link('inspect-link', 'Inspect the process', 'scope', 'inspect'), link('findings-link', 'Structure evidence and findings', 'inspect', 'findings'), link('condition-link', 'Check audit readiness', 'findings', 'condition'), link('review-link', 'Accept the baseline', 'condition', 'review', 'right', 'left', { conditionBranch: 'positive' }),
  ]),
  template('propose-design-system-changes', 'Propose design system changes', 'Turn audit evidence into a coherent, prioritized change proposal rather than a list of disconnected improvements.', '#be123c', [
    node('goal', 'goal', 'Improve the design system', 'Choose changes that make the product more coherent without creating migration chaos.', 80, 220),
    node('prioritize', 'subgoal', 'Prioritize the change set', 'Rank findings by user impact, repetition, accessibility risk, and implementation leverage.', 390, 150),
    node('proposal', 'agent', 'Draft the system proposal', 'Define the target pattern, migration path, ownership, and examples for each change.', 680, 150, ephemeralAgent('systems designer', 'Define the target pattern, migration path, ownership, and examples for each change.')),
    node('impact', 'condition', 'Is the change set coherent?', 'Check that the proposal reduces inconsistency instead of moving complexity elsewhere.', 970, 140, { conditionPositiveLabel: 'Coherent', conditionNegativeLabel: 'Rework proposal', conditionPositiveOutcome: 'The changes reinforce one system direction and can be sequenced.', conditionNegativeOutcome: 'Resolve conflicting recommendations before presenting the proposal.' }),
    node('plan', 'instructions', 'Prepare the migration plan', 'Document rollout order, compatibility constraints, adoption examples, and validation checks.', 1260, 150),
    node('gate', 'approval-gate', 'Approve the direction', 'A design and engineering owner agree on the proposed system contract.', 1550, 150, { policy: { acceptanceActor: 'both' }, approvalEvidenceRequired: true }),
  ], [
    link('prioritize-link', 'Choose leverage points', 'goal', 'prioritize'), link('proposal-link', 'Draft changes', 'prioritize', 'proposal'), link('impact-link', 'Check system coherence', 'proposal', 'impact'), link('plan-link', 'Plan adoption', 'impact', 'plan', 'right', 'left', { conditionBranch: 'positive' }), link('gate-link', 'Approve the contract', 'plan', 'gate'),
  ]),
  template('write-prepared-blog-article', 'Write a prepared blog article', 'Move from topic research and audience framing to a useful, evidence-backed article ready for editorial review.', '#0369a1', [
    node('goal', 'goal', 'Publish the article', 'Create a clear article that earns attention by being genuinely useful on the chosen topic.', 80, 220),
    node('research', 'subgoal', 'Prepare the topic', 'Research the audience question, search landscape, credible sources, and useful point of view.', 390, 150),
    node('outline', 'agent', 'Build the article outline', 'Turn preparation into a promise, structure, examples, and evidence plan.', 680, 150, ephemeralAgent('editorial strategist', 'Turn preparation into a promise, structure, examples, and evidence plan.')),
    node('draft', 'subgoal', 'Write and edit the draft', 'Make the argument clear, concrete, and appropriately scoped for the reader.', 970, 150),
    node('condition', 'condition', 'Is the draft trustworthy?', 'Check claims, sources, usefulness, originality, and whether the article answers the initial question.', 1260, 140, { conditionPositiveLabel: 'Ready for edit', conditionNegativeLabel: 'Needs revision', conditionPositiveOutcome: 'The article is useful and supportable enough for final editorial review.', conditionNegativeOutcome: 'Revise claims, structure, or examples before publication.' }),
    node('review', 'approval-gate', 'Editorial approval', 'A human editor checks voice, accuracy, and publication readiness.', 1550, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('research-link', 'Prepare the topic', 'goal', 'research'), link('outline-link', 'Structure the article', 'research', 'outline'), link('draft-link', 'Write the draft', 'outline', 'draft'), link('condition-link', 'Check trustworthiness', 'draft', 'condition'), link('review-link', 'Approve publication', 'condition', 'review', 'right', 'left', { conditionBranch: 'positive' }),
  ]),
  template('prepare-meeting', 'Prepare and run a meeting', 'Make the meeting earn its time by clarifying the decision, preparing the room, and capturing follow-through.', '#9333ea', [
    node('goal', 'goal', 'Run a useful meeting', 'Leave with a clear decision, owner, and next action—or cancel the meeting.', 80, 220),
    node('decision', 'subgoal', 'Clarify the decision', 'State what must be decided, what is already known, and what is out of scope.', 390, 150),
    node('context', 'agent', 'Gather the context', 'Collect prior decisions, relevant metrics, open questions, and attendee perspectives.', 680, 150, ephemeralAgent('meeting analyst', 'Collect prior decisions, relevant metrics, open questions, and attendee perspectives.')),
    node('agenda', 'instructions', 'Prepare the agenda', 'Sequence the discussion, pre-reads, timeboxes, decision rule, and owner for notes.', 970, 150),
    node('condition', 'condition', 'Is the meeting ready?', 'Check that the right people, inputs, and decision authority are present.', 1260, 140, { conditionPositiveLabel: 'Ready', conditionNegativeLabel: 'Defer or async', conditionPositiveOutcome: 'The meeting has a clear reason to happen now.', conditionNegativeOutcome: 'Resolve missing inputs or replace the meeting with an async update.' }),
    node('followup', 'approval-gate', 'Confirm follow-through', 'The facilitator confirms decisions, owners, dates, and unresolved risks after the meeting.', 1550, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: false }),
  ], [
    link('decision-link', 'Name the decision', 'goal', 'decision'), link('context-link', 'Gather context', 'decision', 'context'), link('agenda-link', 'Prepare the room', 'context', 'agenda'), link('condition-link', 'Check readiness', 'agenda', 'condition'), link('followup-link', 'Record the outcome', 'condition', 'followup', 'right', 'left', { conditionBranch: 'positive' }),
  ]),
  template('release-new-feature', 'Plan and release a new feature', 'Connect product planning, design, implementation, QA, and release evidence into one visible delivery loop.', '#2563eb', [
    node('goal', 'goal', 'Release the new feature', 'Deliver a valuable, usable, and supportable feature to the intended users.', 80, 220),
    node('plan', 'subgoal', 'Plan the feature', 'Define the user outcome, scope boundary, risks, rollout, and success signal.', 390, 150),
    node('design', 'agent', 'Design the experience', 'Resolve the interaction model, states, content, accessibility, and edge cases.', 680, 150, ephemeralAgent('product designer', 'Resolve the interaction model, states, content, accessibility, and edge cases.')),
    node('build', 'subgoal', 'Build the feature', 'Implement the approved contract and instrument the important outcome.', 970, 150),
    node('qa', 'condition', 'Does it meet the release bar?', 'Verify acceptance criteria, regression risk, accessibility, and rollout readiness.', 1260, 140, { conditionPositiveLabel: 'Ready', conditionNegativeLabel: 'Fix before release', conditionPositiveOutcome: 'The feature meets the agreed release bar and can be rolled out safely.', conditionNegativeOutcome: 'Return to implementation or design with evidence of the gap.' }),
    node('release', 'approval-gate', 'Release and learn', 'A product owner confirms the rollout decision and post-release learning plan.', 1550, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
  ], [
    link('plan-link', 'Define the feature', 'goal', 'plan'), link('design-link', 'Design the experience', 'plan', 'design'), link('build-link', 'Implement the contract', 'design', 'build'), link('qa-link', 'Verify release readiness', 'build', 'qa'), link('release-link', 'Release the feature', 'qa', 'release', 'right', 'left', { conditionBranch: 'positive' }),
  ]),
  template('employee-performance-review', 'Conduct an employee performance review', 'Turn evidence, self-reflection, and expectations into a fair review conversation and a practical development plan.', '#0f766e', [
    node('goal', 'goal', 'Conduct the performance review', 'Give the employee clear, evidence-based feedback and agree on the next period of growth.', 80, 220),
    node('criteria', 'subgoal', 'Set the review frame', 'Confirm the review period, role expectations, goals, and evidence sources.', 390, 150),
    node('evidence', 'agent', 'Gather performance evidence', 'Review outcomes, examples, collaboration signals, and prior commitments without over-weighting recent events.', 680, 150, ephemeralAgent('performance analyst', 'Review outcomes, examples, collaboration signals, and prior commitments without over-weighting recent events.')),
    node('draft', 'instructions', 'Prepare the feedback draft', 'Separate observations from interpretations, acknowledge strengths, and write specific improvement guidance.', 970, 150),
    node('condition', 'condition', 'Is the review fair and actionable?', 'Check evidence quality, expectation alignment, balance, specificity, and whether the feedback can lead to a useful conversation.', 1260, 140, { conditionPositiveLabel: 'Ready', conditionNegativeLabel: 'Needs revision', conditionPositiveOutcome: 'The review is grounded enough to discuss with the employee.', conditionNegativeOutcome: 'Gather missing evidence or revise unclear and unsupported feedback.' }),
    node('review', 'approval-gate', 'Manager review', 'A manager or designated reviewer confirms the feedback is fair, respectful, and ready to share.', 1550, 150, { policy: { acceptanceActor: 'human' }, approvalEvidenceRequired: true }),
    node('plan', 'subgoal', 'Agree on the development plan', 'Discuss the review, capture the employee perspective, and agree on goals, support, and follow-up checkpoints.', 1840, 150),
  ], [
    link('criteria-link', 'Set expectations', 'goal', 'criteria'), link('evidence-link', 'Gather examples', 'criteria', 'evidence'), link('draft-link', 'Prepare feedback', 'evidence', 'draft'), link('condition-link', 'Check review quality', 'draft', 'condition'), link('review-link', 'Approve feedback', 'condition', 'review', 'right', 'left', { conditionBranch: 'positive' }), link('plan-link', 'Agree next steps', 'review', 'plan'),
  ]),
];

export function instantiateGoalTemplate(templateToAdd: GoalTemplate, createId: (prefix: string) => string): GoalRecord {
  const idMap = new Map(templateToAdd.elements.map(element => [element.id, createId(element.type === 'connector' ? 'connector' : 'element')]));
  const elements = templateToAdd.elements.map(element => ({
    ...element,
    id: idMap.get(element.id)!,
    sourceId: element.sourceId ? idMap.get(element.sourceId) : undefined,
    targetId: element.targetId ? idMap.get(element.targetId) : undefined,
  }));
  return {
    id: createId('goal'),
    title: templateToAdd.title,
    color: templateToAdd.color,
    updatedAt: new Date().toISOString(),
    elements,
  };
}
