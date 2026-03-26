import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 
    | 'default'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'agendado'
    | 'confirmado'
    | 'compareceu'
    | 'faltou'
    | 'cancelado'
    | 'follow_up'
    | 'cancelou_agendamento'
    | 'abandonou_conversa';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants: Record<string, string> = {
      default: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
      success: 'bg-[#E8F3EC] text-[var(--color-success)] dark:bg-[rgba(122,158,135,0.2)]',
      warning: 'bg-[#FDEDDF] text-[var(--color-warning)] dark:bg-[rgba(232,168,124,0.2)]',
      error: 'bg-[#FCEEEE] text-[var(--color-error)] dark:bg-[rgba(196,126,126,0.2)]',
      info: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      
      agendado: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
      confirmado: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      compareceu: 'bg-[#E8F3EC] text-[var(--color-success)] dark:bg-[rgba(122,158,135,0.2)]',
      faltou: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
      cancelado: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      follow_up: 'bg-[#FDEDDF] text-[var(--color-warning)] dark:bg-[rgba(232,168,124,0.2)]',
      cancelou_agendamento: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      abandonou_conversa: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
          variants[variant] || variants.default,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Badge.displayName = 'Badge';
