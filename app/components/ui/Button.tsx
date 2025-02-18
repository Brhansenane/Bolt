import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';
import { themeTokens } from './theme/StyleGuide';

const buttonVariants = cva(
  classNames(
    themeTokens.button.base,
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium',
  ),
  {
    variants: {
      variant: {
        default: themeTokens.button.secondary,
        destructive: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500/50',
        outline: themeTokens.button.outline,
        secondary: themeTokens.button.secondary,
        ghost: classNames(
          'hover:bg-bolt-elements-background-depth-2 dark:hover:bg-bolt-elements-background-depth-2-dark',
          'text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark',
        ),
        link: classNames(
          'text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark',
          'underline-offset-4 hover:underline',
        ),
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, _asChild = false, ...props }, ref) => {
    return <button className={classNames(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
