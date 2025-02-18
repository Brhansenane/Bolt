import type { GitHubRepoInfo, RepositoryStats } from '~/types/GitHub';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import * as Dialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { getLocalStorage } from '~/lib/persistence';
import { motion } from 'framer-motion';
import { formatSize } from '~/utils/formatSize';
import { themeTokens } from '~/components/ui/theme/StyleGuide';
import { Icon } from '~/components/ui/Icon';

interface RepositorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, branch: string) => void;
}

interface SearchFilters {
  language?: string;
  stars?: number;
  forks?: number;
  user?: string;
}

interface StatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: RepositoryStats;
  isLargeRepo?: boolean;
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

interface RepositoryListProps {
  repos: GitHubRepoInfo[];
  isLoading: boolean;
  onSelect: (repo: GitHubRepoInfo) => void;
  activeTab: string;
}

function StatsDialog({ isOpen, onClose, onConfirm, stats, isLargeRepo }: StatsDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={themeTokens.dialog.overlay} />
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[90vw] md:w-[500px]"
          >
            <Dialog.Content className={classNames(themeTokens.dialog.content, 'overflow-hidden')}>
              <div className={themeTokens.dialog.header}>
                <div className="flex items-center justify-between">
                  <Dialog.Title className={classNames('text-xl font-semibold', themeTokens.text.primary)}>
                    Repository Overview
                  </Dialog.Title>
                  <Dialog.Close onClick={onClose} className={themeTokens.dialog.close}>
                    <div className={classNames('i-ph:x', themeTokens.icon.sizes.md)} />
                  </Dialog.Close>
                </div>
              </div>
              <div className={themeTokens.dialog.body}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className={classNames('text-sm', themeTokens.text.secondary)}>Repository Statistics:</p>
                    <div className={classNames('space-y-2 text-sm', themeTokens.text.primary)}>
                      <div className="flex items-center gap-2">
                        <span
                          className={classNames(
                            'i-ph:files',
                            themeTokens.icon.sizes.sm,
                            themeTokens.icon.colors.accent,
                          )}
                        />
                        <span>Total Files: {stats.totalFiles}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={classNames(
                            'i-ph:database',
                            themeTokens.icon.sizes.sm,
                            themeTokens.icon.colors.accent,
                          )}
                        />
                        <span>Total Size: {formatSize(stats.totalSize)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={classNames('i-ph:code', themeTokens.icon.sizes.sm, themeTokens.icon.colors.accent)}
                        />
                        <span>
                          Languages:{' '}
                          {Object.entries(stats.languages)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 3)
                            .map(([lang, size]) => `${lang} (${formatSize(size)})`)
                            .join(', ')}
                        </span>
                      </div>
                      {stats.hasPackageJson && (
                        <div className="flex items-center gap-2">
                          <span
                            className={classNames(
                              'i-ph:package',
                              themeTokens.icon.sizes.sm,
                              themeTokens.icon.colors.accent,
                            )}
                          />
                          <span>Has package.json</span>
                        </div>
                      )}
                      {stats.hasDependencies && (
                        <div className="flex items-center gap-2">
                          <span
                            className={classNames(
                              'i-ph:tree-structure',
                              themeTokens.icon.sizes.sm,
                              themeTokens.icon.colors.accent,
                            )}
                          />
                          <span>Has dependencies</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isLargeRepo && (
                    <div
                      className={classNames(
                        'p-3 rounded-lg text-sm flex items-start gap-2',
                        themeTokens.status.warning.bg,
                        themeTokens.status.warning.text,
                      )}
                    >
                      <span
                        className={classNames(
                          'i-ph:warning',
                          themeTokens.icon.sizes.sm,
                          'flex-shrink-0 mt-0.5',
                          themeTokens.status.warning.icon,
                        )}
                      />
                      <div>
                        This repository is quite large ({formatSize(stats.totalSize)}). Importing it might take a while
                        and could impact performance.
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className={themeTokens.dialog.footer}>
                <motion.button
                  onClick={onClose}
                  className={classNames(themeTokens.button.base, themeTokens.button.secondary)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={onConfirm}
                  className={classNames(themeTokens.button.base, themeTokens.button.primary)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Import Repository
                </motion.button>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function RepositorySelectionDialog({ isOpen, onClose, onSelect }: RepositorySelectionDialogProps) {
  const [selectedRepository, setSelectedRepository] = useState<GitHubRepoInfo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepoInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GitHubRepoInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'my-repos' | 'search' | 'url'>('my-repos');
  const [customUrl, setCustomUrl] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [currentStats, setCurrentStats] = useState<RepositoryStats | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSearchRef = useRef<string>('');

  // Fetch user's repositories when dialog opens
  useEffect(() => {
    if (isOpen && activeTab === 'my-repos') {
      fetchUserRepos();
    }
  }, [isOpen, activeTab]);

  const fetchUserRepos = async () => {
    const connection = getLocalStorage('github_connection');

    if (!connection?.token) {
      toast.error('Please connect your GitHub account first');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
        headers: {
          Authorization: `Bearer ${connection.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();

      // Add type assertion and validation
      if (
        Array.isArray(data) &&
        data.every((item) => typeof item === 'object' && item !== null && 'full_name' in item)
      ) {
        setRepositories(data as GitHubRepoInfo[]);
      } else {
        throw new Error('Invalid repository data format');
      }
    } catch (error) {
      console.error('Error fetching repos:', error);
      toast.error('Failed to fetch your repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const buildSearchQuery = (query: string, currentFilters: SearchFilters): string => {
    let searchQuery = query;

    if (currentFilters.language) {
      searchQuery += ` language:${currentFilters.language}`;
    }

    if (currentFilters.stars) {
      searchQuery += ` stars:>${currentFilters.stars}`;
    }

    if (currentFilters.forks) {
      searchQuery += ` forks:>${currentFilters.forks}`;
    }

    if (currentFilters.user) {
      searchQuery += ` user:${currentFilters.user}`;
    }

    return searchQuery.trim();
  };

  const handleSearch = async (query: string, currentFilters: SearchFilters) => {
    const fullQuery = buildSearchQuery(query, currentFilters);

    // Don't search if query is empty or hasn't changed
    if (!fullQuery || fullQuery === lastSearchRef.current) {
      setIsSearching(false);
      return;
    }

    lastSearchRef.current = fullQuery;
    setIsLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(fullQuery)}&sort=stars&order=desc`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          response.status === 403 ? 'Rate limit exceeded. Please try again later.' : 'Failed to search repositories',
        );
      }

      const data = await response.json();

      if (typeof data === 'object' && data !== null && 'items' in data && Array.isArray(data.items)) {
        setSearchResults(data.items as GitHubRepoInfo[]);
      } else {
        throw new Error('Invalid search results format');
      }
    } catch (error) {
      console.error('Error searching repos:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search repositories');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const debouncedSearch = (query: string, currentFilters: SearchFilters) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(query, currentFilters);
    }, 500);
  };

  const fetchBranches = async (repo: GitHubRepoInfo) => {
    setIsLoadingBranches(true);

    try {
      const connection = getLocalStorage('github_connection');
      const headers: HeadersInit = connection?.token ? { Authorization: `Bearer ${connection.token}` } : {};

      const response = await fetch(`https://api.github.com/repos/${repo.full_name}/branches`, {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        const branchNames = data.map((b) => b.name);
        setBranches(branchNames);
        setSelectedBranch(repo.default_branch || branchNames[0] || 'main');
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to fetch repository branches');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const handleRepoSelect = async (repo: GitHubRepoInfo) => {
    setSelectedRepository(repo);
    await fetchBranches(repo);
  };

  const formatGitUrl = (url: string): string => {
    // Remove any tree references and ensure .git extension
    const baseUrl = url
      .replace(/\/tree\/[^/]+/, '') // Remove /tree/branch-name
      .replace(/\/$/, '') // Remove trailing slash
      .replace(/\.git$/, ''); // Remove .git if present
    return `${baseUrl}.git`;
  };

  const handleImport = () => {
    if (!selectedRepository || !selectedBranch) {
      return;
    }

    const gitUrl = formatGitUrl(selectedRepository.html_url);
    onSelect(gitUrl, selectedBranch);
    handleClose();
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    let parsedValue: string | number | undefined = value;

    if (key === 'stars' || key === 'forks') {
      parsedValue = value ? parseInt(value, 10) : undefined;
    }

    const newFilters = { ...filters, [key]: parsedValue };
    setFilters(newFilters);
    debouncedSearch(searchQuery, newFilters);
  };

  // Handle dialog close properly
  const handleClose = () => {
    setSearchQuery(''); // Reset search
    setSearchResults([]); // Reset results
    setSelectedRepository(null); // Reset selected repository
    setShowStatsDialog(false); // Hide stats dialog
    setCurrentStats(null); // Reset stats
    setActiveTab('my-repos'); // Reset active tab
    setFilters({}); // Reset filters
    setSelectedBranch(''); // Reset selected branch
    setBranches([]); // Reset branches
    onClose(); // Call parent close handler
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={themeTokens.dialog.overlay} />
        <Dialog.Content
          className={classNames(
            themeTokens.dialog.content,
            'fixed top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2',
            'w-[90vw] md:w-[600px] max-h-[85vh]',
            'z-[51]',
          )}
        >
          <div className={themeTokens.dialog.header}>
            <div className="flex items-center justify-between">
              <Dialog.Title className={classNames('text-xl font-semibold', themeTokens.text.primary)}>
                {selectedRepository ? 'Select Branch' : 'Import GitHub Repository'}
              </Dialog.Title>
              {selectedRepository && (
                <motion.button
                  onClick={() => setSelectedRepository(null)}
                  className={themeTokens.iconButton.base}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <div className={classNames('i-ph:arrow-left', themeTokens.icon.sizes.sm)} />
                </motion.button>
              )}
              <Dialog.Close onClick={handleClose} className={themeTokens.dialog.close}>
                <div className={classNames('i-ph:x', themeTokens.icon.sizes.md)} />
              </Dialog.Close>
            </div>
          </div>

          <div className={classNames(themeTokens.dialog.body, 'space-y-6')}>
            {selectedRepository ? (
              <div className="space-y-4">
                <div className={themeTokens.dialog.section}>
                  <div className="flex items-center gap-2">
                    <div
                      className={classNames(
                        'i-ph:git-repository',
                        themeTokens.icon.sizes.sm,
                        themeTokens.icon.colors.accent,
                      )}
                    />
                    <span className={classNames('text-sm font-medium', themeTokens.text.primary)}>
                      {selectedRepository.full_name}
                    </span>
                  </div>
                </div>

                <div className={themeTokens.dialog.section}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={classNames(
                        'i-ph:git-branch',
                        themeTokens.icon.sizes.sm,
                        themeTokens.icon.colors.accent,
                      )}
                    />
                    <label className={classNames('text-sm font-medium', themeTokens.text.secondary)}>
                      Select Branch
                    </label>
                  </div>
                  {isLoadingBranches ? (
                    <div className={classNames('py-4 text-center', themeTokens.text.secondary)}>
                      <div className={classNames('i-ph:circle-notch animate-spin', themeTokens.icon.sizes.md)} />
                      <p className="mt-2 text-sm">Loading branches...</p>
                    </div>
                  ) : (
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className={themeTokens.branchSelector.base}
                    >
                      {branches.map((branch) => (
                        <option key={branch} value={branch} className={themeTokens.branchSelector.option}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <motion.button
                  onClick={handleImport}
                  className={classNames(themeTokens.button.base, themeTokens.button.primary, 'w-full')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!selectedBranch}
                >
                  <div className={classNames('i-ph:git-branch', themeTokens.icon.sizes.sm)} />
                  Import from {selectedBranch}
                </motion.button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <TabButton active={activeTab === 'my-repos'} onClick={() => setActiveTab('my-repos')}>
                    <span className={classNames('i-ph:book-bookmark', themeTokens.icon.sizes.sm)} />
                    My Repos
                  </TabButton>
                  <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')}>
                    <span className={classNames('i-ph:magnifying-glass', themeTokens.icon.sizes.sm)} />
                    Search
                  </TabButton>
                  <TabButton active={activeTab === 'url'} onClick={() => setActiveTab('url')}>
                    <span className={classNames('i-ph:link', themeTokens.icon.sizes.sm)} />
                    URL
                  </TabButton>
                </div>

                {activeTab === 'url' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={classNames('i-ph:link', themeTokens.icon.sizes.sm, themeTokens.icon.colors.accent)}
                      />
                      <label className={classNames('text-sm font-medium', themeTokens.text.secondary)}>
                        Repository URL
                      </label>
                    </div>
                    <input
                      placeholder="Enter repository URL"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className={classNames(themeTokens.input.base, 'w-full')}
                    />
                    <button
                      onClick={handleImport}
                      disabled={!customUrl}
                      className={classNames(themeTokens.button.base, themeTokens.button.primary, 'w-full')}
                    >
                      <div className={classNames('i-ph:git-branch', themeTokens.icon.sizes.sm)} />
                      Import Repository
                    </button>
                  </div>
                ) : (
                  <>
                    {activeTab === 'search' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={classNames(
                              'i-ph:magnifying-glass',
                              themeTokens.icon.sizes.sm,
                              themeTokens.icon.colors.accent,
                            )}
                          />
                          <label className={classNames('text-sm font-medium', themeTokens.text.secondary)}>
                            Search Repositories
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              placeholder="Search repositories..."
                              value={searchQuery}
                              onChange={(e) => {
                                setSearchQuery(e.target.value);
                                debouncedSearch(e.target.value, filters);
                              }}
                              className={classNames(themeTokens.input.base, 'pl-9')}
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                              <Icon
                                name={isSearching ? 'circle-notch' : 'magnifying-glass'}
                                size="sm"
                                className={isSearching ? 'animate-spin' : ''}
                              />
                            </div>
                          </div>
                        </div>
                        {searchError && (
                          <div
                            className={classNames(
                              'p-3 rounded-lg text-sm flex items-start gap-2',
                              themeTokens.status.error.bg,
                              themeTokens.status.error.text,
                            )}
                          >
                            <Icon name="warning" size="sm" className={themeTokens.status.error.icon} />
                            <span>{searchError}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={classNames(
                                  'i-ph:code',
                                  themeTokens.icon.sizes.sm,
                                  themeTokens.icon.colors.accent,
                                )}
                              />
                              <label className={classNames('text-xs font-medium', themeTokens.text.secondary)}>
                                Language
                              </label>
                            </div>
                            <input
                              type="text"
                              placeholder="Filter by language..."
                              value={filters.language || ''}
                              onChange={(e) => handleFilterChange('language', e.target.value)}
                              className={themeTokens.input.base}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={classNames(
                                  'i-ph:user',
                                  themeTokens.icon.sizes.sm,
                                  themeTokens.icon.colors.accent,
                                )}
                              />
                              <label className={classNames('text-xs font-medium', themeTokens.text.secondary)}>
                                User
                              </label>
                            </div>
                            <input
                              type="text"
                              placeholder="Filter by user..."
                              value={filters.user || ''}
                              onChange={(e) => handleFilterChange('user', e.target.value)}
                              className={themeTokens.input.base}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className={classNames(
                                'i-ph:star',
                                themeTokens.icon.sizes.sm,
                                themeTokens.icon.colors.accent,
                              )}
                            />
                            <label className={classNames('text-xs font-medium', themeTokens.text.secondary)}>
                              Stars
                            </label>
                          </div>
                          <input
                            type="number"
                            placeholder="Min stars..."
                            value={filters.stars || ''}
                            onChange={(e) => handleFilterChange('stars', e.target.value)}
                            className={themeTokens.input.base}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className={classNames(
                                'i-ph:git-fork',
                                themeTokens.icon.sizes.sm,
                                themeTokens.icon.colors.accent,
                              )}
                            />
                            <label className={classNames('text-xs font-medium', themeTokens.text.secondary)}>
                              Forks
                            </label>
                          </div>
                          <input
                            type="number"
                            placeholder="Min forks..."
                            value={filters.forks || ''}
                            onChange={(e) => handleFilterChange('forks', e.target.value)}
                            className={themeTokens.input.base}
                          />
                        </div>
                      </div>
                    )}

                    <div className={classNames('max-h-[400px] overflow-y-auto pr-2', themeTokens.scrollbar)}>
                      <RepositoryList
                        repos={activeTab === 'my-repos' ? repositories : searchResults}
                        isLoading={isLoading}
                        onSelect={handleRepoSelect}
                        activeTab={activeTab}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      {currentStats && (
        <StatsDialog
          isOpen={showStatsDialog}
          onClose={handleClose}
          onConfirm={handleImport}
          stats={currentStats}
          isLargeRepo={currentStats.totalSize > 50 * 1024 * 1024}
        />
      )}
    </Dialog.Root>
  );
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={classNames(
        themeTokens.button.tab.base,
        active ? themeTokens.button.tab.active : themeTokens.button.tab.inactive,
      )}
    >
      {children}
    </button>
  );
}

function RepositoryList({ repos, isLoading, onSelect, activeTab }: RepositoryListProps) {
  if (isLoading) {
    return (
      <div className={classNames('py-8 text-center', themeTokens.text.secondary)}>
        <div className={classNames('i-ph:circle-notch', themeTokens.icon.sizes.md, 'mx-auto animate-spin')} />
        <p className="mt-2 text-sm">Loading repositories...</p>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className={classNames('py-8 text-center', themeTokens.text.secondary)}>
        <div className={classNames('i-ph:folder-open', themeTokens.icon.sizes.lg, 'mx-auto opacity-50')} />
        <p className="mt-2 text-sm">
          {activeTab === 'search' ? 'No repositories found matching your search' : 'No repositories found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-2">
      {repos.map((repo) => (
        <RepositoryCard key={repo.full_name} repo={repo} onSelect={() => onSelect(repo)} />
      ))}
    </div>
  );
}

function RepositoryCard({ repo, onSelect }: { repo: GitHubRepoInfo; onSelect: () => void }) {
  return (
    <motion.button
      onClick={onSelect}
      className={classNames(
        themeTokens.dialog.section,
        'w-full text-left',
        'hover:' + themeTokens.background.depth3.split(' ')[0],
        'group transition-colors duration-200',
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={classNames('i-ph:git-repository', themeTokens.icon.sizes.sm, themeTokens.icon.colors.accent)}
          />
          <span className={classNames('text-sm font-medium', themeTokens.text.primary, 'group-hover:text-purple-500')}>
            {repo.name}
          </span>
        </div>
        {repo.private && (
          <span
            className={classNames(
              'text-xs px-2 py-1 rounded-full',
              themeTokens.status.private.bg,
              themeTokens.status.private.text,
            )}
          >
            Private
          </span>
        )}
      </div>
      {repo.description && (
        <p className={classNames('mt-2 text-xs line-clamp-2', themeTokens.text.secondary)}>{repo.description}</p>
      )}
      <div className={classNames('mt-3 flex items-center gap-3 text-xs', themeTokens.text.tertiary)}>
        {repo.language && (
          <span className="flex items-center gap-1">
            <div className={classNames('i-ph:code', 'w-3.5 h-3.5')} />
            {repo.language}
          </span>
        )}
        <span className="flex items-center gap-1">
          <div className={classNames('i-ph:star', 'w-3.5 h-3.5')} />
          {repo.stargazers_count.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <div className={classNames('i-ph:git-fork', 'w-3.5 h-3.5')} />
          {repo.forks_count.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <div className={classNames('i-ph:clock', 'w-3.5 h-3.5')} />
          {new Date(repo.updated_at).toLocaleDateString()}
        </span>
      </div>
    </motion.button>
  );
}
