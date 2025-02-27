import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { getLocalStorage } from '~/lib/persistence';
import { classNames } from '~/utils/classNames';
import type { GitHubUserResponse } from '~/types/GitHub';
import { logStore } from '~/lib/stores/logs';
import { workbenchStore } from '~/lib/stores/workbench';
import { extractRelativePath } from '~/utils/diff';
import { formatSize } from '~/utils/formatSize';
import type { FileMap, File } from '~/lib/stores/files';
import { Octokit } from '@octokit/rest';
import '~/styles/components/push-github-dialog.scss';

interface PushToGitHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPush: (repoName: string, username?: string, token?: string, isPrivate?: boolean) => Promise<string>;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  language: string;
  private: boolean;
}

export function PushToGitHubDialog({ isOpen, onClose, onPush }: PushToGitHubDialogProps) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<GitHubUserResponse | null>(null);
  const [recentRepos, setRecentRepos] = useState<GitHubRepo[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdRepoUrl, setCreatedRepoUrl] = useState('');
  const [pushedFiles, setPushedFiles] = useState<{ path: string; size: number }[]>([]);

  // Load GitHub connection on mount
  useEffect(() => {
    if (isOpen) {
      const connection = getLocalStorage('github_connection');

      if (connection?.user && connection?.token) {
        setUser(connection.user);

        // Only fetch if we have both user and token
        if (connection.token.trim()) {
          fetchRecentRepos(connection.token);
        }
      }
    }
  }, [isOpen]);

  const fetchRecentRepos = async (token: string) => {
    if (!token || token.trim() === '') {
      logStore.logError('No GitHub token available');
      toast.error('GitHub authentication required');

      return;
    }

    // Ensure token is properly formatted
    const cleanToken = token.trim();

    try {
      setIsFetchingRepos(true);

      // Log token format for debugging (only first few characters)
      console.log('Using GitHub token format:', {
        tokenPrefix: cleanToken ? `${cleanToken.substring(0, 4)}...` : 'none',
        authHeader: `token ${cleanToken}`.substring(0, 10) + '...',
      });

      // Use a simpler URL with fewer parameters
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=5', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `token ${cleanToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Log detailed error information
        console.error('GitHub API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          requestUrl: 'https://api.github.com/user/repos?sort=updated&per_page=5',
          tokenPrefix: cleanToken ? cleanToken.substring(0, 4) : 'none',
        });

        if (response.status === 401) {
          toast.error('GitHub token expired. Please reconnect your account.');

          // Clear invalid token
          const connection = getLocalStorage('github_connection');

          if (connection) {
            localStorage.removeItem('github_connection');
            setUser(null);
          }
        } else {
          logStore.logError('Failed to fetch GitHub repositories', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          toast.error(`Failed to fetch repositories: ${response.statusText}`);
        }

        return;
      }

      const repos = (await response.json()) as GitHubRepo[];
      setRecentRepos(repos);
    } catch (error) {
      logStore.logError('Failed to fetch GitHub repositories', { error });
      toast.error('Failed to fetch recent repositories');
    } finally {
      setIsFetchingRepos(false);
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
      const octokit = new Octokit({
        auth: connection.token.trim(),
        request: {
          timeout: 10000,
        },
      });

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

  // Success Dialog
  if (showSuccessDialog) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="github-dialog-overlay" />
          <div
            className="github-dialog-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'fixed',
              inset: 0,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="success-dialog"
              style={{ position: 'relative', maxHeight: '85vh' }}
            >
              <Dialog.Content className="success-content">
                <div className="success-header">
                  <div className="success-title">
                    <div className="i-ph:check-circle success-icon" />
                    <h3>Successfully pushed to GitHub</h3>
                  </div>
                  <Dialog.Close onClick={handleClose} className="close-button">
                    <div className="i-ph:x close-icon" />
                  </Dialog.Close>
                </div>

                <div className="url-section">
                  <p className="section-label">Repository URL</p>
                  <div className="url-container">
                    <code className="url-code">{createdRepoUrl}</code>
                    <motion.button
                      onClick={() => {
                        navigator.clipboard.writeText(createdRepoUrl);
                        toast.success('URL copied to clipboard');
                      }}
                      className="copy-button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <div className="i-ph:copy copy-icon" />
                    </motion.button>
                  </div>
                </div>

                <div className="files-section">
                  <p className="section-label">Pushed Files ({pushedFiles.length})</p>
                  <div className="files-list custom-scrollbar">
                    {pushedFiles.map((file) => (
                      <div key={file.path} className="file-item">
                        <span className="file-path">{file.path}</span>
                        <span className="file-size">{formatSize(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="action-buttons">
                  <motion.a
                    href={createdRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="i-ph:github-logo button-icon" />
                    View Repository
                  </motion.a>
                  <motion.button
                    onClick={() => {
                      navigator.clipboard.writeText(createdRepoUrl);
                      toast.success('URL copied to clipboard');
                    }}
                    className="copy-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="i-ph:copy button-icon" />
                    Copy URL
                  </motion.button>
                  <motion.button
                    onClick={handleClose}
                    className="close-button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Close
                  </motion.button>
                </div>
              </Dialog.Content>
            </motion.div>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (!user) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="github-dialog-overlay" />
          <div
            className="github-dialog-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'fixed',
              inset: 0,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="connection-required-dialog"
              style={{ position: 'relative' }}
            >
              <Dialog.Content>
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="icon-container"
                >
                  <div className="i-ph:github-logo github-icon" />
                </motion.div>
                <h3 className="title">GitHub Connection Required</h3>
                <p className="description">
                  Please connect your GitHub account in Settings {'>'} Connections to push your code to GitHub.
                </p>
                <motion.button
                  className="close-button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClose}
                >
                  <div className="i-ph:x-circle button-icon" />
                  Close
                </motion.button>
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
        <Dialog.Overlay className="github-dialog-overlay" />
        <div
          className="github-dialog-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'fixed',
            inset: 0,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="push-github-dialog"
            style={{ position: 'relative', maxHeight: '85vh' }}
          >
            <Dialog.Content className="dialog-content">
              <div className="dialog-header">
                <div className="header-content">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="icon-container"
                  >
                    <div className="i-ph:git-branch" />
                  </motion.div>
                  <div className="header-text">
                    <Dialog.Title className="dialog-title">Push to GitHub</Dialog.Title>
                    <p className="dialog-subtitle">Push your code to a new or existing GitHub repository</p>
                  </div>
                </div>
                <Dialog.Close className="dialog-close" onClick={handleClose}>
                  <div className="i-ph:x close-icon" />
                </Dialog.Close>
              </div>

              <div className="dialog-body">
                <div className="user-profile">
                  <img src={user.avatar_url} alt={user.login} className="avatar" />
                  <div className="user-info">
                    <p className="user-name">{user.name || user.login}</p>
                    <p className="user-login">@{user.login}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="repoName" className="form-label">
                      Repository Name
                    </label>
                    <input
                      id="repoName"
                      type="text"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="my-awesome-project"
                      className="form-input"
                      required
                    />
                  </div>

                  {recentRepos.length > 0 && (
                    <div className="recent-repos">
                      <label className="section-label">Recent Repositories</label>
                      <div className="repo-list">
                        {recentRepos.map((repo) => (
                          <motion.button
                            key={repo.full_name}
                            type="button"
                            onClick={() => setRepoName(repo.name)}
                            className="repo-item"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className="repo-header">
                              <div className="repo-name-container">
                                <div className="i-ph:git-repository repo-icon" />
                                <span className="repo-name">{repo.name}</span>
                              </div>
                              {repo.private && <span className="repo-privacy">Private</span>}
                            </div>
                            {repo.description && <p className="repo-description">{repo.description}</p>}
                            <div className="repo-meta">
                              {repo.language && (
                                <span className="meta-item">
                                  <div className="i-ph:code meta-icon" />
                                  {repo.language}
                                </span>
                              )}
                              <span className="meta-item">
                                <div className="i-ph:star meta-icon" />
                                {repo.stargazers_count.toLocaleString()}
                              </span>
                              <span className="meta-item">
                                <div className="i-ph:git-fork meta-icon" />
                                {repo.forks_count.toLocaleString()}
                              </span>
                              <span className="meta-item">
                                <div className="i-ph:clock meta-icon" />
                                {new Date(repo.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isFetchingRepos && (
                    <div className="loading-state">
                      <div className="i-ph:spinner-gap-bold spinner-icon" />
                      Loading repositories...
                    </div>
                  )}

                  <div className="form-group">
                    <div className="checkbox-container">
                      <input
                        type="checkbox"
                        id="private"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="checkbox"
                      />
                      <label htmlFor="private" className="checkbox-label">
                        Make repository private
                      </label>
                    </div>
                  </div>

                  <div className="action-buttons">
                    <motion.button
                      type="button"
                      onClick={handleClose}
                      className="cancel-button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={isLoading}
                      className={classNames('submit-button', isLoading ? 'opacity-50 cursor-not-allowed' : '')}
                      whileHover={!isLoading ? { scale: 1.02 } : {}}
                      whileTap={!isLoading ? { scale: 0.98 } : {}}
                    >
                      {isLoading ? (
                        <>
                          <div className="i-ph:spinner-gap-bold animate-spin button-icon" />
                          Pushing...
                        </>
                      ) : (
                        <>
                          <div className="i-ph:git-branch button-icon" />
                          Push to GitHub
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
