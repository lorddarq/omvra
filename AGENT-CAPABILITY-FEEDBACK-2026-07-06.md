# Agent Capability Feedback

Date: 2026-07-06

## Summary Assessment

| Capability area | Verdict | Primary risk |
| --- | --- | --- |
| Situational awareness | Strong | Snapshot-only read is expensive at scale |
| Task execution loop | Good | No `in progress` state distinct from `under review` |
| Handoff | Good | Three paths need behavioural clarity on which to use |
| Communication | Good | Channel discipline depends entirely on instructions |
| Attachments | Weak | Metadata only; no agent-to-agent artefact handoff |
| Roadmap writes | Overpowered | All agents can create milestones; should be role-gated |
| Destructive ops | Risky | Delete is available without confirmation; needs explicit behavioural guard |

## Structural Gap

The biggest structural gap is the missing `in progress` state and the absence of per-role capability scoping.

Right now every agent has the same write surface regardless of its personality. The behavioural instructions are doing all the work of constraining what each agent actually touches, which means a misconfigured or injected instruction could cause an agent to exercise capabilities it was never meant to have.

## Improvement Checklist

- [ ] Improve situational awareness so reads do not depend on expensive snapshot-only access at scale.
- [ ] Add a distinct `in progress` state instead of overloading `under review`.
- [ ] Clarify handoff behaviour across the three available paths and define when each should be used.
- [ ] Reduce communication risk by enforcing channel discipline in the system, not only in instructions.
- [ ] Support real attachment handoff between agents, not just metadata references.
- [ ] Role-gate roadmap and milestone write capabilities instead of exposing them to every agent.
- [ ] Add an explicit confirmation or guardrail for destructive operations such as delete.
- [ ] Introduce per-role capability scoping so each agent can only access the write surface it actually needs.
