import { useState, useEffect, useRef, useCallback } from 'react';
import { PairingGeneratedPayload, SOCKET_EVENTS } from 'shared';
import { socket } from '../services/socket';

export function usePairing(cardId: string | null) {
  const [pairingData, setPairingData] = useState<PairingGeneratedPayload | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isPairedSuccessfully, setIsPairedSuccessfully] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const generateCode = useCallback(async (targetCardId: string) => {
    try {
      setLoading(true);
      setError(null);
      setIsPairedSuccessfully(false);
      setIsExpired(false);
      clearTimer();

      const res = await fetch(`/api/cards/${targetCardId}/pairing-code`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao gerar código de pareamento.');
      }

      const data: PairingGeneratedPayload = await res.json();
      setPairingData(data);

      const remainingMs = Math.max(0, data.expiresAt - Date.now());
      const remainingSec = Math.floor(remainingMs / 1000);
      setTimeLeftSeconds(remainingSec);

      timerRef.current = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao solicitar código';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cardId) {
      generateCode(cardId);
    } else {
      clearTimer();
      setPairingData(null);
      setTimeLeftSeconds(0);
      setIsExpired(false);
      setIsPairedSuccessfully(false);
    }

    return () => clearTimer();
  }, [cardId, generateCode]);

  useEffect(() => {
    // Escuta evento de pareamento bem-sucedido
    const onDeviceStatus = (payload: { cardId: string; status: 'connected' | 'disconnected' }) => {
      if (cardId && payload.cardId === cardId && payload.status === 'connected') {
        setIsPairedSuccessfully(true);
        clearTimer();
      }
    };

    socket.on(SOCKET_EVENTS.DEVICE_STATUS, onDeviceStatus);

    return () => {
      socket.off(SOCKET_EVENTS.DEVICE_STATUS, onDeviceStatus);
    };
  }, [cardId]);

  const unpair = async (targetCardId: string): Promise<void> => {
    const res = await fetch(`/api/cards/${targetCardId}/unpair`, {
      method: 'POST',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao desvincular aparelho.');
    }
  };

  return {
    pairingData,
    timeLeftSeconds,
    isExpired,
    isPairedSuccessfully,
    loading,
    error,
    regenerateCode: () => cardId && generateCode(cardId),
    unpair,
  };
}
