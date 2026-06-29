import {
  Check,
  ChevronRight,
  ExternalLink,
  Mail,
  Play,
  RotateCcw,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import omvraLogo from '../images/logo-large.svg';
import profilePicture from '../images/profile.png';
import { AnchoredPanelSection } from './AnchoredPanel';

const CONTACT_EMAIL_URL = 'mailto:sorin.jurcut@gmail.com';
const LINKEDIN_URL = 'https://www.linkedin.com/in/sorinjurcut/';

const tutorials = [
  'Getting started with Omvra',
  'Planning work on the timeline',
  'Using MCP with coding agents',
];

const faqs = [
  'How is my workspace data stored?',
  'How do agents access Omvra?',
  'Can I back up or restore my workspace?',
];

interface AboutVersionInfo {
  appVersion: string;
  mcpVersion: string;
  build: string;
}

export function HelpSettingsSection() {
  return (
    <AnchoredPanelSection
      id="help"
      title="Help"
      description="Useful resources for learning and troubleshooting Omvra"
    >
      <div className="min-w-0 space-y-8">
        <section className="space-y-3" aria-labelledby="help-onboarding-title">
          <div className="space-y-1">
            <h4 id="help-onboarding-title" className="text-sm font-semibold leading-5 text-[#71717a]">
              Onboarding
            </h4>
            <p className="break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">
              Restart the first-run guide and revisit the basics.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            <RotateCcw className="size-4" />
            Restart Onboarding
          </button>
        </section>

        <ResourceList title="Tutorials">
          {tutorials.map(item => (
            <ResourceRow key={item} icon={<Play className="size-4 fill-current" />} label={item} />
          ))}
        </ResourceList>

        <ResourceList title="FAQs">
          {faqs.map(item => (
            <ResourceRow key={item} label={item} />
          ))}
        </ResourceList>
      </div>
    </AnchoredPanelSection>
  );
}

export function AboutSettingsSection() {
  const [versionInfo, setVersionInfo] = useState<AboutVersionInfo>({
    appVersion: 'Loading...',
    mcpVersion: 'Loading...',
    build: 'Loading...',
  });

  useEffect(() => {
    let cancelled = false;

    const loadVersionInfo = async () => {
      const runtimeInfo = await loadRuntimeInfo();
      const mcpVersion = await loadMcpVersion();

      if (cancelled) return;

      setVersionInfo({
        appVersion: runtimeInfo.appVersion,
        mcpVersion,
        build: runtimeInfo.build,
      });
    };

    void loadVersionInfo();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AnchoredPanelSection id="about" title="About">
      <div className="min-w-0 space-y-8">
        <div className="pt-1">
          <img src={omvraLogo} alt="Omvra" className="h-8 w-auto" />
        </div>

        <section className="space-y-3" aria-labelledby="about-version-title">
          <h4 id="about-version-title" className="text-sm font-semibold leading-5 text-[#71717a]">
            Version
          </h4>
          <div className="rounded-xl bg-[#fafafa] px-4 py-3">
            <InfoRow label="App version" value={versionInfo.appVersion} />
            <InfoRow label="MCP version" value={versionInfo.mcpVersion} />
            <InfoRow label="Build" value={versionInfo.build} />
            <InfoRow label="Copyright" value="Sorin Jurcut" />
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="about-update-title">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h4 id="about-update-title" className="text-sm font-semibold leading-5 text-[#71717a]">
                Update
              </h4>
              <p className="break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">
                Check if there is a new version available to download.
              </p>
            </div>
            <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-[#15c349]/15 bg-[#15c349]/10 px-3 text-xs font-semibold text-[#138a39]">
              <Check className="size-3.5" />
              Up to date
            </span>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="about-feedback-title">
          <div className="space-y-1">
            <h4 id="about-feedback-title" className="text-sm font-semibold leading-5 text-[#71717a]">
              Suggestions & feedback
            </h4>
            <p className="break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">
              Share ideas, questions, and issues with the person building Omvra.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-[#fafafa] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={profilePicture}
                alt=""
                aria-hidden="true"
                className="size-10 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-5 text-[#71717a]">Sorin Jurcut</div>
                <div className="truncate text-xs leading-4 text-[#8a8a92]">Product Designer</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IconAction label="Open contact email" url={CONTACT_EMAIL_URL}>
                <Mail className="size-4" />
              </IconAction>
              <IconAction label="Open LinkedIn profile" url={LINKEDIN_URL}>
                <ExternalLink className="size-4" />
              </IconAction>
            </div>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="about-licenses-title">
          <div className="space-y-1">
            <h4 id="about-licenses-title" className="text-sm font-semibold leading-5 text-[#71717a]">
              Licenses
            </h4>
            <p className="break-words text-xs leading-4 text-[#6a7282] [overflow-wrap:anywhere]">
              Omvra is built with React, Electron, Vite, Tailwind CSS, Radix UI, and Lucide.
            </p>
          </div>
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-[#fafafa] px-4 py-3 text-left outline-none hover:bg-[#f4f4f5] focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            <span className="min-w-0 text-sm font-semibold leading-5 text-[#71717a]">More</span>
            <ChevronRight className="size-4 shrink-0 text-[#8a8a92]" />
          </button>
        </section>
      </div>
    </AnchoredPanelSection>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-black/[0.04] last:border-b-0">
      <span className="min-w-0 truncate text-xs leading-4 text-[#8a8a92]">{label}</span>
      <span className="max-w-[260px] truncate text-right text-xs font-semibold leading-4 text-[#71717a]">{value}</span>
    </div>
  );
}

async function loadRuntimeInfo(): Promise<{ appVersion: string; build: string }> {
  if (!window.electron?.app?.getRuntimeInfo) {
    return {
      appVersion: 'Unavailable',
      build: 'Browser preview',
    };
  }

  try {
    const runtimeInfo = await window.electron.app.getRuntimeInfo();
    return {
      appVersion: runtimeInfo.version || 'Unavailable',
      build: `${runtimeInfo.isPackaged ? 'Packaged' : 'Development'} / Electron ${runtimeInfo.electronVersion || 'unknown'}`,
    };
  } catch {
    return {
      appVersion: 'Unavailable',
      build: 'Unavailable',
    };
  }
}

async function loadMcpVersion(): Promise<string> {
  if (!window.electron?.mcp?.getCapabilities) {
    return 'Unavailable';
  }

  try {
    const result = await window.electron.mcp.getCapabilities();
    return result.data?.serverInfo?.version || 'Unavailable';
  } catch {
    return 'Unavailable';
  }
}

function ResourceList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-labelledby={`${title.toLowerCase()}-title`}>
      <h4 id={`${title.toLowerCase()}-title`} className="text-sm font-semibold leading-5 text-[#71717a]">
        {title}
      </h4>
      <div className="overflow-hidden rounded-xl bg-[#fafafa]">
        {children}
      </div>
    </section>
  );
}

function ResourceRow({ icon, label }: { icon?: ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex min-h-12 w-full items-center gap-3 border-b border-black/[0.04] px-4 py-3 text-left outline-none last:border-b-0 hover:bg-[#f4f4f5] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-300"
    >
      {icon && <span className="flex size-5 shrink-0 items-center justify-center text-[#e11d48]">{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-[#71717a]">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-[#8a8a92]" />
    </button>
  );
}

function openExternal(url: string) {
  if (typeof window === 'undefined') return;

  if (window.electron?.openExternal) {
    void window.electron.openExternal(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

function IconAction({ label, url, children }: { label: string; url: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => openExternal(url)}
      className="inline-flex size-8 items-center justify-center rounded-full border border-black/10 bg-white text-[#71717a] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
    >
      {children}
    </button>
  );
}
