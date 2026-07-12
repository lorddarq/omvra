import {
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Mail,
  Play,
  RotateCcw,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useAppUpdateState } from '../hooks/useAppUpdateState.ts';
import omvraLogo from '../images/logo-large.svg';
import profilePicture from '../images/profile.png';
import { parseUpdateReleaseNotes } from '../utils/updateReleaseNotes.ts';
import { AnchoredPanelSection } from './AnchoredPanel';

const CONTACT_EMAIL_URL = 'mailto:sorin.jurcut@gmail.com';
const LINKEDIN_URL = 'https://www.linkedin.com/in/sorinjurcut/';

const tutorials = [
  'Getting started with Omvra',
  'Creating and assigning your first task',
  'Backing up your workspace and replaying onboarding',
  'Planning work on the timeline',
  'Moving and resizing timeline tasks',
  'Understanding timeline projects and visibility',
  'Fixing a task that is missing from the timeline',
  'Using MCP with coding agents',
  'Assigning work to an agent',
  'Completing agent work and requesting human review',
  'Securing and troubleshooting MCP access',
];

const faqs = [
  {
    question: 'How is my workspace data stored?',
    answer: [
      'Your workspace is stored locally on your computer, so Omvra works without an account or cloud connection.',
      'Tasks, projects, people, boards, roadmap data, and preferences stay in Omvra’s local app storage. File attachments remain linked to their original files, so moving or deleting a file can break its link.',
    ],
  },
  {
    question: 'Does Omvra work offline?',
    answer: [
      'Yes. You can plan, edit tasks, and manage your workspace without an internet connection.',
      'Some optional actions still need a connection, including checking for updates, opening online links, or using an agent that runs outside your computer.',
    ],
  },
  {
    question: 'Does Omvra send my workspace data anywhere?',
    answer: [
      'Omvra does not send your workspace to a cloud service as part of normal planning and task management.',
      'Network access can still happen when you check for updates, open an external link, or deliberately connect an MCP client. You control MCP access and can turn it off at any time.',
    ],
  },
  {
    question: 'How do agents access Omvra?',
    answer: [
      'Agents connect through Omvra’s local MCP server, and only when you enable agent access in Settings.',
      'Omvra supports local HTTP and stdio connections, with an optional token for extra protection. You can stop the server or disable access at any time.',
    ],
  },
  {
    question: 'What can an agent read or change?',
    answer: [
      'You choose the access level in Settings → MCP. Read Only lets agents inspect workspace data without changing it. Task Write adds safe task and roadmap actions. Admin provides the broadest available access.',
      'Start with Read Only and increase access only when the agent needs to make changes. Restart the MCP listener after changing the access level.',
    ],
  },
  {
    question: 'Can I back up or restore my workspace?',
    answer: [
      'Yes. Open Settings → Data, then choose Backup to save your full workspace as a JSON file.',
      'The backup includes tasks, people, projects, boards, roadmap data, preferences, and MCP settings. Choose Restore in the same section to import a backup. Create a fresh backup before restoring another file or installing a release candidate.',
    ],
  },
  {
    question: 'Can I move my workspace to another computer?',
    answer: [
      'Yes. Create a backup on the first computer, copy the JSON file to the new computer, then choose Settings → Data → Restore.',
      'Attachments are links to files on your computer, not copies stored inside the backup. Move those files separately if you want their links to keep working.',
    ],
  },
  {
    question: 'What happens to attached files?',
    answer: [
      'Omvra stores a reference to each attached file rather than copying the file into your workspace.',
      'Attachment details survive backup and restore, but the original file must still exist at the saved location. If you move or delete it, Omvra keeps the reference but can no longer find the file.',
    ],
  },
  {
    question: 'What is the difference between Kanban and Timeline?',
    answer: [
      'Kanban shows where work stands. Timeline shows when scheduled work happens. Both views use the same tasks, so a change in one view is reflected in the other.',
      'Use Kanban to move work through statuses. Use Timeline to plan dates, duration, projects, and ownership over time.',
    ],
  },
  {
    question: 'Why is my task missing from the Timeline?',
    answer: [
      'First, check that the task has a Timeline Project. Tasks set to “No timeline project” do not have a project row where they can appear.',
      'If the task is complete, turn on completed work in the Timeline. You can also switch between Projects and People: People mode only shows a task when it has an assignee.',
    ],
  },
  {
    question: 'How do I update Omvra?',
    answer: [
      'Open Settings → About, choose Stable releases or Release candidates, then check for updates.',
      'Stable releases are the safer default. Omvra requires a fresh backup before installing a release candidate so you have a recovery point if the preview build changes workspace data.',
    ],
  },
  {
    question: 'Why can’t my agent connect to MCP?',
    answer: [
      'Check that agent access is enabled and the MCP listener is running. Confirm that your client uses the current address, port, and token shown in Settings → MCP.',
      'Restart the listener after changing the host, port, token, or access level. If the connection still fails, run the MCP health check and review the diagnostics before changing anything else.',
    ],
  },
  {
    question: 'Why are MCP write tools missing?',
    answer: [
      'The MCP listener is probably using Read Only access, which intentionally hides write tools.',
      'Choose Task Write or Admin in Settings → MCP, restart the listener, then reconnect your agent. Use Task Write unless the workflow specifically requires broader access.',
    ],
  },
  {
    question: 'Where can I ask for help or report a problem?',
    answer: [
      'Open Settings → About and use the contact action under Suggestions & feedback.',
      'Include your Omvra version, operating system, what you expected, and what happened. Remove access tokens, private task content, and sensitive file paths before sharing screenshots or logs.',
    ],
  },
];

interface AboutVersionInfo {
  appVersion: string;
  mcpVersion: string;
  build: string;
}

interface AboutSettingsSectionProps {
  updateChannel: 'stable' | 'rc';
  onUpdateChannelChange: (channel: 'stable' | 'rc') => void;
  onExportWorkspaceBackup: () => Promise<boolean>;
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
            <FaqRow key={item.question} question={item.question} answers={item.answer} />
          ))}
        </ResourceList>
      </div>
    </AnchoredPanelSection>
  );
}

export function AboutSettingsSection({
  updateChannel,
  onUpdateChannelChange,
  onExportWorkspaceBackup,
}: AboutSettingsSectionProps) {
  const [versionInfo, setVersionInfo] = useState<AboutVersionInfo>({
    appVersion: 'Loading...',
    mcpVersion: 'Loading...',
    build: 'Loading...',
  });
  const {
    updateState,
    backupExportedAt,
    installBlocked,
    handleCheckForUpdates,
    handleDownloadUpdate,
    handleDismissUpdate,
    handleInstallUpdate,
    handleExportBackup,
    handleUpdateChannelSelect,
  } = useAppUpdateState({
    updateChannel,
    onUpdateChannelChange,
    onExportWorkspaceBackup,
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

  const updateBadge = getUpdateBadge(updateState);
  const showDownloadAction = updateState.status === 'available';
  const showInstallAction = updateState.status === 'downloaded';
  const showBackupAction = showDownloadAction || showInstallAction;
  const isCheckingForUpdates = updateState.status === 'checking';
  const parsedReleaseNotes = parseUpdateReleaseNotes(updateState.update?.releaseNotes, { maxItems: 4 });

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
            <span className={updateBadge.className}>
              {updateBadge.showCheck ? <Check className="size-3.5" /> : null}
              {updateBadge.label}
            </span>
          </div>
          <div className="space-y-3 rounded-xl bg-[#fafafa] px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleUpdateChannelSelect('stable')}
                className={getChannelButtonClass(updateChannel === 'stable')}
              >
                Stable releases
              </button>
              <button
                type="button"
                onClick={() => handleUpdateChannelSelect('rc')}
                className={getChannelButtonClass(updateChannel === 'rc')}
              >
                Release candidates
              </button>
            </div>

            <div className="space-y-1 text-xs leading-4 text-[#6a7282]">
              <p>
                {getUpdateSummary(updateState)}
              </p>
              {updateState.update ? (
                <p className="text-[#71717a]">
                  Version {updateState.update.version}
                  {updateState.update.releaseDate ? ` • ${formatUpdateDate(updateState.update.releaseDate)}` : ''}
                </p>
              ) : null}
              {updateState.error ? (
                <p className="text-[#c40000]">{updateState.error}</p>
              ) : null}
              {installBlocked ? (
                <p className="text-[#8a5a00]">Export a backup before installing this release candidate.</p>
              ) : null}
              {backupExportedAt ? (
                <p className="text-[#138a39]">Backup exported for this update.</p>
              ) : null}
            </div>

            {parsedReleaseNotes.items.length > 0 ? (
              <div className="space-y-2 text-xs leading-4 text-[#71717a]">
                {parsedReleaseNotes.summary && !parsedReleaseNotes.items.includes(parsedReleaseNotes.summary) ? (
                  <p>{parsedReleaseNotes.summary}</p>
                ) : null}
                <ul className="ml-[18px] list-disc space-y-1">
                  {parsedReleaseNotes.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {parsedReleaseNotes.hasMore ? <p>...and more in the full release notes.</p> : null}
              </div>
            ) : parsedReleaseNotes.summary ? (
              <p className="text-xs leading-4 text-[#71717a]">{parsedReleaseNotes.summary}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isCheckingForUpdates}
                onClick={() => {
                  void handleCheckForUpdates();
                }}
                className="inline-flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300 disabled:cursor-wait disabled:opacity-80"
              >
                <RotateCcw className={isCheckingForUpdates ? 'size-4 shrink-0 animate-spin' : 'size-4 shrink-0'} />
                Check now
              </button>

              {showBackupAction ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleExportBackup();
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
                >
                  <Download className="size-4 shrink-0" />
                  Export backup
                </button>
              ) : null}

              {showDownloadAction ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleDownloadUpdate();
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-xl border border-[#111827]/10 bg-[#111827] px-3 text-sm font-medium text-white outline-none hover:bg-[#1f2937] focus-visible:ring-2 focus-visible:ring-gray-300"
                >
                  Download
                </button>
              ) : null}

              {showInstallAction ? (
                <button
                  type="button"
                  disabled={installBlocked}
                  onClick={() => {
                    void handleInstallUpdate();
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-xl border border-[#111827]/10 bg-[#111827] px-3 text-sm font-medium text-white outline-none hover:bg-[#1f2937] focus-visible:ring-2 focus-visible:ring-gray-300 disabled:cursor-not-allowed disabled:bg-[#d4d4d8] disabled:text-[#71717a]"
                >
                  Restart and install
                </button>
              ) : null}

              {(showDownloadAction || showInstallAction || updateState.status === 'error') ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleDismissUpdate();
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300"
                >
                  Later
                </button>
              ) : null}
            </div>
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

function getChannelButtonClass(selected: boolean) {
  return selected
    ? 'inline-flex h-8 items-center rounded-xl border border-[#111827]/10 bg-[#111827] px-3 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-gray-300'
    : 'inline-flex h-8 items-center rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#67676f] outline-none hover:bg-[#71717a]/5 focus-visible:ring-2 focus-visible:ring-gray-300';
}

function getUpdateBadge(updateState: AppUpdateState) {
  if (!updateState.packaged) {
    return {
      className: 'inline-flex h-7 shrink-0 items-center rounded-full border border-black/10 bg-[#f4f4f5] px-3 text-xs font-semibold text-[#71717a]',
      label: 'Packaged builds only',
      showCheck: false,
    };
  }

  if (!updateState.supported) {
    return {
      className: 'inline-flex h-7 shrink-0 items-center rounded-full border border-black/10 bg-[#f4f4f5] px-3 text-xs font-semibold text-[#71717a]',
      label: updateState.unsupportedReason === 'updater-unavailable'
        ? 'Updater failed to load'
        : 'Updater unavailable',
      showCheck: false,
    };
  }

  if (updateState.status === 'downloaded') {
    return {
      className: 'inline-flex h-7 shrink-0 items-center rounded-full border border-[#2563eb]/15 bg-[#2563eb]/10 px-3 text-xs font-semibold text-[#1d4ed8]',
      label: 'Ready to install',
      showCheck: false,
    };
  }

  if (updateState.status === 'available' || updateState.status === 'downloading') {
    return {
      className: 'inline-flex h-7 shrink-0 items-center rounded-full border border-[#f59e0b]/15 bg-[#f59e0b]/10 px-3 text-xs font-semibold text-[#b45309]',
      label: updateState.status === 'downloading' && updateState.progressPercent !== null
        ? `Downloading ${updateState.progressPercent}%`
        : 'Update available',
      showCheck: false,
    };
  }

  if (updateState.status === 'error') {
    return {
      className: 'inline-flex h-7 shrink-0 items-center rounded-full border border-[#c40000]/15 bg-[#c40000]/10 px-3 text-xs font-semibold text-[#c40000]',
      label: 'Update issue',
      showCheck: false,
    };
  }

  if (updateState.status === 'checking') {
    return {
      className: 'inline-flex h-7 shrink-0 items-center rounded-full border border-black/10 bg-[#f4f4f5] px-3 text-xs font-semibold text-[#71717a]',
      label: 'Checking…',
      showCheck: false,
    };
  }

  return {
    className: 'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-[#15c349]/15 bg-[#15c349]/10 px-3 text-xs font-semibold text-[#138a39]',
    label: updateState.status === 'not-available' ? 'Up to date' : 'Not checked',
    showCheck: updateState.status === 'not-available',
  };
}

function getUpdateSummary(updateState: AppUpdateState) {
  if (!updateState.packaged) {
    return 'Auto-update checks run only in packaged Omvra builds.';
  }

  if (!updateState.supported) {
    const details = updateState.unsupportedDetails?.trim();
    return updateState.unsupportedReason === 'updater-unavailable'
      ? details
        ? `This packaged Omvra build could not load electron-updater: ${details}`
        : 'This packaged Omvra build could not load electron-updater.'
      : 'Auto-update checks are unavailable in this build.';
  }

  switch (updateState.status) {
    case 'checking':
      return 'Checking GitHub Releases for a newer Omvra build.';
    case 'available':
      return updateState.requiresBackup
        ? 'A release candidate is available. Export a backup before installing it.'
        : 'A newer stable build is available to download.';
    case 'downloading':
      return 'Downloading the update package in the background.';
    case 'downloaded':
      return updateState.requiresBackup
        ? 'The release candidate is ready. Export a backup, then restart to install.'
        : 'The update is ready. Restart Omvra to install it.';
    case 'not-available':
      return 'This Omvra build is up to date for the selected channel.';
    case 'error':
      if (/code signature|did not pass validation|code requirement/i.test(updateState.error || '')) {
        return 'The downloaded macOS build failed code-signature validation. Rebuild and republish the signed release artifact before retrying this update.';
      }
      if (updateState.update) {
        return 'The downloaded update could not be installed. You can retry the install after the release artifact or installer issue is fixed.';
      }
      return 'The update check hit an error. You can retry from here.';
    default:
      return 'Choose stable releases or release candidates, then check for updates when needed.';
  }
}

function formatUpdateDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

function FaqRow({ question, answers }: { question: string; answers: string[] }) {
  return (
    <details className="group border-b border-black/[0.04] last:border-b-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-left outline-none hover:bg-[#f4f4f5] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-300 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-sm font-medium leading-5 text-[#71717a]">{question}</span>
        <ChevronRight className="size-4 shrink-0 text-[#8a8a92] transition-transform group-open:rotate-90" />
      </summary>
      <div className="space-y-2 px-4 pb-4 pr-10 text-xs leading-5 text-[#6a7282] [overflow-wrap:anywhere]">
        {answers.map(answer => <p key={answer}>{answer}</p>)}
      </div>
    </details>
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
