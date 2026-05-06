import type { Medicine } from '../types';

interface Props {
  results: Medicine[];
  selectedId: string | null;
  onSelect: (m: Medicine) => void;
}

export function ResultList({ results, selectedId, onSelect }: Props) {
  if (results.length === 0) return null;

  return (
    <div className="result-list">
      {results.map((m) => (
        <button
          key={m.id}
          className={`result-row ${m.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(m)}
          type="button"
          aria-pressed={m.id === selectedId}
        >
          <span className="result-pick">{m.id === selectedId ? 'Selected' : 'Select'}</span>
          <span className="result-sku">{m.sku}</span>
          <span className="result-name">{m.trade_name}</span>
          {m.generic_name && (
            <span className="result-price text-sub" style={{ color: '#9a8f82', fontWeight: 400 }}>
              {m.generic_name}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
