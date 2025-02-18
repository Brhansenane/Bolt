import { memo } from 'react';
import { classNames } from '~/utils/classNames';

interface PanelHeaderButtonProps {
  className?: string;
  disabledClassName?: string;
  disabled?: boolean;
  children: string | JSX.Element | Array<JSX.Element | string>;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export const PanelHeaderButton = memo(
  ({ className, disabledClassName, disabled = false, children, onClick }: PanelHeaderButtonProps) => {
    return (
      <button
        className={classNames(
          'flex items-center shrink-0 gap-1.5 px-2 rounded-md py-1.5 transition-all duration-200',
          'text-bolt-elements-textTertiary bg-transparent',
          'hover:text-accent-500 hover:bg-accent-500/5',
          'dark:text-white/60 dark:hover:text-accent-500/90 dark:hover:bg-accent-500/10',
          'disabled:cursor-not-allowed disabled:opacity-30',
          {
            [disabledClassName ?? '']: disabled,
          },
          className,
        )}
        disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            return;
          }

          onClick?.(event);
        }}
      >
        {children}
      </button>
    );
  },
);
