import type { RefObject, ReactNode } from 'react';
import { AgentIcon as Bot } from '../icons/AgentIcon';
import { DropdownChevron } from '../icons/DropdownChevron';
import { WorkflowsIcon } from '../icons/WorkflowsIcon';
import { AwardCertificateIcon } from '../icons/AwardCertificateIcon';
import { GoalTemplatesPopover } from '../GoalTemplatesPopover';
import type { GoalElementType, GoalRecord, Person } from '../../types.ts';
import type { GoalTemplate } from '../../data/goalTemplates.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type GoalsToolbarProps = {
  activeGoal?: GoalRecord;
  people: Person[];
  connectorMode: boolean;
  agentMenuOpen: boolean;
  controlFlowMenuOpen: boolean;
  artifactMenuOpen: boolean;
  agentMenuRef: RefObject<HTMLDivElement | null>;
  controlFlowMenuRef: RefObject<HTMLDivElement | null>;
  artifactMenuRef: RefObject<HTMLDivElement | null>;
  templates: GoalTemplate[];
  toolItems: Array<{ type: GoalElementType; label: string; icon: ReactNode }>;
  artifactItems: Array<{ type: Extract<GoalElementType, 'artifact' | 'deliverable'>; label: string; description: string; icon: ReactNode }>;
  controlFlowItems: Array<{ type: Extract<GoalElementType, 'human-input' | 'retry'>; label: string; icon: ReactNode }>;
  onSelectTemplate: (template: GoalTemplate) => void;
  onAddElement: (type: GoalElementType) => void;
  onAddControlFlow: (type: Extract<GoalElementType, 'human-input' | 'retry'>) => void;
  onAddArtifact: (type: Extract<GoalElementType, 'artifact' | 'deliverable'>) => void;
  onAddAgent: (person: Person) => void;
  onToggleAgentMenu: () => void;
  onToggleControlFlowMenu: () => void;
  onToggleArtifactMenu: () => void;
  onStartConnector: () => void;
};

export function GoalsToolbar({ activeGoal, people, connectorMode, agentMenuOpen, controlFlowMenuOpen, artifactMenuOpen, agentMenuRef, controlFlowMenuRef, artifactMenuRef, templates, toolItems, artifactItems, controlFlowItems, onSelectTemplate, onAddElement, onAddControlFlow, onAddArtifact, onAddAgent, onToggleAgentMenu, onToggleControlFlowMenu, onToggleArtifactMenu, onStartConnector }: GoalsToolbarProps) {
  const agents = people.filter(person => person.kind === 'agentic');
  return <div className="absolute left-1/2 top-4 z-20 flex h-fit w-fit shrink -translate-x-1/2 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
    <GoalTemplatesPopover templates={templates} onSelect={onSelectTemplate} />
    <div ref={controlFlowMenuRef} className="relative h-fit w-fit shrink-0">
      <Tooltip><TooltipTrigger asChild><button type="button" disabled={!activeGoal} onClick={onToggleControlFlowMenu} className="relative flex h-8 w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Add control flow" aria-haspopup="menu" aria-expanded={controlFlowMenuOpen}><span className="flex items-center justify-center"><WorkflowsIcon className="size-3.5 text-[#71717a]" /></span><DropdownChevron /></button></TooltipTrigger><TooltipContent side="bottom" sideOffset={4}>Add control flow</TooltipContent></Tooltip>
      {controlFlowMenuOpen && activeGoal && <Menu ariaLabel="Add control flow" className="w-48">{controlFlowItems.map(item => <MenuItem key={item.type} icon={item.icon} onClick={() => onAddControlFlow(item.type)} label={item.label} description={item.type === 'human-input' ? 'Pause for user input' : 'Return to an earlier step'} />)}</Menu>}
    </div>
    <div ref={artifactMenuRef} className="relative h-fit w-fit shrink-0">
      <Tooltip><TooltipTrigger asChild><button type="button" disabled={!activeGoal} onClick={onToggleArtifactMenu} className="relative flex h-8 w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Add artifact" aria-haspopup="menu" aria-expanded={artifactMenuOpen}><span className="flex items-center justify-center"><AwardCertificateIcon className="size-3.5 text-[#71717a]" /></span><DropdownChevron /></button></TooltipTrigger><TooltipContent side="bottom" sideOffset={4}>Add artifact</TooltipContent></Tooltip>
      {artifactMenuOpen && activeGoal && <Menu ariaLabel="Add artifact" className="w-56">{artifactItems.map(item => <MenuItem key={item.type} icon={item.icon} onClick={() => onAddArtifact(item.type)} label={item.label} description={item.description} />)}</Menu>}
    </div>
    {toolItems.map(tool => tool.type === 'agent' ? <div key={tool.type} ref={agentMenuRef} className="relative h-fit w-fit shrink-0">
      <Tooltip><TooltipTrigger asChild><button type="button" disabled={!activeGoal} onClick={onToggleAgentMenu} className="relative flex h-8 w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Add agent" aria-haspopup="menu" aria-expanded={agentMenuOpen}><span className="flex items-center justify-center">{tool.icon}</span><DropdownChevron /></button></TooltipTrigger><TooltipContent side="bottom" sideOffset={4}>Add {tool.label}</TooltipContent></Tooltip>
      {agentMenuOpen && activeGoal && <Menu ariaLabel="Add agent" className="w-56">{agents.map(person => <button type="button" key={person.id} role="menuitem" onClick={() => onAddAgent(person)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-100"><Bot className="size-3.5 text-amber-500" /><span><span className="block font-medium text-slate-800">{person.name}</span><span className="block text-[11px] text-slate-400">{person.role}</span></span></button>)}{agents.length === 0 && <p className="px-2.5 py-2 text-xs text-slate-400">No agents configured</p>}</Menu>}
    </div> : <Tooltip key={tool.type}><TooltipTrigger asChild><button type="button" disabled={!activeGoal} onClick={() => tool.type === 'connector' ? onStartConnector() : onAddElement(tool.type)} className={`flex size-8 shrink-0 items-center justify-center rounded-full p-0 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${tool.type === 'connector' && connectorMode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`} aria-label={`Add ${tool.label}`}><span className="text-base leading-none">{tool.icon}</span></button></TooltipTrigger><TooltipContent side="bottom" sideOffset={4}>{tool.type === 'connector' && connectorMode ? 'Choose source' : `Add ${tool.label}`}</TooltipContent></Tooltip>)}
  </div>;
}

function Menu({ ariaLabel, className, children }: { ariaLabel: string; className: string; children: ReactNode }) {
  return <div role="menu" aria-label={ariaLabel} className={`absolute left-0 top-full mt-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg ${className}`}>{children}</div>;
}

function MenuItem({ icon, label, description, onClick }: { icon: ReactNode; label: string; description: string; onClick: () => void }) {
  return <button type="button" role="menuitem" onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-100"><span className="text-slate-600">{icon}</span><span><span className="block font-medium text-slate-800">{label}</span><span className="block text-[11px] text-slate-400">{description}</span></span></button>;
}
