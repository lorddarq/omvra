import { CheckCircle2, Download, Rocket, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { useAppUpdateState } from '../hooks/useAppUpdateState.ts';
import { parseUpdateReleaseNotes } from '../utils/updateReleaseNotes.ts';

interface UpdateAvailablePopupProps {
  updateChannel: 'stable' | 'rc';
  onUpdateChannelChange: (channel: 'stable' | 'rc') => void;
  onExportWorkspaceBackup: () => Promise<boolean>;
}

export function UpdateAvailablePopup({
  updateChannel,
  onUpdateChannelChange,
  onExportWorkspaceBackup,
}: UpdateAvailablePopupProps) {
  const {
    updateState,
    installBlocked,
    handleCloseUpdate,
    handleUpdatePrimaryAction,
    handleExportBackup,
    handleRemindLater,
    isAvailableDismissedForSession,
  } = useAppUpdateState({
    updateChannel,
    onUpdateChannelChange,
    onExportWorkspaceBackup,
  });

  if (!shouldShowUpdatePopup(updateState, isAvailableDismissedForSession)) {
    return null;
  }

  const highlights = parseUpdateReleaseNotes(updateState.update?.releaseNotes, { maxItems: 3 });
  const title = getPopupTitle(updateState, updateChannel, installBlocked);
  const buttonLabel = getPrimaryButtonLabel(updateState, installBlocked);
  const isBusy = updateState.status === 'downloading';
  const progressPercent = Math.max(0, Math.min(100, updateState.progressPercent ?? 20));
  const isAvailableDialog = updateState.status === 'available' && !installBlocked;
  const isDownloadingDialog = updateState.status === 'downloading';
  const showPrimaryButton = !isDownloadingDialog;

  const handlePrimaryAction = async () => {
    if (installBlocked) {
      await handleExportBackup();
      return;
    }

    await handleUpdatePrimaryAction();
  };

  return (
    <Dialog open>
      <DialogContent
        showClose={false}
        aria-describedby={undefined}
        overlayClassName="bg-transparent"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="top-auto left-auto right-6 bottom-[44px] z-[70] w-[288px] max-w-[calc(100vw-2rem)] translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-[24px] border-0 bg-white p-0 shadow-[0px_2px_8px_rgba(0,0,0,0.1),0px_2px_4px_rgba(0,0,0,0.04),0px_1px_2px_rgba(0,0,0,0.06),0px_0px_41px_rgba(0,0,0,0.2)] sm:max-w-none"
      >
        <section className="relative overflow-hidden rounded-[24px] bg-white">
          <DialogTitle className="sr-only">{title}</DialogTitle>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[115px] top-6 h-[329px] w-[344px] -rotate-[105deg] rounded-full bg-[radial-gradient(circle_at_center,rgba(164,180,255,0.32)_0%,rgba(164,180,255,0.16)_38%,rgba(164,180,255,0.06)_58%,rgba(255,255,255,0)_76%)]"
          />

          <button
            type="button"
            onClick={() => {
              void handleCloseUpdate();
            }}
            aria-label="Dismiss update"
            className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-[12px] text-[#71717a] transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>

          <div className="relative flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex min-h-4 items-center gap-1">
                {getPopupIcon(updateState, installBlocked)}
                <p className="text-[14px] font-semibold leading-6 text-[#71717a]">
                  {title}
                </p>
              </div>

              {isAvailableDialog ? (
                <div className="rounded-[12px] bg-[linear-gradient(135deg,rgba(100,108,169,0.10)_0%,rgba(185,197,255,0.16)_100%)] p-3 text-[12px] leading-4 text-[#525965]">
                  <p className="font-bold text-[#6a7282]">Changes:</p>
                  <div className="mt-3 space-y-3">
                    {highlights.items.length > 0 ? (
                      <ul className="ml-[18px] list-disc space-y-0.5">
                        {highlights.items.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{highlights.summary || 'Latest Omvra improvements and update tooling polish.'}</p>
                    )}
                    {highlights.hasMore ? (
                      <p>...and more</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {installBlocked ? (
                <div className="rounded-[12px] bg-[linear-gradient(135deg,rgba(100,108,169,0.10)_0%,rgba(185,197,255,0.16)_100%)] p-3 text-[12px] leading-4 text-[#525965]">
                  <p>
                    Your current channel is the {getChannelLabel(updateChannel)} channel.
                  </p>
                  <p className="mt-4">
                    As a consequence, prior to each update you will be asked to save a backup to prevent data-loss.
                  </p>
                </div>
              ) : null}

              {isDownloadingDialog ? (
                <div
                  aria-label={`Download progress ${progressPercent}%`}
                  className="relative h-9 overflow-hidden rounded-[12px] bg-[#aeadb7]"
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-[12px] bg-[#1a60cb]"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <div className="relative flex h-full items-center justify-center">
                    <span className="text-[14px] font-bold leading-5 text-white">{progressPercent}%</span>
                  </div>
                </div>
              ) : null}
            </div>

            {updateState.error ? (
              <p className="text-[11px] leading-4 text-[#c40000]">{updateState.error}</p>
            ) : null}

            {showPrimaryButton ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  void handlePrimaryAction();
                }}
                className="flex h-9 items-center justify-center rounded-[12px] bg-[#1a60cb] px-4 text-center text-[14px] font-bold leading-5 text-white transition-colors hover:bg-[#1758b9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-wait disabled:bg-[#90aee6]"
              >
                {buttonLabel}
              </button>
            ) : null}

            {isAvailableDialog ? (
              <button
                type="button"
                onClick={() => {
                  void handleRemindLater();
                }}
                className="-mt-1 text-center text-[14px] font-bold leading-5 text-[#2d66c7] transition-colors hover:text-[#2456aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                Remind me later
              </button>
            ) : null}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function shouldShowUpdatePopup(updateState: AppUpdateState, isAvailableDismissedForSession: boolean) {
  return (updateState.status === 'available' && !isAvailableDismissedForSession)
    || updateState.status === 'downloading'
    || updateState.status === 'downloaded';
}

function getPopupTitle(
  updateState: AppUpdateState,
  updateChannel: 'stable' | 'rc',
  installBlocked: boolean,
) {
  if (installBlocked) {
    return 'Data backup';
  }
  if (updateState.status === 'downloaded') {
    return 'Download ready';
  }
  if (updateState.status === 'downloading') {
    return 'Downloading update...';
  }

  return updateState.update?.version
    ? `Version ${updateState.update.version} available`
    : `Update available on ${getChannelLabel(updateChannel)}`;
}

function getPrimaryButtonLabel(updateState: AppUpdateState, installBlocked: boolean) {
  if (installBlocked) return 'Export Backup';
  if (updateState.status === 'downloading') {
    return updateState.progressPercent !== null
      ? `Downloading ${updateState.progressPercent}%`
      : 'Downloading...';
  }
  if (updateState.status === 'downloaded') {
    return 'Restart to install';
  }
  return 'Update Now';
}

function getPopupIcon(updateState: AppUpdateState, installBlocked: boolean) {
  if (installBlocked) return null;
  if (updateState.status === 'downloaded') {
    return <CheckCircle2 className="size-4 text-[#9ca3af]" strokeWidth={1.8} />;
  }
  if (updateState.status === 'downloading') {
    return <Download className="size-4 text-[#9ca3af]" strokeWidth={1.8} />;
  }
  return <Rocket className="size-4 text-[#9ca3af]" strokeWidth={1.8} />;
}

function getChannelLabel(channel: 'stable' | 'rc') {
  return channel === 'rc' ? 'release candidate' : 'stable release';
}
