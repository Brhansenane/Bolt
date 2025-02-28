import React, { useEffect } from 'react';
import type { GitHubAuthState } from '~/components/@settings/tabs/connections/types/GitHub';
import Cookies from 'js-cookie';
import { getLocalStorage } from '~/lib/persistence';
import '~/styles/components/connection-form.scss';

const GITHUB_CONNECTION_KEY = 'github_connection';

interface ConnectionFormProps {
  authState: GitHubAuthState;
  setAuthState: React.Dispatch<React.SetStateAction<GitHubAuthState>>;
  onSave: (e: React.FormEvent) => void;
  onDisconnect: () => void;
}

export function ConnectionForm({ authState, setAuthState, onSave, onDisconnect }: ConnectionFormProps) {
  // Check for saved token on mount
  useEffect(() => {
    // Try to get the connection from localStorage first
    const savedConnection = getLocalStorage(GITHUB_CONNECTION_KEY);

    if (savedConnection?.token && !authState.tokenInfo?.token) {
      setAuthState((prev: GitHubAuthState) => ({
        ...prev,
        tokenInfo: {
          token: savedConnection.token,
          scope: [],
          avatar_url: savedConnection.user?.avatar_url || '',
          name: savedConnection.user?.name || null,
          created_at: new Date().toISOString(),
          followers: savedConnection.user?.followers || 0,
        },
        username: savedConnection.user?.login || '',
        isConnected: !!savedConnection.user,
      }));
    } else {
      // Fallback to the old cookie method
      const savedToken = Cookies.get('github_token');

      if (savedToken && !authState.tokenInfo?.token) {
        setAuthState((prev: GitHubAuthState) => ({
          ...prev,
          tokenInfo: {
            token: savedToken,
            scope: [],
            avatar_url: '',
            name: null,
            created_at: new Date().toISOString(),
            followers: 0,
          },
        }));
      }
    }
  }, []);

  return (
    <div className="connection-form">
      <div className="form-container">
        <div className="form-header">
          <div className="header-left">
            <div className="icon-container">
              <div className="i-ph:plug-fill header-icon" />
            </div>
            <div className="header-content">
              <h3 className="header-title">Connection Settings</h3>
              <p className="header-description">Configure your GitHub connection</p>
            </div>
          </div>
        </div>

        <form onSubmit={onSave} className="form-fields">
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              GitHub Username
            </label>
            <input
              id="username"
              type="text"
              value={authState.username}
              onChange={(e) => setAuthState((prev: GitHubAuthState) => ({ ...prev, username: e.target.value }))}
              className="form-input"
              placeholder="e.g., octocat"
            />
          </div>

          <div className="form-group">
            <div className="form-label-container">
              <label htmlFor="token" className="form-label">
                Personal Access Token
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,user,read:org,workflow,delete_repo,write:packages,read:packages"
                target="_blank"
                rel="noopener noreferrer"
                className="form-link"
              >
                <span>Generate new token</span>
                <div className="i-ph:plus-circle link-icon" />
              </a>
            </div>
            <input
              id="token"
              type="password"
              value={authState.tokenInfo?.token || ''}
              onChange={(e) =>
                setAuthState((prev: GitHubAuthState) => ({
                  ...prev,
                  tokenInfo: {
                    token: e.target.value,
                    scope: [],
                    avatar_url: '',
                    name: null,
                    created_at: new Date().toISOString(),
                    followers: 0,
                  },
                  username: '',
                  isConnected: false,
                  isVerifying: false,
                  isLoadingRepos: false,
                }))
              }
              className="form-input"
              placeholder="ghp_xxxxxxxxxxxx"
            />
          </div>

          <div className="form-footer">
            <div className="footer-actions">
              {!authState.isConnected ? (
                <button
                  type="submit"
                  disabled={authState.isVerifying || !authState.username || !authState.tokenInfo?.token}
                  className="connect-button"
                >
                  {authState.isVerifying ? (
                    <>
                      <div className="i-ph:spinner spinner" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <div className="i-ph:plug-fill button-icon" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button onClick={onDisconnect} className="disconnect-button">
                    <div className="i-ph:plug-fill button-icon" />
                    <span>Disconnect</span>
                  </button>
                  <span className="connected-badge">
                    <div className="i-ph:check-circle-fill badge-icon" />
                    <span>Connected</span>
                  </span>
                </>
              )}
            </div>
            {authState.rateLimits && (
              <div className="rate-limit">
                <div className="i-ph:clock-countdown clock-icon" />
                <span>Rate limit resets at {authState.rateLimits.reset.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
