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

  async function loadMedicinesByIds(ids: string[], searchLang: Lang) {
    if (!supabase || ids.length === 0) {
      return [];
    }

    const { data: medicinesData, error: medicinesError } = await supabase
      .from('medicines')
      .select('id, sku, barcode')
      .in('id', ids);

    if (medicinesError) {
      throw medicinesError;
    }

    const { data: translationsData, error: translationsError } = await supabase
      .from('medicine_translations')
      .select('medicine_id, trade_name, generic_name, usage, indication, warning, storage')
      .in('medicine_id', ids)
      .eq('lang', searchLang);

    if (translationsError) {
      throw translationsError;
    }

    const translationMap = new Map(
      (translationsData ?? []).map((translation) => [translation.medicine_id, translation])
    );
    const medicineMap = new Map(
      (medicinesData ?? []).map((medicine) => [medicine.id, medicine])
    );

    return ids
      .map((id) => {
        const medicine = medicineMap.get(id);
        if (!medicine) return null;
        return flatMed(medicine, translationMap.get(id) ?? null);
      })
      .filter((medicine): medicine is Medicine => medicine !== null);
  }

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
      const meds = await loadMedicinesByIds(
        (exactMeds as { id: string }[]).map((medicine) => medicine.id),
        searchLang
      );
      setResults(meds);
      setSelected(meds.length === 1 ? meds[0] : null);
      setLoading(false);
      return;
    }

    const { data: list, error: fuzzyError } = await supabase
      .from('medicine_translations')
      .select('medicine_id')
      .or(`trade_name.ilike.%${q}%,generic_name.ilike.%${q}%`)
      .limit(50);

    if (fuzzyError) {
      setError(fuzzyError.message);
      setLoading(false);
      return;
    }

    const ids = Array.from(
      new Set(
        (list ?? [])
          .map((row) => row.medicine_id)
          .filter((medicineId): medicineId is string => Boolean(medicineId))
      )
    ).slice(0, 30);

    const meds = await loadMedicinesByIds(ids, searchLang);
    setResults(meds);
    setSelected(meds.length === 1 ? meds[0] : null);
    setLoading(false);
  }

  function search(q: string) {
    setLastQuery(q);
    void doSearch(q, lang);
  }

  function handlePrint() {
    if (!selected || !settings || !printRootRef.current) return;

    const labelMarkup = printRootRef.current.innerHTML;
    const headMarkup = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

    const printWindow = window.open('', '_blank', 'width=420,height=320');
    if (!printWindow) {
      setError('Unable to open print window. Please allow pop-ups for this site.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="th">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Print Label</title>
          ${headMarkup}
          <style>
            @page { size: 90mm 65mm; margin: 0; }
            html, body {
              margin: 0;
              padding: 0;
              width: 90mm;
              height: 65mm;
              overflow: hidden;
              background: #fff;
            }
            body {
              display: flex;
              align-items: flex-start;
              justify-content: flex-start;
            }
            .label-print-root {
              display: block !important;
              width: 90mm;
              height: 65mm;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            .label {
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
          </style>
        </head>
        <body>
          <div class="label-print-root">${labelMarkup}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    const runPrint = () => {
      printWindow.print();
      printWindow.close();
    };

    if (printWindow.document.readyState === 'complete') {
      setTimeout(runPrint, 150);
    } else {
      printWindow.addEventListener('load', () => setTimeout(runPrint, 150), { once: true });
    }
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
            <div className="status-line">Scan barcode or search by SKU / product name to begin.</div>
          )}
          {!loading && results.length > 1 && (
            <div className="status-line">Select one item from the list to preview and print only that label.</div>
          )}
          {!loading && searched && results.length === 0 && !error && (
            <div className="empty-state" style={{ boxShadow: 'none', padding: '2rem 1rem' }}>
              <div className="empty-icon">Search</div>
              <h3>No results found</h3>
              <p>Try another SKU, barcode, or product name.</p>
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
