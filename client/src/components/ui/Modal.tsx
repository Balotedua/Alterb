import { useEffect, useRef } from 'react';
import type { ReactNode, KeyboardEvent } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal--${size}`}
      onKeyDown={handleKeyDown}
      onClose={onClose}
    >
      <div className="modal__inner">
        {title ? (
          <div className="modal__header">
            <h2 className="modal__title">{title}</h2>
            <button className="modal__close" onClick={onClose} aria-label="Chiudi">
              ✕
            </button>
          </div>
        ) : null}
        <div className="modal__body">{children}</div>
      </div>
    </dialog>
  );
}
