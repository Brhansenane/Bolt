import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { getLocalStorage } from '~/lib/persistence';
import { classNames } from '~/utils/classNames';
import type { GitHubUserResponse, GitHubRepoInfo } from '~/types/GitHub';
import { logStore } from '~/lib/stores/logs';
import { workbenchStore } from '~/lib/stores/workbench';
import { extractRelativePath } from '~/utils/diff';
import { formatSize } from '~/utils/formatSize';
import type { FileMap, File } from '~/lib/stores/files';
import { Octokit } from '@octokit/rest';
import { themeTokens } from '~/components/ui/theme/StyleGuide';

interface PushToGitHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPush: (repoName: string, username?: string, token?: string, isPrivate?: boolean) => Promise<string>;
}

interface RepositoryListProps {
  repos: GitHubRepoInfo[];
  isLoading: boolean;
  onSelect: (repo: GitHubRepoInfo) => void;
  selectedRepo: GitHubRepoInfo | null;
}

interface RepositoryCardProps {
  repo: GitHubRepoInfo;
  onSelect: () => void;
  isSelected?: boolean;
}

interface FileSelectionProps {
  files: { path: string; size: number; changed?: boolean; status?: 'modified' | 'added' | 'deleted' }[];
  selectedFiles: Set<string>;
  onFileSelect: (path: string) => void;
  onSelectAll: () => void;
  branch: string;
  onBranchChange: (branch: string) => void;
  branches: string[];
}

function RepositoryList({ repos, isLoading, onSelect, selectedRepo }: RepositoryListProps) {
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
        <p className="mt-2 text-sm">No repositories found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-2">
      {repos.map((repo) => (
        <RepositoryCard
          key={repo.full_name}
          repo={repo}
          onSelect={() => onSelect(repo)}
          isSelected={selectedRepo?.full_name === repo.full_name}
        />
      ))}
    </div>
  );
}

function RepositoryCard({ repo, onSelect, isSelected }: RepositoryCardProps) {
  return (
    <motion.button
      onClick={onSelect}
      className={classNames(
        themeTokens.dialog.section,
        'w-full text-left',
        'hover:' + themeTokens.background.depth3.split(' ')[0],
        'group transition-colors duration-200',
        isSelected ? 'ring-2 ring-purple-500' : '',
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

function FileSelection({
  files,
  selectedFiles,
  onFileSelect,
  onSelectAll,
  branch,
  onBranchChange,
  branches,
}: FileSelectionProps) {
  const changedFiles = files.filter((f) => f.changed);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = changedFiles.filter((file) => file.path.toLowerCase().includes(searchQuery.toLowerCase()));

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'added':
        return 'text-green-500 dark:text-green-400';
      case 'deleted':
        return 'text-red-500 dark:text-red-400';
      case 'modified':
        return 'text-yellow-500 dark:text-yellow-400';
      default:
        return themeTokens.text.secondary;
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'added':
        return 'Added';
      case 'deleted':
        return 'Deleted';
      case 'modified':
        return 'Modified';
      default:
        return 'Changed';
    }
  };

  return (
    <div className="space-y-4">
      <div className={themeTokens.dialog.section}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={classNames('i-ph:git-branch', themeTokens.icon.sizes.sm, themeTokens.icon.colors.accent)} />
            <span className={classNames('text-sm font-medium', themeTokens.text.secondary)}>Target Branch</span>
          </div>
          <div className="relative">
            <select
              value={branch}
              onChange={(e) => onBranchChange(e.target.value)}
              className={classNames(
                themeTokens.branchSelector.base,
                'appearance-none pr-8 pl-4',
                'bg-no-repeat bg-right',
                'bg-[length:12px_8px]',
                'bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik02IDcuNUwxMiAwSDBMNiA3LjVaIiBmaWxsPSIjODA4MDgwIi8+Cjwvc3ZnPgo=")]',
              )}
            >
              {branches.map((b) => (
                <option key={b} value={b} className={themeTokens.branchSelector.option}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={classNames('i-ph:files', themeTokens.icon.sizes.sm, themeTokens.icon.colors.accent)} />
            <span className={classNames('text-sm font-medium', themeTokens.text.secondary)}>
              Changed Files ({changedFiles.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={classNames(themeTokens.input.base, 'h-9 text-sm w-48 pl-9')}
              />
              <div
                className={classNames(
                  'i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2',
                  themeTokens.icon.sizes.sm,
                  themeTokens.icon.colors.secondary,
                )}
              />
            </div>
            <motion.button
              onClick={onSelectAll}
              className={classNames(themeTokens.button.base, themeTokens.button.secondary, 'h-9 text-sm')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={classNames('i-ph:check-square', themeTokens.icon.sizes.sm)} />
              Select All
            </motion.button>
          </div>
        </div>

        <div className={classNames('space-y-2 max-h-[calc(90vh-500px)] overflow-y-auto pr-2', themeTokens.scrollbar)}>
          {filteredFiles.length === 0 ? (
            <div className={classNames('py-8 text-center', themeTokens.text.secondary)}>
              <div className={classNames('i-ph:file-x', themeTokens.icon.sizes.lg, 'mx-auto opacity-50')} />
              <p className="mt-2 text-sm">{searchQuery ? 'No files match your search' : 'No changed files found'}</p>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <motion.div
                key={file.path}
                className={classNames(
                  themeTokens.dialog.section,
                  'flex items-center justify-between group',
                  'cursor-pointer transition-all duration-200',
                  selectedFiles.has(file.path) ? 'ring-2 ring-[#E5E5E5] dark:ring-[#333333]' : '',
                )}
                onClick={() => onFileSelect(file.path)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.path)}
                        onChange={() => onFileSelect(file.path)}
                        className={themeTokens.checkbox.base}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {selectedFiles.has(file.path) && (
                        <div className={classNames('i-ph:check', themeTokens.checkbox.checkmark)} />
                      )}
                    </div>
                    <div
                      className={classNames('i-ph:file-text', themeTokens.icon.sizes.sm, getStatusColor(file.status))}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={classNames('text-sm font-mono truncate block', themeTokens.text.primary)}>
                      {file.path}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={classNames(
                          'text-xs px-2 py-0.5 rounded-full',
                          file.status === 'added'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : file.status === 'deleted'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
                        )}
                      >
                        {getStatusLabel(file.status)}
                      </span>
                      <span className={classNames('text-xs', themeTokens.text.tertiary)}>{formatSize(file.size)}</span>
                    </div>
                  </div>
                </div>
                <div
                  className={classNames(
                    'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                    themeTokens.text.secondary,
                  )}
                >
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();

                      // Add view diff functionality
                    }}
                    className={themeTokens.iconButton.base}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <div className={classNames('i-ph:git-diff', themeTokens.icon.sizes.sm)} />
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function PushToGitHubDialog({ isOpen, onClose, onPush }: PushToGitHubDialogProps) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<GitHubUserResponse | null>(null);
  const [recentRepos, setRecentRepos] = useState<GitHubRepoInfo[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdRepoUrl, setCreatedRepoUrl] = useState('');
  const [pushedFiles, setPushedFiles] = useState<{ path: string; size: number }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoInfo | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [changedFiles, setChangedFiles] = useState<{ path: string; size: number; changed: boolean }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>(['main']);

  useEffect(() => {
    if (isOpen) {
      const connection = getLocalStorage('github_connection');

      if (connection?.user && connection?.token) {
        setUser(connection.user);

        if (connection.token.trim()) {
          fetchRecentRepos(connection.token);
        }
      }
    }
  }, [isOpen]);

  const fetchRecentRepos = async (token: string) => {
    if (!token) {
      logStore.logError('No GitHub token available');
      toast.error('GitHub authentication required');

      return;
    }

    setIsFetchingRepos(true);

    try {
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100&type=all', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();

      if (
        Array.isArray(data) &&
        data.every((item) => typeof item === 'object' && item !== null && 'full_name' in item)
      ) {
        setRecentRepos(data as GitHubRepoInfo[]);
      } else {
        throw new Error('Invalid repository data format');
      }
    } catch (error) {
      console.error('Error fetching repos:', error);
      toast.error('Failed to fetch your repositories');
    } finally {
      setIsFetchingRepos(false);
    }
  };

  const fetchBranches = async (repo: GitHubRepoInfo, token: string) => {
    try {
      const response = await fetch(`https://api.github.com/repos/${repo.full_name}/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setBranches(data.map((b) => b.name));
        setSelectedBranch(repo.default_branch || 'main');
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to fetch repository branches');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const connection = getLocalStorage('github_connection');

    if (!connection?.token || !connection?.user) {
      toast.error('Please connect your GitHub account in Settings > Connections first');
      return;
    }

    if (!repoName.trim()) {
      toast.error('Repository name is required');
      return;
    }

    setIsLoading(true);

    try {
      // Check if repository exists first
      const octokit = new Octokit({ auth: connection.token });

      try {
        await octokit.repos.get({
          owner: connection.user.login,
          repo: repoName,
        });

        // If we get here, the repo exists
        const confirmOverwrite = window.confirm(
          `Repository "${repoName}" already exists. Do you want to update it? This will add or modify files in the repository.`,
        );

        if (!confirmOverwrite) {
          setIsLoading(false);
          return;
        }
      } catch (error) {
        // 404 means repo doesn't exist, which is what we want for new repos
        if (error instanceof Error && 'status' in error && error.status !== 404) {
          throw error;
        }
      }

      const repoUrl = await onPush(repoName, connection.user.login, connection.token, isPrivate);
      setCreatedRepoUrl(repoUrl);

      // Get list of pushed files
      const files = workbenchStore.files.get();
      const filesList = Object.entries(files as FileMap)
        .filter(([, dirent]) => dirent?.type === 'file' && !dirent.isBinary)
        .map(([path, dirent]) => ({
          path: extractRelativePath(path),
          size: new TextEncoder().encode((dirent as File).content || '').length,
        }));

      setPushedFiles(filesList);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      toast.error('Failed to push to GitHub. Please check your repository name and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setRepoName('');
    setIsPrivate(false);
    setShowSuccessDialog(false);
    setCreatedRepoUrl('');
    onClose();
  };

  useEffect(() => {
    if (selectedRepo) {
      // Get list of changed files
      const files = workbenchStore.files.get();
      const filesList = Object.entries(files as FileMap)
        .filter(([, dirent]) => dirent?.type === 'file' && !dirent.isBinary)
        .map(([path, dirent]) => ({
          path: extractRelativePath(path),
          size: new TextEncoder().encode((dirent as File).content || '').length,
          changed: true, // You'll need to implement actual change detection here
        }));

      setChangedFiles(filesList);
      setSelectedFiles(new Set(filesList.map((f) => f.path))); // Select all by default
    }
  }, [selectedRepo]);

  const handleRepoSelect = async (repo: GitHubRepoInfo) => {
    setSelectedRepo(repo);
    setRepoName(repo.name);

    const connection = getLocalStorage('github_connection');

    if (connection?.token) {
      await fetchBranches(repo, connection.token);
    }
  };

  const handleFileSelect = (path: string) => {
    const newSelected = new Set(selectedFiles);

    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }

    setSelectedFiles(newSelected);
  };

  const handleSelectAllFiles = () => {
    const allFiles = new Set(changedFiles.filter((f) => f.changed).map((f) => f.path));

    setSelectedFiles(allFiles);
  };

  // Success Dialog
  if (showSuccessDialog) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className={themeTokens.dialog.overlay} />
          <Dialog.Content className={classNames(themeTokens.dialog.content, 'max-h-[90vh] flex flex-col')}>
            <div className={themeTokens.dialog.header}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={classNames('i-ph:check-circle', themeTokens.icon.sizes.md, 'text-green-500')} />
                  <Dialog.Title className={classNames('text-xl font-semibold', themeTokens.text.primary)}>
                    Successfully pushed to GitHub
                  </Dialog.Title>
                </div>
                <Dialog.Close onClick={handleClose} className={themeTokens.dialog.close}>
                  <div className={classNames('i-ph:x', themeTokens.icon.sizes.md)} />
                </Dialog.Close>
              </div>
            </div>

            <div className={classNames(themeTokens.dialog.body, 'flex-1 overflow-y-auto min-h-0')}>
              <div className="space-y-4">
                <div className={themeTokens.dialog.section}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={classNames('i-ph:link', themeTokens.icon.sizes.sm, themeTokens.icon.colors.accent)}
                    />
                    <p className={classNames('text-sm font-medium', themeTokens.text.secondary)}>Repository URL</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className={classNames('flex-1 text-sm px-3 py-2 rounded-xl font-mono', themeTokens.input.base)}
                    >
                      {createdRepoUrl}
                    </code>
                    <motion.button
                      onClick={() => {
                        navigator.clipboard.writeText(createdRepoUrl);
                        toast.success('URL copied to clipboard');
                      }}
                      className={themeTokens.dialog.close}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <div className={classNames('i-ph:copy', themeTokens.icon.sizes.sm)} />
                    </motion.button>
                  </div>
                </div>

                <div className={themeTokens.dialog.section}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={classNames('i-ph:files', themeTokens.icon.sizes.sm, themeTokens.icon.colors.accent)}
                    />
                    <p className={classNames('text-sm font-medium', themeTokens.text.secondary)}>
                      Pushed Files ({pushedFiles.length})
                    </p>
                  </div>
                  <div className={classNames('max-h-[240px] overflow-y-auto pr-2', themeTokens.scrollbar)}>
                    {pushedFiles.map((file) => (
                      <div
                        key={file.path}
                        className={classNames(
                          'flex items-center justify-between py-2',
                          'border-b last:border-b-0',
                          themeTokens.border.base,
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={classNames(
                              'i-ph:file-text',
                              themeTokens.icon.sizes.sm,
                              themeTokens.icon.colors.secondary,
                            )}
                          />
                          <span className={classNames('font-mono text-sm truncate', themeTokens.text.primary)}>
                            {file.path}
                          </span>
                        </div>
                        <span className={classNames('text-xs ml-2', themeTokens.text.secondary)}>
                          {formatSize(file.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <motion.a
                    href={createdRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(themeTokens.button.base, themeTokens.button.primary)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={classNames('i-ph:github-logo', themeTokens.icon.sizes.sm)} />
                    View Repository
                  </motion.a>
                  <motion.button
                    onClick={() => {
                      navigator.clipboard.writeText(createdRepoUrl);
                      toast.success('URL copied to clipboard');
                    }}
                    className={classNames(themeTokens.button.base, themeTokens.button.secondary)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={classNames('i-ph:copy', themeTokens.icon.sizes.sm)} />
                    Copy URL
                  </motion.button>
                  <motion.button
                    onClick={handleClose}
                    className={classNames(themeTokens.button.base, themeTokens.button.secondary)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Close
                  </motion.button>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (!user) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
                <div className={themeTokens.dialog.body}>
                  <div className="text-center space-y-4">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className={classNames(
                        'mx-auto w-12 h-12 rounded-xl flex items-center justify-center',
                        themeTokens.background.depth2,
                      )}
                    >
                      <div
                        className={classNames(
                          'i-ph:github-logo',
                          themeTokens.icon.sizes.lg,
                          themeTokens.icon.colors.accent,
                        )}
                      />
                    </motion.div>
                    <h3 className={classNames('text-lg font-medium', themeTokens.text.primary)}>
                      GitHub Connection Required
                    </h3>
                    <p className={classNames('text-sm', themeTokens.text.secondary)}>
                      Please connect your GitHub account in Settings {'>'} Connections to push your code to GitHub.
                    </p>
                    <motion.button
                      className={classNames(themeTokens.button.base, themeTokens.button.primary, 'text-sm')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClose}
                    >
                      <div className={classNames('i-ph:x-circle', themeTokens.icon.sizes.sm)} />
                      Close
                    </motion.button>
                  </div>
                </div>
              </Dialog.Content>
            </motion.div>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={themeTokens.dialog.overlay} />
        <Dialog.Content className={classNames(themeTokens.dialog.content, 'max-h-[90vh] flex flex-col')}>
          <div className={themeTokens.dialog.header}>
            <div className="flex items-center justify-between">
              <Dialog.Title className={classNames('text-xl font-semibold', themeTokens.text.primary)}>
                {selectedRepo ? 'Push to Repository' : 'Select Repository'}
              </Dialog.Title>
              {selectedRepo && (
                <motion.button
                  onClick={() => setSelectedRepo(null)}
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

          <div className={classNames(themeTokens.dialog.body, 'flex-1 overflow-y-auto min-h-0')}>
            <div className="space-y-6">
              <div className={themeTokens.dialog.section}>
                <div className="flex items-center gap-3">
                  <img src={user.avatar_url} alt={user.login} className="w-10 h-10 rounded-full" />
                  <div>
                    <div className={classNames('text-sm font-medium', themeTokens.text.primary)}>
                      {user.name || user.login}
                    </div>
                    <div className={classNames('text-xs', themeTokens.text.secondary)}>@{user.login}</div>
                  </div>
                </div>
              </div>

              {!selectedRepo ? (
                <div className={classNames('max-h-[calc(90vh-300px)] overflow-y-auto pr-2', themeTokens.scrollbar)}>
                  <RepositoryList
                    repos={recentRepos}
                    isLoading={isFetchingRepos}
                    onSelect={handleRepoSelect}
                    selectedRepo={selectedRepo}
                  />
                </div>
              ) : (
                <>
                  <div className={themeTokens.dialog.section}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={classNames(
                            'i-ph:git-repository',
                            themeTokens.icon.sizes.sm,
                            themeTokens.icon.colors.accent,
                          )}
                        />
                        <span className={classNames('text-sm font-medium', themeTokens.text.primary)}>
                          {selectedRepo.full_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <FileSelection
                    files={changedFiles}
                    selectedFiles={selectedFiles}
                    onFileSelect={handleFileSelect}
                    onSelectAll={handleSelectAllFiles}
                    branch={selectedBranch}
                    onBranchChange={setSelectedBranch}
                    branches={branches}
                  />

                  <div className={themeTokens.dialog.section}>
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        id="private"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className={themeTokens.checkbox.base}
                      />
                      {isPrivate && <div className={classNames('i-ph:check', themeTokens.checkbox.checkmark)} />}
                      <label
                        htmlFor="private"
                        className={classNames(
                          'flex items-center gap-2 ml-2',
                          'text-sm select-none cursor-pointer',
                          'text-[#666666] dark:text-[#A0A0A0]',
                          'hover:text-[#111111] dark:hover:text-[#FFFFFF]',
                          'transition-colors duration-200',
                        )}
                      >
                        <div className={classNames('i-ph:lock-simple', themeTokens.icon.sizes.sm)} />
                        Make repository private
                      </label>
                    </div>
                  </div>
                </>
              )}

              {selectedRepo && (
                <motion.button
                  type="submit"
                  disabled={isLoading || selectedFiles.size === 0}
                  onClick={handleSubmit}
                  className={classNames(
                    themeTokens.button.base,
                    themeTokens.button.primary,
                    'w-full',
                    isLoading || selectedFiles.size === 0 ? 'opacity-50 cursor-not-allowed' : '',
                  )}
                  whileHover={!isLoading ? { scale: 1.02 } : {}}
                  whileTap={!isLoading ? { scale: 0.98 } : {}}
                >
                  {isLoading ? (
                    <>
                      <div className={classNames('i-ph:circle-notch animate-spin', themeTokens.icon.sizes.md)} />
                      <span>Pushing to {selectedBranch}...</span>
                    </>
                  ) : (
                    <>
                      <div className={classNames('i-ph:git-branch', themeTokens.icon.sizes.md)} />
                      <span>
                        Push {selectedFiles.size} files to {selectedBranch}
                      </span>
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
