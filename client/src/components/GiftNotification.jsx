import { useEffect, useRef } from 'react';

export default function GiftNotification({ gift, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    for (let i = 0; i < 40; i++) {
      const c = document.createElement('div');
      c.className = 'gift-confetti';
      c.style.left = Math.random() * 100 + '%';
      c.style.animationDelay = Math.random() * 0.8 + 's';
      c.style.background = ['#00E676','#FFD600','#FF4081','#448AFF','#E040FB','#FF6E40'][Math.floor(Math.random() * 6)];
      el.appendChild(c);
    }
  }, []);

  const handleClose = () => {
    overlayRef.current?.classList.add('gift-out');
    setTimeout(onClose, 400);
  };

  return (
    <div className="gift-overlay" ref={overlayRef}>
      <div className="gift-modal">
        <img src="/img/mascot/gift.webp" alt="JH porta un regalo" className="gift-img" />
        <div className="gift-title">Hai ricevuto {gift.credits} crediti!</div>
        {gift.reason && <div className="gift-reason">"{gift.reason}"</div>}
        <button className="gift-close" onClick={handleClose}>Grazie, JobHacker!</button>
      </div>
    </div>
  );
}
