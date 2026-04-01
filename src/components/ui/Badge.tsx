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
      default: 'bg-[#FDF6E3] text-[#856404] font-semibold',
      success: 'bg-[#DEF2D7] text-[#1E4620]',
      warning: 'bg-[#FFF4E5] text-[#8C5E00]',
      error: 'bg-[#FEE2E2] text-[#991B1B]',
      info: 'bg-[#E0F2FE] text-[#0369A1]',
      
      novo_contato: 'bg-[#FDF6E3] text-[#856404] font-semibold',
      agendado: 'bg-[#E0E7FF] text-[#3730A3] font-medium shadow-sm',
      consulta_agendada: 'bg-[#E0E7FF] text-[#3730A3] font-medium shadow-sm',
      confirmado: 'bg-[#DEF2D7] text-[#1E4620]',
      compareceu: 'bg-[#DEF2D7] text-[#1E4620]',
      faltou: 'bg-slate-100 text-slate-700',
      cancelado: 'bg-rose-100 text-rose-800',
      perdido: 'bg-rose-100 text-rose-800',
      follow_up: 'bg-[#E0F2FE] text-[#0369A1]',
      cancelou_agendamento: 'bg-rose-100 text-rose-800',
      abandonou_conversa: 'bg-slate-200 text-slate-700',
      conversando: 'bg-[#FDF6E3] text-[#856404] font-semibold',
      reagendado: 'bg-[#FFF4E5] text-[#8C5E00] border-amber-200/50 font-medium shadow-sm',
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
