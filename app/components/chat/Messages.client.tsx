import type { Message } from 'ai';
import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import WithTooltip from '~/components/ui/Tooltip';
import { mergeRefs } from '~/utils/mergeRefs';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
}

// Memoize individual message components
const MessageItem = memo(
  ({
    message,
    index,
    isLast,
    isStreaming,
    onRewind,
    onFork,
  }: {
    message: Message;
    index: number;
    isLast: boolean;
    isStreaming: boolean;
    onRewind: (messageId: string) => void;
    onFork: (messageId: string) => Promise<void>;
  }) => {
    const { role, content, id: messageId, annotations } = message;
    const isUserMessage = role === 'user';
    const isHidden = annotations?.includes('hidden');

    if (isHidden) {
      return null;
    }

    return (
      <div
        className={classNames('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
          'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
          'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent': isStreaming && isLast,
          'mt-4': index > 0,
        })}
      >
        {isUserMessage && (
          <div className="flex items-center justify-center w-[34px] h-[34px] overflow-hidden bg-white text-gray-600 rounded-full shrink-0 self-start">
            <div className="i-ph:user-fill text-xl"></div>
          </div>
        )}
        <div className="grid grid-col-1 w-full">
          {isUserMessage ? (
            <UserMessage content={content} />
          ) : (
            <AssistantMessage content={content} annotations={annotations} />
          )}
        </div>
        {!isUserMessage && messageId && (
          <div className="flex gap-2 flex-col lg:flex-row">
            <WithTooltip content="Revert to this message">
              <button
                onClick={() => onRewind(messageId)}
                key="i-ph:arrow-u-up-left"
                className={classNames(
                  'i-ph:arrow-u-up-left',
                  'text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors',
                )}
              />
            </WithTooltip>

            <WithTooltip content="Fork chat from this message">
              <button
                onClick={() => onFork(messageId)}
                key="i-ph:git-fork"
                className={classNames(
                  'i-ph:git-fork',
                  'text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors',
                )}
              />
            </WithTooltip>
          </div>
        )}
      </div>
    );
  },
);

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [] } = props;
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Effect to handle initial load and scrolling
  useEffect(() => {
    if (isInitialLoad && messages.length > 0) {
      setIsInitialLoad(false);

      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: messages.length - 1,
          behavior: 'auto',
        });
      });
    }
  }, [isInitialLoad, messages.length]);

  const handleRewind = useCallback(
    (messageId: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', messageId);
      window.location.search = searchParams.toString();
    },
    [location.search],
  );

  const handleFork = useCallback(async (messageId: string) => {
    try {
      if (!db || !chatId.get()) {
        toast.error('Chat persistence is not available');
        return;
      }

      const urlId = await forkChat(db, chatId.get()!, messageId);
      window.location.href = `/chat/${urlId}`;
    } catch (error) {
      toast.error('Failed to fork chat: ' + (error as Error).message);
    }
  }, []);

  const renderMessage = useCallback(
    (index: number) => {
      const message = messages[index];
      return (
        <MessageItem
          key={`${message.id || index}-${message.content}`}
          message={message}
          index={index}
          isLast={index === messages.length - 1}
          isStreaming={isStreaming}
          onRewind={handleRewind}
          onFork={handleFork}
        />
      );
    },
    [messages, isStreaming, handleRewind, handleFork],
  );

  return (
    <div
      id={id}
      ref={mergeRefs(ref, containerRef)}
      className={classNames(props.className, 'relative')}
      style={{ height: '100%' }}
    >
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={messages}
        itemContent={renderMessage}
        followOutput="smooth"
        alignToBottom
        overscan={5}
        increaseViewportBy={{ top: 100, bottom: 100 }}
        components={{
          Footer: () =>
            isStreaming ? (
              <div className="text-center w-full text-bolt-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4" />
            ) : null,
        }}
      />
    </div>
  );
});
