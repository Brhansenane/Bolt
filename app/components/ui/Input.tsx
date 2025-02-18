import { forwardRef } from 'react';
import { classNames } from '~/utils/classNames';
import { themeTokens } from './theme/StyleGuide';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type, error, icon, ...props }, ref) => {
  return (
    <div className="relative">
      {icon && (
        <div className={classNames('absolute left-3 top-1/2 -translate-y-1/2', themeTokens.icon.base)}>{icon}</div>
      )}
      <input
        type={type}
        className={classNames(
          themeTokens.input.base,
          'w-full h-10 rounded-md',
          'px-3 py-2 text-sm',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          icon ? 'pl-10' : '',
          error ? 'border-red-500 dark:border-red-500' : '',
          className,
        )}
        ref={ref}
        {...props}
      />
    </div>
  );
});

Input.displayName = 'Input';

export { Input };
