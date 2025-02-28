import type { GitHubRepoInfo, GitHubContent, RepositoryStats } from '~/types/GitHub';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import * as Dialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { getLocalStorage } from '~/lib/persistence';
import { motion } from 'framer-motion';
import { formatSize } from '~/utils/formatSize';
import { Input } from '~/components/ui/Input';
import '~/styles/components/repository-dialog.scss';

interface GitHubTreeResponse {
  tree: Array<{
    path: string;
    type: string;
    size?: number;
  }>;
}

interface RepositorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

interface SearchFilters {
  language?: string;
  stars?: number;
  forks?: number;
}

interface StatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: RepositoryStats;
  isLargeRepo?: boolean;
}

function StatsDialog({ isOpen, onClose, onConfirm, stats, isLargeRepo }: StatsDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <div
          className="dialog-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[90vw] md:w-[500px]"
          >
            <Dialog.Content
              className="stats-dialog"
              onEscapeKeyDown={(_e) => {
                onClose();
              }}
              onPointerDownOutside={(e) => {
                e.preventDefault();
              }}
            >
              <div className="stats-content">
                <div className="stats-body">
                  <div>
                    <h3 className="stats-title">Repository Overview</h3>
                    <div className="stats-section">
                      <p className="section-title">Repository Statistics:</p>
                      <div className="stats-list">
                        <div className="stats-item">
                          <span className="i-ph:files stats-icon" />
                          <span>Total Files: {stats.totalFiles}</span>
                        </div>
                        <div className="stats-item">
                          <span className="i-ph:database stats-icon" />
                          <span>Total Size: {formatSize(stats.totalSize)}</span>
                        </div>
                        <div className="stats-item">
                          <span className="i-ph:code stats-icon" />
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
                          <div className="stats-item">
                            <span className="i-ph:package stats-icon" />
                            <span>Has package.json</span>
                          </div>
                        )}
                        {stats.hasDependencies && (
                          <div className="stats-item">
                            <span className="i-ph:tree-structure stats-icon" />
                            <span>Has dependencies</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isLargeRepo && (
                      <div className="warning-box">
                        <span className="i-ph:warning warning-icon" />
                        <div className="warning-text">
                          This repository is quite large ({formatSize(stats.totalSize)}). Importing it might take a
                          while and could impact performance.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="stats-footer">
                  <button onClick={onClose} className="cancel-button">
                    Cancel
                  </button>
                  <button onClick={onConfirm} className="confirm-button">
                    Import Repository
                  </button>
                </div>
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
  const [isLoading, setIsLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepoInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GitHubRepoInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'my-repos' | 'search' | 'url'>('my-repos');
  const [customUrl, setCustomUrl] = useState('');
  const [branches, setBranches] = useState<{ name: string; default?: boolean }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stats, setStats] = useState<RepositoryStats | null>(null);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [currentStats, setCurrentStats] = useState<RepositoryStats | null>(null);
  const [pendingGitUrl, setPendingGitUrl] = useState<string>('');

  // Add debugging to log when the dialog opens or closes
  useEffect(() => {
    console.log('RepositorySelectionDialog isOpen changed:', isOpen);

    // When dialog opens, fetch repositories if needed
    if (isOpen && activeTab === 'my-repos') {
      console.log('Fetching user repositories...');
      fetchUserRepos();
    }

    // Force a re-render when isOpen changes to ensure the dialog state is updated
    const forceUpdate = setTimeout(() => {
      console.log('Force update after isOpen change:', isOpen);
    }, 50);

    return () => clearTimeout(forceUpdate);
  }, [isOpen, activeTab]);

  const fetchUserRepos = async () => {
    const connection = getLocalStorage('github_connection');
    console.log('GitHub connection in fetchUserRepos:', {
      exists: !!connection,
      hasToken: !!connection?.token,
      hasUser: !!connection?.user,
    });

    if (!connection?.token) {
      toast.error('Please connect your GitHub account first');

      // Show a more helpful message in the UI instead of just a toast
      setRepositories([]);
      setIsLoading(false);

      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
        headers: {
          Authorization: `token ${connection.token}`,
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

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setSearchResults([]);

    try {
      let searchQuery = query;

      if (filters.language) {
        searchQuery += ` language:${filters.language}`;
      }

      if (filters.stars) {
        searchQuery += ` stars:>${filters.stars}`;
      }

      if (filters.forks) {
        searchQuery += ` forks:>${filters.forks}`;
      }

      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${getLocalStorage('github_connection')?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to search repositories');
      }

      const data = await response.json();

      // Add type assertion and validation
      if (typeof data === 'object' && data !== null && 'items' in data && Array.isArray(data.items)) {
        setSearchResults(data.items as GitHubRepoInfo[]);
      } else {
        throw new Error('Invalid search results format');
      }
    } catch (error) {
      console.error('Error searching repos:', error);
      toast.error('Failed to search repositories');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async (repo: GitHubRepoInfo) => {
    setIsLoading(true);

    try {
      const response = await fetch(`https://api.github.com/repos/${repo.full_name}/branches`, {
        headers: {
          Authorization: `token ${getLocalStorage('github_connection')?.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const data = await response.json();

      // Add type assertion and validation
      if (Array.isArray(data) && data.every((item) => typeof item === 'object' && item !== null && 'name' in item)) {
        setBranches(
          data.map((branch) => ({
            name: branch.name,
            default: branch.name === repo.default_branch,
          })),
        );
      } else {
        throw new Error('Invalid branch data format');
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to fetch branches');
    } finally {
      setIsLoading(false);
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

  const verifyRepository = async (repoUrl: string): Promise<RepositoryStats | null> => {
    try {
      const [owner, repo] = repoUrl
        .replace(/\.git$/, '')
        .split('/')
        .slice(-2);

      console.log('Verifying repository:', { owner, repo });

      const connection = getLocalStorage('github_connection');
      const headers: HeadersInit = connection?.token ? { Authorization: `token ${connection.token}` } : {};

      // Try main branch first
      let treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
        headers,
      });

      // If main branch doesn't exist, try master branch
      if (!treeResponse.ok && treeResponse.status === 404) {
        console.log('Main branch not found, trying master branch');
        treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`, {
          headers,
        });
      }

      if (!treeResponse.ok) {
        console.error('Failed to fetch repository structure:', {
          status: treeResponse.status,
          statusText: treeResponse.statusText,
        });
        throw new Error(`Failed to fetch repository structure: ${treeResponse.statusText}`);
      }

      const treeData = (await treeResponse.json()) as GitHubTreeResponse;
      console.log('Repository tree data:', {
        truncated: treeData.tree?.length > 100 ? 'true (showing first 5)' : 'false',
        sampleFiles: treeData.tree?.slice(0, 5).map((f) => f.path),
      });

      // Calculate repository stats
      let totalSize = 0;
      let totalFiles = 0;
      const languages: { [key: string]: number } = {};
      let hasPackageJson = false;
      let hasDependencies = false;

      for (const file of treeData.tree) {
        if (file.type === 'blob') {
          totalFiles++;

          if (file.size) {
            totalSize += file.size;
          }

          // Check for package.json
          if (file.path === 'package.json') {
            hasPackageJson = true;

            // Fetch package.json content to check dependencies
            const contentResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
              headers,
            });

            if (contentResponse.ok) {
              const content = (await contentResponse.json()) as GitHubContent;
              const packageJson = JSON.parse(Buffer.from(content.content, 'base64').toString());
              hasDependencies = !!(
                packageJson.dependencies ||
                packageJson.devDependencies ||
                packageJson.peerDependencies
              );
            }
          }

          // Detect language based on file extension
          const ext = file.path.split('.').pop()?.toLowerCase();

          if (ext) {
            languages[ext] = (languages[ext] || 0) + (file.size || 0);
          }
        }
      }

      const stats: RepositoryStats = {
        totalFiles,
        totalSize,
        languages,
        hasPackageJson,
        hasDependencies,
      };

      setStats(stats);

      return stats;
    } catch (error) {
      console.error('Error verifying repository:', error);
      toast.error('Failed to verify repository');

      return null;
    }
  };

  const handleImport = async () => {
    try {
      let gitUrl: string;

      if (activeTab === 'url' && customUrl) {
        gitUrl = formatGitUrl(customUrl);
      } else if (selectedRepository) {
        gitUrl = formatGitUrl(selectedRepository.html_url);

        if (selectedBranch) {
          gitUrl = `${gitUrl}#${selectedBranch}`;
        }
      } else {
        return;
      }

      // Verify repository before importing
      const stats = await verifyRepository(gitUrl);

      if (!stats) {
        return;
      }

      setCurrentStats(stats);
      setPendingGitUrl(gitUrl);
      setShowStatsDialog(true);
    } catch (error) {
      console.error('Error preparing repository:', error);
      toast.error('Failed to prepare repository. Please try again.');
    }
  };

  const handleStatsConfirm = () => {
    console.log('Stats dialog confirmed, importing repository:', pendingGitUrl);
    setShowStatsDialog(false);

    if (pendingGitUrl) {
      // Add a small delay to ensure the stats dialog is fully closed before proceeding
      setTimeout(() => {
        onSelect(pendingGitUrl);
        onClose();
      }, 100);
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    let parsedValue: string | number | undefined = value;

    if (key === 'stars' || key === 'forks') {
      parsedValue = value ? parseInt(value, 10) : undefined;
    }

    setFilters((prev) => ({ ...prev, [key]: parsedValue }));
    handleSearch(searchQuery);
  };

  // Handle dialog close properly
  const handleClose = () => {
    console.log('handleClose called in RepositorySelectionDialog');
    setIsLoading(false); // Reset loading state
    setSearchQuery(''); // Reset search
    setSearchResults([]); // Reset results

    // Call the parent's onClose callback
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        console.log('Dialog onOpenChange:', open);

        /*
         * Only handle close events from the dialog itself
         * Don't handle open events to prevent immediate closing
         */
        if (isOpen && !open) {
          handleClose();
        }
      }}
      modal={true}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="repository-dialog"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            maxHeight: '85vh',
            width: '90vw',
            maxWidth: '600px',
            zIndex: 10000,
          }}
          onEscapeKeyDown={(_e) => {
            console.log('Escape key pressed');
            handleClose();
          }}
          onPointerDownOutside={(e) => {
            // Only prevent closing in specific cases
            if (showStatsDialog) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            console.log('Interact outside');

            // Only prevent interaction in specific cases
            if (showStatsDialog) {
              e.preventDefault();
            }
          }}
          aria-describedby="repo-dialog-description"
        >
          <div className="dialog-content">
            <div className="dialog-header">
              <Dialog.Title className="dialog-title">Import GitHub Repository</Dialog.Title>
              <button
                type="button"
                onClick={(e) => {
                  console.log('Close button clicked');
                  e.preventDefault();
                  e.stopPropagation();
                  handleClose();
                }}
                className="dialog-close"
              >
                <span className="i-ph:x close-icon" aria-hidden="true" />
                <span className="sr-only">Close dialog</span>
              </button>
            </div>

            <div className="dialog-body">
              <Dialog.Description id="repo-dialog-description" className="sr-only">
                Browse and select a GitHub repository to clone
              </Dialog.Description>

              <div className="tab-navigation">
                <TabButton active={activeTab === 'my-repos'} onClick={() => setActiveTab('my-repos')}>
                  <span className="i-ph:book-bookmark tab-icon" />
                  My Repos
                </TabButton>
                <TabButton active={activeTab === 'search'} onClick={() => setActiveTab('search')}>
                  <span className="i-ph:magnifying-glass tab-icon" />
                  Search
                </TabButton>
                <TabButton active={activeTab === 'url'} onClick={() => setActiveTab('url')}>
                  <span className="i-ph:link tab-icon" />
                  URL
                </TabButton>
              </div>

              {activeTab === 'url' ? (
                <div className="url-section">
                  <Input
                    placeholder="Enter repository URL"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="url-input"
                  />
                  <button onClick={handleImport} disabled={!customUrl} className="import-button">
                    Import Repository
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'search' && (
                    <div className="search-section">
                      <div className="search-row">
                        <input
                          type="text"
                          placeholder="Search repositories..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleSearch(e.target.value);
                          }}
                          className="search-input"
                        />
                        <button onClick={() => setFilters({})} className="filter-button">
                          <span className="i-ph:funnel-simple" />
                        </button>
                      </div>
                      <div className="filter-grid">
                        <input
                          type="text"
                          placeholder="Filter by language..."
                          value={filters.language || ''}
                          onChange={(e) => {
                            setFilters({ ...filters, language: e.target.value });
                            handleSearch(searchQuery);
                          }}
                          className="filter-input"
                        />
                        <input
                          type="number"
                          placeholder="Min stars..."
                          value={filters.stars || ''}
                          onChange={(e) => handleFilterChange('stars', e.target.value)}
                          className="filter-input"
                        />
                      </div>
                      <input
                        type="number"
                        placeholder="Min forks..."
                        value={filters.forks || ''}
                        onChange={(e) => handleFilterChange('forks', e.target.value)}
                        className="filter-input"
                      />
                    </div>
                  )}

                  <div className="repository-list">
                    {selectedRepository ? (
                      <div className="branch-selection">
                        <div className="branch-header">
                          <button onClick={() => setSelectedRepository(null)} className="back-button">
                            <span className="i-ph:arrow-left back-icon" />
                          </button>
                          <h3 className="repo-title">{selectedRepository.full_name}</h3>
                        </div>
                        <div className="branch-form">
                          <label className="branch-label">Select Branch</label>
                          <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="branch-select"
                          >
                            {branches.map((branch) => (
                              <option key={branch.name} value={branch.name} className="branch-option">
                                {branch.name} {branch.default ? '(default)' : ''}
                              </option>
                            ))}
                          </select>
                          <button onClick={handleImport} className="import-button">
                            Import Selected Branch
                          </button>
                        </div>
                      </div>
                    ) : (
                      <RepositoryList
                        repos={activeTab === 'my-repos' ? repositories : searchResults}
                        isLoading={isLoading}
                        onSelect={handleRepoSelect}
                        activeTab={activeTab}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
      {currentStats && (
        <StatsDialog
          isOpen={showStatsDialog}
          onClose={handleStatsConfirm}
          onConfirm={handleStatsConfirm}
          stats={currentStats}
          isLargeRepo={currentStats.totalSize > 50 * 1024 * 1024}
        />
      )}
    </Dialog.Root>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={classNames('tab-button', active ? 'active' : 'inactive')}>
      {children}
    </button>
  );
}

function RepositoryList({
  repos,
  isLoading,
  onSelect,
  activeTab,
}: {
  repos: GitHubRepoInfo[];
  isLoading: boolean;
  onSelect: (repo: GitHubRepoInfo) => void;
  activeTab: string;
}) {
  const connection = getLocalStorage('github_connection');
  const hasGitHubConnection = !!connection?.token && !!connection?.user;

  if (isLoading) {
    return (
      <div className="loading-state">
        <span className="i-ph:spinner spinner-icon" />
        Loading repositories...
      </div>
    );
  }

  if (!hasGitHubConnection && activeTab === 'my-repos') {
    return (
      <div className="empty-state">
        <span className="i-ph:github-logo empty-icon" />
        <p className="mb-2">GitHub connection required</p>
        <p className="text-xs text-bolt-elements-textSecondary mb-3">
          To access your repositories, you need to connect your GitHub account first.
        </p>
        <a
          href="/settings/connections"
          className="px-3 py-1.5 text-xs bg-purple-500 text-white rounded-md inline-flex items-center gap-1 hover:bg-purple-600 transition-colors"
        >
          <span className="i-ph:plug-charging w-3.5 h-3.5" />
          Connect GitHub Account
        </a>
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="empty-state">
        <span className="i-ph:folder-simple-dashed empty-icon" />
        <p>{activeTab === 'my-repos' ? 'No repositories found' : 'Search for repositories'}</p>
      </div>
    );
  }

  return repos.map((repo) => <RepositoryCard key={repo.full_name} repo={repo} onSelect={() => onSelect(repo)} />);
}

function RepositoryCard({ repo, onSelect }: { repo: GitHubRepoInfo; onSelect: () => void }) {
  return (
    <div className="repository-card">
      <div className="card-header">
        <div className="repo-info">
          <span className="i-ph:git-repository repo-icon" />
          <h3 className="repo-name">{repo.name}</h3>
        </div>
        <button onClick={onSelect} className="import-button">
          <span className="i-ph:download-simple import-icon" />
          Import
        </button>
      </div>
      {repo.description && <p className="repo-description">{repo.description}</p>}
      <div className="repo-meta">
        {repo.language && (
          <span className="meta-item">
            <span className="i-ph:code meta-icon" />
            {repo.language}
          </span>
        )}
        <span className="meta-item">
          <span className="i-ph:star meta-icon" />
          {repo.stargazers_count.toLocaleString()}
        </span>
        <span className="meta-item">
          <span className="i-ph:clock meta-icon" />
          {new Date(repo.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
