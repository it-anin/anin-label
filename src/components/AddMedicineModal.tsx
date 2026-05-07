import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseConfigError } from '../lib/supabase';
import { LANGS, type Lang } from '../types';

type TrForm = {
  trade_name: string;
  generic_name: string;
  usage: string;
  indication: string;
  warning: string;
  storage: string;
};

const emptyTr = (): TrForm => ({
  trade_name: '',
  generic_name: '',
  usage: '',
  indication: '',
  warning: '',
  storage: '',
});

type FormData = {
  sku: string;
  barcode: string;
  translations: Record<Lang, TrForm>;
};

const initForm = (): FormData => ({
  sku: '',
  barcode: '',
  translations: {
    th: emptyTr(),
    en: emptyTr(),
    zh: emptyTr(),
    ja: emptyTr(),
    my: emptyTr(),
    km: emptyTr(),
  },
});

const FIELDS: { key: keyof TrForm; labelTh: string; labelEn: string; type: 'input' | 'textarea' }[] = [
  { key: 'trade_name', labelTh: 'ชื่อการค้า', labelEn: 'Trade name', type: 'input' },
  { key: 'generic_name', labelTh: 'ชื่อยา', labelEn: 'Generic name', type: 'input' },
  { key: 'usage', labelTh: 'วิธีใช้', labelEn: 'Usage', type: 'textarea' },
  { key: 'indication', labelTh: 'ข้อบ่งใช้', labelEn: 'Indication', type: 'textarea' },
  { key: 'warning', labelTh: 'ข้อควรระวัง', labelEn: 'Warning', type: 'textarea' },
  { key: 'storage', labelTh: 'การเก็บรักษา', labelEn: 'Storage', type: 'input' },
];

interface Props {
  onClose: () => void;
  onSaved: (sku: string) => void;
  /** Pass medicine id to open in edit mode with pre-loaded data */
  initialMedicineId?: string;
}

export function AddMedicineModal({ onClose, onSaved, initialMedicineId }: Props) {
  const isEditMode = Boolean(initialMedicineId);
  const [form, setForm] = useState<FormData>(initForm);
  const [activeLang, setActiveLang] = useState<Lang>('th');
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);
  const [skuExists, setSkuExists] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const skuCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseDownOnOverlay = useRef(false);

  // Load existing medicine data when in edit mode
  useEffect(() => {
    if (!initialMedicineId || !supabase) return;

    Promise.all([
      supabase.from('medicines').select('sku, barcode').eq('id', initialMedicineId).single(),
      supabase.from('medicine_translations')
        .select('lang, trade_name, generic_name, usage, indication, warning, storage')
        .eq('medicine_id', initialMedicineId),
    ]).then(([medRes, trRes]) => {
      if (medRes.error || !medRes.data) {
        setError('โหลดข้อมูลไม่สำเร็จ');
        setLoadingData(false);
        return;
      }

      const loaded = initForm();
      loaded.sku = medRes.data.sku ?? '';
      loaded.barcode = medRes.data.barcode ?? '';

      for (const tr of trRes.data ?? []) {
        const lang = tr.lang as Lang;
        if (loaded.translations[lang]) {
          loaded.translations[lang] = {
            trade_name: tr.trade_name ?? '',
            generic_name: tr.generic_name ?? '',
            usage: tr.usage ?? '',
            indication: tr.indication ?? '',
            warning: tr.warning ?? '',
            storage: tr.storage ?? '',
          };
        }
      }

      setForm(loaded);
      setLoadingData(false);
    });
  }, [initialMedicineId]);

  function setField(field: keyof TrForm, value: string) {
    setForm((prev) => ({
      ...prev,
      translations: {
        ...prev.translations,
        [activeLang]: { ...prev.translations[activeLang], [field]: value },
      },
    }));
  }

  function onSkuChange(value: string) {
    setForm((p) => ({ ...p, sku: value }));
    setSkuExists(false);

    if (isEditMode || !value.trim() || !supabase) return;

    if (skuCheckTimer.current) clearTimeout(skuCheckTimer.current);
    skuCheckTimer.current = setTimeout(async () => {
      const { data } = await supabase!
        .from('medicines')
        .select('id')
        .eq('sku', value.trim())
        .maybeSingle();
      setSkuExists(Boolean(data));
    }, 600);
  }

  async function handleSave() {
    const sku = form.sku.trim();
    if (!sku) {
      setError('กรุณากรอก SKU');
      return;
    }

    if (!supabase) {
      setError(supabaseConfigError ?? 'Supabase is not configured.');
      return;
    }

    setSaving(true);
    setError(null);

    let medicineId: string;

    if (isEditMode && initialMedicineId) {
      const { error: medErr } = await supabase
        .from('medicines')
        .update({ sku, barcode: form.barcode.trim() || null })
        .eq('id', initialMedicineId);

      if (medErr) {
        setError(medErr.message);
        setSaving(false);
        return;
      }
      medicineId = initialMedicineId;
    } else {
      const { data: med, error: medErr } = await supabase
        .from('medicines')
        .upsert({ sku, barcode: form.barcode.trim() || null, trade_name_ref: '' }, { onConflict: 'sku,trade_name_ref' })
        .select('id')
        .single();

      if (medErr || !med) {
        setError(medErr?.message ?? 'บันทึกไม่สำเร็จ');
        setSaving(false);
        return;
      }
      medicineId = med.id;
    }

    const rows = Object.entries(form.translations)
      .filter(([, tr]) => tr.trade_name.trim())
      .map(([lang, tr]) => ({
        medicine_id: medicineId,
        lang,
        trade_name: tr.trade_name.trim() || null,
        generic_name: tr.generic_name.trim() || null,
        usage: tr.usage.trim() || null,
        indication: tr.indication.trim() || null,
        warning: tr.warning.trim() || null,
        storage: tr.storage.trim() || null,
      }));

    if (rows.length > 0) {
      const { error: trErr } = await supabase
        .from('medicine_translations')
        .upsert(rows, { onConflict: 'medicine_id,lang' });

      if (trErr) {
        setError(trErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved(sku);
    onClose();
  }

  async function handleAutoTranslate() {
    if (!supabase) {
      setTranslateError(supabaseConfigError ?? 'Supabase not configured.');
      return;
    }
    const sourceTr = form.translations[activeLang];
    if (!sourceTr.trade_name.trim()) {
      setTranslateError('กรุณากรอกชื่อการค้าในแท็บที่เลือกก่อนแปล');
      return;
    }
    const targetLangs = (['th', 'en', 'zh', 'ja', 'my', 'km'] as Lang[]).filter((l) => l !== activeLang);

    setTranslating(true);
    setTranslateError(null);

    const { data, error: fnError } = await supabase.functions.invoke('translate-medicine', {
      body: { source_lang: activeLang, fields: sourceTr, target_langs: targetLangs },
    });

    setTranslating(false);

    if (fnError) {
      setTranslateError(`การแปลล้มเหลว: ${fnError.message}`);
      return;
    }
    if (!data || typeof data !== 'object') {
      setTranslateError('การแปลล้มเหลว: ไม่ได้รับข้อมูลที่ถูกต้อง');
      return;
    }

    setForm((prev) => {
      const updated = { ...prev.translations };
      for (const lang of targetLangs) {
        const t = (data as Record<string, Record<string, string>>)[lang];
        if (t) {
          updated[lang] = {
            trade_name:   t.trade_name   ?? '',
            generic_name: t.generic_name ?? '',
            usage:        t.usage        ?? '',
            indication:   t.indication   ?? '',
            warning:      t.warning      ?? '',
            storage:      t.storage      ?? '',
          };
        }
      }
      return { ...prev, translations: updated };
    });
  }

  const tr = form.translations[activeLang];

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onClick={() => { if (mouseDownOnOverlay.current) onClose(); }}
    >
      <div className="modal add-medicine-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'แก้ไขข้อมูลฉลากยา' : 'เพิ่มฉลากยาใหม่'}</h2>
          <button className="modal-close" onClick={onClose} type="button">
            ×
          </button>
        </div>

        {loadingData ? (
          <div className="add-form-body" style={{ minHeight: 200, justifyContent: 'center', alignItems: 'center' }}>
            <div className="status-line">กำลังโหลดข้อมูล...</div>
          </div>
        ) : (
          <div className="add-form-body">
            <div className="add-form-row">
              <div className="add-form-field">
                <label>
                  SKU <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <input
                  value={form.sku}
                  onChange={(e) => onSkuChange(e.target.value)}
                  placeholder="เช่น 100238"
                  autoFocus={!isEditMode}
                  readOnly={isEditMode}
                  style={isEditMode ? { background: '#f5f5f5', cursor: 'default' } : undefined}
                />
                {skuExists && (
                  <span className="sku-exists-badge">
                    ⚠ SKU นี้มีข้อมูลแล้ว
                  </span>
                )}
              </div>
              <div className="add-form-field">
                <label>Barcode</label>
                <input
                  value={form.barcode}
                  onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                  placeholder="(ถ้ามี)"
                />
              </div>
            </div>

            <div className="add-form-divider" />

            <div className="add-form-langs">
              <span className="add-form-langs-label">ภาษา:</span>
              {LANGS.map(({ code, label }) => {
                const filled = form.translations[code].trade_name.trim() !== '';
                return (
                  <button
                    key={code}
                    className={`lang-btn ${activeLang === code ? 'active' : ''} ${filled ? 'lang-btn--filled' : ''}`}
                    onClick={() => setActiveLang(code)}
                    type="button"
                  >
                    {label}
                    {filled && <span className="lang-dot" />}
                  </button>
                );
              })}
              <button
                className="btn-translate"
                onClick={handleAutoTranslate}
                disabled={translating || saving || loadingData}
                type="button"
                title="แปลจากแท็บที่เลือกไปยังอีก 5 ภาษาโดยอัตโนมัติ"
              >
                {translating ? '⏳ กำลังแปล...' : '✨ แปลอัตโนมัติ'}
              </button>
            </div>

            {translateError && (
              <div className="error-line" style={{ margin: 0 }}>{translateError}</div>
            )}

            <div className="add-form-fields">
              {FIELDS.map(({ key, labelTh, labelEn, type }) => (
                <div key={key} className="add-form-field full">
                  <label>
                    {labelTh}
                    <span className="add-form-label-en"> / {labelEn}</span>
                  </label>
                  {type === 'textarea' ? (
                    <textarea
                      value={tr[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      rows={2}
                      placeholder="(ไม่บังคับ)"
                    />
                  ) : (
                    <input
                      value={tr[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={key === 'trade_name' ? 'ชื่อการค้า (จำเป็น)' : '(ไม่บังคับ)'}
                    />
                  )}
                </div>
              ))}
            </div>

            {error && <div className="error-line">{error}</div>}
          </div>
        )}

        <div className="modal-footer">
          <button
            className="btn-clear"
            onClick={onClose}
            style={{ padding: '10px 24px', fontSize: '14px', color: 'var(--color-text-sub)' }}
            disabled={saving}
            type="button"
          >
            ยกเลิก
          </button>
          <button className="btn-gold" onClick={handleSave} disabled={saving || loadingData || translating} type="button">
            {saving ? 'กำลังบันทึก...' : isEditMode ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
