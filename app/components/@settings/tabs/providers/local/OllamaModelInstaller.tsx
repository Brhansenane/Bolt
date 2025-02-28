import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Progress } from '~/components/ui/Progress';
import { useToast } from '~/components/ui/use-toast';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { debounce } from '~/utils/debounce';

// Create a CSS module for OllamaModelInstaller styles
import '~/styles/components/ollama.scss';

interface OllamaModelInstallerProps {
  onModelInstalled: () => void;
  baseUrl?: string;
}

interface InstallProgress {
  status: string;
  progress: number;
  downloadedSize?: string;
  totalSize?: string;
  speed?: string;
}

interface ModelInfo {
  name: string;
  desc: string;
  size: string;
  tags: string[];
  installedVersion?: string;
  latestVersion?: string;
  needsUpdate?: boolean;
  status?: 'idle' | 'installing' | 'updating' | 'updated' | 'error';
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

const POPULAR_MODELS: ModelInfo[] = [
  {
    name: 'deepseek-coder:6.7b',
    desc: "DeepSeek's code generation model",
    size: '4.1GB',
    tags: ['coding', 'popular'],
  },
  {
    name: 'llama2:7b',
    desc: "Meta's Llama 2 (7B parameters)",
    size: '3.8GB',
    tags: ['general', 'popular'],
  },
  {
    name: 'mistral:7b',
    desc: "Mistral's 7B model",
    size: '4.1GB',
    tags: ['general', 'popular'],
  },
  {
    name: 'gemma:7b',
    desc: "Google's Gemma model",
    size: '4.0GB',
    tags: ['general', 'new'],
  },
  {
    name: 'codellama:7b',
    desc: "Meta's Code Llama model",
    size: '4.1GB',
    tags: ['coding', 'popular'],
  },
  {
    name: 'neural-chat:7b',
    desc: "Intel's Neural Chat model",
    size: '4.1GB',
    tags: ['chat', 'popular'],
  },
  {
    name: 'phi:latest',
    desc: "Microsoft's Phi-2 model",
    size: '2.7GB',
    tags: ['small', 'fast'],
  },
  {
    name: 'qwen:7b',
    desc: "Alibaba's Qwen model",
    size: '4.1GB',
    tags: ['general'],
  },
  {
    name: 'solar:10.7b',
    desc: "Upstage's Solar model",
    size: '6.1GB',
    tags: ['large', 'powerful'],
  },
  {
    name: 'openchat:7b',
    desc: 'Open-source chat model',
    size: '4.1GB',
    tags: ['chat', 'popular'],
  },
  {
    name: 'dolphin-phi:2.7b',
    desc: 'Lightweight chat model',
    size: '1.6GB',
    tags: ['small', 'fast'],
  },
  {
    name: 'stable-code:3b',
    desc: 'Lightweight coding model',
    size: '1.8GB',
    tags: ['coding', 'small'],
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

// Add Ollama Icon SVG component
function OllamaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} fill="currentColor">
      <path d="M684.3 322.2H339.8c-9.5.1-17.7 6.8-19.6 16.1-8.2 41.4-12.4 83.5-12.4 125.7 0 42.2 4.2 84.3 12.4 125.7 1.9 9.3 10.1 16 19.6 16.1h344.5c9.5-.1 17.7-6.8 19.6-16.1 8.2-41.4 12.4-83.5 12.4-125.7 0-42.2-4.2-84.3-12.4-125.7-1.9-9.3-10.1-16-19.6-16.1zM512 640c-176.7 0-320-143.3-320-320S335.3 0 512 0s320 143.3 320 320-143.3 320-320 320z" />
    </svg>
  );
}

export default function OllamaModelInstaller({
  onModelInstalled,
  baseUrl = 'http://127.0.0.1:11434',
}: OllamaModelInstallerProps) {
  const [modelString, setModelString] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [models, setModels] = useState<ModelInfo[]>(POPULAR_MODELS);
  const [lastCheckedUrl, setLastCheckedUrl] = useState<string>('');
  const [checkError, setCheckError] = useState<string | null>(null);
  const { toast } = useToast();
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to check installed models and their versions with error handling
  const checkInstalledModels = async (url: string, showToast = false) => {
    // Don't check if we're already checking or installing
    if (isChecking || isInstalling) {
      return;
    }

    // Don't recheck if the URL hasn't changed and we've already checked recently
    if (url === lastCheckedUrl && !showToast) {
      return;
    }

    try {
      setIsChecking(true);
      setCheckError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${url}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch installed models: ${response.statusText}`);
      }

      const data = (await response.json()) as { models: Array<{ name: string; digest: string; latest: string }> };
      const installedModels = data.models || [];

      // Update models with installed versions
      setModels((prevModels) =>
        prevModels.map((model) => {
          const installed = installedModels.find((m) => m.name.toLowerCase() === model.name.toLowerCase());

          if (installed) {
            return {
              ...model,
              installedVersion: installed.digest.substring(0, 8),
              needsUpdate: installed.digest !== installed.latest,
              latestVersion: installed.latest?.substring(0, 8),
            };
          }

          return model;
        }),
      );

      setLastCheckedUrl(url);

      if (showToast) {
        toast('Model versions checked');
      }
    } catch (error) {
      console.error('Error checking installed models:', error);
      setCheckError(error instanceof Error ? error.message : 'Unknown error');

      if (showToast) {
        toast('Failed to check model versions');
      }
    } finally {
      setIsChecking(false);
    }
  };

  // Debounced version of checkInstalledModels to prevent too many requests
  const debouncedCheckModels = useRef(
    debounce((url: string) => {
      checkInstalledModels(url, false);
    }, 1000),
  ).current;

  // Check installed models when baseUrl changes
  useEffect(() => {
    if (baseUrl) {
      // Only check models on initial mount or when baseUrl changes
      if (lastCheckedUrl !== baseUrl) {
        debouncedCheckModels(baseUrl);
      }
    }

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [baseUrl]);

  const handleCheckUpdates = async () => {
    await checkInstalledModels(baseUrl, true);
  };

  const filteredModels = models.filter((model) => {
    const matchesSearch =
      searchQuery === '' ||
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => model.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  const handleInstallModel = async (modelToInstall: string) => {
    if (!modelToInstall || isInstalling) {
      return;
    }

    try {
      setIsInstalling(true);
      setInstallProgress({
        status: 'Starting download...',
        progress: 0,
        downloadedSize: '0 B',
        totalSize: 'Calculating...',
        speed: '0 B/s',
      });
      setModelString('');
      setSearchQuery('');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for large models

      const response = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelToInstall }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let lastTime = Date.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if ('status' in data) {
              const currentTime = Date.now();
              const timeDiff = (currentTime - lastTime) / 1000; // Convert to seconds
              const bytesDiff = (data.completed || 0) - lastBytes;
              const speed = bytesDiff / timeDiff;

              setInstallProgress({
                status: data.status,
                progress: data.completed && data.total ? (data.completed / data.total) * 100 : 0,
                downloadedSize: formatBytes(data.completed || 0),
                totalSize: data.total ? formatBytes(data.total) : 'Calculating...',
                speed: formatSpeed(speed),
              });

              lastTime = currentTime;
              lastBytes = data.completed || 0;
            }
          } catch (err) {
            console.error('Error parsing progress:', err);
          }
        }
      }

      toast('Successfully installed ' + modelToInstall + '. The model list will refresh automatically.');

      /*
       * Ensure we call onModelInstalled after successful installation
       * Use a small delay to ensure the server has time to register the new model
       */
      checkTimeoutRef.current = setTimeout(() => {
        // Reset the URL check to force a recheck on next render
        setLastCheckedUrl('');

        // This single call will update both the UI and the model selector
        onModelInstalled();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`Error installing ${modelToInstall}:`, errorMessage);
      toast(`Failed to install ${modelToInstall}. ${errorMessage}`);
    } finally {
      setIsInstalling(false);
      setInstallProgress(null);
    }
  };

  const handleUpdateModel = async (modelToUpdate: string) => {
    if (isInstalling) {
      return;
    }

    try {
      setModels((prev) => prev.map((m) => (m.name === modelToUpdate ? { ...m, status: 'updating' } : m)));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for large models

      const response = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelToUpdate }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let lastTime = Date.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if ('status' in data) {
              const currentTime = Date.now();
              const timeDiff = (currentTime - lastTime) / 1000;
              const bytesDiff = (data.completed || 0) - lastBytes;
              const speed = bytesDiff / timeDiff;

              setInstallProgress({
                status: data.status,
                progress: data.completed && data.total ? (data.completed / data.total) * 100 : 0,
                downloadedSize: formatBytes(data.completed || 0),
                totalSize: data.total ? formatBytes(data.total) : 'Calculating...',
                speed: formatSpeed(speed),
              });

              lastTime = currentTime;
              lastBytes = data.completed || 0;
            }
          } catch (err) {
            console.error('Error parsing progress:', err);
          }
        }
      }

      toast('Successfully updated ' + modelToUpdate);

      // Refresh model list after update
      checkTimeoutRef.current = setTimeout(() => {
        // Reset the URL check to force a recheck
        setLastCheckedUrl('');

        // Check installed models to update the UI
        checkInstalledModels(baseUrl, false);

        // Notify parent component to refresh the model selector
        onModelInstalled();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`Error updating ${modelToUpdate}:`, errorMessage);
      toast(`Failed to update ${modelToUpdate}. ${errorMessage}`);
      setModels((prev) => prev.map((m) => (m.name === modelToUpdate ? { ...m, status: 'error' } : m)));
    } finally {
      setInstallProgress(null);
    }
  };

  // Add a function to handle model deletion
  const handleDeleteModel = async (modelName: string) => {
    if (isInstalling) {
      return;
    }

    try {
      // Update UI to show deletion in progress
      setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'updating' } : m)));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.statusText}`);
      }

      // Remove the model from the local state immediately
      setModels((prev) =>
        prev.map((m) =>
          m.name === modelName
            ? { ...m, installedVersion: undefined, needsUpdate: false, latestVersion: undefined }
            : m,
        ),
      );

      toast(`Successfully deleted ${modelName}`);

      // Force a refresh of the model list
      setLastCheckedUrl(''); // Reset the URL check to force a refresh

      // First immediate refresh
      onModelInstalled();

      // Second refresh after a delay to ensure the model selector is updated
      setTimeout(() => {
        onModelInstalled();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`Error deleting ${modelName}:`, errorMessage);
      toast(`Failed to delete ${modelName}. ${errorMessage}`);

      // Reset the model status
      setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'error' } : m)));
    }
  };

  const allTags = Array.from(new Set(POPULAR_MODELS.flatMap((model) => model.tags)));

  return (
    <div className="ollama-installer">
      <div className="installer-header">
        <div className="installer-title">
          <OllamaIcon className="installer-icon" />
          <div>
            <h3 className="installer-title-text">Ollama Models</h3>
            <p className="installer-subtitle">Install and manage your Ollama models</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckUpdates}
          className={classNames('check-updates-btn', {
            updating: isChecking,
          })}
          disabled={isChecking || isInstalling}
        >
          {isChecking ? (
            <div className="i-ph:spinner-gap-bold animate-spin mr-2" />
          ) : (
            <div className="i-ph:arrows-clockwise mr-2" />
          )}
          Check Updates
        </Button>
      </div>

      {checkError && (
        <div className="connection-error">
          <div className="i-ph:warning-circle error-icon" />
          <span>Connection error: {checkError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => checkInstalledModels(baseUrl, true)}
            className="retry-button"
          >
            Retry
          </Button>
        </div>
      )}

      <div className="search-container">
        <div className="search-input-wrapper">
          <Input
            type="text"
            className="search-input"
            placeholder="Search models or enter custom model name..."
            value={searchQuery || modelString}
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
              setModelString(value);
            }}
            disabled={isInstalling}
          />
          <p className="search-help-text">
            Browse models at{' '}
            <a href="https://ollama.com/library" target="_blank" rel="noopener noreferrer" className="library-link">
              ollama.com/library
              <div className="i-ph:arrow-square-out text-sm" />
            </a>{' '}
            and copy model names to install
          </p>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => handleInstallModel(modelString)}
          className={classNames('install-btn', {
            disabled: !modelString || isInstalling,
          })}
          disabled={!modelString || isInstalling}
        >
          {isInstalling ? (
            <div className="btn-content">
              <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4 mr-2" />
              <span>Installing...</span>
            </div>
          ) : (
            <div className="btn-content">
              <OllamaIcon className="btn-icon mr-2" />
              <span>Install Model</span>
            </div>
          )}
        </Button>
      </div>

      <div className="tag-filters">
        {allTags.map((tag) => (
          <Button
            key={tag}
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
            }}
            className={classNames('tag-filter', {
              active: selectedTags.includes(tag),
            })}
          >
            {tag}
          </Button>
        ))}
      </div>

      <div className="model-grid">
        {isChecking ? (
          <div className="models-loading">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="model-placeholder" />
            ))}
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="models-empty">
            <div className="i-ph:cube-transparent empty-icon" />
            <p className="empty-message">No models found matching your search</p>
            <p className="empty-help">Try a different search term or tag filter</p>
          </div>
        ) : (
          filteredModels.map((model) => (
            <motion.div
              key={model.name}
              className={classNames('model-card', {
                'model-installed': !!model.installedVersion,
                'model-updating': model.status === 'updating',
                'model-error': model.status === 'error',
              })}
            >
              <OllamaIcon className="model-icon" />
              <div className="model-details">
                <div className="model-header">
                  <div>
                    <p className="model-name">{model.name}</p>
                    <p className="model-description">{model.desc}</p>
                  </div>
                  <div className="model-meta">
                    <span className="model-size">{model.size}</span>
                    {model.installedVersion && (
                      <div className="model-version-info">
                        <span className="model-installed-version">v{model.installedVersion}</span>
                        {model.needsUpdate && model.latestVersion && (
                          <span className="model-update-available">v{model.latestVersion} available</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="model-footer">
                  <div className="model-tags">
                    {model.tags.map((tag) => (
                      <span key={tag} className="model-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="model-actions">
                    {model.installedVersion ? (
                      model.needsUpdate ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateModel(model.name)}
                          className="update-model-btn"
                          disabled={model.status === 'updating' || isInstalling}
                        >
                          {model.status === 'updating' ? (
                            <>
                              <div className="i-ph:spinner-gap-bold animate-spin mr-1" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <div className="i-ph:arrows-clockwise mr-1" />
                              Update
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className="model-installed-actions">
                          <span className="model-up-to-date">
                            <div className="i-ph:check-circle mr-1" />
                            Up to date
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete ${model.name}?`)) {
                                handleDeleteModel(model.name);
                              }
                            }}
                            className="delete-model-btn"
                            disabled={model.status === 'updating' || isInstalling}
                          >
                            <div className="i-ph:trash mr-1" />
                            Delete
                          </Button>
                        </div>
                      )
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInstallModel(model.name)}
                        className="install-model-btn"
                        disabled={isInstalling}
                      >
                        <div className="i-ph:download mr-1" />
                        Install
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {installProgress && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="progress-container">
          <div className="progress-info">
            <span className="progress-status">{installProgress.status}</span>
            <div className="progress-stats">
              <span className="progress-size">
                {installProgress.downloadedSize} / {installProgress.totalSize}
              </span>
              <span className="progress-speed">{installProgress.speed}</span>
              <span className="progress-percentage">{Math.round(installProgress.progress)}%</span>
            </div>
          </div>
          <Progress value={installProgress.progress} className="progress-bar" />
        </motion.div>
      )}
    </div>
  );
}
