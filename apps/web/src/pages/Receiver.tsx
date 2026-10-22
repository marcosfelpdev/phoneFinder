import React, { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '../services/socket';
import { LocateAlertPayload, PairingResultPayload, SOCKET_EVENTS } from 'shared';

const STORAGE_KEY_DEVICE_ID = 'phone_finder_device_id';
const STORAGE_KEY_CARD_NAME = 'phone_finder_card_name';

export function Receiver() {
  const [deviceId, setDeviceId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY_DEVICE_ID)
  );
  const [cardName, setCardName] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY_CARD_NAME)
  );
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(socket.connected);
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  // Estado da Tela Vermelha de 5 Segundos
  const [isAlertActive, setIsAlertActive] = useState<boolean>(false);
  const processedCommandsRef = useRef<Set<string>>(new Set());
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Solicitar Wake Lock para manter a tela ligada
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLockActive(true);
        lock.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock request warning:', err);
      }
    }
  }, []);

  useEffect(() => {
    // Monitorar conexão de socket
    const onConnect = () => {
      setIsSocketConnected(true);
      const savedId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
      if (savedId) {
        socket.emit(SOCKET_EVENTS.DEVICE_IDENTIFY, { deviceId: savedId });
      }
    };

    const onDisconnect = () => setIsSocketConnected(false);

    // Resposta de pareamento do servidor
    const onPairingResult = (result: PairingResultPayload) => {
      setSubmitting(false);
      if (result.success && result.deviceId) {
        localStorage.setItem(STORAGE_KEY_DEVICE_ID, result.deviceId);
        if (result.cardName) {
          localStorage.setItem(STORAGE_KEY_CARD_NAME, result.cardName);
          setCardName(result.cardName);
        }
        setDeviceId(result.deviceId);
        setError(null);
        requestWakeLock();
      } else {
        setError(result.error || 'Código inválido ou expirado.');
      }
    };

    // Notificação de desvinculação pelo dashboard
    const onDeviceUnpaired = () => {
      localStorage.removeItem(STORAGE_KEY_DEVICE_ID);
      localStorage.removeItem(STORAGE_KEY_CARD_NAME);
      setDeviceId(null);
      setCardName(null);
      setIsAlertActive(false);
      setError('Este aparelho foi desvinculado.');
    };

    // Recebimento do comando "Localizar celular" direcionado a este aparelho
    const onAlertLocate = (payload: LocateAlertPayload) => {
      const { commandId, durationMs = 5000 } = payload;

      // Prevenção contra execução duplicada do mesmo comando
      if (processedCommandsRef.current.has(commandId)) {
        return;
      }
      processedCommandsRef.current.add(commandId);

      // Limpar timer anterior se houver
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }

      // Enviar ACK imediato ao servidor
      socket.emit(SOCKET_EVENTS.ALERT_ACK, {
        commandId,
        status: 'ok',
        timestamp: Date.now(),
      });

      // Ativar tela 100% vermelha pura (#FF0000)
      setIsAlertActive(true);

      // Programar retorno automático ao normal após os 5 segundos
      alertTimerRef.current = setTimeout(() => {
        setIsAlertActive(false);
        alertTimerRef.current = null;
      }, durationMs);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.PAIRING_RESULT, onPairingResult);
    socket.on(SOCKET_EVENTS.DEVICE_UNPAIRED, onDeviceUnpaired);
    socket.on(SOCKET_EVENTS.ALERT_LOCATE, onAlertLocate);

    if (socket.connected && deviceId) {
      socket.emit(SOCKET_EVENTS.DEVICE_IDENTIFY, { deviceId });
      requestWakeLock();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.PAIRING_RESULT, onPairingResult);
      socket.off(SOCKET_EVENTS.DEVICE_UNPAIRED, onDeviceUnpaired);
      socket.off(SOCKET_EVENTS.ALERT_LOCATE, onAlertLocate);
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    };
  }, [deviceId, requestWakeLock]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setError('Por favor, digite os 6 números do código.');
      return;
    }

    setSubmitting(true);
    setError(null);
    socket.emit(SOCKET_EVENTS.PAIRING_SUBMIT, { code: cleanCode });
  };

  const handleUnpairSelf = () => {
    localStorage.removeItem(STORAGE_KEY_DEVICE_ID);
    localStorage.removeItem(STORAGE_KEY_CARD_NAME);
    setDeviceId(null);
    setCardName(null);
    setCode('');
    setError(null);
    setIsAlertActive(false);
  };

  return (
    <>
      {/* Tela Vermelha de 5 Segundos (Sem textos, sem botões, 100% visibilidade) */}
      {isAlertActive && (
        <div
          id="full-screen-red-alert"
          className="full-screen-red-alert"
          role="alert"
          aria-label="Alerta de localização visual ativado"
        />
      )}

      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          padding: '1rem',
        }}
      >
        {/* Cabeçalho do Receptor */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="brand-icon-wrapper" style={{ width: 36, height: 36 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Phone Finder</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receptor Móvel</p>
            </div>
          </div>

          <div className={`status-tag ${isSocketConnected ? 'connected' : 'disconnected'}`}>
            ● {isSocketConnected ? 'Wi-Fi Conectado' : 'Reconectando...'}
          </div>
        </div>

        {/* Conteúdo Principal */}
        {deviceId ? (
          /* Estado Pareado e Monitorando */
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-glow)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.25rem',
              textAlign: 'center',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>

            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ✓ Aparelho Pareado
              </span>
              <h2 style={{ fontSize: '1.4rem', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                {cardName || 'Celular Conectado'}
              </h2>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                ID: {deviceId.slice(0, 13)}...
              </p>
            </div>

            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '0.9rem',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
              }}
            >
              📱 <strong>Aguardando comandos de localização.</strong><br />
              Mantenha esta aba aberta para receber o alerta de tela vermelha de 5 segundos.
            </div>

            {wakeLockActive ? (
              <div style={{ fontSize: '0.8rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>☀️</span> Tela mantida ativa automaticamente (Wake Lock ativo)
              </div>
            ) : (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                onClick={requestWakeLock}
              >
                ☀️ Manter tela ligada
              </button>
            )}

            <button
              id="btn-receiver-unpair"
              className="btn btn-secondary"
              style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', marginTop: '1rem' }}
              onClick={handleUnpairSelf}
            >
              Desvincular este Celular
            </button>
          </div>
        ) : (
          /* Estado Não Pareado: Formulário de Digitação de Código */
          <form
            onSubmit={handleSubmit}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.3rem', marginBottom: '0.35rem' }}>Parear Aparelho</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Digite o código de 6 dígitos gerado no card do Dashboard para vincular este celular:
              </p>
            </div>

            <div className="form-group" style={{ alignItems: 'center' }}>
              <input
                id="input-receiver-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className="input-text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{
                  fontSize: '2rem',
                  textAlign: 'center',
                  letterSpacing: '0.4em',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  width: '100%',
                  maxWidth: '280px',
                  padding: '0.75rem',
                }}
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="form-error" style={{ textAlign: 'center' }} role="alert">
                ⚠️ {error}
              </p>
            )}

            <button
              id="btn-receiver-submit"
              type="submit"
              className="btn btn-primary"
              disabled={submitting || code.length !== 6 || !isSocketConnected}
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
            >
              {submitting ? 'Validando Código...' : 'Vincular e Conectar'}
            </button>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
              💡 Dica: O código expira em 5 minutos e é válido para uma única utilização.
            </p>
          </form>
        )}
      </div>
    </>
  );
}
