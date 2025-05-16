import React from 'react';
import { CryptoCurrency } from '@/types/misc';
import Icon from '@/components/Icons';

interface CryptoInfoCardProps {
  cryptoType: CryptoCurrency;
  price: number;
  change24h: number;
}

const getCryptoIcon = (type: CryptoCurrency) => {
  switch (type) {
    case CryptoCurrency.DOGE:
      return "Doge";
    case CryptoCurrency.LTC:
      return "Ltc";
    case CryptoCurrency.BTC:
    default:
      return "Btc";
  }
};

const getCryptoName = (type: CryptoCurrency) => {
  switch (type) {
    case CryptoCurrency.DOGE:
      return "Dogecoin";
    case CryptoCurrency.LTC:
      return "Litecoin";
    case CryptoCurrency.BTC:
    default:
      return "Bitcoin";
  }
};

const CryptoInfoCard: React.FC<CryptoInfoCardProps> = ({
  cryptoType,
  price,
  change24h
}) => {
  return (
    <div className="crypto-info-card">
      <div className="crypto-info-card__header">
        <div className="crypto-info-card__icon">
          <Icon name={getCryptoIcon(cryptoType)} size={18} />
        </div>
        <div className="crypto-info-card__title">
          <h3>{getCryptoName(cryptoType)}</h3>
          <span className="crypto-info-card__ticker">{cryptoType}</span>
        </div>
      </div>
      <div className="crypto-info-card__stats">
        <div className="crypto-info-card__price">
          ${price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </div>
        <div className={`crypto-info-card__change ${change24h >= 0 ? 'positive' : 'negative'}`}>
          {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
        </div>
      </div>
      <style jsx>{`
        .crypto-info-card {
          background-color: var(--sys-color-background-card);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .crypto-info-card__header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .crypto-info-card__icon {
          margin-right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: var(--sys-color-background-light);
        }
        
        .crypto-info-card__title h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          color: var(--sys-color-text-primary);
        }
        
        .crypto-info-card__ticker {
          font-size: 12px;
          color: var(--sys-color-text-mute);
        }
        
        .crypto-info-card__stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .crypto-info-card__price {
          font-size: 18px;
          font-weight: 600;
          color: var(--sys-color-text-primary);
        }
        
        .crypto-info-card__change {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .crypto-info-card__change.positive {
          background-color: rgba(0, 200, 83, 0.1);
          color: #00c853;
        }
        
        .crypto-info-card__change.negative {
          background-color: rgba(255, 53, 53, 0.1);
          color: #ff3535;
        }
      `}</style>
    </div>
  );
};

export default CryptoInfoCard; 