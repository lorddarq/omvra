export interface PermissionResponseRequest {
  responseKind?: 'elicitation' | 'codex-approval' | 'acp-permission';
  fields: Array<{ name: string; defaultValue?: unknown }>;
  options?: Array<{ optionId: string; kind: string }>;
}

export function buildPermissionResponse(request: PermissionResponseRequest, action: 'accept' | 'decline', values: Record<string, unknown>, optionId?: string) {
  if (request.responseKind === 'codex-approval') {
    return { decision: action === 'accept' ? 'accept' : 'decline' };
  }
  if (request.responseKind === 'acp-permission') {
    const selected = request.options?.find(option => option.optionId === optionId)
      || request.options?.find(option => action === 'accept' ? option.kind === 'allow_once' : option.kind === 'reject_once');
    return { outcome: selected ? { outcome: 'selected', optionId: selected.optionId } : { outcome: 'cancelled' } };
  }
  const content = action === 'accept'
    ? Object.fromEntries(request.fields.map(field => [field.name, values[field.name] ?? field.defaultValue ?? '']))
    : null;
  return { action, content, _meta: null };
}
