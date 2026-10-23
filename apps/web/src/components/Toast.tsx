import { useEffect, useRef, useState } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      role="region"
      aria-label="Notificações"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        maxWidth: '400px',
        width: 'calc(100% - 3rem)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [isClosing, setIsClosing] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    // Inicia o fechamento suave aos 3.7s e remove do DOM aos 4s
    const fadeTimer = setTimeout(() => {
      setIsClosing(true);
    }, 3700);

    const removeTimer = setTimeout(() => {
      onDismissRef.current(toast.id);
    }, 4000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id]); // Apenas toast.id como dependência garante que re-renders do pai não reiniciem o timer!

  const handleManualClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onDismissRef.current(toast.id);
    }, 200);
  };

  const bgColor =
    toast.type === 'success'
      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))'
      : toast.type === 'error'
      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))'
      : 'linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(67, 56, 202, 0.95))';

  return (
    <div
      role="alert"
      style={{
        background: bgColor,
        color: 'white',
        padding: '0.85rem 1.15rem',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        fontSize: '0.9rem',
        fontWeight: 500,
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        opacity: isClosing ? 0 : 1,
        transform: isClosing ? 'translateY(10px) scale(0.96)' : 'translateY(0) scale(1)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <span style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>{toast.message}</span>
      <button
        onClick={handleManualClose}
        aria-label="Fechar notificação"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.8)',
          cursor: 'pointer',
          padding: '0.2rem 0.4rem',
          fontSize: '1rem',
          lineHeight: 1,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
      >
        ✕
      </button>
    </div>
  );
}
