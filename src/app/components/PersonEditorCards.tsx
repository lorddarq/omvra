import type { PersonKind } from '../types';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

interface PersonEditorCardProps {
  name: string;
  role: string;
  kind: PersonKind;
  nameInputId?: string;
  roleInputId?: string;
  kindInputId?: string;
  namePlaceholder?: string;
  rolePlaceholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onNameChange: (name: string) => void;
  onRoleChange: (role: string) => void;
  onKindChange: (kind: PersonKind) => void;
}

interface AgentEditorCardProps extends PersonEditorCardProps {
  agentInstructions: string;
  agentInstructionsInputId?: string;
  onAgentInstructionsChange: (instructions: string) => void;
}

export function PersonEditorCard(props: PersonEditorCardProps) {
  return <BasePersonEditorCard {...props} />;
}

export function AgentEditorCard(props: AgentEditorCardProps) {
  return <BasePersonEditorCard {...props} showAgentInstructions />;
}

function BasePersonEditorCard({
  name,
  role,
  kind,
  nameInputId,
  roleInputId,
  kindInputId,
  namePlaceholder = 'Name',
  rolePlaceholder = 'Role',
  compact = false,
  autoFocus = false,
  onNameChange,
  onRoleChange,
  onKindChange,
  ...agentProps
}: PersonEditorCardProps & Partial<AgentEditorCardProps> & { showAgentInstructions?: boolean }) {
  const inputHeightClass = compact ? 'h-8' : undefined;
  const agentInstructionsInputId = agentProps.agentInstructionsInputId || 'person-agent-instructions';

  return (
    <div className={compact ? 'min-w-[240px] flex-1 space-y-2' : 'space-y-3'}>
      <div className={compact ? undefined : 'space-y-2'}>
        {!compact && nameInputId && <Label htmlFor={nameInputId}>Name</Label>}
        <Input
          id={nameInputId}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={namePlaceholder}
          className={inputHeightClass}
          autoFocus={autoFocus}
        />
      </div>
      <div className={compact ? undefined : 'space-y-2'}>
        {!compact && roleInputId && <Label htmlFor={roleInputId}>Role</Label>}
        <Input
          id={roleInputId}
          value={role}
          onChange={(event) => onRoleChange(event.target.value)}
          placeholder={rolePlaceholder}
          className={inputHeightClass}
        />
      </div>
      <div className={compact ? undefined : 'space-y-2'}>
        {!compact && kindInputId && <Label htmlFor={kindInputId}>Type</Label>}
        <Select value={kind} onValueChange={(value) => onKindChange(value as PersonKind)}>
          <SelectTrigger id={kindInputId} className={inputHeightClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="human">Human</SelectItem>
            <SelectItem value="agentic">Agentic (sub-agent)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {agentProps.showAgentInstructions && (
        <div className={compact ? 'space-y-1' : 'space-y-2'}>
          <Label htmlFor={agentInstructionsInputId} className={compact ? 'text-xs' : undefined}>
            Agent instructions
          </Label>
          <Textarea
            id={agentInstructionsInputId}
            value={agentProps.agentInstructions || ''}
            onChange={(event) => agentProps.onAgentInstructionsChange?.(event.target.value)}
            placeholder="Describe how this agent should approach assigned tasks..."
            className={compact ? 'min-h-[112px] resize-y text-sm' : 'min-h-[120px] resize-y'}
          />
          <p className="text-xs text-gray-500">
            Reused whenever tasks are assigned to this agentic persona.
          </p>
        </div>
      )}
    </div>
  );
}
