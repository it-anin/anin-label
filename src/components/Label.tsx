import { forwardRef } from 'react';
import type { Medicine, ShopSettings } from '../types';
import { formatBeDate } from '../lib/format';
import aninLogo from '../assets/anin-logo.png';
import lineIcon from '../assets/line-icon.png';
import phoneIcon from '../assets/phone-icon.png';

interface Props {
  medicine: Medicine;
  settings: ShopSettings;
  date?: Date;
  preview?: boolean;
}

export const Label = forwardRef<HTMLDivElement, Props>(
  ({ medicine, settings, date, preview }, ref) => {
    const dateStr = formatBeDate(date ?? new Date());

    return (
      <div
        ref={ref}
        className={`label ${preview ? 'label-preview' : ''}`}
        aria-label="medicine label"
      >
        <div className="label-header">
          <div className="label-shop">
            <img className="label-logo-image" src={aninLogo} alt="ANIN logo" />
            <div>
              <div className="label-shop-name-th">{settings.shop_name_th}</div>
              <div className="label-shop-name-en">{settings.shop_name_en}</div>
            </div>
          </div>
          <div className="label-contact">
            <div className="label-contact-row">
              <img className="label-contact-icon" src={phoneIcon} alt="Phone" />
              <span>{settings.phone}</span>
            </div>
            <div className="label-contact-row">
              <img className="label-contact-icon" src={lineIcon} alt="LINE" />
              <span>{settings.line_id}</span>
            </div>
            <div className="label-date">{dateStr}</div>
          </div>
        </div>

        <div className="label-divider" />

        <div className="label-section">
          <div>
            <strong>ชื่อการค้า:</strong> {medicine.trade_name}
          </div>
          {medicine.generic_name && (
            <div>
              <strong>ชื่อยา:</strong> {medicine.generic_name}
            </div>
          )}
        </div>

        <div className="label-divider" />

        {medicine.usage && (
          <div className="label-section">
            <strong>วิธีใช้:</strong> {medicine.usage}
          </div>
        )}

        {medicine.indication && (
          <div className="label-section">
            <strong>ข้อบ่งใช้:</strong> {medicine.indication}
          </div>
        )}

        {(medicine.warning || medicine.storage) && (
          <div className="label-warn">
            {medicine.warning && (
              <div className="label-section">
                <strong>ข้อควรระวัง:</strong> {medicine.warning}
              </div>
            )}
            {medicine.storage && (
              <div className="label-section">
                <strong>การเก็บรักษา:</strong> {medicine.storage}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

Label.displayName = 'Label';
