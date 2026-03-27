// src/Splash.jsx
import { useEffect, useState } from 'react';
import './Splash.css';

export default function Splash({ onFinish }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out after 2 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2000);

    // Call onFinish after 2.5 seconds
    const finishTimer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="splash-content">
        {/* Logo */}
        <div className="splash-logo-text">Auditly</div>
        
        {/* Subtitle */}
        <div className="splash-subtitle">
          AI-powered website audit tool
        </div>
        
        {/* Loading Spinner */}
        <div className="splash-loading">
          <div className="splash-spinner"></div>
          <p>Loading audit tool...</p>
        </div>
        
        {/* Credit */}
        <div className="splash-credit">
          by JENAT MILAN
        </div>
      </div>
    </div>
  );
}