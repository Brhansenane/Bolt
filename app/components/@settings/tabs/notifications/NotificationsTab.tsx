import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { logStore } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { formatDistanceToNow } from 'date-fns';
import { classNames } from '~/utils/classNames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import '~/styles/components/notifications.scss';

interface NotificationDetails {
  type?: string;
  message?: string;
  currentVersion?: string;
  latestVersion?: string;
  branch?: string;
  updateUrl?: string;
}

type FilterType = 'all' | 'system' | 'error' | 'warning' | 'update' | 'info' | 'provider' | 'network';

const NotificationsTab = () => {
  const [filter, setFilter] = useState<FilterType>('all');
  const logs = useStore(logStore.logs);

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      logStore.logPerformanceMetric('NotificationsTab', 'mount-duration', duration);
    };
  }, []);

  const handleClearNotifications = () => {
    const count = Object.keys(logs).length;
    logStore.logInfo('Cleared notifications', {
      type: 'notification_clear',
      message: `Cleared ${count} notifications`,
      clearedCount: count,
      component: 'notifications',
    });
    logStore.clearLogs();
  };

  const handleUpdateAction = (updateUrl: string) => {
    logStore.logInfo('Update link clicked', {
      type: 'update_click',
      message: 'User clicked update link',
      updateUrl,
      component: 'notifications',
    });
    window.open(updateUrl, '_blank');
  };

  const handleFilterChange = (newFilter: FilterType) => {
    logStore.logInfo('Notification filter changed', {
      type: 'filter_change',
      message: `Filter changed to ${newFilter}`,
      previousFilter: filter,
      newFilter,
      component: 'notifications',
    });
    setFilter(newFilter);
  };

  const filteredLogs = Object.values(logs)
    .filter((log) => {
      if (filter === 'all') {
        return true;
      }

      if (filter === 'update') {
        return log.details?.type === 'update';
      }

      if (filter === 'system') {
        return log.category === 'system';
      }

      if (filter === 'provider') {
        return log.category === 'provider';
      }

      if (filter === 'network') {
        return log.category === 'network';
      }

      return log.level === filter;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getNotificationStyle = (level: string, type?: string) => {
    if (type === 'update') {
      return {
        icon: 'i-ph:arrow-circle-up',
        iconClass: 'update-icon',
        itemClass: 'update-notification',
      };
    }

    switch (level) {
      case 'error':
        return {
          icon: 'i-ph:warning-circle',
          iconClass: 'error-icon',
          itemClass: 'error-notification',
        };
      case 'warning':
        return {
          icon: 'i-ph:warning',
          iconClass: 'warning-icon',
          itemClass: 'warning-notification',
        };
      case 'info':
        return {
          icon: 'i-ph:info',
          iconClass: 'info-icon',
          itemClass: 'info-notification',
        };
      case 'system':
        return {
          icon: 'i-ph:gear',
          iconClass: 'system-icon',
          itemClass: 'system-notification',
        };
      case 'provider':
        return {
          icon: 'i-ph:robot',
          iconClass: 'provider-icon',
          itemClass: 'provider-notification',
        };
      case 'network':
        return {
          icon: 'i-ph:wifi-high',
          iconClass: 'network-icon',
          itemClass: 'network-notification',
        };
      default:
        return {
          icon: 'i-ph:bell',
          iconClass: '',
          itemClass: '',
        };
    }
  };

  const renderNotificationDetails = (details: NotificationDetails) => {
    if (details.type === 'update') {
      return (
        <div className="update-details">
          <p className="update-message">{details.message}</p>
          <div className="version-info">
            <p>Current Version: {details.currentVersion}</p>
            <p>Latest Version: {details.latestVersion}</p>
            <p>Branch: {details.branch}</p>
          </div>
          <button onClick={() => details.updateUrl && handleUpdateAction(details.updateUrl)} className="update-button">
            <span className="i-ph:git-branch branch-icon" />
            View Changes
          </button>
        </div>
      );
    }

    return details.message ? <p className="notification-message">{details.message}</p> : null;
  };

  const filterOptions: { id: FilterType; label: string; icon: string; color: string }[] = [
    { id: 'all', label: 'All Notifications', icon: 'i-ph:bell', color: '#9333ea' },
    { id: 'system', label: 'System', icon: 'i-ph:gear', color: '#6b7280' },
    { id: 'update', label: 'Updates', icon: 'i-ph:arrow-circle-up', color: '#9333ea' },
    { id: 'error', label: 'Errors', icon: 'i-ph:warning-circle', color: '#ef4444' },
    { id: 'warning', label: 'Warnings', icon: 'i-ph:warning', color: '#f59e0b' },
    { id: 'info', label: 'Information', icon: 'i-ph:info', color: '#3b82f6' },
    { id: 'provider', label: 'Providers', icon: 'i-ph:robot', color: '#10b981' },
    { id: 'network', label: 'Network', icon: 'i-ph:wifi-high', color: '#6366f1' },
  ];

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="filter-button">
              <span
                className={classNames(
                  'filter-icon',
                  filterOptions.find((opt) => opt.id === filter)?.icon || 'i-ph:funnel',
                )}
                style={{ color: filterOptions.find((opt) => opt.id === filter)?.color }}
              />
              {filterOptions.find((opt) => opt.id === filter)?.label || 'Filter Notifications'}
              <span className="i-ph:caret-down caret-icon" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content className="filter-dropdown" sideOffset={5} align="start" side="bottom">
              {filterOptions.map((option) => (
                <DropdownMenu.Item
                  key={option.id}
                  className="filter-item"
                  onClick={() => handleFilterChange(option.id)}
                >
                  <div className="item-icon-container">
                    <div className={classNames('item-icon', option.icon)} style={{ color: option.color }} />
                  </div>
                  <span className="item-label">{option.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button onClick={handleClearNotifications} className="clear-button">
          <span className="i-ph:trash trash-icon" />
          Clear All
        </button>
      </div>

      <div className="notifications-list">
        {filteredLogs.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="empty-state">
            <span className="i-ph:bell-slash empty-icon" />
            <div>
              <h3 className="empty-title">No Notifications</h3>
              <p className="empty-description">You're all caught up!</p>
            </div>
          </motion.div>
        ) : (
          filteredLogs.map((log) => {
            const style = getNotificationStyle(log.level, log.details?.type);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={classNames('notification-item', style.itemClass)}
              >
                <div className="notification-header">
                  <div className="notification-content">
                    <span className={classNames('notification-icon', style.icon, style.iconClass)} />
                    <div className="notification-text">
                      <h3 className="notification-title">{log.message}</h3>
                      {log.details && renderNotificationDetails(log.details as NotificationDetails)}
                      <p className="notification-category">
                        Category: {log.category}
                        {log.subCategory ? ` > ${log.subCategory}` : ''}
                      </p>
                    </div>
                  </div>
                  <time className="notification-time">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </time>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsTab;
