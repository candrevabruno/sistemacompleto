import React from 'react';
import { cn } from '../../lib/utils';
import { User } from 'lucide-react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, fallback, size = 'md', ...props }, ref) => {
    
    const sizes = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-20 h-20 text-xl'
    };

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full font-dm font-semibold items-center justify-center bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-white/20',
          sizes[size],
          className
        )}
        {...props}
      >
        {src ? (
          <img
            src={src}
            className="aspect-square h-full w-full object-cover"
            alt="Avatar"
          />
        ) : fallback ? (
          <span className="uppercase">{fallback.slice(0, 2)}</span>
        ) : (
          <User size={size === 'sm' ? 14 : size === 'md' ? 18 : 24} />
        )}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';
