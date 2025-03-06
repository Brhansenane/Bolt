import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';
import { classNames } from '~/utils/classNames';
import { formatDistanceToNow } from 'date-fns';
import { PRTestingService } from './PRTestingService';
import type { PullRequest } from './types';
import {
  FiGitPullRequest,
  FiGitMerge,
  FiExternalLink,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiRefreshCw,
  FiCode,
  FiGitCommit,
  FiFileText,
  FiServer,
  FiCopy,
  FiAlertCircle,
} from 'react-icons/fi';
import { useStore } from '@nanostores/react';
import { themeStore } from '~/lib/stores/theme';

// Custom PR icon component for better visibility
const PullRequestIcon = ({ state, className }: { state: string; className?: string }) => {
  return (
    <div
      className={classNames(
        'flex-shrink-0 rounded-full flex items-center justify-center',
        state === 'open'
          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
          : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
        className || 'w-6 h-6',
      )}
    >
      {state === 'open' ? <FiGitPullRequest className="w-3.5 h-3.5" /> : <FiGitMerge className="w-3.5 h-3.5" />}
    </div>
  );
};

// Custom styled search input
interface StyledSearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}

const StyledSearchInput = ({ value, onChange, placeholder }: StyledSearchInputProps) => {
  const theme = useStore(themeStore);
  const isDark = theme === 'dark';

  return (
    <div className="relative w-full sm:w-64">
      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-bolt-elements-textSecondary" />
      <input
        type="text"
        placeholder={placeholder}
        style={{
          color: isDark ? 'white' : 'black',
          backgroundColor: isDark ? '#1a1a1a' : 'white',
          padding: '0.5rem 1rem 0.5rem 2.5rem',
          borderRadius: '0.375rem',
          width: '100%',
          border: '1px solid var(--bolt-elements-borderColor)',
        }}
        value={value}
        onChange={onChange}
      />
    </div>
  );
};

function PrTestingTab() {
  const theme = useStore(themeStore);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<'all' | 'open' | 'closed'>('open');
  const [prCommits, setPRCommits] = useState<any[]>([]);
  const [prFiles, setPRFiles] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{
    description: boolean;
    commits: boolean;
    files: boolean;
    serverInfo: boolean;
    setupLogs: boolean;
  }>({
    description: false,
    commits: false,
    files: false,
    serverInfo: true,
    setupLogs: true,
  });
  const [testingPRs, setTestingPRs] = useState<Set<number>>(new Set());
  const [serverInfo, setServerInfo] = useState<
    Map<number, { port: number; url: string; pid: number; tempDir: string }>
  >(new Map());
  const [setupLogs, setSetupLogs] = useState<Map<number, string[]>>(new Map());

  useEffect(() => {
    fetchPullRequests();
  }, [filterState]);

  useEffect(() => {
    const loadActiveTests = async () => {
      const prService = PRTestingService.getInstance();
      const activePRs = new Set<number>();

      for (const pr of pullRequests) {
        const isActive = await prService.isTestActive(pr.number);

        if (isActive) {
          activePRs.add(pr.number);
        }
      }

      setTestingPRs(activePRs);

      // Load server information and setup logs for active PRs
      const newServerInfo = new Map<number, { port: number; url: string; pid: number; tempDir: string }>();
      const newSetupLogs = new Map<number, string[]>();

      // Convert Set to Array for iteration
      const prNumbers = Array.from(activePRs);

      for (const prNumber of prNumbers) {
        // Load server info
        const info = await prService.getServerInfo(prNumber);

        if (info) {
          newServerInfo.set(prNumber, info);
        }

        // Load setup logs
        const logs = await prService.getSetupLogs(prNumber);

        if (logs.length > 0) {
          newSetupLogs.set(prNumber, logs);
        }
      }

      setServerInfo(newServerInfo);
      setSetupLogs(newSetupLogs);
    };

    loadActiveTests();
  }, [pullRequests]);

  const fetchPullRequests = async () => {
    setIsLoading(true);

    try {
      const prService = PRTestingService.getInstance();
      const prs = await prService.fetchPullRequests(filterState);
      setPullRequests(prs);
    } catch (error) {
      logStore.logError('Failed to fetch pull requests', { error });
      toast.error('Failed to fetch pull requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPR = async (pr: PullRequest) => {
    if (selectedPR?.number === pr.number) {
      setSelectedPR(null);
      setPRCommits([]);
      setPRFiles([]);

      return;
    }

    setSelectedPR(pr);
    setIsLoadingDetails(true);

    try {
      const prService = PRTestingService.getInstance();
      const [commits, files] = await Promise.all([prService.fetchPRCommits(pr), prService.fetchPRFiles(pr)]);

      setPRCommits(commits);
      setPRFiles(files);
    } catch (error) {
      logStore.logError('Failed to fetch PR details', { error, pr });
      toast.error('Failed to fetch PR details');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleTestPR = async (pr: PullRequest) => {
    setIsCloning(true);

    try {
      const prService = PRTestingService.getInstance();

      // Clear previous logs
      setSetupLogs((prev) => {
        const newLogs = new Map(prev);
        newLogs.set(pr.number, []);

        return newLogs;
      });

      // Start polling for logs
      const logInterval = setInterval(async () => {
        const logs = await prService.getSetupLogs(pr.number);
        setSetupLogs((prev) => {
          const newLogs = new Map(prev);
          newLogs.set(pr.number, [...logs]);

          return newLogs;
        });
      }, 1000);

      const result = await prService.testPullRequest(pr);

      // Stop polling for logs
      clearInterval(logInterval);

      // Get final logs
      const finalLogs = await prService.getSetupLogs(pr.number);
      setSetupLogs((prev) => {
        const newLogs = new Map(prev);
        newLogs.set(pr.number, [...finalLogs]);

        return newLogs;
      });

      if (result.success) {
        toast.success(result.message);
        setTestingPRs((prev) => new Set(prev).add(pr.number));

        if (result.data?.port && result.data?.pid && result.data?.tempDir) {
          const port = result.data.port;
          const pid = result.data.pid;
          const tempDir = result.data.tempDir;

          setServerInfo((prev) => {
            const newMap = new Map(prev);
            newMap.set(pr.number, {
              port,
              url: `http://localhost:${port}`,
              pid,
              tempDir,
            });

            return newMap;
          });
        }

        if (selectedPR?.number === pr.number) {
          await handleSelectPR(pr);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      logStore.logError('Failed to test PR', { error, pr });
      toast.error('Failed to test PR');
    } finally {
      setIsCloning(false);
    }
  };

  const handleStopTest = async (pr: PullRequest) => {
    try {
      const prService = PRTestingService.getInstance();
      const result = await prService.stopTest(pr.number);

      if (result.success) {
        toast.success(result.message);

        setTestingPRs((prev) => {
          const newSet = new Set(prev);
          newSet.delete(pr.number);

          return newSet;
        });

        setServerInfo((prev) => {
          const newMap = new Map(prev);
          newMap.delete(pr.number);

          return newMap;
        });

        if (selectedPR?.number === pr.number) {
          await handleSelectPR(pr);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      logStore.logError('Failed to stop test', { error, pr });
      toast.error('Failed to stop test');
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success('Copied to clipboard');
      },
      (err) => {
        toast.error('Failed to copy to clipboard');
        console.error('Could not copy text: ', err);
      },
    );
  };

  const filteredPRs = pullRequests.filter(
    (pr) =>
      pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.user.login.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pr.number.toString().includes(searchQuery),
  );

  const renderServerInfo = (prNumber: number) => {
    if (testingPRs.has(prNumber) && serverInfo.has(prNumber)) {
      const info = serverInfo.get(prNumber);
      return (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <FiServer className="w-3.5 h-3.5 text-bolt-elements-icon-success" />
          <span className="text-bolt-elements-textSecondary">Running at:</span>
          <a
            href={info?.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-bolt-elements-item-contentAccent hover:underline truncate max-w-[150px]"
            onClick={(e) => e.stopPropagation()}
          >
            {info?.url}
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(info?.url || '');
            }}
            className="p-0.5 rounded-md hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
            title="Copy URL"
          >
            <FiCopy className="w-3 h-3" />
          </button>
        </div>
      );
    }

    return null;
  };

  const renderSetupLogs = (prNumber: number) => {
    const logs = setupLogs.get(prNumber) || [];

    if (logs.length === 0) {
      return <div className="text-sm text-bolt-elements-textSecondary italic">No setup logs available.</div>;
    }

    return (
      <div className="bg-bolt-elements-bg-depth-2 dark:bg-bolt-elements-bg-depth-3 rounded-md border border-bolt-elements-borderColor overflow-auto max-h-80 transition-all duration-200">
        <div className="sticky top-0 bg-bolt-elements-bg-depth-1 dark:bg-bolt-elements-bg-depth-2 border-b border-bolt-elements-borderColor px-3 py-2 flex justify-between items-center">
          <div className="text-xs font-medium text-bolt-elements-textPrimary">Setup Logs ({logs.length})</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(logs.join('\n'));
            }}
            className="p-1 rounded-md hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all duration-200"
            title="Copy all logs"
          >
            <FiCopy className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-3 font-mono text-xs space-y-1">
          {logs.map((log, index) => {
            // Parse the log to extract timestamp and message
            const timestampMatch = log.match(/\[(.*?)\]/);
            const timestamp = timestampMatch ? timestampMatch[1] : '';
            const message = timestampMatch ? log.substring(timestampMatch[0].length).trim() : log;

            // Determine if this is a success, error, or info message
            const isSuccess = message.toLowerCase().includes('success') || message.toLowerCase().includes('started');
            const isError = message.toLowerCase().includes('error') || message.toLowerCase().includes('fail');

            return (
              <div
                key={index}
                className={classNames(
                  'py-1 px-2 rounded whitespace-pre-wrap border-l-2 transition-all duration-200',
                  isSuccess
                    ? 'border-l-bolt-elements-icon-success bg-bolt-elements-icon-success bg-opacity-5'
                    : isError
                      ? 'border-l-bolt-elements-button-danger-background bg-bolt-elements-button-danger-background bg-opacity-5'
                      : 'border-l-bolt-elements-borderColor',
                )}
              >
                <span className="text-bolt-elements-textSecondary mr-2 select-none">{index + 1}.</span>
                <span className="text-bolt-elements-textSecondary select-none">[{timestamp}]</span>
                <span
                  className={classNames(
                    'ml-2',
                    isSuccess
                      ? 'text-bolt-elements-icon-success'
                      : isError
                        ? 'text-bolt-elements-button-danger-text'
                        : 'text-bolt-elements-textPrimary',
                  )}
                >
                  {message}
                </span>
              </div>
            );
          })}
        </div>
        {isCloning && (
          <div className="px-3 py-2 border-t border-bolt-elements-borderColor bg-bolt-elements-bg-depth-1 dark:bg-bolt-elements-bg-depth-2 flex items-center gap-2">
            <div className="animate-spin w-3 h-3 text-bolt-elements-item-contentAccent">
              <FiRefreshCw className="w-3 h-3" />
            </div>
            <span className="text-xs text-bolt-elements-textSecondary">Updating logs...</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Debug Theme */}
      <div className="text-xs text-bolt-elements-textSecondary mb-2">Current theme: {theme}</div>
      {/* Header */}
      <motion.div
        className="flex items-center gap-2 mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <PullRequestIcon state="open" className="w-5 h-5" />
        <h2 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-white">PR Testing</h2>
        {!isLoading && pullRequests.filter((pr) => pr.state === 'open').length > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">
            {pullRequests.filter((pr) => pr.state === 'open').length} open
          </span>
        )}
      </motion.div>
      <p className="text-sm text-bolt-elements-textSecondary mb-6">Test pull requests from the GitHub repository</p>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <StyledSearchInput
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search pull requests..."
        />
        <div className="flex gap-2">
          <button
            className={classNames(
              'px-3 py-2 rounded-md text-sm font-medium',
              'transition-all duration-200',
              filterState === 'open'
                ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                : 'bg-bolt-elements-bg-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
            )}
            onClick={() => setFilterState('open')}
          >
            Open
          </button>
          <button
            className={classNames(
              'px-3 py-2 rounded-md text-sm font-medium',
              'transition-all duration-200',
              filterState === 'closed'
                ? 'bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text'
                : 'bg-bolt-elements-bg-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
            )}
            onClick={() => setFilterState('closed')}
          >
            Closed
          </button>
          <button
            className={classNames(
              'px-3 py-2 rounded-md text-sm font-medium',
              'transition-all duration-200',
              filterState === 'all'
                ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
                : 'bg-bolt-elements-bg-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
            )}
            onClick={() => setFilterState('all')}
          >
            All
          </button>
          <button
            className={classNames(
              'px-3 py-2 rounded-md text-sm font-medium',
              'bg-bolt-elements-bg-depth-1 text-bolt-elements-textSecondary',
              'hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
              'transition-all duration-200',
            )}
            onClick={fetchPullRequests}
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pull Requests List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin w-8 h-8 text-bolt-elements-item-contentAccent">
            <FiRefreshCw className="w-8 h-8" />
          </div>
        </div>
      ) : filteredPRs.length === 0 ? (
        <div className="text-center py-12 text-bolt-elements-textSecondary">
          {searchQuery ? 'No pull requests match your search' : 'No pull requests found'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredPRs.map((pr) => (
            <motion.div
              key={pr.number}
              className={classNames(
                'rounded-lg border cursor-pointer',
                'transition-all duration-200',
                selectedPR?.number === pr.number
                  ? 'border-accent-500 shadow-md'
                  : 'border-bolt-elements-borderColor hover:border-accent-300',
                'bg-bolt-elements-bg-depth-1 hover:bg-bolt-elements-item-backgroundActive',
              )}
              onClick={() => handleSelectPR(pr)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <PullRequestIcon state={pr.state} className="w-6 h-6" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-bolt-elements-textPrimary dark:text-white transition-theme">
                        {pr.title}
                      </h3>
                      <span className="text-xs text-bolt-elements-textSecondary transition-theme">#{pr.number}</span>
                      {testingPRs.has(pr.number) && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-icon-success bg-opacity-10 text-bolt-elements-icon-success transition-theme">
                          Testing
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-bolt-elements-textSecondary transition-theme">
                      Opened by{' '}
                      <a
                        href={pr.user.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bolt-elements-item-contentAccent hover:underline transition-theme"
                      >
                        {pr.user.login}
                      </a>{' '}
                      {formatDistanceToNow(new Date(pr.created_at))} ago
                    </div>

                    {renderServerInfo(pr.number)}
                    {pr.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {pr.labels.map((label) => (
                          <span
                            key={label.name}
                            className="px-2 py-0.5 text-xs rounded-full"
                            style={{
                              backgroundColor: `#${label.color}20`,
                              color: `#${label.color}`,
                              border: `1px solid #${label.color}40`,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={pr.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-md bg-bolt-elements-bg-depth-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FiExternalLink className="w-4 h-4" />
                  </a>
                  {testingPRs.has(pr.number) ? (
                    <button
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStopTest(pr);
                      }}
                    >
                      Stop Test
                    </button>
                  ) : (
                    <button
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTestPR(pr);
                      }}
                      disabled={isCloning}
                    >
                      {isCloning ? (
                        <div className="animate-spin w-4 h-4">
                          <FiRefreshCw className="w-4 h-4" />
                        </div>
                      ) : (
                        <span>Test PR</span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {selectedPR?.number === pr.number && (
                <motion.div
                  className="mt-4 pt-4 border-t border-bolt-elements-borderColor"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  {isLoadingDetails ? (
                    <div className="flex justify-center items-center py-4">
                      <div className="animate-spin w-6 h-6 text-purple-500">
                        <FiRefreshCw className="w-6 h-6" />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Server Information Section - Show only for active tests */}
                      {testingPRs.has(pr.number) && (
                        <div className="mb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-2 hover:bg-bolt-elements-item-backgroundActive rounded-md px-2 -mx-2 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSection('serverInfo');
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <FiServer className="w-4 h-4 text-bolt-elements-icon-success" />
                              <h4 className="text-sm font-medium text-bolt-elements-textPrimary dark:text-white">
                                Server Information
                              </h4>
                              <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">
                                Active
                              </span>
                            </div>
                            {expandedSections.serverInfo ? (
                              <FiChevronUp className="w-4 h-4 text-bolt-elements-textSecondary" />
                            ) : (
                              <FiChevronDown className="w-4 h-4 text-bolt-elements-textSecondary" />
                            )}
                          </div>

                          {expandedSections.serverInfo && (
                            <div className="p-3 bg-bolt-elements-bg-depth-1 dark:bg-bolt-elements-bg-depth-3 rounded-md border border-bolt-elements-borderColor transition-all duration-200">
                              {serverInfo.has(pr.number) ? (
                                <div className="space-y-3">
                                  <div className="flex flex-col space-y-1">
                                    <div className="text-sm font-medium text-bolt-elements-textPrimary dark:text-white transition-all duration-200">
                                      Server URL
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={serverInfo.get(pr.number)?.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-bolt-elements-item-contentAccent hover:underline transition-all duration-200"
                                      >
                                        {serverInfo.get(pr.number)?.url}
                                      </a>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(serverInfo.get(pr.number)?.url || '');
                                        }}
                                        className="p-1 rounded-md hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all duration-200"
                                        title="Copy URL"
                                      >
                                        <FiCopy className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex flex-col space-y-1">
                                    <div className="text-sm font-medium text-bolt-elements-textPrimary dark:text-white transition-all duration-200">
                                      Process ID
                                    </div>
                                    <div className="text-sm text-bolt-elements-textSecondary transition-all duration-200">
                                      {serverInfo.get(pr.number)?.pid}
                                    </div>
                                  </div>

                                  <div className="flex flex-col space-y-1">
                                    <div className="text-sm font-medium text-bolt-elements-textPrimary dark:text-white transition-all duration-200">
                                      Temporary Directory
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm text-bolt-elements-textSecondary truncate max-w-[300px] transition-all duration-200">
                                        {serverInfo.get(pr.number)?.tempDir}
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          copyToClipboard(serverInfo.get(pr.number)?.tempDir || '');
                                        }}
                                        className="p-1 rounded-md hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-all duration-200"
                                        title="Copy path"
                                      >
                                        <FiCopy className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-2 p-2 bg-bolt-elements-cta-background rounded-md border border-bolt-elements-borderColor transition-all duration-200">
                                    <div className="flex items-start gap-2">
                                      <FiAlertCircle className="w-4 h-4 text-bolt-elements-icon-secondary mt-0.5 transition-all duration-200" />
                                      <div className="text-xs text-bolt-elements-cta-text transition-all duration-200">
                                        <p className="font-medium">Important:</p>
                                        <p>
                                          Remember to stop the test when you're done to free up resources. The server
                                          will be automatically stopped when you close the application.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-bolt-elements-textSecondary">
                                  Server information not available. The PR test may still be starting up.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Setup Logs Section - Show for all PRs being tested */}
                      {testingPRs.has(pr.number) && (
                        <div className="mb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-2 hover:bg-bolt-elements-item-backgroundActive rounded-md px-2 -mx-2 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSection('setupLogs');
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <FiFileText className="w-4 h-4 text-bolt-elements-icon-primary" />
                              <h4 className="text-sm font-medium text-bolt-elements-textPrimary dark:text-white">
                                Setup Logs
                              </h4>
                              {isCloning && pr.number === selectedPR?.number && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent animate-pulse">
                                  Running
                                </span>
                              )}
                              {(() => {
                                const logs = setupLogs.get(pr.number);
                                return logs && logs.length > 0 ? (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">
                                    {logs.length}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            {expandedSections.setupLogs ? (
                              <FiChevronUp className="w-4 h-4 text-bolt-elements-textSecondary" />
                            ) : (
                              <FiChevronDown className="w-4 h-4 text-bolt-elements-textSecondary" />
                            )}
                          </div>

                          {expandedSections.setupLogs && <div className="mt-2">{renderSetupLogs(pr.number)}</div>}
                        </div>
                      )}

                      {/* Description Section */}
                      <div className="mb-4">
                        <div
                          className="flex items-center justify-between cursor-pointer py-2 hover:bg-bolt-elements-item-backgroundActive rounded-md px-2 -mx-2 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSection('description');
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <FiFileText className="w-4 h-4 text-bolt-elements-icon-primary" />
                            <h4 className="text-sm font-medium text-bolt-elements-textPrimary dark:text-white">
                              Description
                            </h4>
                          </div>
                          {expandedSections.description ? (
                            <FiChevronUp className="w-4 h-4 text-bolt-elements-textSecondary" />
                          ) : (
                            <FiChevronDown className="w-4 h-4 text-bolt-elements-textSecondary" />
                          )}
                        </div>

                        {expandedSections.description && (
                          <div className="text-sm text-bolt-elements-textSecondary whitespace-pre-line p-3 bg-bolt-elements-bg-depth-2 dark:bg-bolt-elements-bg-depth-3 rounded-md">
                            {pr.body || 'No description provided.'}
                          </div>
                        )}
                      </div>

                      {/* PR Commits */}
                      {prCommits.length > 0 && (
                        <div className="mb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-2 hover:bg-bolt-elements-item-backgroundActive rounded-md px-2 -mx-2 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSection('commits');
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <FiGitCommit className="w-4 h-4 text-bolt-elements-icon-primary" />
                              <h4 className="text-sm font-medium text-bolt-elements-textPrimary dark:text-white">
                                Commits
                              </h4>
                              <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent transition-theme">
                                {prCommits.length}
                              </span>
                            </div>
                            {expandedSections.commits ? (
                              <FiChevronUp className="w-4 h-4 text-bolt-elements-textSecondary" />
                            ) : (
                              <FiChevronDown className="w-4 h-4 text-bolt-elements-textSecondary" />
                            )}
                          </div>

                          {expandedSections.commits && (
                            <div className="p-3 bg-bolt-elements-bg-depth-1 dark:bg-bolt-elements-bg-depth-3 rounded-md border border-bolt-elements-borderColor transition-all duration-200">
                              <div className="space-y-3">
                                {prCommits.map((commit) => (
                                  <div key={commit.sha} className="text-sm">
                                    <div className="flex items-center gap-2">
                                      <FiGitCommit className="w-3.5 h-3.5 text-bolt-elements-icon-primary transition-theme" />
                                      <a
                                        href={commit.html_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-xs text-bolt-elements-item-contentAccent hover:underline transition-theme"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {commit.sha.substring(0, 7)}
                                      </a>
                                    </div>
                                    <div className="ml-5 mt-1 text-bolt-elements-textPrimary dark:text-white transition-theme">
                                      {commit.commit.message}
                                    </div>
                                    <div className="ml-5 mt-1 text-xs text-bolt-elements-textSecondary transition-theme">
                                      by {commit.author?.login || commit.commit.author.name}{' '}
                                      {formatDistanceToNow(new Date(commit.commit.author.date))} ago
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PR Files */}
                      {prFiles.length > 0 && (
                        <div className="mb-4">
                          <div
                            className="flex items-center justify-between cursor-pointer py-2 hover:bg-bolt-elements-item-backgroundActive rounded-md px-2 -mx-2 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSection('files');
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <FiCode className="w-4 h-4 text-bolt-elements-icon-primary" />
                              <h4 className="text-sm font-medium text-bolt-elements-textPrimary dark:text-white">
                                Changed Files
                              </h4>
                              <span className="px-2 py-0.5 text-xs rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent">
                                {prFiles.length}
                              </span>
                            </div>
                            {expandedSections.files ? (
                              <FiChevronUp className="w-4 h-4 text-bolt-elements-textSecondary" />
                            ) : (
                              <FiChevronDown className="w-4 h-4 text-bolt-elements-textSecondary" />
                            )}
                          </div>

                          {expandedSections.files && (
                            <div className="p-3 bg-bolt-elements-bg-depth-1 dark:bg-bolt-elements-bg-depth-3 rounded-md border border-bolt-elements-borderColor transition-all duration-200">
                              <div className="space-y-2">
                                {prFiles.map((file) => (
                                  <div key={file.filename} className="text-sm">
                                    <a
                                      href={file.blob_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-bolt-elements-item-contentAccent hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {file.filename}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PrTestingTab;
