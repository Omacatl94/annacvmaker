import { useState, useEffect } from 'react';
import { api } from '../api';
import { t } from '../strings';
import Icon from './Icon';

export default function PricingModal({ onClose }) {
  const [isOpenBeta, setIsOpenBeta] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [error, setError] = useState(null);
  const [buyingTier, setBuyingTier] = useState(null);

  useEffect(() => {
    api.getBalance()
      .then((balance) => {
        setIsOpenBeta(balance.openBeta);
        if (!balance.openBeta) {
          return api.getPricing().then((res) => setTiers(res.tiers));
        }
      })
      .catch((err) => {
        setIsOpenBeta(false);
        setError(err.message);
      });
  }, []);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleBuy = async (tierId) => {
    setBuyingTier(tierId);
    try {
      const { url } = await api.createCheckout(tierId);
      window.location.href = url;
    } catch {
      setBuyingTier(null);
    }
  };

  if (isOpenBeta === null) {
    return (
      <div className="pricing-overlay" onClick={handleOverlayClick}>
        <div className="pricing-modal">
          <button className="pricing-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
          <p>Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-overlay" onClick={handleOverlayClick}>
      <div className="pricing-modal">
        <button className="pricing-close" onClick={onClose}>
          <Icon name="x" size={20} />
        </button>

        <img src="/img/mascot/raccoin.jpg" alt="Raccoin" className="pricing-raccoin-img" />

        {isOpenBeta ? (
          <>
            <h2 className="pricing-title">{t('beta.modalTitle')}</h2>
            <p className="pricing-subtitle">{t('beta.modalText')}</p>

            <div className="pricing-earn-section">
              <h3 className="pricing-earn-title">Vuoi pi\u00F9 Raccoin?</h3>
              <div className="pricing-earn-options">
                <div className="pricing-earn-option">
                  <Icon name="message-circle" size={20} />
                  <div>
                    <strong>Segnala bug o idee</strong>
                    <p>Clicca il procione in basso a destra \u2014 i feedback utili vengono premiati</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="pricing-title">{t('pricing.title')}</h2>
            <p className="pricing-subtitle">{t('pricing.subtitle')}</p>

            {error ? (
              <p className="pricing-subtitle" style={{ color: 'var(--color-error)' }}>
                {error}
              </p>
            ) : (
              <div className="pricing-grid">
                {tiers.map((tier, i) => (
                  <div className={`pricing-tier${i === 1 ? ' popular' : ''}`} key={tier.id}>
                    {i === 1 && (
                      <span className="pricing-popular-badge">{t('pricing.popular')}</span>
                    )}
                    <div className="pricing-tier-name">
                      {tier.name.charAt(0).toUpperCase() + tier.name.slice(1)}
                    </div>
                    <div className="pricing-tier-price">
                      {'\u20AC' + (tier.price / 100).toFixed(2).replace('.', ',')}
                    </div>
                    <div className="pricing-tier-credits">
                      {tier.credits} {t('pricing.credits')}
                    </div>
                    <div className="pricing-tier-percv">
                      {'\u20AC' +
                        (tier.price / 100 / tier.credits).toFixed(2).replace('.', ',') +
                        t('pricing.perCv')}
                    </div>
                    <button
                      className="btn-primary"
                      disabled={buyingTier === tier.id}
                      onClick={() => handleBuy(tier.id)}
                    >
                      {buyingTier === tier.id ? '...' : t('pricing.buy')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="pricing-guarantee">{t('pricing.guarantee')}</p>
          </>
        )}
      </div>
    </div>
  );
}
