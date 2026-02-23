import React from 'react';

interface WolfLogoProps {
  className?: string;
  size?: number;
}

export const WolfLogo: React.FC<WolfLogoProps> = ({ className = '', size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="url(#wolfGradient)" />
      
      {/* Wolf face outline */}
      <path
        d="M50 15
           L30 35
           L15 30
           L25 50
           L20 70
           L35 65
           L50 85
           L65 65
           L80 70
           L75 50
           L85 30
           L70 35
           L50 15Z"
        fill="#1a1a1a"
        stroke="#ef4444"
        strokeWidth="2"
      />
      
      {/* Left ear */}
      <path
        d="M30 35 L15 30 L25 50 L35 42 Z"
        fill="#2a2a2a"
        stroke="#ef4444"
        strokeWidth="1.5"
      />
      
      {/* Right ear */}
      <path
        d="M70 35 L85 30 L75 50 L65 42 Z"
        fill="#2a2a2a"
        stroke="#ef4444"
        strokeWidth="1.5"
      />
      
      {/* Left eye */}
      <ellipse cx="38" cy="48" rx="6" ry="5" fill="#ef4444" />
      <ellipse cx="39" cy="47" rx="2" ry="2" fill="#ffffff" />
      
      {/* Right eye */}
      <ellipse cx="62" cy="48" rx="6" ry="5" fill="#ef4444" />
      <ellipse cx="63" cy="47" rx="2" ry="2" fill="#ffffff" />
      
      {/* Nose */}
      <ellipse cx="50" cy="62" rx="5" ry="4" fill="#333" stroke="#ef4444" strokeWidth="1" />
      
      {/* Snout lines */}
      <path
        d="M50 66 L50 72"
        stroke="#ef4444"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M45 74 Q50 78 55 74"
        stroke="#ef4444"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Forehead mark */}
      <path
        d="M50 25 L47 35 L50 33 L53 35 Z"
        fill="#ef4444"
      />
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="wolfGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1f1f1f" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const WolfLogoSmall: React.FC<WolfLogoProps> = ({ className = '', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Simplified wolf head for small sizes */}
      <circle cx="50" cy="50" r="48" fill="#1a1a1a" stroke="#ef4444" strokeWidth="3" />
      
      {/* Simplified wolf shape */}
      <path
        d="M50 20
           L28 40
           L18 35
           L28 55
           L50 80
           L72 55
           L82 35
           L72 40
           Z"
        fill="#ef4444"
      />
      
      {/* Eyes */}
      <circle cx="38" cy="48" r="4" fill="#1a1a1a" />
      <circle cx="62" cy="48" r="4" fill="#1a1a1a" />
    </svg>
  );
};
