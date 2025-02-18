import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { SyncStats } from '.';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function SyncTab() {
  const syncStatus = useStore(workbenchStore.syncStatus);
  const syncSettings = useStore(workbenchStore.syncSettings);
  const isSyncEnabled = useStore(workbenchStore.isSyncEnabled);
  const currentSession = useStore(workbenchStore.currentSession);
  const [isUpdating, setIsUpdating] = useState(false);

  // Update effect to show loading state during sync
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (currentSession?.lastSync) {
      setIsUpdating(true);
      timer = setTimeout(() => setIsUpdating(false), 1000);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [currentSession?.lastSync]);

  return (
    <div className="p-6 space-y-8">
      {/* Status Overview */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className={classNames(
              'w-10 h-10 flex items-center justify-center rounded-xl',
              'bg-purple-500/10 text-purple-500',
            )}
            whileHover={{ scale: 1.05 }}
          >
            <div className="i-ph:sliders-horizontal w-6 h-6" />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Sync Settings</h2>
              <div
                className={classNames(
                  'px-2 py-0.5 text-xs rounded-full',
                  isSyncEnabled ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500',
                )}
              >
                {isSyncEnabled ? 'Enabled' : 'Disabled'}
              </div>
              {isUpdating && (
                <div className="flex items-center gap-1 text-xs text-purple-500">
                  <div className="i-ph:arrows-clockwise w-3 h-3 animate-spin" />
                  <span>Syncing...</span>
                </div>
              )}
            </div>
            <p className="text-sm text-bolt-elements-textSecondary">
              {syncStatus.folderName ? `Syncing to ${syncStatus.folderName}` : 'No sync folder selected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {syncStatus.lastSync && (
            <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary border-r border-bolt-elements-borderColor pr-4">
              <div className="i-ph:clock" />
              <span>Last sync: {syncStatus.lastSync}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {syncSettings.autoSync && (
              <div className="flex items-center gap-1 text-xs text-bolt-elements-textSecondary">
                <div className="i-ph:arrows-clockwise text-green-500" />
                <span>Auto-sync every {syncSettings.autoSyncInterval}m</span>
              </div>
            )}
            {syncSettings.syncOnSave && (
              <div className="flex items-center gap-1 text-xs text-bolt-elements-textSecondary">
                <div className="i-ph:check-circle text-green-500" />
                <span>Sync on save</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          className="bg-bolt-elements-background-depth-2 p-4 rounded-lg"
          animate={{ opacity: isUpdating ? 0.7 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:files text-purple-500" />
            <div className="text-sm text-bolt-elements-textSecondary">Total Files</div>
          </div>
          <div className="text-2xl font-semibold text-bolt-elements-textPrimary">{syncStatus.totalFiles || 0}</div>
        </motion.div>
        <motion.div
          className="bg-bolt-elements-background-depth-2 p-4 rounded-lg"
          animate={{ opacity: isUpdating ? 0.7 : 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:database text-purple-500" />
            <div className="text-sm text-bolt-elements-textSecondary">Total Size</div>
          </div>
          <div className="text-2xl font-semibold text-bolt-elements-textPrimary">{syncStatus.totalSize || '0 B'}</div>
        </motion.div>
        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:arrows-clockwise text-purple-500" />
            <div className="text-sm text-bolt-elements-textSecondary">Auto Sync</div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={classNames('h-2 w-2 rounded-full', syncSettings.autoSync ? 'bg-green-500' : 'bg-gray-400')}
            />
            <span className="text-sm font-medium text-bolt-elements-textPrimary">
              {syncSettings.autoSync ? `Every ${syncSettings.autoSyncInterval}m` : 'Disabled'}
            </span>
          </div>
        </div>
        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:floppy-disk text-purple-500" />
            <div className="text-sm text-bolt-elements-textSecondary">Sync on Save</div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={classNames('h-2 w-2 rounded-full', syncSettings.syncOnSave ? 'bg-green-500' : 'bg-gray-400')}
            />
            <span className="text-sm font-medium text-bolt-elements-textPrimary">
              {syncSettings.syncOnSave ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      {/* Sync History */}
      <SyncStats />
    </div>
  );
}
