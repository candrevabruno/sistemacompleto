import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-[var(--sage-dark)] text-white hover:opacity-90 border border-transparent shadow-sm',
      secondary: 'bg-transparent border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--sage-xlight)]',
      ghost: 'bg-transparent text-[var(--ink)] hover:bg-[var(--sage-xlight)]',
      danger: 'bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity'
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-base rounded-[8px]',
      lg: 'px-6 py-3 text-lg rounded-[8px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-dm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--sage-dark)] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-[8px]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {!loading && children}
      </button>
    );
  }
);
Button.displayName = 'Button';
