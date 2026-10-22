import { useState, useEffect } from 'react';
import { socket } from './services/socket';
import { useCards } from './hooks/useCards';
import { DeviceCard } from './components/DeviceCard';
import { AddCardModal } from './components/AddCardModal';
import { EditCardModal } from './components/EditCardModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { PairingModal } from './components/PairingModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Receiver } from './pages/Receiver';
import { CardWithStatus, LocateFeedbackPayload, SystemInfoResponse, SOCKET_EVENTS } from 'shared';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isSocketConnected, setIsSocketConnected] = useState(socket.connected);
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null);

  // Modais
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardWithStatus | null>(null);
  const [deletingCard, setDeletingCard] = useState<CardWithStatus | null>(null);
  const [pairingCard, setPairingCard] = useState<CardWithStatus | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Gerenciamento de Cards
  const { cards, loading, error, refresh, addCard, updateCard, deleteCard, setCardLocating } = useCards();

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    // Escutar feedback de execução do comando "Localizar celular"
    const onLocateFeedback = (feedback: LocateFeedbackPayload) => {
      setCardLocating(feedback.cardId, false);
      if (feedback.status === 'success') {
        addToast('success', feedback.message);
      } else {
        addToast('error', feedback.message);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.LOCATE_FEEDBACK, onLocateFeedback);

    // Buscar informações de rede
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data: SystemInfoResponse) => setSystemInfo(data))
      .catch((err) => console.warn('Erro ao carregar rede:', err));

    return () => {
      window.removeEventListener('popstate', handlePopState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.LOCATE_FEEDBACK, onLocateFeedback);
    };
  }, [setCardLocating]);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Ações de Cards
  const handleAddCard = async (dto: { name: string; description?: string }) => {
    await addCard(dto);
    addToast('success', `Celular "${dto.name}" adicionado com sucesso!`);
  };

  const handleUpdateCard = async (id: string, dto: { name?: string; description?: string }) => {
    const updated = await updateCard(id, dto);
    addToast('success', `Celular "${updated.name}" atualizado com sucesso!`);
  };

  const handleDeleteCard = async (id: string) => {
    const cardToDelete = cards.find((c) => c.id === id);
    await deleteCard(id);
    addToast('info', `Celular "${cardToDelete?.name || ''}" foi removido.`);
  };

  const handleLocateCard = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.status !== 'connected') {
      addToast('error', 'O celular precisa estar conectado na rede Wi-Fi para ser localizado.');
      return;
    }

    setCardLocating(cardId, true);
    addToast('info', `Disparando comando de tela vermelha para "${card.name}"...`);

    // Emissão do comando via Socket.IO
    socket.emit(SOCKET_EVENTS.LOCATE_TRIGGER, { cardId });
  };

  const handleOpenPairing = (card: CardWithStatus) => {
    setPairingCard(card);
  };

  return (
    <div className="app-container">
      {/* Cabeçalho Principal */}
      <header className="app-header" id="main-header">
        <div className="brand-section">
          <div className="brand-icon-wrapper" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
          </div>
          <div>
            <h1 className="brand-title">Phone Finder</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Localização visual em rede Wi-Fi local
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="lan-badge" title="Operação 100% em rede Wi-Fi local sem nuvem">
            <span className="pulse-dot"></span>
            Rede Local Wi-Fi
          </div>

          <div
            className={`status-tag ${isSocketConnected ? 'connected' : 'disconnected'}`}
            id="socket-status-badge"
          >
            ● {isSocketConnected ? 'WebSocket Online' : 'WebSocket Conectando'}
          </div>
        </div>
      </header>

      {/* Navegação entre Dashboard e Receptor Web */}
      <nav style={{ display: 'flex', gap: '0.75rem' }} aria-label="Navegação da Aplicação">
        <button
          id="btn-nav-dashboard"
          className={`btn ${currentPath === '/' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => navigateTo('/')}
        >
          Dashboard (Computador)
        </button>
        <button
          id="btn-nav-receiver"
          className={`btn ${currentPath === '/receiver' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => navigateTo('/receiver')}
        >
          Receptor Móvel (/receiver)
        </button>
      </nav>

      {/* Banner de Diagnóstico de Rede Local */}
      <section className="info-banner" id="lan-diagnostics-banner" aria-label="Informações de Rede Local">
        <div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            Acesso para Celulares na mesma rede Wi-Fi
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Abra o navegador do celular e acesse o receptor pelo IPv4 local:
          </p>
        </div>

        <div className="ip-list">
          {systemInfo?.interfaces && systemInfo.interfaces.length > 0 ? (
            systemInfo.interfaces.map((iface) => (
              <span key={iface.ip} className="ip-badge" title={`Interface: ${iface.name}`}>
                {iface.receiverUrl}
              </span>
            ))
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Carregando interfaces de rede...
            </span>
          )}
        </div>
      </section>

      {/* Conteúdo Principal */}
      {currentPath === '/receiver' ? (
        <Receiver />
      ) : (
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Barra de Ações do Dashboard */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem' }}>Celulares Cadastrados</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Gerencie seus aparelhos físicos ({cards.length} cadastrado{cards.length === 1 ? '' : 's'})
              </p>
            </div>

            <button
              id="btn-add-device"
              className="btn btn-primary"
              onClick={() => setIsAddModalOpen(true)}
            >
              + Adicionar celular
            </button>
          </div>

          {/* Tratamento de Erro */}
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                color: '#f87171',
                fontSize: '0.9rem',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Grade de Cards ou Estados Vazios / Carregamento */}
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Carregando celulares cadastrados...
            </div>
          ) : cards.length === 0 ? (
            <div
              id="empty-state-container"
              style={{
                background: 'var(--bg-surface)',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: 'var(--radius-lg)',
                padding: '4rem 2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Nenhum celular cadastrado</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px' }}>
                  Clique no botão "Adicionar celular" para cadastrar seu primeiro aparelho e gerar o código de pareamento.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setIsAddModalOpen(true)}
                id="btn-empty-add-device"
              >
                + Adicionar celular agora
              </button>
            </div>
          ) : (
            <div className="cards-grid" id="devices-cards-grid">
              {cards.map((card) => (
                <DeviceCard
                  key={card.id}
                  card={card}
                  onLocate={handleLocateCard}
                  onPair={handleOpenPairing}
                  onEdit={(c) => setEditingCard(c)}
                  onDelete={(c) => setDeletingCard(c)}
                />
              ))}
            </div>
          )}
        </main>
      )}

      {/* Modais */}
      <AddCardModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddCard}
      />

      <EditCardModal
        card={editingCard}
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        onSubmit={handleUpdateCard}
      />

      <DeleteConfirmModal
        card={deletingCard}
        isOpen={!!deletingCard}
        onClose={() => setDeletingCard(null)}
        onConfirm={handleDeleteCard}
      />

      <PairingModal
        card={pairingCard}
        isOpen={!!pairingCard}
        onClose={() => setPairingCard(null)}
        systemInfo={systemInfo}
        onUnpairSuccess={() => {
          refresh();
          addToast('info', 'Aparelho desvinculado com sucesso.');
        }}
      />

      {/* Container de Notificações Toast */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
