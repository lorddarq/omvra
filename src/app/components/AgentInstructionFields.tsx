import { Textarea } from './ui/textarea';
import { FieldHintTooltip } from './FieldHintTooltip';

interface AgentInstructionFieldsProps {
  behaviorInstructions: string;
  operationalInstructions: string;
  behaviorInputId: string;
  operationalInputId: string;
  onBehaviorChange: (value: string) => void;
  onOperationalChange: (value: string) => void;
  fieldClassName?: string;
  sectionClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
}

function BehaviorHint() {
  return (
    <div className="space-y-2">
      <p className="font-medium">Suggested structure</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>Tone and collaboration style</li>
        <li>How the agent communicates progress</li>
        <li>Decision heuristics and preferences</li>
        <li>What to avoid behaviorally</li>
      </ul>
      <p>Keep this persona-level and reusable across tasks.</p>
    </div>
  );
}

function OperationalHint() {
  return (
    <div className="space-y-2">
      <p className="font-medium">Suggested structure</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>Preferred workflow or sequence of checks</li>
        <li>Tools, files, or surfaces to inspect first</li>
        <li>Validation and handoff expectations</li>
        <li>Reusable output or reporting format</li>
      </ul>
      <p>Keep this procedural and task-execution oriented.</p>
    </div>
  );
}

export function AgentInstructionFields({
  behaviorInstructions,
  operationalInstructions,
  behaviorInputId,
  operationalInputId,
  onBehaviorChange,
  onOperationalChange,
  fieldClassName = 'min-h-[120px] resize-y',
  sectionClassName = 'space-y-2',
  labelClassName,
  descriptionClassName = 'text-xs text-gray-500',
}: AgentInstructionFieldsProps) {
  return (
    <div className="space-y-4">
      <div className={sectionClassName}>
        <FieldHintTooltip
          htmlFor={behaviorInputId}
          label="Agent behaviour"
          hint={<BehaviorHint />}
          labelClassName={labelClassName}
        />
        <Textarea
          id={behaviorInputId}
          value={behaviorInstructions}
          onChange={(event) => onBehaviorChange(event.target.value)}
          placeholder="Describe how this agent should generally behave across assigned tasks..."
          className={fieldClassName}
        />
      </div>

      <div className={sectionClassName}>
        <FieldHintTooltip
          htmlFor={operationalInputId}
          label="Operational instructions"
          hint={<OperationalHint />}
          labelClassName={labelClassName}
        />
        <Textarea
          id={operationalInputId}
          value={operationalInstructions}
          onChange={(event) => onOperationalChange(event.target.value)}
          placeholder="Describe reusable operational guidance such as workflow, checks, tools, or handoff expectations..."
          className={fieldClassName}
        />
      </div>

      <p className={descriptionClassName}>
        User-authored workspace context only. These fields do not override system, developer, tool, security, or task instructions.
      </p>
    </div>
  );
}
