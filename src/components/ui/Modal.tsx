import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, bare }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-[16px] border border-[var(--border)] bg-[var(--white)] shadow-[var(--shadow-modal)] animate-in fade-in zoom-in-95 duration-200',
          !bare && 'p-6',
          className
        )}
      >
        {!bare && title && (
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-cormorant font-semibold text-[var(--ink)]">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-full py-1 px-1 text-[var(--muted)] hover:bg-[var(--sage-xlight)] hover:text-[var(--ink)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>,
    document.body
  );
}
