/**
 * WOLF Footer — Branded footer with portfolio link.
 */
import React from 'react';

interface FooterProps {
  isDarkMode: boolean;
  textClass: string;
  textMutedClass: string;
}

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer style={{ padding: '40px 0', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
      <p style={{ fontFamily: 'var(--ff-mono)', fontSize: '.78rem', color: 'var(--text-secondary)' }}>
        WOLF Valuation Engine · Built by{' '}
        <a
          href="https://ahmedwael.pages.dev"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent-gold)', textDecoration: 'none' }}
        >
          Ahmed Wael Metwally
        </a>
        {' '}· Cairo, Egypt
      </p>
      <p style={{ fontFamily: 'var(--ff-mono)', fontSize: '.68rem', color: 'var(--text-muted)', marginTop: '8px' }}>
        Institutional-grade equity analysis · FMVA® Certified
      </p>
    </footer>
  );
};

export default Footer;
