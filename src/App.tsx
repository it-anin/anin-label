import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigError } from './lib/supabase';
import { LANGS, type Lang, type Medicine, type ShopSettings } from './types';
import { Label } from './components/Label';
import { SearchBar } from './components/SearchBar';
import { ResultList } from './components/ResultList';
import { AddMedicineModal } from './components/AddMedicineModal';

function flatMed(
  med: { id: string; sku: string; barcode: string | null },
  tr: {
    trade_name?: string | null;
    generic_name?: string | null;
    usage?: string | null;
    indication?: string | null;
    warning?: string | null;
    storage?: string | null;
  } | null
): Medicine {
  return {
    id: med.id,
    sku: med.sku,
    barcode: med.barcode,
    trade_name: tr?.trade_name ?? `(${med.sku})`,
    generic_name: tr?.generic_name ?? null,
    usage: tr?.usage ?? null,
    indication: tr?.indication ?? null,
    warning: tr?.warning ?? null,
    storage: tr?.storage ?? null,
  };
}

export default function App() {
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [lang, setLang] = useState<Lang>('th');
  const [lastQuery, setLastQuery] = useState('');
  const [results, setResults] = useState<Medicine[]>([]);
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const printRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) {
      setError(supabaseConfigError ?? 'Supabase is not configured.');
      return;
    }

    supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError(`Failed to load shop settings: ${error.message}`);
          return;
        }

        setSettings(data as ShopSettings);
      });
  }, []);

  useEffect(() => {
    if (lastQuery) void doSearch(lastQuery, lang);
  }, [lang, lastQuery]);

  async function doSearch(q: string, searchLang: Lang) {
    if (!supabase) {
      setError(supabaseConfigError ?? 'Supabase is not configured.');
      setSearched(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    const { data: exactMeds, error: exactError } = await supabase
      .from('medicines')
      .select('id, sku, barcode')
      .or(`sku.eq.${q},barcode.eq.${q}`)
      .limit(20);

    if (exactError) {
      setError(exactError.message);
      setLoading(false);
      return;
    }

    if (exactMeds && exactMeds.length > 0) {
      const medList = exactMeds as { id: string; sku: string; barcode: string | null }[];
      const ids = medList.map((m) => m.id);
      const { data: trList, error: translationError } = await supabase
        .from('medicine_translations')
        .select('medicine_id,trade_name,generic_name,usage,indication,warning,storage')
        .in('medicine_id', ids)
        .eq('lang', searchLang);

      if (translationError) {
        setError(translationError.message);
        setLoading(false);
        return;
      }

      const trMap: Record<string, (typeof trList)[number]> = {};
      for (const t of trList ?? []) {
        trMap[(t as { medicine_id: string }).medicine_id] = t;
      }

      const meds = medList.map((m) => flatMed(m, trMap[m.id] ?? null));
      setResults(meds);
      setSelected(meds.length === 1 ? meds[0] : null);
      setLoading(false);
      return;
    }

    const { data: list, error: fuzzyError } = await supabase
      .from('medicine_translations')
      .select('trade_name,generic_name,usage,indication,warning,storage,medicines!inner(id,sku,barcode)')
      .eq('lang', searchLang)
      .or(`trade_name.ilike.%${q}%,generic_name.ilike.%${q}%`)
      .limit(30);

    if (fuzzyError) {
      setError(fuzzyError.message);
      setLoading(false);
      return;
    }

    type Row = {
      trade_name: string | null;
      generic_name: string | null;
      usage: string | null;
      indication: string | null;
      warning: string | null;
      storage: string | null;
      medicines: { id: string; sku: string; barcode: string | null }[];
    };

    const meds = (list as unknown as Row[]).map((r) => flatMed(r.medicines[0], r));
    setResults(meds);
    setSelected(meds.length === 1 ? meds[0] : null);
    setLoading(false);
  }

  function search(q: string) {
    setLastQuery(q);
    void doSearch(q, lang);
  }

  function handlePrint() {
    if (!selected || !settings) return;
    window.print();
  }

  return (
    <div className="app-container">
      <header className="hero-header">
        <div className="hero-content">
          <div className="logo-premium">{settings?.logo_text ?? 'BIGYA'} LABEL</div>
          <div className="tagline">
            {settings ? `${settings.shop_name_th} | ${settings.shop_name_en}` : 'Loading shop settings...'}
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <SearchBar onSubmit={search} loading={loading} />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button className="btn-gold btn-gold--add" onClick={() => setShowAdd(true)} type="button">
              + Add medicine label
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="results-panel">
          {error && <div className="error-line">{error}</div>}
          {loading && <div className="status-line">Searching...</div>}
          {!loading && !searched && (
            <div className="status-line">Scan barcode or search by SKU / medicine name to begin.</div>
          )}
          {!loading && searched && results.length === 0 && !error && (
            <div className="empty-state" style={{ boxShadow: 'none', padding: '2rem 1rem' }}>
              <div className="empty-icon">Search</div>
              <h3>No results found</h3>
              <p>Try another SKU, barcode, or medicine name.</p>
            </div>
          )}
          <ResultList results={results} selectedId={selected?.id ?? null} onSelect={setSelected} />
        </section>

        <aside className="preview-panel">
          <h3>Label Preview (90 x 65 mm)</h3>

          <div className="lang-selector">
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                className={`lang-btn ${lang === code ? 'active' : ''}`}
                onClick={() => setLang(code)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {selected && settings ? (
            <>
              <div className="preview-frame">
                <Label medicine={selected} settings={settings} preview />
              </div>
              <div className="print-actions">
                <button className="btn-gold" onClick={handlePrint} type="button">
                  Print label
                </button>
              </div>
            </>
          ) : (
            <div className="empty-preview">Select a medicine to preview the label.</div>
          )}
        </aside>
      </main>

      {selected && settings && (
        <div ref={printRootRef} className="label-print-root">
          <Label medicine={selected} settings={settings} />
        </div>
      )}

      {showAdd && (
        <AddMedicineModal
          onClose={() => setShowAdd(false)}
          onSaved={(sku) => {
            setShowAdd(false);
            search(sku);
          }}
        />
      )}
    </div>
  );
}
