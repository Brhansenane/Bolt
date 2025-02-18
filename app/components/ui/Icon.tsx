import { classNames } from '~/utils/classNames';
import { themeTokens } from './theme/StyleGuide';

interface IconProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent';
  className?: string;
  onClick?: () => void;
}

export function Icon({ name, size = 'md', color = 'secondary', className, onClick }: IconProps) {
  return (
    <span
      className={classNames(
        `i-ph:${name}`,
        themeTokens.icon.sizes[size],
        themeTokens.icon.colors[color],
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    />
  );
}
