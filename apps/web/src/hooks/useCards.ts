import { useState, useEffect, useCallback } from 'react';
import { CardWithStatus, CreateCardDTO, UpdateCardDTO, SOCKET_EVENTS } from 'shared';
import { socket } from '../services/socket';

export function useCards() {
  const [cards, setCards] = useState<CardWithStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cards');
      if (!res.ok) {
        throw new Error(`Erro ao buscar cards: HTTP ${res.status}`);
      }
      const data: CardWithStatus[] = await res.json();
      setCards(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar celulares';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();

    // Ouvir atualizações de conectividade em tempo real via Socket.IO
    const onDeviceStatus = (payload: { cardId: string; status: 'connected' | 'disconnected' }) => {
      setCards((prevCards) =>
        prevCards.map((card) =>
          card.id === payload.cardId ? { ...card, status: payload.status } : card
        )
      );
    };

    // Ouvir telemetria de bateria recebida a cada ciclo de 10 minutos
    const onCardBattery = (payload: { cardId: string; level: number; isCharging?: boolean; updatedAt: string }) => {
      setCards((prevCards) =>
        prevCards.map((card) =>
          card.id === payload.cardId
            ? {
                ...card,
                battery: {
                  level: payload.level,
                  isCharging: payload.isCharging,
                  updatedAt: payload.updatedAt,
                },
              }
            : card
        )
      );
    };

    socket.on(SOCKET_EVENTS.DEVICE_STATUS, onDeviceStatus);
    socket.on(SOCKET_EVENTS.CARD_BATTERY, onCardBattery);

    return () => {
      socket.off(SOCKET_EVENTS.DEVICE_STATUS, onDeviceStatus);
      socket.off(SOCKET_EVENTS.CARD_BATTERY, onCardBattery);
    };
  }, [fetchCards]);

  const addCard = async (dto: CreateCardDTO): Promise<CardWithStatus> => {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao cadastrar celular.');
    }

    const created: CardWithStatus = await res.json();
    setCards((prev) => [created, ...prev]);
    return created;
  };

  const updateCard = async (id: string, dto: UpdateCardDTO): Promise<CardWithStatus> => {
    const res = await fetch(`/api/cards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao atualizar celular.');
    }

    const updated: CardWithStatus = await res.json();
    setCards((prev) => prev.map((card) => (card.id === id ? updated : card)));
    return updated;
  };

  const deleteCard = async (id: string): Promise<void> => {
    const res = await fetch(`/api/cards/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao remover celular.');
    }

    setCards((prev) => prev.filter((card) => card.id !== id));
  };

  const setCardLocating = (cardId: string, isLocating: boolean) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isLocating } : c))
    );
  };

  return {
    cards,
    loading,
    error,
    refresh: fetchCards,
    addCard,
    updateCard,
    deleteCard,
    setCardLocating,
  };
}
