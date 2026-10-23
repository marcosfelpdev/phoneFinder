import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SystemInfoResponse } from 'shared';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInfo: SystemInfoResponse | null;
}

export function ApkDownloadModal({ isOpen, onClose, systemInfo }: ApkDownloadModalProps) {
  const [copied, setCopied] = useState(false);
  const [selectedInterfaceIndex, setSelectedInterfaceIndex] = useState(0);

  if (!isOpen) return null;

  const interfaces = systemInfo?.interfaces || [];
  const currentInterface = interfaces[selectedInterfaceIndex] || interfaces[0];

  // URL para download direto no celular
  const downloadUrl = currentInterface?.apkDownloadUrl || `${window.location.origin}/api/apk/download`;
  const apkInfo = systemInfo?.apkInfo;
  const isApkAvailable = apkInfo?.available ?? true;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-apk-title"
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px', textAlign: 'center' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
            </div>
            <h2 id="modal-apk-title" className="modal-title" style={{ fontSize: '1.2rem', textAlign: 'left' }}>
              Instalar App no Celular via Wi-Fi
            </h2>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Fechar" id="btn-close-apk-modal">
            ✕
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'left', lineHeight: '1.4' }}>
          Escaneie o QR Code abaixo com a câmera do celular conectado à mesma rede Wi-Fi para baixar e instalar o aplicativo Android diretamente, sem precisar de cabos ou opções de desenvolvedor.
        </p>

        {/* Seletor de Interface de Rede caso haja mais de uma */}
        {interfaces.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rede:</span>
            <select
              value={selectedInterfaceIndex}
              onChange={(e) => setSelectedInterfaceIndex(Number(e.target.value))}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '0.825rem',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {interfaces.map((iface, idx) => (
                <option key={iface.ip} value={idx} style={{ background: '#111726', color: 'white' }}>
                  {iface.name} ({iface.ip})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Card do QR Code */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-glow)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {/* Container branco de alto contraste para o QR Code */}
          <div
            style={{
              background: '#ffffff',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <QRCodeSVG
              value={downloadUrl}
              size={190}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Status do Arquivo APK */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            {isApkAvailable ? (
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span>✓</span> APK pronto para download {apkInfo?.fileSizeMb ? `(${apkInfo.fileSizeMb})` : ''}
              </span>
            ) : (
              <span style={{ color: 'var(--accent-amber)', fontWeight: 500 }}>
                ⚠️ O arquivo APK ainda não foi gerado no servidor.
              </span>
            )}
          </div>

          {/* Link direto e botão copiar */}
          <div style={{ width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={downloadUrl}
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.5rem 0.75rem',
                color: 'var(--accent-cyan)',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
              }}
            />
            <button
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              onClick={handleCopyLink}
            >
              {copied ? '✓ Copiado!' : '📋 Copiar'}
            </button>
          </div>
        </div>

        {/* Instruções Rápidas de Instalação */}
        <div style={{ textAlign: 'left', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            📲 Como instalar em 3 passos:
          </h4>
          <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.825rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li>
              Aponte a <strong>câmera do celular</strong> para o QR Code acima e toque na notificação para baixar o <code>PhoneFinder.apk</code>.
            </li>
            <li>
              Abra o arquivo baixado e toque em <strong>Instalar</strong>. Se o Android perguntar, autorize a opção <em>"Permitir desta fonte"</em> para o seu navegador.
            </li>
            <li>
              Abra o aplicativo no celular e conceda as permissões de <strong>Notificação</strong> e <strong>Sobreposição de Tela</strong> para que o alarme acenda a tela mesmo apagada.
            </li>
          </ol>
        </div>

        {/* Rodapé com Ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <a
            href={downloadUrl}
            download="PhoneFinder.apk"
            className="btn btn-secondary"
            style={{ fontSize: '0.825rem', textDecoration: 'none' }}
          >
            💾 Baixar no PC
          </a>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Entendi, fechar
          </button>
        </div>
      </div>
    </div>
  );
}
