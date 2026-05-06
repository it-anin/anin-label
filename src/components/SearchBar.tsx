import { useState, type FormEvent } from 'react';

interface Props {
  onSubmit: (q: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export function SearchBar({ onSubmit, loading, placeholder }: Props) {
  const [value, setValue] = useState('');

  function handle(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q) onSubmit(q);
  }

  return (
    <form className="search-wrap" onSubmit={handle}>
      <input
        className="search-input"
        type="text"
        autoFocus
        placeholder={placeholder ?? 'พิมพ์ SKU / บาร์โค้ด / ชื่อยา แล้วกด Enter'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
      />
      <button className="search-btn" type="submit" disabled={loading} aria-label="search">
        {loading ? '…' : '→'}
      </button>
    </form>
  );
}
