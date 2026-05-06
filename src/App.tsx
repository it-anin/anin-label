import { useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { LANGS, type Lang, type Medicine, type ShopSettings } from './types';
import { Label } from './components/Label';
import { SearchBar } from './components/SearchBar';
import { ResultList } from './components/ResultList';
import { AddMedicineModal } from './components/AddMedicineModal';

function flatMed(
  med: { id: string; sku: string; barcode: string | null },
  tr: { trade_name?: string | null; generic_name?: string | null; usage?: string | null; indication?: string | null; warning?: string | null; storage?: string | null } | null
): Medicine {
  return {
    id: med.id,
    sku: med.sku,
    barcode: med.barcode,
    trade_name:   tr?.trade_name   ?? `(${med.sku})`,
    generic_name: tr?.generic_name ?? null,
    usage:        tr?.usage        ?? null,
    indication:   tr?.indication   ?? null,
    warning:      tr?.warning      ?? null,
    storage:      tr?.storage      ?? null,
  };
}

export default function App() {
  const [settings, setSettings]   = useState<ShopSettings | null>(null);
  const [lang, setLang]           = useState<Lang>('th');
  const [lastQuery, setLastQuery] = useState('');
  const [results, setResults]     = useState<Medicine[]>([]);
  const [selected, setSelected]   = useState<Medicine | null>(null);
  const [loading, setLoading]     = useState(false);
  const [searched, setSearched]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const printRootRef              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('settings').select('*').eq('id', 1).single().then(({ data, error }) => {
      if (error) setError(`โหลดข้อมูลร้านไม่ได้: ${error.message}`);
      else setSettings(data as ShopSettings);
    });
  }, []);

  // Re-run last search when language changes
  useEffect(() => {
    if (lastQuery) doSearch(lastQuery, lang);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  async function doSearch(q: string, searchLang: Lang) {
    setLoading(true);
    setError(null);
    setSearched(true);

    // 1. Exact SKU or barcode — may return multiple rows (same SKU, different sizes)
    const { data: exactMeds, error: e1 } = await supabase
      .from('medicines')
      .select('id, sku, barcode')
      .or(`sku.eq.${q},barcode.eq.${q}`)
      .limit(20);

    if (e1) { setError(e1.message); setLoading(false); return; }

    if (exactMeds && exactMeds.length > 0) {
      const medList = exactMeds as { id: string; sku: string; barcode: string | null }[];

      // Fetch translations for all matched medicines in one query
      const ids = medList.map(m => m.id);
      const { data: trList } = await supabase
        .from('medicine_translations')
        .select('medicine_id,trade_name,generic_name,usage,indication,warning,storage')
        .in('medicine_id', ids)
        .eq('lang', searchLang);

      const trMap: Record<string, typeof trList extends (infer T)[] | null ? T : never> = {};
      for (const t of trList ?? []) {
        trMap[(t as { medicine_id: string }).medicine_id] = t;
      }

      const meds = medList.map(m => flatMed(m, trMap[m.id] ?? null));
      setResults(meds);
      setSelected(meds.length === 1 ? meds[0] : null);
      setLoading(false);
      return;
    }

    // 2. Fuzzy search on translation
    const { data: list, error: e2 } = await supabase
      .from('medicine_translations')
      .select('trade_name,generic_name,usage,indication,warning,storage,medicines!inner(id,sku,barcode)')
      .eq('lang', searchLang)
      .or(`trade_name.ilike.%${q}%,generic_name.ilike.%${q}%`)
      .limit(30);

    if (e2) { setError(e2.message); setLoading(false); return; }

    type Row = {
      trade_name: string | null; generic_name: string | null;
      usage: string | null; indication: string | null;
      warning: string | null; storage: string | null;
      medicines: { id: string; sku: string; barcode: string | null }[];
    };
    const meds = (list as unknown as Row[]).map(r => flatMed(r.medicines[0], r));
    setResults(meds);
    setSelected(meds.length === 1 ? meds[0] : null);
    setLoading(false);
  }

  function search(q: string) {
    setLastQuery(q);
    doSearch(q, lang);
  }

  function handleLangChange(l: Lang) {
    setLang(l);
    // doSearch triggered by useEffect above
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
            {settings ? `${settings.shop_name_th} · ${settings.shop_name_en}` : 'กำลังโหลด…'}
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <SearchBar onSubmit={search} loading={loading} />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button className="btn-gold btn-gold--add" onClick={() => setShowAdd(true)}>
              + เพิ่มฉลากยา
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="results-panel">
          {error && <div className="error-line">{error}</div>}
          {loading && <div className="status-line">กำลังค้นหา…</div>}
          {!loading && !searched && (
            <div className="status-line">สแกนบาร์โค้ดหรือพิมพ์ SKU / ชื่อยา เพื่อเริ่มค้นหา</div>
          )}
          {!loading && searched && results.length === 0 && !error && (
            <div className="empty-state" style={{ boxShadow: 'none', padding: '2rem 1rem' }}>
              <div className="empty-icon">🔍</div>
              <h3>ไม่พบรายการ</h3>
              <p>ลองพิมพ์ SKU หรือชื่อยาอื่น</p>
            </div>
          )}
          <ResultList results={results} selectedId={selected?.id ?? null} onSelect={setSelected} />
        </section>

        <aside className="preview-panel">
          <h3>ตัวอย่างฉลาก (90 × 65 mm)</h3>

          {/* Language selector */}
          <div className="lang-selector">
            {LANGS.map(({ code, label }) => (
              <button
                key={code}
                className={`lang-btn ${lang === code ? 'active' : ''}`}
                onClick={() => handleLangChange(code)}
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
                <button className="btn-gold" onClick={handlePrint}>
                  พิมพ์ฉลาก
                </button>
              </div>
            </>
          ) : (
            <div className="empty-preview">เลือกรายการยาเพื่อดูตัวอย่างฉลาก</div>
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
