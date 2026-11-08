import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import logoPng from '../assets/logo.png';

interface NavbarProps {
  activeTab: 'home' | 'series' | 'movies' | 'anime';
  setActiveTab: (tab: 'home' | 'series' | 'movies' | 'anime') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenSettings: () => void;
  onRescan: () => void;
  scanning: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenSettings,
  onRescan,
  scanning
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-8 py-4 flex items-center justify-between ${
        isScrolled ? 'nav-solid' : 'nav-transparent'
      }`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 36px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
        {/* Brand Logo */}
        <div
          onClick={() => setActiveTab('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            background: 'transparent',
            borderRadius: 0
          }}
        >
          <img
            src={logoPng}
            alt="NetFlixxy"
            style={{
              width: '28px',
              height: '28px',
              objectFit: 'contain',
              background: 'transparent',
              borderRadius: 0,
              display: 'block'
            }}
          />
          <span
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 900,
              fontSize: '24px',
              letterSpacing: '0.04em',
              color: '#E50914',
              textTransform: 'uppercase',
              textShadow: '0 2px 10px rgba(229, 9, 20, 0.35)'
            }}
          >
            NetFlixxy
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '20px' }}>
          {(['home', 'series', 'movies', 'anime'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === tab ? '#ffffff' : '#b3b3b3',
                fontWeight: activeTab === tab ? 700 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'color 0.2s',
                textTransform: 'capitalize'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => {
                if (activeTab !== tab) e.currentTarget.style.color = '#b3b3b3';
              }}
            >
              {tab === 'home' ? 'Home' : tab === 'series' ? 'TV Shows' : tab === 'movies' ? 'Movies' : 'Anime'}
            </button>
          ))}
        </nav>
      </div>

      {/* Right Action Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        {/* Real-time Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: showSearchInput || searchQuery ? 'rgba(0,0,0,0.75)' : 'transparent',
            border: showSearchInput || searchQuery ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
            borderRadius: '4px',
            padding: '4px 10px',
            transition: 'all 0.3s'
          }}
        >
          <Search
            size={18}
            color="#ffffff"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowSearchInput(!showSearchInput)}
          />
          {(showSearchInput || searchQuery) && (
            <input
              type="text"
              placeholder="Titles, people, genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '13px',
                marginLeft: '8px',
                width: '180px'
              }}
            />
          )}
        </div>

        {/* Rescan Button */}
        <button
          onClick={onRescan}
          disabled={scanning}
          title="Rescan Local Media"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: scanning ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!scanning) e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          }}
        >
          <RefreshCw
            size={14}
            style={{
              animation: scanning ? 'spin 1s linear infinite' : 'none'
            }}
          />
          <span>{scanning ? 'Scanning...' : 'Rescan'}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Settings"
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '4px'
          }}
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
};
