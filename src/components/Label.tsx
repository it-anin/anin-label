import { forwardRef } from 'react';
import type { Medicine, ShopSettings } from '../types';
import { formatBeDate } from '../lib/format';
import aninLogo from '../assets/anin-logo.png';

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
              <span className="label-icon label-icon-tel">TEL</span>
              <span>{settings.phone}</span>
            </div>
            <div className="label-contact-row">
              <span className="label-icon label-icon-line">LINE</span>
              <span>{settings.line_id}</span>
            </div>
            <div className="label-date">{dateStr}</div>
          </div>
        </div>

        <div className="label-divider" />

        <div className="label-section">
          <div>
            <strong>เธเธทเนเธญเธเธฒเธฃเธเนเธฒ:</strong> {medicine.trade_name}
          </div>
          {medicine.generic_name && (
            <div>
              <strong>เธเธทเนเธญเธขเธฒ:</strong> {medicine.generic_name}
            </div>
          )}
        </div>

        <div className="label-divider" />

        {medicine.usage && (
          <div className="label-section">
            <strong>เธงเธดเธเธตเนเธเน:</strong> {medicine.usage}
          </div>
        )}

        {medicine.indication && (
          <div className="label-section">
            <strong>เธเนเธญเธเนเธเนเธเน:</strong> {medicine.indication}
          </div>
        )}

        {(medicine.warning || medicine.storage) && (
          <div className="label-warn">
            {medicine.warning && (
              <div className="label-section">
                <strong>เธเนเธญเธเธงเธฃเธฃเธฐเธงเธฑเธ:</strong> {medicine.warning}
              </div>
            )}
            {medicine.storage && (
              <div className="label-section">
                <strong>เน€เธเนเธเธฃเธฑเธเธฉเธฒ:</strong> {medicine.storage}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

Label.displayName = 'Label';
