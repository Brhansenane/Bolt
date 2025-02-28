import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { LOCAL_PROVIDERS, URL_CONFIGURABLE_PROVIDERS } from '~/lib/stores/settings';
import type { IProviderConfig } from '~/types/model';
import { logStore } from '~/lib/stores/logs';
import { motion, AnimatePresence } from 'framer-motion';
import { BsRobot } from 'react-icons/bs';
import type { IconType } from 'react-icons';
import { TbBrandOpenai } from 'react-icons/tb';
import { providerBaseUrlEnvKeys } from '~/utils/constants';
import { useToast } from '~/components/ui/use-toast';
import { Progress } from '~/components/ui/Progress';
import OllamaModelInstaller from './OllamaModelInstaller';
import { classNames } from '~/utils/classNames';
import { FaServer } from 'react-icons/fa';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { FiLink, FiCheck, FiX, FiEdit2, FiWifi, FiWifiOff } from 'react-icons/fi';

// Add type for provider names to ensure type safety
type ProviderName = 'Ollama' | 'LMStudio' | 'OpenAILike';

// Update the PROVIDER_ICONS type to use the ProviderName type
const PROVIDER_ICONS: Record<ProviderName, IconType> = {
  Ollama: BsRobot,
  LMStudio: BsRobot,
  OpenAILike: TbBrandOpenai,
};

// Update PROVIDER_DESCRIPTIONS to use the same type
const PROVIDER_DESCRIPTIONS: Record<ProviderName, string> = {
  Ollama: 'Run open-source models locally on your machine',
  LMStudio: 'Local model inference with LM Studio',
  OpenAILike: 'Connect to OpenAI-compatible API endpoints',
};

// Add a constant for the Ollama API base URL
const OLLAMA_API_URL = 'http://127.0.0.1:11434';

// Add connection check endpoints for each provider
const PROVIDER_CONNECTION_ENDPOINTS: Record<string, string> = {
  Ollama: '/api/tags',
  LMStudio: '/v1/models',
  OpenAILike: '/v1/models',
};

// Add connection status type
type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'unknown';

// Add interface for connection status tracking
interface ProviderConnectionStatus {
  status: ConnectionStatus;
  lastChecked: number;
  error?: string;
}

// Add type for connection status map
type ConnectionStatusMap = Record<string, ProviderConnectionStatus>;

interface OllamaModel {
  name: string;
  digest: string;
  size: number;
  modified_at: string;
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
  status?: 'idle' | 'updating' | 'updated' | 'error' | 'checking';
  error?: string;
  newDigest?: string;
  progress?: {
    current: number;
    total: number;
    status: string;
  };
}

interface OllamaPullResponse {
  status: string;
  completed?: number;
  total?: number;
  digest?: string;
}

const isOllamaPullResponse = (data: unknown): data is OllamaPullResponse => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    typeof (data as OllamaPullResponse).status === 'string'
  );
};

export default function LocalProvidersTab() {
  const { providers, updateProviderSettings } = useSettings();
  const [filteredProviders, setFilteredProviders] = useState<IProviderConfig[]>([]);
  const [categoryEnabled, setCategoryEnabled] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState<string>('');
  const [urlInputError, setUrlInputError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Add state for connection status
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusMap>({});

  // Add ref to track if we're currently checking connections
  const checkingConnectionsRef = useRef<boolean>(false);

  // Add a ref to track if we've already fetched models
  const lastFetchRef = useRef(false);

  // Effect to filter and sort providers
  useEffect(() => {
    const newFilteredProviders = Object.entries(providers || {})
      .filter(([key]) => [...LOCAL_PROVIDERS, 'OpenAILike'].includes(key))
      .map(([key, value]) => {
        const provider = value as IProviderConfig;
        const envKey = providerBaseUrlEnvKeys[key]?.baseUrlKey;
        const envUrl = envKey ? (import.meta.env[envKey] as string | undefined) : undefined;

        // Set base URL if provided by environment
        if (envUrl && !provider.settings.baseUrl) {
          updateProviderSettings(key, {
            ...provider.settings,
            baseUrl: envUrl,
          });
        }

        return {
          name: key,
          settings: {
            ...provider.settings,
            baseUrl: provider.settings.baseUrl || envUrl,
          },
          staticModels: provider.staticModels || [],
          getDynamicModels: provider.getDynamicModels,
          getApiKeyLink: provider.getApiKeyLink,
          labelForGetApiKey: provider.labelForGetApiKey,
          icon: provider.icon,
        } as IProviderConfig;
      });

    // Custom sort function to ensure LMStudio appears before OpenAILike
    const sorted = newFilteredProviders.sort((a, b) => {
      if (a.name === 'LMStudio') {
        return -1;
      }

      if (b.name === 'LMStudio') {
        return 1;
      }

      if (a.name === 'OpenAILike') {
        return 1;
      }

      if (b.name === 'OpenAILike') {
        return -1;
      }

      return a.name.localeCompare(b.name);
    });
    setFilteredProviders(sorted);

    // Check connection status for all providers when the list changes
    checkAllProviderConnections();
  }, [providers, updateProviderSettings]);

  // Add effect to check connection status periodically for enabled providers
  useEffect(() => {
    // Check connections initially
    checkAllProviderConnections();

    // Set up interval to check connections every 30 seconds
    const intervalId = setInterval(() => {
      checkAllProviderConnections();
    }, 30000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [filteredProviders]);

  // Add function to check connection for all providers
  const checkAllProviderConnections = useCallback(async () => {
    // Prevent multiple simultaneous checks
    if (checkingConnectionsRef.current) {
      return;
    }

    checkingConnectionsRef.current = true;

    try {
      // Check each enabled provider
      for (const provider of filteredProviders) {
        if (provider.settings.enabled) {
          // Set status to checking
          setConnectionStatus((prev) => ({
            ...prev,
            [provider.name]: {
              ...prev[provider.name],
              status: 'checking',
              lastChecked: Date.now(),
            },
          }));

          // Check connection
          const result = await checkProviderConnection(provider.name, provider.settings.baseUrl);

          // Update status
          setConnectionStatus((prev) => ({
            ...prev,
            [provider.name]: {
              status: result.isConnected ? 'connected' : 'disconnected',
              error: result.errorMessage,
              lastChecked: Date.now(),
            },
          }));
        }
      }
    } finally {
      checkingConnectionsRef.current = false;
    }
  }, [filteredProviders]);

  // Add general provider connection check function
  const checkProviderConnection = async (
    providerName: string,
    baseUrl?: string,
  ): Promise<{ isConnected: boolean; errorMessage?: string }> => {
    if (!baseUrl) {
      // Use default URL if none provided
      if (providerName === 'Ollama') {
        baseUrl = OLLAMA_API_URL;
      } else if (providerName === 'LMStudio') {
        baseUrl = 'http://127.0.0.1:1234'; // Default LMStudio URL
      } else {
        return { isConnected: false, errorMessage: 'No base URL configured' };
      }
    }

    // Get the appropriate endpoint for this provider
    const endpoint = PROVIDER_CONNECTION_ENDPOINTS[providerName] || '/v1/models';

    try {
      console.log(`Checking connection to ${providerName} at ${baseUrl}${endpoint}`);

      // For LMStudio, we need to handle the connection differently due to potential CORS issues
      if (providerName === 'LMStudio') {
        try {
          // Use our server-side proxy to avoid CORS issues
          const proxyUrl = new URL('/api/lmstudio-proxy/v1/models', window.location.origin);
          proxyUrl.searchParams.set('baseUrl', baseUrl);

          console.log(`Using proxy for LMStudio: ${proxyUrl.toString()}`);

          const response = await fetch(proxyUrl.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000),
          });

          console.log(`${providerName} connection check response:`, response.status, response.statusText);

          if (response.ok) {
            // Try to parse the response to verify it's valid
            const data = await response.json();
            console.log(`${providerName} response data:`, data);

            return { isConnected: true };
          } else {
            return {
              isConnected: false,
              errorMessage: `Connection failed: ${response.statusText} (${response.status})`,
            };
          }
        } catch (error) {
          console.error(`Connection check error for ${providerName}:`, error);
          return {
            isConnected: false,
            errorMessage:
              error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed: Unknown error',
          };
        }
      } else {
        // For other providers, use the standard connection check
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        });

        // Log the response status
        console.log(`${providerName} connection check response:`, response.status, response.statusText);

        if (!response.ok) {
          return {
            isConnected: false,
            errorMessage: `Connection failed: ${response.statusText} (${response.status})`,
          };
        }

        return { isConnected: true };
      }
    } catch (error) {
      console.error(`Connection check error for ${providerName}:`, error);

      return {
        isConnected: false,
        errorMessage:
          error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed: Unknown error',
      };
    }
  };

  // Update the existing checkOllamaConnection to use the new general function
  const checkOllamaConnection = async (url: string): Promise<{ isConnected: boolean; errorMessage?: string }> => {
    try {
      setIsLoadingModels(true);
      return await checkProviderConnection('Ollama', url);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Add a component to display connection status
  const ConnectionStatusIndicator = ({ providerName }: { providerName: string }) => {
    const status = connectionStatus[providerName] || { status: 'unknown', lastChecked: 0 };

    return (
      <div
        className="connection-status-indicator"
        title={`Status: ${status.status}${status.error ? ` - ${status.error}` : ''}`}
      >
        {status.status === 'connected' && <FiWifi className="connection-icon connected" />}
        {status.status === 'disconnected' && <FiWifiOff className="connection-icon disconnected" />}
        {status.status === 'checking' && (
          <div className="i-ph:spinner-gap-bold animate-spin connection-icon checking" />
        )}
        {status.status === 'unknown' && <FiWifi className="connection-icon unknown" />}
      </div>
    );
  };

  // Add effect to update category toggle state based on provider states
  useEffect(() => {
    const newCategoryState = filteredProviders.every((p) => p.settings.enabled);
    setCategoryEnabled(newCategoryState);
  }, [filteredProviders]);

  // Fetch Ollama models when enabled
  useEffect(() => {
    const ollamaProvider = filteredProviders.find((p) => p.name === 'Ollama');

    /*
     * Only fetch models when the Ollama provider is enabled
     * This prevents unnecessary refreshes when other providers change
     */
    if (ollamaProvider?.settings.enabled) {
      // Use a ref to track if this is the initial load
      const isInitialLoad = !lastFetchRef.current;
      lastFetchRef.current = true;

      // Only fetch on initial load or when explicitly enabled
      if (isInitialLoad) {
        fetchOllamaModels(false); // Don't force refresh on initial load
      }
    }
  }, [filteredProviders.find((p) => p.name === 'Ollama')?.settings.enabled]);

  const fetchOllamaModels = async (forceRefresh = true) => {
    try {
      setIsLoadingModels(true);

      const ollamaProvider = filteredProviders.find((p) => p.name === 'Ollama');
      const baseUrl = ollamaProvider?.settings?.baseUrl || OLLAMA_API_URL;

      // Use AbortController to set a timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch Ollama models: ${response.statusText}`);
      }

      const data = (await response.json()) as { models: OllamaModel[] };

      setOllamaModels(
        data.models.map((model) => ({
          ...model,
          status: 'idle' as const,
        })),
      );

      /*
       * Force a refresh of the provider's dynamic models when models are fetched
       * This ensures the model selector in the chat interface is updated
       */
      if (forceRefresh && ollamaProvider && ollamaProvider.name) {
        // First, temporarily disable the provider to clear the cache
        const wasEnabled = ollamaProvider.settings.enabled;

        // Disable to clear cache
        updateProviderSettings(ollamaProvider.name, {
          ...ollamaProvider.settings,
          enabled: false,
        });

        // Short delay before re-enabling
        setTimeout(() => {
          // Re-enable with original state
          updateProviderSettings(ollamaProvider.name, {
            ...ollamaProvider.settings,
            enabled: wasEnabled,
          });

          // For more reliable refresh, do another update after a short delay
          if (wasEnabled) {
            setTimeout(() => {
              updateProviderSettings(ollamaProvider.name, {
                ...ollamaProvider.settings,
                enabled: wasEnabled,
              });
            }, 500);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);

      // Show a toast with the error
      toast(`Error fetching models: ${error instanceof Error ? error.message : 'Unknown error occurred'}`, {
        type: 'error',
      });

      // Clear the models list to indicate there was an error
      setOllamaModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleDeleteOllamaModel = async (modelName: string) => {
    try {
      setOllamaModels((prevModels) =>
        prevModels.map((model) =>
          model.name === modelName ? { ...model, status: 'updating', error: undefined } : model,
        ),
      );

      const ollamaProvider = filteredProviders.find((provider) => provider.name === 'Ollama');
      const baseUrl = ollamaProvider?.settings?.baseUrl || OLLAMA_API_URL;

      // Use AbortController to set a timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for deletion

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

      // Remove the model from the local state
      setOllamaModels((prevModels) => prevModels.filter((model) => model.name !== modelName));

      // Force a refresh of the provider's dynamic models
      if (ollamaProvider && ollamaProvider.name) {
        // First, temporarily disable the provider to clear the cache
        const wasEnabled = ollamaProvider.settings.enabled;

        // Disable to clear cache
        updateProviderSettings(ollamaProvider.name, {
          ...ollamaProvider.settings,
          enabled: false,
        });

        // Short delay before re-enabling
        setTimeout(() => {
          // Re-enable with original state
          updateProviderSettings(ollamaProvider.name, {
            ...ollamaProvider.settings,
            enabled: wasEnabled,
          });

          // For more reliable refresh, do another update after a short delay
          if (wasEnabled) {
            setTimeout(() => {
              updateProviderSettings(ollamaProvider.name, {
                ...ollamaProvider.settings,
                enabled: wasEnabled,
              });
            }, 500);
          }
        }, 100);
      }

      toast(`${modelName} has been deleted successfully.`);
    } catch (error) {
      console.error('Error deleting model:', error);

      setOllamaModels((prevModels) =>
        prevModels.map((model) =>
          model.name === modelName
            ? {
                ...model,
                status: 'error',
                error: error instanceof Error ? error.message : 'Failed to delete model',
              }
            : model,
        ),
      );

      toast(`Error deleting model: ${error instanceof Error ? error.message : 'Failed to delete model'}`, {
        type: 'error',
      });
    }
  };

  const validateUrlInput = (url: string): { isValid: boolean; errorMessage?: string } => {
    if (!url) {
      return { isValid: false, errorMessage: 'URL cannot be empty' };
    }

    try {
      const parsedUrl = new URL(url);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { isValid: false, errorMessage: 'URL must use http or https protocol' };
      }

      return { isValid: true };
    } catch (_) {
      return { isValid: false, errorMessage: 'Invalid URL format' };
    }
  };

  const handleUrlChange = async () => {
    // Validate URL format first
    const validation = validateUrlInput(urlInputValue);

    if (!validation.isValid) {
      setUrlInputError(validation.errorMessage || null);
      return;
    }

    // Check connection to Ollama
    const connectionCheck = await checkOllamaConnection(urlInputValue);

    if (!connectionCheck.isConnected) {
      setUrlInputError(connectionCheck.errorMessage || null);
      return;
    }

    // Find the Ollama provider
    const ollamaProvider = filteredProviders.find((p: IProviderConfig) => p.name === 'Ollama');

    if (ollamaProvider && ollamaProvider.name) {
      // Update provider settings
      updateProviderSettings(ollamaProvider.name, {
        ...ollamaProvider.settings,
        baseUrl: urlInputValue,
      });
    }

    setEditingProvider(null);
    setUrlInputError(null);

    // Refresh models with new URL
    fetchOllamaModels();

    toast(`Ollama base URL has been updated to ${urlInputValue}`);
  };

  const handleToggleCategory = useCallback(
    async (enabled: boolean) => {
      filteredProviders.forEach((provider) => {
        updateProviderSettings(provider.name, { ...provider.settings, enabled });
      });
      toast(enabled ? 'All local providers enabled' : 'All local providers disabled');
    },
    [filteredProviders, updateProviderSettings],
  );

  const handleToggleProvider = (provider: IProviderConfig, enabled: boolean) => {
    updateProviderSettings(provider.name, {
      ...provider.settings,
      enabled,
    });

    if (enabled) {
      logStore.logProvider(`Provider ${provider.name} enabled`, { provider: provider.name });
      toast(`${provider.name} enabled`);
    } else {
      logStore.logProvider(`Provider ${provider.name} disabled`, { provider: provider.name });
      toast(`${provider.name} disabled`);
    }
  };

  const handleUpdateOllamaModel = async (modelName: string) => {
    const updateSuccess = await updateOllamaModel(modelName);

    if (updateSuccess) {
      toast(`Updated ${modelName}`);
    } else {
      toast(`Failed to update ${modelName}`);
    }
  };

  // Update model details display
  const ModelDetails = ({ model }: { model: OllamaModel }) => (
    <div className="model-details">
      <div className="model-detail">
        <div className="i-ph:code detail-icon" />
        <span>{model.digest.substring(0, 7)}</span>
      </div>
      {model.details && (
        <>
          <div className="model-detail">
            <div className="i-ph:database detail-icon" />
            <span>{model.details.parameter_size}</span>
          </div>
          <div className="model-detail">
            <div className="i-ph:cube detail-icon" />
            <span>{model.details.quantization_level}</span>
          </div>
        </>
      )}
    </div>
  );

  // Enhanced model update function with better error handling
  const updateOllamaModel = async (modelName: string): Promise<boolean> => {
    const provider = filteredProviders.find((p) => p.name === 'Ollama');

    if (!provider) {
      return false;
    }

    const baseUrl = provider.settings.baseUrl || OLLAMA_API_URL;

    try {
      // Update model status to updating
      setOllamaModels((current) => current.map((m) => (m.name === modelName ? { ...m, status: 'updating' } : m)));

      const response = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update ${modelName}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No response reader available');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const rawData = JSON.parse(line);

            if (!isOllamaPullResponse(rawData)) {
              console.error('Invalid response format:', rawData);
              continue;
            }

            setOllamaModels((current) =>
              current.map((m) =>
                m.name === modelName
                  ? {
                      ...m,
                      progress: {
                        current: rawData.completed || 0,
                        total: rawData.total || 0,
                        status: rawData.status,
                      },
                      newDigest: rawData.digest,
                    }
                  : m,
              ),
            );
          } catch (err) {
            console.error('Error parsing response line:', err);
          }
        }
      }

      // Refresh models list after update
      await fetchOllamaModels();

      return true;
    } catch (error) {
      console.error(`Error updating ${modelName}:`, error);

      // Update model status to error
      setOllamaModels((current) =>
        current.map((m) =>
          m.name === modelName
            ? {
                ...m,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            : m,
        ),
      );

      return false;
    }
  };

  return (
    <div className="local-providers" role="region" aria-label="Local Providers Configuration">
      <motion.div
        className="providers-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header section */}
        <div className="header-section">
          <div className="header-content">
            <div className="header-icon">
              <FaServer />
            </div>
            <div className="header-text">
              <h3 className="header-title">
                Local Providers
                <span className="provider-badge local">Local</span>
              </h3>
              <p className="header-description">Configure and manage local LLM providers</p>
            </div>
          </div>
          <div className="toggle-all">
            <span className="toggle-label">Enable All</span>
            <Switch
              checked={categoryEnabled}
              onCheckedChange={filteredProviders.length > 0 ? handleToggleCategory : undefined}
            />
          </div>
        </div>

        {/* Ollama Section */}
        {filteredProviders
          .filter((provider) => provider.name === 'Ollama')
          .map((provider) => (
            <motion.div
              key={provider.name}
              className="provider-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Provider Header */}
              <div className="provider-header">
                <div className="provider-info">
                  <div
                    className={classNames('provider-icon', {
                      enabled: !!provider.settings.enabled,
                    })}
                  >
                    {React.createElement(PROVIDER_ICONS[provider.name as ProviderName] || BsRobot, {
                      className: 'w-7 h-7',
                      'aria-label': `${provider.name} icon`,
                    })}
                  </div>
                  <div className="provider-text">
                    <div className="provider-name">
                      <h3>{provider.name}</h3>
                      <span className="provider-badge local">Local</span>
                      {provider.settings.enabled && <ConnectionStatusIndicator providerName={provider.name} />}
                    </div>
                    <p className="provider-description">{PROVIDER_DESCRIPTIONS[provider.name as ProviderName]}</p>
                  </div>
                </div>
                <Switch
                  checked={provider.settings.enabled}
                  onCheckedChange={(checked) => handleToggleProvider(provider, checked)}
                  aria-label={`Toggle ${provider.name} provider`}
                />
              </div>

              {/* Enhanced URL Configuration Section */}
              <AnimatePresence>
                {provider.settings.enabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="url-config"
                  >
                    <div className="url-config-header">
                      <label className="url-label">API Endpoint</label>
                      {urlInputError && <span className="url-error">{urlInputError}</span>}
                    </div>

                    {editingProvider === provider.name ? (
                      <div className="url-edit-container">
                        <Input
                          ref={urlInputRef}
                          type="text"
                          value={urlInputValue}
                          onChange={(e) => setUrlInputValue(e.target.value)}
                          placeholder="Enter Ollama base URL"
                          className="url-input"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUrlChange();
                            } else if (e.key === 'Escape') {
                              setEditingProvider(null);
                            }
                          }}
                        />
                        <div className="url-edit-actions">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleUrlChange}
                            className="url-action-button confirm"
                            aria-label="Confirm URL change"
                          >
                            <FiCheck />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingProvider(null)}
                            className="url-action-button cancel"
                            aria-label="Cancel URL change"
                          >
                            <FiX />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => setEditingProvider(provider.name)} className="url-display">
                        <div className="url-content">
                          <FiLink className="url-icon" />
                          <span>{provider.settings.baseUrl || OLLAMA_API_URL}</span>
                        </div>
                        <div className="url-actions">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              checkProviderConnection(provider.name, provider.settings.baseUrl).then((result) => {
                                setConnectionStatus((prev) => ({
                                  ...prev,
                                  [provider.name]: {
                                    status: result.isConnected ? 'connected' : 'disconnected',
                                    error: result.errorMessage,
                                    lastChecked: Date.now(),
                                  },
                                }));

                                if (result.isConnected) {
                                  toast(`Successfully connected to ${provider.name}`);
                                } else {
                                  toast(`Failed to connect to ${provider.name}: ${result.errorMessage}`, {
                                    type: 'error',
                                  });
                                }
                              });
                            }}
                            className="url-check-button"
                            aria-label="Check connection"
                          >
                            <div className="i-ph:arrows-clockwise" />
                          </Button>
                          <Button variant="ghost" size="icon" className="url-edit-button" aria-label="Edit URL">
                            <FiEdit2 size={16} />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="url-help-text">The API endpoint should point to your Ollama server</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Enhanced Ollama Models Section */}
              {provider.settings.enabled && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="models-section">
                  <div className="models-header">
                    <div className="models-title">
                      <div className="i-ph:cube-duotone models-icon" />
                      <h4>Installed Models</h4>
                    </div>
                    {isLoadingModels ? (
                      <div className="flex items-center gap-2">
                        <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
                        <span className="models-count">Loading models...</span>
                      </div>
                    ) : (
                      <div className="models-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchOllamaModels(true)}
                          className="refresh-models-button"
                          disabled={isLoadingModels}
                        >
                          <div className="i-ph:arrows-clockwise mr-1" />
                          Refresh
                        </Button>
                        <span className="models-count">{ollamaModels.length} models available</span>
                      </div>
                    )}
                  </div>

                  <div>
                    {isLoadingModels ? (
                      <div className="models-loading">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="model-placeholder" />
                        ))}
                      </div>
                    ) : ollamaModels.length === 0 ? (
                      <div className="models-empty">
                        <div className="i-ph:cube-transparent empty-icon" />
                        <p className="empty-message">No models installed yet</p>
                        <p className="empty-help">
                          Browse models at{' '}
                          <a
                            href="https://ollama.com/library"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="library-link"
                          >
                            ollama.com/library
                            <div className="i-ph:arrow-square-out text-xs" />
                          </a>{' '}
                          and copy model names to install
                        </p>
                      </div>
                    ) : (
                      <div className="models-grid">
                        {ollamaModels.map((model) => (
                          <motion.div
                            key={model.name}
                            className={classNames('model-item', {
                              'model-updating': model.status === 'updating',
                              'model-error': model.status === 'error',
                            })}
                          >
                            <div className="model-header">
                              <div className="i-ph:robot model-icon" />
                              <div className="model-info">
                                <div className="model-info-name">
                                  <h5>{model.name}</h5>
                                  {model.status && model.status !== 'idle' && (
                                    <span className={classNames('model-status-badge', model.status)}>
                                      {model.status.charAt(0).toUpperCase() + model.status.slice(1)}
                                    </span>
                                  )}
                                </div>
                                <ModelDetails model={model} />
                              </div>
                            </div>

                            {model.error && (
                              <div className="model-error-message">
                                <FiX className="error-icon" />
                                <span>{model.error}</span>
                              </div>
                            )}

                            {model.progress && (
                              <div className="model-progress">
                                <div className="progress-info">
                                  <span className="progress-status">{model.progress.status}</span>
                                  <span className="progress-percentage">
                                    {Math.round((model.progress.current / model.progress.total) * 100)}%
                                  </span>
                                </div>
                                <Progress
                                  value={Math.round((model.progress.current / model.progress.total) * 100)}
                                  className="progress-bar"
                                />
                              </div>
                            )}

                            <div className="model-actions">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateOllamaModel(model.name)}
                                disabled={model.status === 'updating'}
                                className={classNames('action-button update', {
                                  disabled: model.status === 'updating',
                                })}
                                aria-label="Update model"
                              >
                                {model.status === 'updating' ? (
                                  <div className="update-text">
                                    <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
                                    <span className="text-sm">Updating...</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="i-ph:arrows-clockwise text-lg mr-1" />
                                    Update
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete ${model.name}?`)) {
                                    handleDeleteOllamaModel(model.name);
                                  }
                                }}
                                disabled={model.status === 'updating'}
                                className={classNames('action-button delete', {
                                  disabled: model.status === 'updating',
                                })}
                                aria-label="Delete model"
                              >
                                <div className="i-ph:trash text-lg mr-1" />
                                Delete
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Model Installation Section */}
                  <OllamaModelInstaller
                    onModelInstalled={fetchOllamaModels}
                    baseUrl={provider.settings.baseUrl || OLLAMA_API_URL}
                  />
                </motion.div>
              )}
            </motion.div>
          ))}

        {/* Other Providers Section - Enhanced URL Configuration */}
        <div className="other-providers">
          <h3 className="section-title">Other Local Providers</h3>
          <div className="providers-grid">
            {filteredProviders
              .filter((provider) => provider.name !== 'Ollama')
              .map((provider, index) => (
                <motion.div
                  key={provider.name}
                  className="provider-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Provider Header */}
                  <div className="provider-header">
                    <div className="provider-info">
                      <div
                        className={classNames('provider-icon', {
                          enabled: !!provider.settings.enabled,
                        })}
                      >
                        {React.createElement(PROVIDER_ICONS[provider.name as ProviderName] || BsRobot, {
                          className: 'w-7 h-7',
                          'aria-label': `${provider.name} icon`,
                        })}
                      </div>
                      <div className="provider-text">
                        <div className="provider-name">
                          <h3>{provider.name}</h3>
                          <div className="flex gap-1">
                            <span className="provider-badge local">Local</span>
                            {URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && (
                              <span className="provider-badge configurable">Configurable</span>
                            )}
                            {provider.settings.enabled && <ConnectionStatusIndicator providerName={provider.name} />}
                          </div>
                        </div>
                        <p className="provider-description">{PROVIDER_DESCRIPTIONS[provider.name as ProviderName]}</p>
                      </div>
                    </div>
                    <Switch
                      checked={provider.settings.enabled}
                      onCheckedChange={(checked) => handleToggleProvider(provider, checked)}
                      aria-label={`Toggle ${provider.name} provider`}
                    />
                  </div>

                  {/* Enhanced URL Configuration Section */}
                  <AnimatePresence>
                    {provider.settings.enabled && URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="url-config"
                      >
                        <div className="url-config-header">
                          <label className="url-label">API Endpoint</label>
                          {urlInputError && editingProvider === provider.name && (
                            <span className="url-error">{urlInputError}</span>
                          )}
                        </div>

                        {editingProvider === provider.name ? (
                          <div className="url-edit-container">
                            <Input
                              ref={urlInputRef}
                              type="text"
                              value={urlInputValue}
                              onChange={(e) => setUrlInputValue(e.target.value)}
                              placeholder={`Enter ${provider.name} base URL`}
                              className="url-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUrlChange();
                                } else if (e.key === 'Escape') {
                                  setEditingProvider(null);
                                }
                              }}
                            />
                            <div className="url-edit-actions">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleUrlChange}
                                className="url-action-button confirm"
                                aria-label="Confirm URL change"
                              >
                                <FiCheck />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingProvider(null)}
                                className="url-action-button cancel"
                                aria-label="Cancel URL change"
                              >
                                <FiX />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div onClick={() => setEditingProvider(provider.name)} className="url-display">
                            <div className="url-content">
                              <FiLink className="url-icon" />
                              <span>{provider.settings.baseUrl || `Click to set ${provider.name} base URL`}</span>
                            </div>
                            <div className="url-actions">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  checkProviderConnection(provider.name, provider.settings.baseUrl).then((result) => {
                                    setConnectionStatus((prev) => ({
                                      ...prev,
                                      [provider.name]: {
                                        status: result.isConnected ? 'connected' : 'disconnected',
                                        error: result.errorMessage,
                                        lastChecked: Date.now(),
                                      },
                                    }));

                                    if (result.isConnected) {
                                      toast(`Successfully connected to ${provider.name}`);
                                    } else {
                                      toast(`Failed to connect to ${provider.name}: ${result.errorMessage}`, {
                                        type: 'error',
                                      });
                                    }
                                  });
                                }}
                                className="url-check-button"
                                aria-label="Check connection"
                              >
                                <div className="i-ph:arrows-clockwise" />
                              </Button>
                              <Button variant="ghost" size="icon" className="url-edit-button" aria-label="Edit URL">
                                <FiEdit2 size={16} />
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="url-help-text">
                          The API endpoint should point to your {provider.name} server
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
