import { CardWithStatus } from 'shared';

interface DeviceCardProps {
  card: CardWithStatus;
  onLocate: (cardId: string) => void;
  onPair: (card: CardWithStatus) => void;
  onEdit: (card: CardWithStatus) => void;
  onDelete: (card: CardWithStatus) => void;
}

function getBatteryIcon(level: number): string {
  if (level > 70) return '🔋';
  if (level > 20) return '🔋';
  return '🪫';
}

function getBatteryColor(level: number): string {
  if (level > 50) return '#34d399';
  if (level > 20) return '#fbbf24';
  return '#f87171';
}

function getBatteryBg(level: number): string {
  if (level > 50) return 'rgba(16, 185, 129, 0.12)';
  if (level > 20) return 'rgba(245, 158, 11, 0.12)';
  return 'rgba(239, 68, 68, 0.12)';
}

function getBatteryBorder(level: number): string {
  if (level > 50) return 'rgba(16, 185, 129, 0.28)';
  if (level > 20) return 'rgba(245, 158, 11, 0.28)';
  return 'rgba(239, 68, 68, 0.28)';
}

function formatBatteryTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function DeviceCard({ card, onLocate, onPair, onEdit, onDelete }: DeviceCardProps) {
  const isOnline = card.status === 'connected';

  return (
    <article className="device-card" id={`card-${card.id}`}>
      <div className="card-top">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="card-title" title={card.name} style={{ wordBreak: 'break-word' }}>
            {card.name}
          </h3>
          <p className="card-desc" style={{ wordBreak: 'break-word' }}>
            {card.description || 'Sem descrição cadastrada'}
          </p>
        </div>

        <div
          className={`status-tag ${isOnline ? 'connected' : 'disconnected'}`}
          id={`status-${card.id}`}
        >
          {isOnline ? (
            <>
              <span className="pulse-dot" style={{ width: 6, height: 6 }}></span>
              Conectado
            </>
          ) : (
            'Desconectado'
          )}
        </div>
      </div>

      {/* Identificação de vínculo e nível de bateria */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.775rem' }}>
        <div style={{ color: 'var(--text-muted)' }}>
          <span>ID: {card.id.slice(0, 8)}...</span>
          <span style={{ marginLeft: '0.4rem' }}>
            {card.pairedDeviceId ? '✓ Aparelho Pareado' : 'Aguardando Pareamento'}
          </span>
        </div>

        {card.battery ? (
          <div
            className="battery-indicator"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.775rem',
              fontWeight: 600,
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-sm)',
              background: getBatteryBg(card.battery.level),
              color: getBatteryColor(card.battery.level),
              border: `1px solid ${getBatteryBorder(card.battery.level)}`,
              opacity: isOnline ? 1 : 0.65,
            }}
            title={`Nível de bateria: ${card.battery.level}%${card.battery.isCharging ? ' (Carregando ⚡)' : ''} • Última leitura: ${formatBatteryTime(card.battery.updatedAt)}${!isOnline ? ' (celular offline)' : ''}`}
          >
            <span>{card.battery.isCharging ? '⚡' : getBatteryIcon(card.battery.level)}</span>
            <span>{card.battery.level}%</span>
          </div>
        ) : isOnline ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title="Aguardando primeira leitura periódica do celular (ciclo de 10 min)...">
            <span>🔋</span>
            <span>Lendo bateria...</span>
          </div>
        ) : null}
      </div>

      {/* Botão Principal de Localização Visual */}
      <button
        id={`btn-locate-${card.id}`}
        className="btn btn-locate"
        style={{ width: '100%', padding: '0.85rem' }}
        disabled={!isOnline || card.isLocating}
        onClick={() => onLocate(card.id)}
        title={!isOnline ? 'O celular precisa estar conectado na rede Wi-Fi para ser localizado' : 'Disparar tela 100% vermelha por 5s'}
      >
        {card.isLocating ? (
          <>
            <span className="pulse-dot" style={{ width: 8, height: 8 }}></span>
            Localizando Celular...
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="22" y1="12" x2="18" y2="12"></line>
              <line x1="6" y1="12" x2="2" y2="12"></line>
              <line x1="12" y1="6" x2="12" y2="2"></line>
              <line x1="12" y1="22" x2="12" y2="18"></line>
            </svg>
            Localizar Celular
          </>
        )}
      </button>

      {!isOnline && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '-0.5rem' }}>
          ⚠️ Desconectado — Conecte o aparelho para localizar
        </p>
      )}

      {/* Ações Secundárias do Card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          id={`btn-pair-${card.id}`}
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}
          onClick={() => onPair(card)}
          title="Gerar código de 6 dígitos para parear com o celular"
        >
          🔑 Parear
        </button>

        <button
          id={`btn-edit-${card.id}`}
          className="btn btn-secondary"
          style={{ padding: '0.45rem 0.6rem', fontSize: '0.8rem' }}
          onClick={() => onEdit(card)}
          title="Renomear este celular"
        >
          ✏️ Renomear
        </button>

        <button
          id={`btn-delete-${card.id}`}
          className="btn btn-secondary"
          style={{
            padding: '0.45rem 0.65rem',
            fontSize: '0.8rem',
            color: 'var(--accent-rose)',
          }}
          onClick={() => onDelete(card)}
          title="Excluir este card"
        >
          🗑️
        </button>
      </div>
    </article>
  );
}
