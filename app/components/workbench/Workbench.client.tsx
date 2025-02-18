import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import useViewport from '~/lib/hooks';
import Tooltip from '~/components/ui/Tooltip';
import { useSync } from '~/lib/hooks/useSync';
import { PushToGitHubDialog } from '~/components/@settings/tabs/connections/components/PushToGitHubDialog';

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'preview',
    text: 'Preview',
  },
};

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

const SyncTooltipContent = memo(
  ({
    syncFolder,
    lastSyncTime,
    syncStats,
    syncSettings,
    currentSession,
  }: {
    syncFolder: FileSystemDirectoryHandle;
    lastSyncTime: string;
    syncStats: { files: number; size: string } | null;
    syncSettings: NonNullable<(typeof workbenchStore)['syncSettings']['value']>;
    currentSession: NonNullable<(typeof workbenchStore)['currentSession']['value']>;
  }) => (
    <div className="space-y-3 p-3 min-w-[240px] bg-white dark:bg-[#1E1E1E] rounded-lg shadow-lg">
      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium text-bolt-elements-textPrimary dark:text-white/90">Sync Enabled</span>
        </div>
        {lastSyncTime && workbenchStore.isSyncEnabled.get() && (
          <div className="text-xs text-bolt-elements-textTertiary dark:text-white/60">Last sync: {lastSyncTime}</div>
        )}
      </div>

      {/* Folders */}
      <div className="space-y-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-bolt-elements-textSecondary dark:text-white/60">
            Main Sync Folder
          </span>
          <div className="flex items-center gap-2 text-sm group cursor-pointer">
            <div className="i-ph:folder-duotone text-bolt-elements-textTertiary dark:text-white/60 group-hover:text-accent-500 dark:group-hover:text-accent-500/90" />
            <span className="text-bolt-elements-textPrimary dark:text-white/90 truncate group-hover:text-accent-500 dark:group-hover:text-accent-500/90">
              {syncFolder.name}
            </span>
          </div>
        </div>
        {currentSession?.projectFolder && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-bolt-elements-textSecondary dark:text-white/60">
              Project Folder
            </span>
            <div className="flex items-center gap-2 text-sm group cursor-pointer">
              <div className="i-ph:folder-notch-duotone text-bolt-elements-textTertiary dark:text-white/60 group-hover:text-accent-500 dark:group-hover:text-accent-500/90" />
              <span className="text-bolt-elements-textPrimary dark:text-white/90 truncate group-hover:text-accent-500 dark:group-hover:text-accent-500/90">
                {currentSession.projectFolder}
              </span>
              {currentSession.projectName && (
                <span className="text-xs text-bolt-elements-textTertiary dark:text-white/60">
                  ({currentSession.projectName})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {syncStats && (
        <div className="flex items-center gap-4 text-sm text-bolt-elements-textSecondary dark:text-white/60">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="i-ph:files-duotone text-bolt-elements-textTertiary dark:text-white/60 group-hover:text-accent-500 dark:group-hover:text-accent-500/90" />
            <span className="group-hover:text-accent-500 dark:group-hover:text-accent-500/90">
              {syncStats.files} files
            </span>
          </div>
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="i-ph:database-duotone text-bolt-elements-textTertiary dark:text-white/60 group-hover:text-accent-500 dark:group-hover:text-accent-500/90" />
            <span className="group-hover:text-accent-500 dark:group-hover:text-accent-500/90">{syncStats.size}</span>
          </div>
        </div>
      )}

      {/* Settings */}
      {(syncSettings.autoSync || syncSettings.syncOnSave) && (
        <div className="border-t border-bolt-elements-borderColor/10 dark:border-white/10 pt-2 space-y-1.5">
          {syncSettings.autoSync && (
            <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary dark:text-white/60 group cursor-pointer">
              <div className="i-ph:arrows-clockwise text-accent-500 dark:text-accent-500/90 group-hover:text-accent-600 dark:group-hover:text-accent-400" />
              <span className="group-hover:text-accent-500 dark:group-hover:text-accent-500/90">
                Auto-sync every {syncSettings.autoSyncInterval}m
              </span>
            </div>
          )}
          {syncSettings.syncOnSave && (
            <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary dark:text-white/60 group cursor-pointer">
              <div className="i-ph:check-circle text-accent-500 dark:text-accent-500/90 group-hover:text-accent-600 dark:group-hover:text-accent-400" />
              <span className="group-hover:text-accent-500 dark:group-hover:text-accent-500/90">
                Sync on save enabled
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  ),
);

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const selectedView = useStore(workbenchStore.currentView);
  const syncSettings = useStore(workbenchStore.syncSettings);
  const syncFolder = useStore(workbenchStore.syncFolder);
  const [isSyncing] = useState(false);
  const currentSession = useStore(workbenchStore.currentSession);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncStats, setSyncStats] = useState<{ files: number; size: string } | null>(null);
  const [showGitHubDialog, setShowGitHubDialog] = useState(false);

  const isSmallViewport = useViewport(1024);

  const { handleSyncRequest, openSyncSettings } = useSync();

  const setSelectedView = (view: WorkbenchViewType) => {
    workbenchStore.currentView.set(view);
  };

  useEffect(() => {
    if (hasPreview) {
      setSelectedView('preview');
    }
  }, [hasPreview]);

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  const onEditorChange = useCallback<OnEditorChange>((update) => {
    workbenchStore.setCurrentDocumentContent(update.content);
  }, []);

  const onEditorScroll = useCallback<OnEditorScroll>((position) => {
    workbenchStore.setCurrentDocumentScrollPosition(position);
  }, []);

  const onFileSelect = useCallback((filePath: string | undefined) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  const handleSync = () => {
    handleSyncRequest();
  };

  const updateSyncStats = useCallback(() => {
    if (!currentSession?.statistics?.length) {
      setSyncStats(null);
      return;
    }

    const lastStats = currentSession.statistics[currentSession.statistics.length - 1];

    if (lastStats) {
      setSyncStats({
        files: lastStats.totalFiles,
        size: formatBytes(lastStats.totalSize),
      });
    }
  }, [currentSession?.statistics]);

  const onFileSave = useCallback(async () => {
    try {
      await workbenchStore.saveCurrentDocument();

      if (syncSettings.syncOnSave && syncFolder) {
        await handleSync();
      }
    } catch (error) {
      toast.error('Failed to update file content');
      console.error('Save error:', error);
    }
  }, [syncSettings.syncOnSave, syncFolder]);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  const updateLastSyncTime = useCallback(() => {
    if (!currentSession?.lastSync) {
      setLastSyncTime('');
      return;
    }

    const now = Date.now();
    const diff = now - currentSession.lastSync;
    const date = new Date(currentSession.lastSync);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;

    if (diff < 60000) {
      // less than 1 minute
      setLastSyncTime(`${timeString}`);
    } else if (diff < 3600000) {
      // less than 1 hour
      const mins = Math.floor(diff / 60000);
      setLastSyncTime(`${timeString} (${mins}m ago)`);
    } else {
      // more than 1 hour
      const hours = Math.floor(diff / 3600000);
      setLastSyncTime(`${timeString} (${hours}h ago)`);
    }
  }, [currentSession?.lastSync]);

  useEffect(() => {
    updateSyncStats();
    updateLastSyncTime();
  }, [currentSession, updateSyncStats, updateLastSyncTime]);

  useEffect(() => {
    if (!currentSession?.lastSync) {
      return undefined;
    }

    const interval = setInterval(updateLastSyncTime, 60000);

    return () => clearInterval(interval);
  }, [currentSession?.lastSync, updateLastSyncTime]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleSelectFolder = () => {
    openSyncSettings();
  };

  const handleGitHubPush = async (repoName: string, username?: string, token?: string, isPrivate?: boolean) => {
    try {
      const commitMessage = 'Initial commit from Bolt.diy';
      return await workbenchStore.pushToGitHub(repoName, commitMessage, username, token, isPrivate);
    } catch (error) {
      console.error('Failed to push to GitHub:', error);
      throw error;
    }
  };

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench"
      >
        <div
          className={classNames(
            'fixed top-[calc(var(--header-height)+1.5rem)] bottom-6 w-[var(--workbench-inner-width)] mr-4 z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
            {
              'w-full': isSmallViewport,
              'left-0': showWorkbench && isSmallViewport,
              'left-[var(--workbench-left)]': showWorkbench,
              'left-[100%]': !showWorkbench,
            },
          )}
        >
          <div className="absolute inset-0 px-2 lg:px-6">
            <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
                <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                <div className="ml-auto flex items-center gap-3">
                  {selectedView === 'code' && (
                    <>
                      <PanelHeaderButton onClick={() => workbenchStore.downloadZip()} className="text-sm">
                        <div className="i-ph:code" />
                        Download
                      </PanelHeaderButton>

                      <div className="h-4 border-l border-bolt-elements-borderColor dark:border-white/10" />

                      {syncFolder ? (
                        <div className="flex items-center gap-2">
                          <Tooltip
                            content={
                              <SyncTooltipContent
                                syncFolder={syncFolder}
                                lastSyncTime={lastSyncTime}
                                syncStats={syncStats}
                                syncSettings={syncSettings}
                                currentSession={
                                  currentSession || {
                                    id: '',
                                    timestamp: Date.now(),
                                    lastSync: Date.now(),
                                    files: new Set(),
                                    history: [],
                                    statistics: [],
                                  }
                                }
                              />
                            }
                          >
                            <div
                              className={classNames(
                                'flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all duration-200',
                                'bg-white dark:bg-[#1E1E1E] hover:bg-accent-500/5 dark:hover:bg-accent-500/10',
                                'border-bolt-elements-borderColor dark:border-white/10 hover:border-accent-500/20 dark:hover:border-accent-500/20',
                                'cursor-pointer',
                              )}
                            >
                              <div className="i-ph:folder-duotone text-bolt-elements-textTertiary dark:text-white/60" />
                              <span className="truncate max-w-[120px] text-bolt-elements-textPrimary dark:text-white/90">
                                {syncFolder.name}
                              </span>
                              <div className="flex items-center gap-2 border-l border-bolt-elements-borderColor/10 dark:border-white/10 pl-2">
                                <div className="text-xs text-bolt-elements-textSecondary dark:text-white/60">
                                  Sync On
                                </div>
                                {workbenchStore.isSyncEnabled.get() && (
                                  <>
                                    {syncSettings.autoSync && (
                                      <div className="i-ph:arrows-clockwise text-green-500 dark:text-green-400" />
                                    )}
                                    {syncSettings.syncOnSave && (
                                      <div className="i-ph:check-circle text-green-500 dark:text-green-400" />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </Tooltip>

                          {workbenchStore.isSyncEnabled.get() && (
                            <div className="flex items-center gap-1 border-l border-bolt-elements-borderColor/10 dark:border-white/10 pl-1">
                              <IconButton
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={classNames({
                                  'animate-spin': isSyncing,
                                })}
                                title={isSyncing ? 'Sync in progress...' : 'Sync now'}
                              >
                                <div className="i-ph:arrows-clockwise" />
                              </IconButton>

                              <IconButton onClick={() => workbenchStore.setSyncFolder(null)} title="Clear sync folder">
                                <div className="i-ph:x-circle" />
                              </IconButton>
                            </div>
                          )}
                        </div>
                      ) : (
                        <PanelHeaderButton onClick={handleSelectFolder} className="text-sm">
                          <div className="i-ph:folder-simple-plus-duotone" />
                          Select Folder
                        </PanelHeaderButton>
                      )}

                      <div className="h-4 border-l border-bolt-elements-borderColor dark:border-white/10" />

                      <PanelHeaderButton
                        onClick={() => workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get())}
                        className="text-sm"
                      >
                        <div className="i-ph:terminal" />
                        Terminal
                      </PanelHeaderButton>

                      <div className="h-4 border-l border-bolt-elements-borderColor dark:border-white/10" />

                      <PanelHeaderButton onClick={() => setShowGitHubDialog(true)} className="text-sm">
                        <div className="i-ph:github-logo" />
                        GitHub Upload
                      </PanelHeaderButton>

                      <PushToGitHubDialog
                        isOpen={showGitHubDialog}
                        onClose={() => setShowGitHubDialog(false)}
                        onPush={handleGitHubPush}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="relative flex-1 overflow-hidden">
                <View
                  initial={{ x: selectedView === 'code' ? 0 : '-100%' }}
                  animate={{ x: selectedView === 'code' ? 0 : '-100%' }}
                >
                  <EditorPanel
                    editorDocument={currentDocument}
                    isStreaming={isStreaming}
                    selectedFile={selectedFile}
                    files={files}
                    unsavedFiles={unsavedFiles}
                    onFileSelect={onFileSelect}
                    onEditorScroll={onEditorScroll}
                    onEditorChange={onEditorChange}
                    onFileSave={onFileSave}
                    onFileReset={onFileReset}
                  />
                </View>
                <View
                  initial={{ x: selectedView === 'preview' ? 0 : '100%' }}
                  animate={{ x: selectedView === 'preview' ? 0 : '100%' }}
                >
                  <Preview />
                </View>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  );
});

interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
