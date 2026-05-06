import { useState } from 'react';
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
  trade_name: '', generic_name: '', usage: '',
  indication: '', warning: '', storage: '',
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
    th: emptyTr(), en: emptyTr(), zh: emptyTr(),
    ja: emptyTr(), my: emptyTr(), km: emptyTr(),
  },
});

const FIELDS: { key: keyof TrForm; labelTh: string; labelEn: string; type: 'input' | 'textarea' }[] = [
  { key: 'trade_name',   labelTh: 'ชื่อการค้า',    labelEn: 'Trade name',  type: 'input'    },
  { key: 'generic_name', labelTh: 'ชื่อยา',         labelEn: 'Generic name',type: 'input'    },
  { key: 'usage',        labelTh: 'วิธีใช้',         labelEn: 'Usage',       type: 'textarea' },
  { key: 'indication',   labelTh: 'ข้อบ่งใช้',      labelEn: 'Indication',  type: 'textarea' },
  { key: 'warning',      labelTh: 'ข้อควรระวัง',    labelEn: 'Warning',     type: 'textarea' },
  { key: 'storage',      labelTh: 'การเก็บรักษา',  labelEn: 'Storage',     type: 'input'    },
];

interface Props {
  onClose: () => void;
  onSaved: (sku: string) => void;
}

export function AddMedicineModal({ onClose, onSaved }: Props) {
  const [form, setForm]           = useState<FormData>(initForm);
  const [activeLang, setActiveLang] = useState<Lang>('th');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  function setField(field: keyof TrForm, value: string) {
    setForm(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [activeLang]: { ...prev.translations[activeLang], [field]: value },
      },
    }));
  }

  async function handleSave() {
    const sku = form.sku.trim();
    if (!sku) { setError('กรุณากรอก SKU'); return; }

    if (!supabase) { setError(supabaseConfigError ?? 'Supabase is not configured.'); return; }

    setSaving(true);
    setError(null);

    // 1. Upsert medicine row
    const { data: med, error: medErr } = await supabase
      .from('medicines')
      .upsert(
        { sku, barcode: form.barcode.trim() || null },
        { onConflict: 'sku' }
      )
      .select('id')
      .single();

    if (medErr || !med) {
      setError(medErr?.message ?? 'บันทึกไม่สำเร็จ');
      setSaving(false);
      return;
    }

    // 2. Upsert translations that have at least trade_name
    const rows = Object.entries(form.translations)
      .filter(([, tr]) => tr.trade_name.trim())
      .map(([lang, tr]) => ({
        medicine_id:  med.id,
        lang,
        trade_name:   tr.trade_name.trim()   || null,
        generic_name: tr.generic_name.trim() || null,
        usage:        tr.usage.trim()        || null,
        indication:   tr.indication.trim()   || null,
        warning:      tr.warning.trim()      || null,
        storage:      tr.storage.trim()      || null,
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

  const tr = form.translations[activeLang];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal add-medicine-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>เพิ่มฉลากยาใหม่</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="add-form-body">
          {/* SKU + Barcode */}
          <div className="add-form-row">
            <div className="add-form-field">
              <label>SKU <span style={{ color: '#e53e3e' }}>*</span></label>
              <input
                value={form.sku}
                onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                placeholder="เช่น 100238"
                autoFocus
              />
            </div>
            <div className="add-form-field">
              <label>Barcode</label>
              <input
                value={form.barcode}
                onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))}
                placeholder="(ถ้ามี)"
              />
            </div>
          </div>

          <div className="add-form-divider" />

          {/* Language tabs */}
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
          </div>

          {/* Fields for active language */}
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
                    onChange={e => setField(key, e.target.value)}
                    rows={2}
                    placeholder="(ไม่บังคับ)"
                  />
                ) : (
                  <input
                    value={tr[key]}
                    onChange={e => setField(key, e.target.value)}
                    placeholder={key === 'trade_name' ? 'ชื่อการค้า (จำเป็น)' : '(ไม่บังคับ)'}
                  />
                )}
              </div>
            ))}
          </div>

          {error && <div className="error-line">{error}</div>}
        </div>

        <div className="modal-footer">
          <button
            className="btn-clear"
            onClick={onClose}
            style={{ padding: '10px 24px', fontSize: '14px', color: 'var(--color-text-sub)' }}
            disabled={saving}
          >
            ยกเลิก
          </button>
          <button className="btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}
