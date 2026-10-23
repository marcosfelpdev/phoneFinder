import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CardWithStatus, SystemInfoResponse } from 'shared';
import { usePairing } from '../hooks/usePairing';

interface PairingModalProps {
  card: CardWithStatus | null;
  isOpen: boolean;
  onClose: () => void;
  systemInfo: SystemInfoResponse | null;
  onUnpairSuccess: () => void;
  onOpenApkModal?: () => void;
}

export function PairingModal({
  card,
  isOpen,
  onClose,
  systemInfo,
  onUnpairSuccess,
  onOpenApkModal,
}: PairingModalProps) {
  const {
    pairingData,
    timeLeftSeconds,
    isExpired,
    isPairedSuccessfully,
    loading,
    error,
    regenerateCode,
    unpair,
  } = usePairing(isOpen && card ? card.id : null);

  const [unpairing, setUnpairing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const showQr = true;

  if (!isOpen || !card) return null;

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const lanUrl =
    systemInfo?.interfaces && systemInfo.interfaces.length > 0
      ? systemInfo.interfaces[0].receiverUrl
      : `${window.location.origin}/receiver`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(lanUrl);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleUnpair = async () => {
    try {
      setUnpairing(true);
      await unpair(card.id);
      onUnpairSuccess();
      onClose();
    } catch (err) {
      console.error('Falha ao desvincular:', err);
    } finally {
      setUnpairing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-pairing-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', textAlign: 'center' }}>
        <div className="modal-header">
          <h2 id="modal-pairing-title" className="modal-title" style={{ fontSize: '1.2rem', textAlign: 'left' }}>
            Parear Celular: {card.name}
          </h2>
          <button className="btn-close" onClick={onClose} aria-label="Fechar" id="btn-close-pairing-modal">
            ✕
          </button>
        </div>

        {/* Notificação de Sucesso */}
        {isPairedSuccessfully ? (
          <div
            style={{
              padding: '2rem 1.5rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--accent-emerald)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: '1.2rem', color: '#34d399' }}>Celular Pareado com Sucesso!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              O aparelho agora está vinculado a este card e pronto para receber comandos visuais.
            </p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: '0.5rem' }}>
              Concluir
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Instruções com QR Code */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {showQr && (
                <div
                  style={{
                    background: '#ffffff',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  title="Escaneie com a câmera do celular para abrir o receptor"
                >
                  <QRCodeSVG value={lanUrl} size={84} level="M" />
                </div>
              )}
              <div style={{ textAlign: 'left', flex: 1 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '0.4rem' }}>
                  Acesse no navegador do celular ou aponte a câmera para o QR Code:
                </p>
                <div style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace', fontSize: '0.825rem', wordBreak: 'break-all', marginBottom: '0.4rem' }}>
                  {lanUrl}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    onClick={handleCopyLink}
                  >
                    {copyFeedback ? '✓ Copiado!' : '📋 Copiar'}
                  </button>
                  {onOpenApkModal && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--accent-primary)' }}
                      onClick={onOpenApkModal}
                    >
                      📲 Baixar APK Nativo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'left' }}>
              Digite o código de pareamento abaixo no celular ou aplicativo Android:
            </p>

            {/* Código de Pareamento de 6 Dígitos */}
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid var(--border-glow)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              {loading ? (
                <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Gerando código seguro...</div>
              ) : isExpired ? (
                <div style={{ color: 'var(--accent-rose)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>⚠️ Este código expirou.</span>
                  <button className="btn btn-primary" onClick={regenerateCode} id="btn-regenerate-code">
                    Gerar Novo Código
                  </button>
                </div>
              ) : pairingData ? (
                <>
                  <div
                    id="pairing-code-display"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '2.5rem',
                      fontWeight: 800,
                      letterSpacing: '0.35em',
                      color: 'white',
                      textShadow: '0 0 20px rgba(99, 102, 241, 0.6)',
                      paddingLeft: '0.35em',
                    }}
                  >
                    {pairingData.code}
                  </div>
                  <div
                    style={{
                      fontSize: '0.825rem',
                      color: timeLeftSeconds < 60 ? '#f87171' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <span>⏱️ Expira em {formattedTime}</span>
                    <span>• Uso único</span>
                  </div>
                </>
              ) : null}
            </div>

            {error && <p className="form-error">{error}</p>}

            {/* Ações inferiores */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              {card.pairedDeviceId ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', padding: '0.45rem 0.8rem' }}
                  onClick={handleUnpair}
                  disabled={unpairing}
                >
                  {unpairing ? 'Desvinculando...' : 'Desvincular Aparelho Atual'}
                </button>
              ) : (
                <div></div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={regenerateCode}
                  disabled={loading}
                >
                  🔄 Novo Código
                </button>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
