import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { Switch } from '~/components/ui/Switch';
import { classNames } from '~/utils/classNames';
import { tabConfigurationStore } from '~/lib/stores/settings';
import { TAB_LABELS } from '~/components/@settings/core/constants';
import type { TabType } from '~/components/@settings/core/types';
import { toast } from 'react-toastify';
import { TbLayoutGrid } from 'react-icons/tb';
import { useSettingsStore } from '~/lib/stores/settings';
import '~/styles/components/tab-management.scss';

// Define tab icons mapping
const TAB_ICONS: Record<TabType, string> = {
  profile: 'i-ph:user-circle-fill',
  settings: 'i-ph:gear-six-fill',
  notifications: 'i-ph:bell-fill',
  features: 'i-ph:star-fill',
  data: 'i-ph:database-fill',
  'cloud-providers': 'i-ph:cloud-fill',
  'local-providers': 'i-ph:desktop-fill',
  'service-status': 'i-ph:activity-fill',
  connection: 'i-ph:wifi-high-fill',
  debug: 'i-ph:bug-fill',
  'event-logs': 'i-ph:list-bullets-fill',
  update: 'i-ph:arrow-clockwise-fill',
  'task-manager': 'i-ph:chart-line-fill',
  'tab-management': 'i-ph:squares-four-fill',
};

// Define which tabs are default in user mode
const DEFAULT_USER_TABS: TabType[] = [
  'features',
  'data',
  'cloud-providers',
  'local-providers',
  'connection',
  'notifications',
  'event-logs',
];

// Define which tabs can be added to user mode
const OPTIONAL_USER_TABS: TabType[] = ['profile', 'settings', 'task-manager', 'service-status', 'debug', 'update'];

// All available tabs for user mode
const ALL_USER_TABS = [...DEFAULT_USER_TABS, ...OPTIONAL_USER_TABS];

// Define which tabs are beta
const BETA_TABS = new Set<TabType>(['task-manager', 'service-status', 'update', 'local-providers']);

// Beta label component
const BetaLabel = () => <span className="tab-badge beta-badge">BETA</span>;

export const TabManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const tabConfiguration = useStore(tabConfigurationStore);
  const { setSelectedTab } = useSettingsStore();

  const handleTabVisibilityChange = (tabId: TabType, checked: boolean) => {
    // Get current tab configuration
    const currentTab = tabConfiguration.userTabs.find((tab) => tab.id === tabId);

    // If tab doesn't exist in configuration, create it
    if (!currentTab) {
      const newTab = {
        id: tabId,
        visible: checked,
        window: 'user' as const,
        order: tabConfiguration.userTabs.length,
      };

      const updatedTabs = [...tabConfiguration.userTabs, newTab];

      tabConfigurationStore.set({
        ...tabConfiguration,
        userTabs: updatedTabs,
      });

      toast.success(`Tab ${checked ? 'enabled' : 'disabled'} successfully`);

      return;
    }

    // Check if tab can be enabled in user mode
    const canBeEnabled = DEFAULT_USER_TABS.includes(tabId) || OPTIONAL_USER_TABS.includes(tabId);

    if (!canBeEnabled && checked) {
      toast.error('This tab cannot be enabled in user mode');
      return;
    }

    // Update tab visibility
    const updatedTabs = tabConfiguration.userTabs.map((tab) => {
      if (tab.id === tabId) {
        return { ...tab, visible: checked };
      }

      return tab;
    });

    // Update store
    tabConfigurationStore.set({
      ...tabConfiguration,
      userTabs: updatedTabs,
    });

    // Show success message
    toast.success(`Tab ${checked ? 'enabled' : 'disabled'} successfully`);
  };

  // Create a map of existing tab configurations
  const tabConfigMap = new Map(tabConfiguration.userTabs.map((tab) => [tab.id, tab]));

  // Generate the complete list of tabs, including those not in the configuration
  const allTabs = ALL_USER_TABS.map((tabId) => {
    return (
      tabConfigMap.get(tabId) || {
        id: tabId,
        visible: false,
        window: 'user' as const,
        order: -1,
      }
    );
  });

  // Filter tabs based on search query
  const filteredTabs = allTabs.filter((tab) => TAB_LABELS[tab.id].toLowerCase().includes(searchQuery.toLowerCase()));

  useEffect(() => {
    // Reset to first tab when component unmounts
    return () => {
      setSelectedTab('user'); // Reset to user tab when unmounting
    };
  }, [setSelectedTab]);

  return (
    <div className="tab-management-container">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="section-header">
          <div className="header-left">
            <div className="header-icon-container">
              <TbLayoutGrid className="header-icon" />
            </div>
            <div className="header-content">
              <h4 className="header-title">Tab Management</h4>
              <p className="header-description">Configure visible tabs and their order</p>
            </div>
          </div>

          {/* Search */}
          <div className="search-container">
            <div className="i-ph:magnifying-glass search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tabs..."
              className="search-input"
            />
          </div>
        </div>

        {/* Tab Grid */}
        <div className="tabs-grid">
          {/* Default Section Header */}
          {filteredTabs.some((tab) => DEFAULT_USER_TABS.includes(tab.id)) && (
            <div className="section-divider col-span-full">
              <div className="i-ph:star-fill divider-icon" />
              <span className="divider-label">Default Tabs</span>
            </div>
          )}

          {/* Default Tabs */}
          {filteredTabs
            .filter((tab) => DEFAULT_USER_TABS.includes(tab.id))
            .map((tab, index) => (
              <motion.div
                key={tab.id}
                className="tab-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                {/* Status Badges */}
                <div className="badge-container">
                  <span className="tab-badge default-badge">Default</span>
                  {BETA_TABS.has(tab.id) && <BetaLabel />}
                </div>

                <div className="tab-content">
                  <motion.div
                    className={classNames('tab-icon-container', tab.visible ? 'enabled' : 'disabled')}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <div className="tab-icon">
                      <div className={classNames(TAB_ICONS[tab.id], 'w-full h-full')} />
                    </div>
                  </motion.div>

                  <div className="tab-details">
                    <div className="tab-header">
                      <div className="tab-info">
                        <div className="tab-name-container">
                          <h4 className="tab-name">{TAB_LABELS[tab.id]}</h4>
                        </div>
                        <p className="tab-status">{tab.visible ? 'Visible in user mode' : 'Hidden in user mode'}</p>
                      </div>
                      <Switch
                        checked={tab.visible}
                        onCheckedChange={(checked) => {
                          const isDisabled =
                            !DEFAULT_USER_TABS.includes(tab.id) && !OPTIONAL_USER_TABS.includes(tab.id);

                          if (!isDisabled) {
                            handleTabVisibilityChange(tab.id, checked);
                          }
                        }}
                        className={classNames('data-[state=checked]:bg-purple-500 ml-4', {
                          'opacity-50 pointer-events-none':
                            !DEFAULT_USER_TABS.includes(tab.id) && !OPTIONAL_USER_TABS.includes(tab.id),
                        })}
                      />
                    </div>
                  </div>
                </div>

                <motion.div
                  className={classNames('tab-highlight', tab.visible ? 'enabled' : 'disabled')}
                  animate={{
                    borderColor: tab.visible ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0)',
                    scale: tab.visible ? 1 : 0.98,
                  }}
                  transition={{ duration: 0.2 }}
                />
              </motion.div>
            ))}

          {/* Optional Section Header */}
          {filteredTabs.some((tab) => OPTIONAL_USER_TABS.includes(tab.id)) && (
            <div className="section-divider col-span-full">
              <div className="i-ph:plus-circle-fill divider-icon" />
              <span className="divider-label">Optional Tabs</span>
            </div>
          )}

          {/* Optional Tabs */}
          {filteredTabs
            .filter((tab) => OPTIONAL_USER_TABS.includes(tab.id))
            .map((tab, index) => (
              <motion.div
                key={tab.id}
                className="tab-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                {/* Status Badges */}
                <div className="badge-container">
                  <span className="tab-badge optional-badge">Optional</span>
                  {BETA_TABS.has(tab.id) && <BetaLabel />}
                </div>

                <div className="tab-content">
                  <motion.div
                    className={classNames('tab-icon-container', tab.visible ? 'enabled' : 'disabled')}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <div className="tab-icon">
                      <div className={classNames(TAB_ICONS[tab.id], 'w-full h-full')} />
                    </div>
                  </motion.div>

                  <div className="tab-details">
                    <div className="tab-header">
                      <div className="tab-info">
                        <div className="tab-name-container">
                          <h4 className="tab-name">{TAB_LABELS[tab.id]}</h4>
                        </div>
                        <p className="tab-status">{tab.visible ? 'Visible in user mode' : 'Hidden in user mode'}</p>
                      </div>
                      <Switch
                        checked={tab.visible}
                        onCheckedChange={(checked) => {
                          const isDisabled =
                            !DEFAULT_USER_TABS.includes(tab.id) && !OPTIONAL_USER_TABS.includes(tab.id);

                          if (!isDisabled) {
                            handleTabVisibilityChange(tab.id, checked);
                          }
                        }}
                        className={classNames('data-[state=checked]:bg-purple-500 ml-4', {
                          'opacity-50 pointer-events-none':
                            !DEFAULT_USER_TABS.includes(tab.id) && !OPTIONAL_USER_TABS.includes(tab.id),
                        })}
                      />
                    </div>
                  </div>
                </div>

                <motion.div
                  className={classNames('tab-highlight', tab.visible ? 'enabled' : 'disabled')}
                  animate={{
                    borderColor: tab.visible ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0)',
                    scale: tab.visible ? 1 : 0.98,
                  }}
                  transition={{ duration: 0.2 }}
                />
              </motion.div>
            ))}
        </div>
      </motion.div>
    </div>
  );
};
