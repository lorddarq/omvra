export type AgentProvenanceId = 'codex' | 'copilot' | 'claude' | 'opencode' | 'openai' | 'unknown';

export interface AgentProvenanceBrand {
  id: AgentProvenanceId;
  label: string;
  dotColor: string;
  badgeBackground: string;
  badgeTextColor: string;
  avatarStyle?: { background: string };
  cardBackground: string;
}

const AGENT_PROVENANCE_BRANDS: Record<AgentProvenanceId, AgentProvenanceBrand> = {
  codex: {
    id: 'codex',
    label: 'Codex',
    dotColor: '#7c6ee6',
    badgeBackground: '#eeebff',
    badgeTextColor: '#6558d3',
    avatarStyle: { background: 'linear-gradient(135deg, #80a8e1 0%, #8d72cf 100%)' },
    cardBackground: 'linear-gradient(141deg, rgba(186, 206, 235, 0.2) 0.9%, rgba(255, 255, 255, 0.2) 34.3%), #ffffff',
  },
  copilot: {
    id: 'copilot',
    label: 'Copilot',
    dotColor: '#2563eb',
    badgeBackground: '#e7f0ff',
    badgeTextColor: '#1d4ed8',
    avatarStyle: { background: 'linear-gradient(135deg, #53a6ff 0%, #1d4ed8 100%)' },
    cardBackground: 'linear-gradient(141deg, rgba(187, 219, 255, 0.24) 0.9%, rgba(255, 255, 255, 0.2) 34.3%), #ffffff',
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    dotColor: '#cd9169',
    badgeBackground: '#f5e7dc',
    badgeTextColor: '#9a6847',
    avatarStyle: { background: '#cd9169' },
    cardBackground: 'linear-gradient(141deg, rgba(224, 211, 202, 0.2) 0.9%, rgba(255, 255, 255, 0.2) 34.3%), #ffffff',
  },
  opencode: {
    id: 'opencode',
    label: 'OpenCode',
    dotColor: '#d97706',
    badgeBackground: '#fff2db',
    badgeTextColor: '#b45309',
    avatarStyle: { background: 'linear-gradient(135deg, #f6ad55 0%, #d97706 100%)' },
    cardBackground: 'linear-gradient(141deg, rgba(254, 215, 170, 0.24) 0.9%, rgba(255, 255, 255, 0.2) 34.3%), #ffffff',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    dotColor: '#15803d',
    badgeBackground: '#e7f6ea',
    badgeTextColor: '#166534',
    avatarStyle: { background: 'linear-gradient(135deg, #34d399 0%, #15803d 100%)' },
    cardBackground: 'linear-gradient(141deg, rgba(187, 247, 208, 0.24) 0.9%, rgba(255, 255, 255, 0.2) 34.3%), #ffffff',
  },
  unknown: {
    id: 'unknown',
    label: 'Unknown',
    dotColor: '#94a3b8',
    badgeBackground: '#f3f4f6',
    badgeTextColor: '#6b7280',
    avatarStyle: { background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)' },
    cardBackground: 'linear-gradient(141deg, rgba(226, 232, 240, 0.24) 0.9%, rgba(255, 255, 255, 0.2) 34.3%), #ffffff',
  },
};

function normalizeSource(...values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

export function detectAgentProvenance(...values: Array<string | null | undefined>): AgentProvenanceId {
  const source = normalizeSource(...values);
  if (!source) return 'unknown';
  if (source.includes('copilot') || source.includes('github-copilot') || source.includes('github copilot')) {
    return 'copilot';
  }
  if (source.includes('opencode') || source.includes('open-code')) {
    return 'opencode';
  }
  if (source.includes('claude') || source.includes('anthropic')) {
    return 'claude';
  }
  if (source.includes('codex')) {
    return 'codex';
  }
  if (source.includes('openai') || source.includes('chatgpt')) {
    return 'openai';
  }
  return 'unknown';
}

export function getAgentProvenanceBrand(...values: Array<string | null | undefined>): AgentProvenanceBrand {
  return AGENT_PROVENANCE_BRANDS[detectAgentProvenance(...values)];
}

export function getAgentAvatarStyle(name: string) {
  return getAgentProvenanceBrand(name).avatarStyle;
}

export function getAgentCardBackground(name: string) {
  return getAgentProvenanceBrand(name).cardBackground;
}
