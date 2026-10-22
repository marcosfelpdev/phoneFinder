import React, { useState, useEffect } from 'react';
import { CardWithStatus, UpdateCardDTO } from 'shared';

interface EditCardModalProps {
  card: CardWithStatus | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, dto: UpdateCardDTO) => Promise<void>;
}

export function EditCardModal({ card, isOpen, onClose, onSubmit }: EditCardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (card) {
      setName(card.name);
      setDescription(card.description || '');
      setError(null);
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError('O nome do celular deve ter pelo menos 2 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(card.id, {
        name: trimmedName,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao atualizar celular';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-edit-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-edit-title" className="modal-title">Renomear Celular</h2>
          <button className="btn-close" onClick={onClose} aria-label="Fechar" id="btn-close-edit-modal">
            ✕
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          ID Imutável: {card.id}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="input-edit-card-name" className="form-label">
              Nome do Celular <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              id="input-edit-card-name"
              type="text"
              className="input-text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={50}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-edit-card-desc" className="form-label">
              Descrição Opcional
            </label>
            <input
              id="input-edit-card-desc"
              type="text"
              className="input-text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={150}
            />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              id="btn-cancel-edit-card"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              id="btn-confirm-edit-card"
            >
              {submitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
