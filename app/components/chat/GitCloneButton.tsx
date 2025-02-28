import ignore from 'ignore';
import { useGit } from '~/lib/hooks/useGit';
import type { Message } from 'ai';
import { detectProjectCommands, createCommandsMessage, escapeBoltTags } from '~/utils/projectCommands';
import { generateId } from '~/utils/fileUtils';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';
import { RepositorySelectionDialog } from '~/components/@settings/tabs/connections/components/RepositorySelectionDialog';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import type { IChatMetadata } from '~/lib/persistence/db';
import { getLocalStorage } from '~/lib/persistence';

const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.github/**',
  '.vscode/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
  '**/*lock.json',
  '**/*lock.yaml',
];

const ig = ignore().add(IGNORE_PATTERNS);

const MAX_FILE_SIZE = 100 * 1024; // 100KB limit per file
const MAX_TOTAL_SIZE = 500 * 1024; // 500KB total limit

interface GitCloneButtonProps {
  className?: string;
  importChat?: (description: string, messages: Message[], metadata?: IChatMetadata) => Promise<void>;
}

export default function GitCloneButton({ importChat, className }: GitCloneButtonProps) {
  const { ready, gitClone } = useGit();
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasGitHubConnection, setHasGitHubConnection] = useState(false);

  // Use a ref to track if we're in the process of opening the dialog
  const openingDialogRef = useRef(false);

  // Add debugging to check GitHub connection on mount and when it changes
  useEffect(() => {
    const checkConnection = () => {
      const connection = getLocalStorage('github_connection');
      const hasConnection = !!connection?.token && !!connection?.user;
      setHasGitHubConnection(hasConnection);

      console.log('GitHub connection status:', {
        exists: !!connection,
        hasToken: !!connection?.token,
        hasUser: !!connection?.user,
        ready,
      });
    };

    // Check immediately
    checkConnection();

    // Set up a listener for localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'github_connection') {
        checkConnection();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [ready]);

  // Add an effect to log when the dialog state changes
  useEffect(() => {
    console.log('Dialog state changed in GitCloneButton:', isDialogOpen);

    // If we're opening the dialog, clear the ref
    if (isDialogOpen) {
      openingDialogRef.current = false;
    }
  }, [isDialogOpen]);

  const handleClone = useCallback(
    async (repoUrl: string) => {
      if (!ready) {
        toast.error('WebContainer is not ready. Please try again in a moment.');
        return;
      }

      setLoading(true);
      setIsDialogOpen(false); // Close the dialog when starting to clone

      try {
        const { workdir, data } = await gitClone(repoUrl);

        if (importChat) {
          const filePaths = Object.keys(data).filter((filePath) => !ig.ignores(filePath));
          const textDecoder = new TextDecoder('utf-8');

          let totalSize = 0;
          const skippedFiles: string[] = [];
          const fileContents = [];

          for (const filePath of filePaths) {
            const { data: content, encoding } = data[filePath];

            // Skip binary files
            if (
              content instanceof Uint8Array &&
              !filePath.match(/\.(txt|md|astro|mjs|js|jsx|ts|tsx|json|html|css|scss|less|yml|yaml|xml|svg)$/i)
            ) {
              skippedFiles.push(filePath);
              continue;
            }

            try {
              const textContent =
                encoding === 'utf8' ? content : content instanceof Uint8Array ? textDecoder.decode(content) : '';

              if (!textContent) {
                continue;
              }

              // Check file size
              const fileSize = new TextEncoder().encode(textContent).length;

              if (fileSize > MAX_FILE_SIZE) {
                skippedFiles.push(`${filePath} (too large: ${Math.round(fileSize / 1024)}KB)`);
                continue;
              }

              // Check total size
              if (totalSize + fileSize > MAX_TOTAL_SIZE) {
                skippedFiles.push(`${filePath} (would exceed total size limit)`);
                continue;
              }

              totalSize += fileSize;
              fileContents.push({
                path: filePath,
                content: textContent,
              });
            } catch (e: any) {
              skippedFiles.push(`${filePath} (error: ${e.message})`);
            }
          }

          const commands = await detectProjectCommands(fileContents);
          const commandsMessage = createCommandsMessage(commands);

          const filesMessage: Message = {
            role: 'assistant',
            content: `Cloning the repo ${repoUrl} into ${workdir}
${
  skippedFiles.length > 0
    ? `\nSkipped files (${skippedFiles.length}):
${skippedFiles.map((f) => `- ${f}`).join('\n')}`
    : ''
}

<boltArtifact id="imported-files" title="Git Cloned Files" type="bundled">
${fileContents
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>`,
            id: generateId(),
            createdAt: new Date(),
          };

          const messages = [filesMessage];

          if (commandsMessage) {
            messages.push(commandsMessage);
          }

          await importChat(`Git Project:${repoUrl.split('/').slice(-1)[0]}`, messages);
        }
      } catch (error) {
        console.error('Error during import:', error);
        toast.error('Failed to import repository');
      } finally {
        setLoading(false);
      }
    },
    [ready, gitClone, importChat],
  );

  const handleOpenDialog = useCallback(() => {
    console.log('Opening repository selection dialog, ready status:', ready);

    if (!ready) {
      toast.error('WebContainer is not ready. Please try again in a moment.');
      return;
    }

    if (!hasGitHubConnection) {
      toast.error('Please connect your GitHub account in Settings → Connections first');
      return;
    }

    // Set the ref to indicate we're opening the dialog
    openingDialogRef.current = true;

    /*
     * Set dialog open state with a small delay to ensure React has time to update
     * This helps prevent race conditions with state updates
     */
    setTimeout(() => {
      setIsDialogOpen(true);
      console.log('Dialog open state set to true');
    }, 10);
  }, [ready, hasGitHubConnection]);

  const handleCloseDialog = useCallback(() => {
    console.log('Dialog closed by user');

    // Only close if we're not in the process of opening
    if (!openingDialogRef.current) {
      setIsDialogOpen(false);
    }
  }, []);

  return (
    <>
      <Button
        onClick={handleOpenDialog}
        title={
          !ready
            ? 'WebContainer is initializing...'
            : !hasGitHubConnection
              ? 'GitHub connection required'
              : 'Clone a Git Repo'
        }
        variant="outline"
        size="lg"
        className={classNames(
          'gap-2 bg-[#F5F5F5] dark:bg-[#252525]',
          'text-bolt-elements-textPrimary dark:text-white',
          'hover:bg-[#E5E5E5] dark:hover:bg-[#333333]',
          'border-[#E5E5E5] dark:border-[#333333]',
          'h-10 px-4 py-2 min-w-[120px] justify-center',
          'transition-all duration-200 ease-in-out',
          className,
        )}
        disabled={!ready || loading}
      >
        <span className="i-ph:git-branch w-4 h-4" />
        Clone a Git Repo
      </Button>

      {/* Always render the dialog component but control its visibility with isOpen prop */}
      <RepositorySelectionDialog isOpen={isDialogOpen} onClose={handleCloseDialog} onSelect={handleClone} />

      {loading && <LoadingOverlay message="Please wait while we clone the repository..." />}
    </>
  );
}
