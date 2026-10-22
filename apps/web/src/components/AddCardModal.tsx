import React, { useState } from 'react';
import { CreateCardDTO } from 'shared';

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateCardDTO) => Promise<void>;
}

export function AddCardModal({ isOpen, onClose, onSubmit }: AddCardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

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
      await onSubmit({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao adicionar celular';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-add-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-add-title" className="modal-title">Adicionar Celular</h2>
          <button className="btn-close" onClick={onClose} aria-label="Fechar" id="btn-close-add-modal">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label htmlFor="input-card-name" className="form-label">
              Nome do Celular <span style={{ color: 'var(--accent-rose)' }}>*</span>
            </label>
            <input
              id="input-card-name"
              type="text"
              className="input-text"
              placeholder="Ex: Celular Estoque 01"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={50}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-card-desc" className="form-label">
              Descrição Opcional
            </label>
            <input
              id="input-card-desc"
              type="text"
              className="input-text"
              placeholder="Ex: Bancada de Testes 02"
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
              id="btn-cancel-add-card"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              id="btn-confirm-add-card"
            >
              {submitting ? 'Cadastrando...' : 'Cadastrar Celular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
