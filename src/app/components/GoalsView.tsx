import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Bot, Check, ChevronLeft, ChevronRight, CircleDot, FileText, Link2, Minus, MousePointer2, Plus, Sparkles, Target, Trash2, Type, ZoomIn } from 'lucide-react';
import type { GoalConnectorSide, GoalElement, GoalElementType, GoalRecord, Person } from '../types.ts';
import { safeReadJSON, persistJSONWithElectronMirror } from '../utils/storage.ts';

const STORAGE_KEY = 'omvra.goals.v1';
const GOAL_ID = 'goal-lights-off-factory';

const INITIAL_GOALS: GoalRecord[] = [{
  id: GOAL_ID,
  title: 'Deliver the roadmap',
  updatedAt: new Date().toISOString(),
  elements: [
    { id: 'goal-root', type: 'goal', title: 'Deliver the roadmap', body: 'User-driven automation with boundaries', x: 420, y: 120, width: 250, height: 104, status: 'working' },
    { id: 'subgoal-shaping', type: 'subgoal', title: 'Shaping', body: 'Product architecture + PRD', x: 100, y: 340, width: 220, height: 90, status: 'complete' },
    { id: 'subgoal-design', type: 'subgoal', title: 'Design', body: 'UX/UI workflow and states', x: 390, y: 340, width: 220, height: 90, status: 'working' },
    { id: 'subgoal-implementation', type: 'subgoal', title: 'Implementation', body: 'Build the working surface', x: 680, y: 340, width: 220, height: 90, status: 'draft' },
    { id: 'connector-1', type: 'connector', title: 'Shaping → Design', x: 310, y: 385, sourceId: 'goal-root', targetId: 'subgoal-shaping', sourceSide: 'bottom', targetSide: 'top' },
    { id: 'connector-2', type: 'connector', title: 'Design → Implementation', x: 610, y: 385, sourceId: 'goal-root', targetId: 'subgoal-implementation', sourceSide: 'bottom', targetSide: 'top' },
  ],
}];

const TOOL_ITEMS: Array<{ type: GoalElementType; label: string; icon: ReactNode }> = [
  { type: 'agent', label: 'Agent', icon: <Bot className="size-3.5" /> },
  { type: 'subgoal', label: 'Subgoal', icon: <Target className="size-3.5" /> },
  { type: 'connector', label: 'Connector', icon: <Link2 className="size-3.5" /> },
  { type: 'instructions', label: 'Instructions', icon: <FileText className="size-3.5" /> },
  { type: 'goal', label: 'Goal', icon: <Sparkles className="size-3.5" /> },
  { type: 'text', label: 'Text', icon: <Type className="size-3.5" /> },
];

function readGoals(): GoalRecord[] {
  const stored = safeReadJSON<GoalRecord[]>(STORAGE_KEY, INITIAL_GOALS);
  return Array.isArray(stored) && stored.length > 0 ? stored : INITIAL_GOALS;
}

function nodeClass(type: GoalElementType): string {
  if (type === 'goal') return 'border-slate-900 bg-slate-900 text-white';
  if (type === 'subgoal') return 'border-blue-200 bg-white text-slate-900';
  if (type === 'agent') return 'border-amber-200 bg-amber-50 text-slate-900';
  return 'border-slate-200 bg-white text-slate-700';
}

export function GoalsView({ people = [] }: { people?: Person[] }) {
  const [goals, setGoals] = useState<GoalRecord[]>(readGoals);
  const [selectedGoalId, setSelectedGoalId] = useState(GOAL_ID);
  const [selectedElementId, setSelectedElementId] = useState('goal-root');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [connectorMode, setConnectorMode] = useState(false);
  const [connectorSourceId, setConnectorSourceId] = useState<string | null>(null);
  const [connectorSourceSide, setConnectorSourceSide] = useState<GoalConnectorSide>('right');
  const [rewireConnectorId, setRewireConnectorId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activeGoal = goals.find(goal => goal.id === selectedGoalId) ?? goals[0];
  const selectedElement = activeGoal?.elements.find(element => element.id === selectedElementId) ?? activeGoal?.elements[0];
  const selectedAgent = selectedElement?.type === 'agent' ? people.find(person => person.id === selectedElement.assigneeId) : undefined;

  const getAgentForElement = (element: GoalElement) => element.type === 'agent'
    ? people.find(person => person.id === element.assigneeId)
    : undefined;

  const getElementTitle = (element: GoalElement) => getAgentForElement(element)?.name ?? element.title;
  const getElementBody = (element: GoalElement) => getAgentForElement(element)?.role ?? element.body;

  useEffect(() => { persistJSONWithElectronMirror(STORAGE_KEY, goals); }, [goals]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        setPanMode(false);
        setConnectorMode(false);
        setConnectorSourceId(null);
        setRewireConnectorId(null);
        setAgentMenuOpen(false);
        return;
      }
      if (event.code === 'Space' && (event.target === document.body || event.target === canvasRef.current)) { event.preventDefault(); setSpacePressed(true); }
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') setSpacePressed(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => setGoals(current => current.map(goal => goal.id !== selectedGoalId ? goal : ({ ...goal, elements: goal.elements.map(element => element.id !== drag.id ? element : { ...element, x: drag.originX + (event.clientX - drag.startX) / zoom, y: drag.originY + (event.clientY - drag.startY) / zoom }) })));
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag, selectedGoalId, zoom]);

  const updateElement = (updates: Partial<GoalElement>) => setGoals(current => current.map(goal => goal.id !== selectedGoalId ? goal : ({ ...goal, updatedAt: new Date().toISOString(), elements: goal.elements.map(element => element.id === selectedElement?.id ? { ...element, ...updates } : element) })));
  const updateGoal = (updates: Partial<GoalRecord>) => setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, ...updates, updatedAt: new Date().toISOString() } : goal));
  const addElement = (type: GoalElementType) => {
    const id = `${type}-${Date.now()}`;
    const element: GoalElement = { id, type, title: type === 'subgoal' ? 'New subgoal' : `New ${type}`, body: 'Describe the outcome and handoff', x: 260 + (activeGoal.elements.length % 3) * 260, y: 560, width: 220, height: type === 'text' ? 64 : 90, status: 'draft' };
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, updatedAt: new Date().toISOString(), elements: [...goal.elements, element] } : goal));
    setSelectedElementId(id);
  };
  const deleteElement = () => {
    if (!selectedElement) return;
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, elements: goal.elements.filter(element => element.id !== selectedElement.id && element.sourceId !== selectedElement.id && element.targetId !== selectedElement.id) } : goal));
    setSelectedElementId(activeGoal.elements.find(element => element.id !== selectedElement.id)?.id ?? '');
  };
  const createGoal = () => {
    const goal: GoalRecord = { id: `goal-${Date.now()}`, title: 'Untitled goal', updatedAt: new Date().toISOString(), elements: [{ id: `root-${Date.now()}`, type: 'goal', title: 'Untitled goal', body: 'Define the outcome', x: 420, y: 180, width: 250, height: 104, status: 'draft' }] };
    setGoals(current => [...current, goal]); setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0].id);
  };

  const connections = activeGoal?.elements.filter(element => element.type === 'connector') ?? [];

  const addAgent = (person: Person) => {
    const id = `agent-${person.id}-${Date.now()}`;
    const element: GoalElement = { id, type: 'agent', title: person.name, body: person.role, assigneeId: person.id, x: 260 + (activeGoal.elements.length % 3) * 260, y: 560, width: 220, height: 90, status: 'draft' };
    setGoals(current => current.map(goal => goal.id === selectedGoalId ? { ...goal, updatedAt: new Date().toISOString(), elements: [...goal.elements, element] } : goal));
    setSelectedElementId(id);
    setAgentMenuOpen(false);
  };

  const connectNodes = (targetId: string, targetSide: GoalConnectorSide = 'left') => {
    if (!connectorSourceId || connectorSourceId === targetId) return;
    setGoals(current => current.map(goal => {
      if (goal.id !== selectedGoalId) return goal;
      const elements = rewireConnectorId
        ? goal.elements.map(element => element.id === rewireConnectorId ? { ...element, sourceId: connectorSourceId, targetId, sourceSide: element.sourceSide ?? connectorSourceSide, targetSide } : element)
        : [...goal.elements, { id: `connector-${Date.now()}`, type: 'connector' as const, title: 'Node connection', x: 0, y: 0, sourceId: connectorSourceId, targetId, sourceSide: connectorSourceSide, targetSide }];
      return { ...goal, updatedAt: new Date().toISOString(), elements };
    }));
    setConnectorMode(false);
    setConnectorSourceId(null);
    setRewireConnectorId(null);
  };

  const nodePoint = (element: GoalElement, side: GoalConnectorSide) => {
    const width = element.width ?? 220;
    const height = element.height ?? 90;
    if (side === 'top') return { x: element.x + width / 2, y: element.y };
    if (side === 'bottom') return { x: element.x + width / 2, y: element.y + height };
    if (side === 'left') return { x: element.x, y: element.y + height / 2 };
    return { x: element.x + width, y: element.y + height / 2 };
  };

  const controlPoint = (point: { x: number; y: number }, side: GoalConnectorSide, distance: number) => {
    if (side === 'top') return { x: point.x, y: point.y - distance };
    if (side === 'bottom') return { x: point.x, y: point.y + distance };
    if (side === 'left') return { x: point.x - distance, y: point.y };
    return { x: point.x + distance, y: point.y };
  };

  const connectorPath = (connection: GoalElement) => {
    const source = activeGoal?.elements.find(element => element.id === connection.sourceId);
    const target = activeGoal?.elements.find(element => element.id === connection.targetId);
    if (!source || !target) return null;
    const sourceSide = connection.sourceSide ?? 'right';
    const targetSide = connection.targetSide ?? 'left';
    const start = nodePoint(source, sourceSide);
    const end = nodePoint(target, targetSide);
    const bend = Math.max(48, Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) * 0.35);
    const first = controlPoint(start, sourceSide, bend);
    const second = controlPoint(end, targetSide, bend);
    return `M ${start.x} ${start.y} C ${first.x} ${first.y}, ${second.x} ${second.y}, ${end.x} ${end.y}`;
  };

  const beginConnection = (elementId: string, side: GoalConnectorSide) => {
    setConnectorMode(true);
    setConnectorSourceId(elementId);
    setConnectorSourceSide(side);
  };

  const portStyle = (side: GoalConnectorSide): CSSProperties => {
    if (side === 'top') return { left: '50%', top: '-0.5rem', transform: 'translateX(-50%)' };
    if (side === 'right') return { right: '-0.5rem', top: '50%', transform: 'translateY(-50%)' };
    if (side === 'bottom') return { left: '50%', bottom: '-0.5rem', transform: 'translateX(-50%)' };
    return { left: '-0.5rem', top: '50%', transform: 'translateY(-50%)' };
  };

  const renderPorts = (element: GoalElement) => (['top', 'right', 'bottom', 'left'] as GoalConnectorSide[]).map(side => (
    <button key={side} style={portStyle(side)} className={`absolute size-4 rounded-full border-2 border-white shadow-sm ${connectorMode && connectorSourceId === element.id && connectorSourceSide === side ? 'bg-amber-400' : 'bg-blue-400'}`} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (connectorMode && connectorSourceId) connectNodes(element.id, side); else beginConnection(element.id, side); }} aria-label={`${connectorMode && connectorSourceId ? 'Connect to' : 'Connect from'} ${element.title} via ${side} handle`} />
  ));

  return <section className="relative h-full min-h-0 overflow-hidden bg-slate-50 text-slate-700">
    <aside className={`absolute left-4 top-4 bottom-4 z-20 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-[width] duration-200 ${leftPanelCollapsed ? 'w-12' : 'w-64'}`}>
      <div className={`flex items-center border-b px-3 py-3 ${leftPanelCollapsed ? 'justify-center' : 'justify-between'}`}><div className={leftPanelCollapsed ? 'hidden' : ''}><h1 className="text-sm font-semibold text-slate-900">Goals</h1><p className="mt-0.5 text-xs text-slate-500">Shape work as a loop</p></div><button onClick={() => setLeftPanelCollapsed(value => !value)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={leftPanelCollapsed ? 'Expand goals panel' : 'Collapse goals panel'}>{leftPanelCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}</button></div>
      <div className={`flex-1 space-y-1 overflow-auto p-2 ${leftPanelCollapsed ? 'hidden' : ''}`}>{goals.map(goal => <button key={goal.id} onClick={() => { setSelectedGoalId(goal.id); setSelectedElementId(goal.elements[0]?.id ?? ''); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${goal.id === selectedGoalId ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><span className="block truncate">{goal.title}</span><span className="mt-1 block text-[11px] text-slate-400">{goal.elements.filter(element => element.type === 'subgoal').length} subgoals · {goal.elements.length} nodes</span></button>)}</div>
      <div className={`border-t p-3 ${leftPanelCollapsed ? 'hidden' : ''}`}><button onClick={createGoal} className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"><Plus className="size-3.5" /> New goal</button></div>
    </aside>

    <div ref={canvasRef} tabIndex={0} role="application" aria-label="Goal canvas. Hold space and drag to pan." className={`h-full w-full outline-none ${spacePressed || panMode ? 'cursor-grab' : 'cursor-default'}`} onPointerDown={event => { if (spacePressed || panMode) { const start = { x: event.clientX, y: event.clientY }; const origin = { ...pan }; const move = (next: PointerEvent) => setPan({ x: origin.x + next.clientX - start.x, y: origin.y + next.clientY - start.y }); const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); } }}>
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\"24\" height=\"24\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Ccircle cx=\"2\" cy=\"2\" r=\"1\" fill=\"%23cbd5e1\"/%3E%3C/svg%3E")' }} />
      <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`, transformOrigin: 'center' }}>
        <svg className="pointer-events-auto absolute left-0 top-0 h-[900px] w-[1400px] overflow-visible">{connections.map(connection => { const path = connectorPath(connection); return path ? <path key={connection.id} d={path} fill="none" stroke={selectedElement?.id === connection.id ? '#2563eb' : '#94a3b8'} strokeWidth={selectedElement?.id === connection.id ? '3' : '2'} strokeLinecap="round" className="cursor-pointer" onClick={event => { event.stopPropagation(); setSelectedElementId(connection.id); setConnectorMode(false); setConnectorSourceId(null); }} aria-label={`Connector from ${connection.sourceId} to ${connection.targetId}`} /> : null; })}</svg>
        {activeGoal?.elements.filter(element => element.type !== 'connector').map(element => <div key={element.id} role="button" tabIndex={0} onClick={() => { if (connectorMode) { if (connectorSourceId) connectNodes(element.id); else beginConnection(element.id, 'right'); } else setSelectedElementId(element.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedElementId(element.id); }} onPointerDown={event => { if (spacePressed || panMode || connectorMode) return; setSelectedElementId(element.id); setDrag({ id: element.id, startX: event.clientX, startY: event.clientY, originX: element.x, originY: element.y }); }} className={`absolute flex flex-col rounded-lg border p-3 text-left shadow-sm transition-shadow hover:shadow-md ${nodeClass(element.type)} ${selectedElement?.id === element.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`} style={{ left: element.x, top: element.y, width: element.width ?? 220, minHeight: element.height ?? 80 }}><span className="flex items-center gap-2 text-xs font-semibold"><span className="rounded bg-black/5 p-1">{element.type === 'agent' ? <Bot className="size-3.5" /> : element.type === 'goal' ? <Sparkles className="size-3.5" /> : <Target className="size-3.5" />}</span>{getElementTitle(element)}</span>{getElementBody(element) && <span className={`mt-2 text-[11px] ${element.type === 'goal' ? 'text-slate-300' : 'text-slate-500'}`}>{getElementBody(element)}</span>}<span className={`mt-3 text-[10px] uppercase ${element.status === 'complete' ? 'text-emerald-600' : element.status === 'working' ? 'text-blue-600' : 'text-slate-400'}`}>{element.status ?? 'draft'}</span>{renderPorts(element)}</div>)}
      </div>
    </div>

    <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"><button onClick={() => setPanMode(value => !value)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${panMode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`} aria-pressed={panMode} aria-label="Pan canvas"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="#71717A" d="M12.951,5.238L6.485,3.621C5.223,3.306,4,4.26,4,5.562V9H3V7H2.5C1.672,7,1,7.672,1,8.5v1.833c0,1.082,0.351,2.135,1,3L4,16h9l2.097-6.99C15.589,7.371,14.612,5.653,12.951,5.238z M8,13H7V8h1V13z M11,13h-1V8h1V13z" /></svg>Pan</button>{TOOL_ITEMS.map(tool => tool.type === 'agent' ? <div key={tool.type} className="relative"><button onClick={() => setAgentMenuOpen(value => !value)} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100" aria-label="Add agent">{tool.icon}{tool.label}</button>{agentMenuOpen && <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">{people.filter(person => person.kind === 'agentic').map(person => <button key={person.id} onClick={() => addAgent(person)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-100"><Bot className="size-3.5 text-amber-500" /><span><span className="block font-medium text-slate-800">{person.name}</span><span className="block text-[11px] text-slate-400">{person.role}</span></span></button>)}{people.filter(person => person.kind === 'agentic').length === 0 && <p className="px-2.5 py-2 text-xs text-slate-400">No agents configured</p>}</div>}</div> : <button key={tool.type} onClick={() => tool.type === 'connector' ? (setConnectorMode(true), setConnectorSourceId(null)) : addElement(tool.type)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${tool.type === 'connector' && connectorMode ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`} aria-label={`Add ${tool.label}`}>{tool.icon}{tool.type === 'connector' && connectorMode ? 'Choose source' : tool.label}</button>)}</div>
    {selectedElement && <aside className="absolute right-4 top-16 bottom-16 z-20 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[11px] uppercase text-slate-400">Details</p><h2 className="mt-1 text-sm font-semibold text-slate-900">{selectedElement.type}</h2></div><MousePointer2 className="size-4 text-slate-400" /></div><label className="mt-5 block text-xs font-medium text-slate-600">Title<input value={selectedAgent?.name ?? selectedElement.title} readOnly={selectedElement.type === 'agent'} onChange={selectedElement.type === 'agent' ? undefined : event => updateElement({ title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 read-only:bg-slate-50 read-only:text-slate-500" /></label>{selectedElement.type === 'goal' && <label className="mt-4 block text-xs font-medium text-slate-600">Overseer agent<select value={activeGoal?.overseerAgentId ?? ''} onChange={event => updateGoal({ overseerAgentId: event.target.value || undefined })} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="">Select an agent</option>{people.filter(person => person.kind === 'agentic').map(person => <option key={person.id} value={person.id}>{person.name} · {person.role}</option>)}</select><span className="mt-1 block text-[11px] font-normal text-slate-400">This agent derives subgoal status toward the goal.</span></label>}<label className="mt-4 block text-xs font-medium text-slate-600">Notes<textarea value={selectedAgent?.role ?? selectedElement.body ?? ''} readOnly={selectedElement.type === 'agent'} onChange={selectedElement.type === 'agent' ? undefined : event => updateElement({ body: event.target.value })} rows={4} className="mt-1 w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 read-only:bg-slate-50 read-only:text-slate-500" /></label><label className="mt-4 block text-xs font-medium text-slate-600">Status{selectedElement.type === 'subgoal' ? <><div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-600">{selectedElement.status ?? 'draft'}</div><span className="mt-1 block text-[11px] font-normal text-slate-400">Managed by the overseer agent</span></> : <select value={selectedElement.status ?? 'draft'} onChange={event => updateElement({ status: event.target.value as GoalElement['status'] })} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"><option value="draft">Draft</option><option value="working">Working</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select>}</label>{selectedElement.type === 'connector' && <button onClick={() => { setConnectorMode(true); setRewireConnectorId(selectedElement.id); setConnectorSourceId(selectedElement.sourceId ?? null); }} className="mt-5 flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700"><Link2 className="size-3.5" /> Rewire connector</button>}<button onClick={deleteElement} className="mt-6 flex items-center gap-2 text-xs font-medium text-red-600 hover:text-red-700"><Trash2 className="size-3.5" /> Delete element</button></aside>}
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />1 agent working</span><span className="text-slate-300">·</span><span>2 idle</span><span className="ml-2 rounded bg-slate-100 px-2 py-1">{spacePressed ? 'Release space to edit' : panMode ? 'Pan mode' : 'Space + drag to pan'}</span><span className="ml-1 inline-flex items-center gap-1 text-slate-400"><Check className="size-3.5" /> MCP off</span><span className="ml-2 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1"><button className="rounded p-1 hover:bg-slate-100" onClick={() => setZoom(value => Math.max(.6, value - .1))} aria-label="Zoom out"><Minus className="size-3" /></button><span className="min-w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span><button className="rounded p-1 hover:bg-slate-100" onClick={() => setZoom(value => Math.min(1.4, value + .1))} aria-label="Zoom in"><ZoomIn className="size-3" /></button></span></div>
  </section>;
}
