import { useLanguage } from '../contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer">
      <div className="footer-content">
        {/* 第一部分：版权信息 */}
        <div className="footer-section copyright">
          <h3>Copyright© {new Date().getFullYear()} ZZIPP</h3>
          <p>{t('footer.copyright')}</p>
        </div>

        {/* 第二部分：站点导航 */}
        <div className="footer-section navigation">
          <h4>{t('footer.navigation')}</h4>
          <ul>
            <li><a href="http://127.0.0.1:8000/sitemap.xml" target="_blank">{t('footer.sitemap')}</a></li>
            <li><a href="#">{t('footer.rss')}</a></li>
            <li><a href="#/friends">{t('nav.friends')}</a></li>
          </ul>
        </div>

        {/* 第三部分：托管信息 & 统计信息 */}
        <div className="footer-section hosting-stats">
          <h4>{t('footer.hosting')}</h4>
          <ul>
            <li>{t('footer.hosting_on')}</li>
          </ul>
        </div>

        {/* 第四部分：技术栈信息 */}
        <div className="footer-section tech-stack">
          <h4>{t('footer.tech_stack')}</h4>
          <ul>
            <li>{t('footer.powered_by')}</li>
            <li><a href="https://github.com/llljjjwww333/zpblog-v2" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          </ul>
        </div>

        {/* 第五部分：联系我们 */}
        <div className="footer-section contact">
          <h4>{t('footer.contact')}</h4>
          <ul>
            <li>Email: <a href="mailto:3490870833@qq.com">3490870833@qq.com</a></li>
          </ul>
        </div>
      </div>

      <style>{`
        .site-footer {
          background-color: #2c2c2c;
          color: #ccc;
          padding: 40px 20px;
          margin-top: auto; /* 确保footer推到底部 */
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; /* 统一使用 Poppins 字体 */
          border-top: 4px double #444;
          width: 100%;
          font-size: 0.9rem; /* 整体字体调小 */
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 30px;
        }

        .footer-section {
          flex: 1;
          min-width: 150px;
        }

        .footer-section h3, .footer-section h4 {
          color: #fff;
          margin-bottom: 12px;
          font-size: 1rem; /* 标题字体调小 */
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #444;
          padding-bottom: 8px;
          display: inline-block;
        }

        .footer-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
          font-size: 0.85rem; /* 列表字体调小 */
        }

        .footer-section li {
          margin-bottom: 8px;
        }

        .footer-section a {
          color: #ccc;
          text-decoration: none;
          transition: color 0.2s;
        }

        .footer-section a:hover {
          color: #fff;
          text-decoration: underline;
        }

        .load-time {
          color: #e67e22;
          font-weight: bold;
        }

        @media (max-width: 768px) {
          .footer-content {
            flex-direction: column;
            gap: 40px;
          }
          
          .footer-section {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}
