import { motion } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { classNames } from '~/utils/classNames';
import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { TAB_LABELS, TAB_ICONS } from '~/components/@settings/core/constants';
import { FiGitPullRequest } from 'react-icons/fi';

interface TabTileProps {
  tab: TabVisibilityConfig;
  onClick?: () => void;
  isActive?: boolean;
  hasUpdate?: boolean;
  statusMessage?: string;
  description?: string;
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const TabTile: React.FC<TabTileProps> = ({
  tab,
  onClick,
  isActive,
  hasUpdate,
  statusMessage,
  description,
  isLoading,
  className,
  children,
}: TabTileProps) => {
  // Custom rendering for PR Testing tab icon
  const renderTabIcon = () => {
    if (tab.id === 'pr-testing') {
      return (
        <FiGitPullRequest
          className={classNames(
            'w-8 h-8',
            'text-gray-600 dark:text-gray-300',
            'group-hover:text-purple-500 dark:group-hover:text-purple-400/80',
            isActive ? 'text-purple-500 dark:text-purple-400/90' : '',
          )}
        />
      );
    }

    return (
      <motion.div
        className={classNames(
          TAB_ICONS[tab.id],
          'w-8 h-8',
          'text-gray-600 dark:text-gray-300',
          'group-hover:text-purple-500 dark:group-hover:text-purple-400/80',
          isActive ? 'text-purple-500 dark:text-purple-400/90' : '',
        )}
      />
    );
  };

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.div
            onClick={onClick}
            className={classNames(
              'relative flex flex-col items-center p-6 rounded-xl',
              'w-full h-full min-h-[160px]',
              'bg-white dark:bg-[#141414]',
              'border border-[#E5E5E5] dark:border-[#333333]',
              'group',
              'hover:bg-purple-50 dark:hover:bg-[#1a1a1a]',
              'hover:border-purple-200 dark:hover:border-purple-900/30',
              isActive ? 'border-purple-500 dark:border-purple-500/50 bg-purple-500/5 dark:bg-purple-500/10' : '',
              isLoading ? 'cursor-wait opacity-70' : '',
              className || '',
            )}
          >
            {/* Main Content */}
            <div className="flex flex-col items-center justify-center flex-1 w-full">
              {/* Icon */}
              <motion.div
                className={classNames(
                  'relative',
                  'w-14 h-14',
                  'flex items-center justify-center',
                  'rounded-xl',
                  'bg-gray-100 dark:bg-gray-800',
                  'ring-1 ring-gray-200 dark:ring-gray-700',
                  'group-hover:bg-purple-100 dark:group-hover:bg-gray-700/80',
                  'group-hover:ring-purple-200 dark:group-hover:ring-purple-800/30',
                  isActive ? 'bg-purple-500/10 dark:bg-purple-500/10 ring-purple-500/30 dark:ring-purple-500/20' : '',
                )}
              >
                {renderTabIcon()}
              </motion.div>

              {/* Label and Description */}
              <div className="flex flex-col items-center mt-5 w-full">
                <h3
                  className={classNames(
                    'text-[15px] font-medium leading-snug mb-2',
                    'text-center',
                    'text-[#111111] dark:text-white',
                    'group-hover:text-purple-700 dark:group-hover:text-purple-300',
                    isActive ? 'text-purple-700 dark:text-purple-300' : '',
                  )}
                >
                  {TAB_LABELS[tab.id]}
                </h3>
                {description && (
                  <p className="text-xs text-center text-[#666666] dark:text-[#999999] max-w-[200px]">{description}</p>
                )}
              </div>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                <div className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                  {statusMessage}
                </div>
              </div>
            )}

            {/* Update Badge */}
            {hasUpdate && <div className="absolute top-2 right-2 w-3 h-3 bg-purple-500 rounded-full animate-pulse" />}

            {/* Children */}
            {children}
          </motion.div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            align="center"
            className="bg-[#333333] dark:bg-[#111111] text-white px-3 py-1.5 rounded-md text-xs z-50"
          >
            {TAB_LABELS[tab.id]}
            <Tooltip.Arrow className="fill-[#333333] dark:fill-[#111111]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
