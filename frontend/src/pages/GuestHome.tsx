import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { PublicArticleList } from './PublicArticleList';
import { Footer } from '../components/Footer';

const animations = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-10px); }
    60% { transform: translateY(-5px); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

interface GuestHomeProps {
  onLoginClick: () => void;
}

// 玻璃拟态样式常量
const glassStyles = {
  background: 'rgba(255, 255, 255, 0.15)',
  backdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
  borderRadius: '16px',
};

export function GuestHome({ onLoginClick }: GuestHomeProps) {
  const { t, language, setLanguage } = useLanguage();
  const [scrollY, setScrollY] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    const styleSheet = document.createElement("style");
    styleSheet.innerText = animations;
    document.head.appendChild(styleSheet);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.head.removeChild(styleSheet);
    };
  }, []);

  const progress = Math.min(scrollY / 500, 1);

  // 背景图片
  const pageStyle: React.CSSProperties = {
    minHeight: '200vh',
    backgroundImage: 'url(/background.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    position: 'relative',
  };

  const heroStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: '15vw',
    position: 'relative',
    overflow: 'hidden',
  };

  const heroContentStyle: React.CSSProperties = {
    textAlign: 'left',
    zIndex: 10,
    opacity: Math.max(0, 1 - progress * 2),
    transform: `translateY(${scrollY * 0.3}px)`,
    transition: 'opacity 0.1s ease-out, transform 0.1s ease-out',
    padding: '60px 0',
    maxWidth: '600px',
  };

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    height: '60px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 32px',
    ...glassStyles,
    zIndex: 100,
    width: '90%',
    maxWidth: '1200px',
    borderRadius: '30px',
  };

  const articlesSectionStyle: React.CSSProperties = {
    minHeight: '100vh',
    padding: '100px 60px',
    position: 'relative',
    zIndex: 20,
  };

  const articlesContainerStyle: React.CSSProperties = {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '50px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 500,
    letterSpacing: '0.5px',
    background: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '20px',
    cursor: 'pointer',
    color: '#ffffff',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    backdropFilter: 'blur(10px)',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#1a1a1a',
    fontWeight: 600,
  };

  const scrollIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    animation: 'bounce 2s infinite',
    cursor: 'pointer',
    opacity: Math.max(0, 1 - progress * 2),
    transition: 'opacity 0.1s ease-out',
    padding: '12px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // 浮动装饰元素
  const floatingElements = [
    { top: '10%', left: '10%', size: 200, delay: '0s', color: 'rgba(255,255,255,0.1)' },
    { top: '60%', right: '10%', size: 150, delay: '1s', color: 'rgba(255,255,255,0.08)' },
    { top: '30%', right: '20%', size: 100, delay: '2s', color: 'rgba(255,255,255,0.12)' },
    { bottom: '20%', left: '15%', size: 180, delay: '1.5s', color: 'rgba(255,255,255,0.06)' },
  ];

  return (
    <div style={pageStyle}>
      {/* 浮动装饰背景 */}
      {floatingElements.map((el, index) => (
        <div
          key={index}
          style={{
            position: 'fixed',
            width: el.size,
            height: el.size,
            borderRadius: '50%',
            background: el.color,
            filter: 'blur(60px)',
            top: el.top,
            left: el.left,
            right: el.right,
            bottom: el.bottom,
            animation: `float 6s ease-in-out ${el.delay} infinite`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      ))}

      {/* Navigation */}
      <nav style={navStyle}>
        <img 
          src="/logo.png" 
          alt="ZPblog"
          style={{ 
            height: '36px',
            objectFit: 'contain',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          }}
        />
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            style={buttonStyle}
            onClick={() => setShowSettings(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            {t('common.settings')}
          </button>
          <button
            style={primaryButtonStyle}
            onClick={onLoginClick}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {t('common.login')}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={headerRef} style={heroStyle}>
        <div style={heroContentStyle}>
          <div style={{
            margin: '0 0 30px 0',
            animation: 'fadeInUp 1s ease-out 0.2s both',
          }}>
            <p style={{
              fontSize: '96px',
              fontWeight: 800,
              letterSpacing: '16px',
              color: 'rgba(255, 255, 255, 0.95)',
              margin: '0 0 4px 0',
              textShadow: '0 6px 30px rgba(0,0,0,0.4)',
            }}>
              {language === 'zh' ? '发布，' : 'Publish,'}
            </p>
            <p style={{
              fontSize: '96px',
              fontWeight: 800,
              letterSpacing: '16px',
              color: 'rgba(255, 255, 255, 0.95)',
              margin: '0 0 4px 80px',
              textShadow: '0 6px 30px rgba(0,0,0,0.4)',
            }}>
              {language === 'zh' ? '交流，' : 'Connect,'}
            </p>
            <p style={{
              fontSize: '96px',
              fontWeight: 800,
              letterSpacing: '16px',
              color: 'rgba(255, 255, 255, 0.95)',
              margin: '0 0 20px 160px',
              textShadow: '0 6px 30px rgba(0,0,0,0.4)',
            }}>
              {language === 'zh' ? '连接。' : 'Share.'}
            </p>
          </div>
          <p style={{
            fontSize: '18px',
            fontWeight: 400,
            letterSpacing: language === 'zh' ? '3px' : '1px',
            color: 'rgba(255, 255, 255, 0.85)',
            margin: '0 0 50px 0',
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
            animation: 'fadeInUp 1s ease-out 0.5s both',
          }}>
            {language === 'zh' ? '在ZPblog，这就是我们的全部' : 'At ZPblog, this is everything we do'}
          </p>
        </div>
        
        {/* Scroll Indicator */}
        <div 
          style={scrollIndicatorStyle}
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
        </div>
      </section>

      {/* Settings Modal */}
      {showSettings && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowSettings(false)}
        >
          <div 
            style={{
              ...glassStyles,
              padding: '40px',
              minWidth: '320px',
              animation: 'fadeInUp 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ 
              margin: '0 0 30px 0', 
              fontSize: '20px', 
              fontWeight: 600,
              letterSpacing: '1px',
              color: '#ffffff',
              textAlign: 'center',
            }}>
              {t('common.language')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => { setLanguage('zh'); setShowSettings(false); }}
                style={{
                  padding: '16px 24px',
                  background: language === 'zh' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)',
                  color: language === 'zh' ? '#1a1a1a' : '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: language === 'zh' ? 600 : 400,
                  letterSpacing: '1px',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={(e) => {
                  if (language !== 'zh') {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (language !== 'zh') {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  }
                }}
              >
                中文
              </button>
              <button
                onClick={() => { setLanguage('en'); setShowSettings(false); }}
                style={{
                  padding: '16px 24px',
                  background: language === 'en' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.1)',
                  color: language === 'en' ? '#1a1a1a' : '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: language === 'en' ? 600 : 400,
                  letterSpacing: '1px',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={(e) => {
                  if (language !== 'en') {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (language !== 'en') {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  }
                }}
              >
                English
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Articles Section */}
      <section style={articlesSectionStyle}>
        <div style={articlesContainerStyle}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: 600,
            letterSpacing: '3px',
            color: '#ffffff',
            margin: '0 0 40px 0',
            textTransform: 'uppercase',
            textAlign: 'center',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}>
            {t('dashboard.recent_articles')}
          </h2>
          <PublicArticleList />
        </div>
      </section>

      <Footer />
    </div>
  );
}
