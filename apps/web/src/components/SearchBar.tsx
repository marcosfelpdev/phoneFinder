interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  totalCards: number;
  filteredCount: number;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar celular por nome...',
  totalCards,
  filteredCount,
}: SearchBarProps) {
  return (
    <div className="search-bar-container" role="search">
      <div className="search-input-wrapper">
        <span className="search-icon" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </span>

        <input
          id="search-devices-input"
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onChange('');
            }
          }}
          aria-label="Buscar celular pelo nome"
          autoComplete="off"
        />

        {value && (
          <div className="search-trailing-actions">
            <span className="search-count-badge">
              {filteredCount} de {totalCards} {totalCards === 1 ? 'celular' : 'celulares'}
            </span>
            <button
              type="button"
              id="btn-clear-search"
              className="search-clear-btn"
              onClick={() => onChange('')}
              title="Limpar pesquisa (Esc)"
              aria-label="Limpar pesquisa"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
