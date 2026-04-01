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
    | 'abandonou_conversa'
    | 'conversando'
    | 'reagendado';
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants: Record<string, string> = {
      default: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
      success: 'bg-[#EAF3DE] text-[#3B6D11] dark:bg-[rgba(122,158,135,0.2)]',
      warning: 'bg-[#F7F3E8] text-[#C9A84C] dark:bg-[rgba(232,168,124,0.2)]',
      error: 'bg-[#FCEEEE] text-[var(--color-error)] dark:bg-[rgba(196,126,126,0.2)]',
      info: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      
      agendado: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      confirmado: 'bg-[#EAF3DE] text-[#3B6D11]',
      compareceu: 'bg-[#EAF3DE] text-[#3B6D11]',
      faltou: 'bg-slate-100 text-slate-600',
      cancelado: 'bg-rose-50 text-rose-700',
      follow_up: 'bg-sky-50 text-sky-700',
      cancelou_agendamento: 'bg-rose-50 text-rose-700',
      abandonou_conversa: 'bg-gray-100 text-gray-500',
      conversando: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
      reagendado: 'bg-amber-50 text-amber-700 border-amber-200/50',
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
