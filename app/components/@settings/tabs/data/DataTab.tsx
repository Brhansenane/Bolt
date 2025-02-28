import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { DialogRoot, DialogClose, Dialog, DialogTitle } from '~/components/ui/Dialog';
import { db, getAll, deleteById } from '~/lib/persistence';
import '~/styles/components/data.scss';

export default function DataTab() {
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImportingKeys, setIsImportingKeys] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResetInlineConfirm, setShowResetInlineConfirm] = useState(false);
  const [showDeleteInlineConfirm, setShowDeleteInlineConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAllChats = async () => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Get all chats from IndexedDB
      const allChats = await getAll(db);
      const exportData = {
        chats: allChats,
        exportDate: new Date().toISOString(),
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-chats-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Chats exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export chats');
    }
  };

  const handleExportSettings = () => {
    try {
      const settings = {
        userProfile: localStorage.getItem('bolt_user_profile'),
        settings: localStorage.getItem('bolt_settings'),
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-settings-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Settings exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export settings');
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const settings = JSON.parse(content);

      if (settings.userProfile) {
        localStorage.setItem('bolt_user_profile', settings.userProfile);
      }

      if (settings.settings) {
        localStorage.setItem('bolt_settings', settings.settings);
      }

      window.location.reload(); // Reload to apply settings
      toast.success('Settings imported successfully');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import settings');
    }
  };

  const handleImportAPIKeys = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsImportingKeys(true);

    try {
      const content = await file.text();
      const keys = JSON.parse(content);

      // Validate and save each key
      Object.entries(keys).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          throw new Error(`Invalid value for key: ${key}`);
        }

        localStorage.setItem(`bolt_${key.toLowerCase()}`, value);
      });

      toast.success('API keys imported successfully');
    } catch (error) {
      console.error('Error importing API keys:', error);
      toast.error('Failed to import API keys');
    } finally {
      setIsImportingKeys(false);

      if (apiKeyFileInputRef.current) {
        apiKeyFileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    setIsDownloadingTemplate(true);

    try {
      const template = {
        Anthropic_API_KEY: '',
        OpenAI_API_KEY: '',
        Google_API_KEY: '',
        Groq_API_KEY: '',
        HuggingFace_API_KEY: '',
        OpenRouter_API_KEY: '',
        Deepseek_API_KEY: '',
        Mistral_API_KEY: '',
        OpenAILike_API_KEY: '',
        Together_API_KEY: '',
        xAI_API_KEY: '',
        Perplexity_API_KEY: '',
        Cohere_API_KEY: '',
        AzureOpenAI_API_KEY: '',
        OPENAI_LIKE_API_BASE_URL: '',
        LMSTUDIO_API_BASE_URL: '',
        OLLAMA_API_BASE_URL: '',
        TOGETHER_API_BASE_URL: '',
      };

      const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bolt-api-keys-template.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Template downloaded successfully');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleResetSettings = async () => {
    setIsResetting(true);

    try {
      // Clear all stored settings from localStorage
      localStorage.removeItem('bolt_user_profile');
      localStorage.removeItem('bolt_settings');
      localStorage.removeItem('bolt_chat_history');

      // Clear all data from IndexedDB
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Get all chats and delete them
      const chats = await getAll(db as IDBDatabase);
      const deletePromises = chats.map((chat) => deleteById(db as IDBDatabase, chat.id));
      await Promise.all(deletePromises);

      // Close the dialog first
      setShowResetInlineConfirm(false);

      // Then reload and show success message
      window.location.reload();
      toast.success('Settings reset successfully');
    } catch (error) {
      console.error('Reset error:', error);
      setShowResetInlineConfirm(false);
      toast.error('Failed to reset settings');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteAllChats = async () => {
    setIsDeleting(true);

    try {
      // Clear chat history from localStorage
      localStorage.removeItem('bolt_chat_history');

      // Clear chats from IndexedDB
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Get all chats and delete them one by one
      const chats = await getAll(db as IDBDatabase);
      const deletePromises = chats.map((chat) => deleteById(db as IDBDatabase, chat.id));
      await Promise.all(deletePromises);

      // Close the dialog first
      setShowDeleteInlineConfirm(false);

      // Then show the success message
      toast.success('Chat history deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      setShowDeleteInlineConfirm(false);
      toast.error('Failed to delete chat history');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="data-container">
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportSettings} className="hidden-input" />
      {/* Reset Settings Dialog */}
      <DialogRoot open={showResetInlineConfirm} onOpenChange={setShowResetInlineConfirm}>
        <Dialog showCloseButton={false} className="z-[1000]">
          <div className="confirm-dialog">
            <div className="confirm-dialog-header">
              <div className="i-ph:warning-circle-fill dialog-icon warning" />
              <DialogTitle className="dialog-title">Reset All Settings?</DialogTitle>
            </div>
            <p className="confirm-dialog-content">
              This will reset all your settings to their default values. This action cannot be undone.
            </p>
            <div className="confirm-dialog-actions">
              <DialogClose asChild>
                <button className="cancel-button">Cancel</button>
              </DialogClose>
              <motion.button
                className="confirm-button warning"
                onClick={handleResetSettings}
                disabled={isResetting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isResetting ? (
                  <div className="i-ph:spinner-gap-bold spinner" />
                ) : (
                  <div className="i-ph:arrow-counter-clockwise button-icon" />
                )}
                Reset Settings
              </motion.button>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Delete Confirmation Dialog */}
      <DialogRoot open={showDeleteInlineConfirm} onOpenChange={setShowDeleteInlineConfirm}>
        <Dialog showCloseButton={false} className="z-[1000]">
          <div className="confirm-dialog">
            <div className="confirm-dialog-header">
              <div className="i-ph:warning-circle-fill dialog-icon danger" />
              <DialogTitle className="dialog-title">Delete All Chats?</DialogTitle>
            </div>
            <p className="confirm-dialog-content">
              This will permanently delete all your chat history. This action cannot be undone.
            </p>
            <div className="confirm-dialog-actions">
              <DialogClose asChild>
                <button className="cancel-button">Cancel</button>
              </DialogClose>
              <motion.button
                className="confirm-button danger"
                onClick={handleDeleteAllChats}
                disabled={isDeleting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isDeleting ? (
                  <div className="i-ph:spinner-gap-bold spinner" />
                ) : (
                  <div className="i-ph:trash button-icon" />
                )}
                Delete All
              </motion.button>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Chat History Section */}
      <motion.div
        className="data-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="data-section-header">
          <div className="i-ph:chat-circle-duotone section-icon" />
          <h3 className="section-title">Chat History</h3>
        </div>
        <p className="data-section-description">Export or delete all your chat history.</p>
        <div className="data-section-actions">
          <motion.button
            className="action-button primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportAllChats}
          >
            <div className="i-ph:download-simple button-icon" />
            Export All Chats
          </motion.button>
          <motion.button
            className="action-button danger"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowDeleteInlineConfirm(true)}
          >
            <div className="i-ph:trash button-icon" />
            Delete All Chats
          </motion.button>
        </div>
      </motion.div>

      {/* Settings Backup Section */}
      <motion.div
        className="data-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="data-section-header">
          <div className="i-ph:gear-duotone section-icon" />
          <h3 className="section-title">Settings Backup</h3>
        </div>
        <p className="data-section-description">
          Export your settings to a JSON file or import settings from a previously exported file.
        </p>
        <div className="data-section-actions">
          <motion.button
            className="action-button primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportSettings}
          >
            <div className="i-ph:download-simple button-icon" />
            Export Settings
          </motion.button>
          <motion.button
            className="action-button primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="i-ph:upload-simple button-icon" />
            Import Settings
          </motion.button>
          <motion.button
            className="action-button warning"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowResetInlineConfirm(true)}
          >
            <div className="i-ph:arrow-counter-clockwise button-icon" />
            Reset Settings
          </motion.button>
        </div>
      </motion.div>

      {/* API Keys Management Section */}
      <motion.div
        className="data-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="data-section-header">
          <div className="i-ph:key-duotone section-icon" />
          <h3 className="section-title">API Keys Management</h3>
        </div>
        <p className="data-section-description">
          Import API keys from a JSON file or download a template to fill in your keys.
        </p>
        <div className="data-section-actions">
          <input
            ref={apiKeyFileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportAPIKeys}
            className="hidden-input"
          />
          <motion.button
            className="action-button primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
          >
            {isDownloadingTemplate ? (
              <div className="i-ph:spinner-gap-bold spinner" />
            ) : (
              <div className="i-ph:download-simple button-icon" />
            )}
            Download Template
          </motion.button>
          <motion.button
            className="action-button primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => apiKeyFileInputRef.current?.click()}
            disabled={isImportingKeys}
          >
            {isImportingKeys ? (
              <div className="i-ph:spinner-gap-bold spinner" />
            ) : (
              <div className="i-ph:upload-simple button-icon" />
            )}
            Import API Keys
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
