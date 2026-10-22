import { useState } from 'react';
import { CardWithStatus } from 'shared';

interface DeleteConfirmModalProps {
  card: CardWithStatus | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteConfirmModal({ card, isOpen, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !card) return null;

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(card.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao remover celular';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-delete-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-delete-title" className="modal-title" style={{ color: 'var(--accent-rose)' }}>
            Confirmar Exclusão
          </h2>
          <button className="btn-close" onClick={onClose} aria-label="Fechar" id="btn-close-delete-modal">
            ✕
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: '1.5' }}>
          Tem certeza de que deseja remover o celular <strong>"{card.name}"</strong>?
          {card.pairedDeviceId && (
            <span style={{ display: 'block', marginTop: '0.5rem', color: '#fbbf24', fontSize: '0.85rem' }}>
              ⚠️ Este aparelho está atualmente pareado. Sua vinculação será desfeita.
            </span>
          )}
        </p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
            id="btn-cancel-delete"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: 'white',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
            }}
            onClick={handleConfirm}
            disabled={submitting}
            id="btn-confirm-delete"
          >
            {submitting ? 'Removendo...' : 'Sim, Excluir Celular'}
          </button>
        </div>
      </div>
    </div>
  );
}
