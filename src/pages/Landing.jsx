import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const whatsappUrl = "https://wa.me/201060607654?text=" + encodeURIComponent("السلام عليكم د. محمود جاد، أود الاستفسار بخصوص منصة الدكتور فى الرياضيات");
  const facebookUrl = "https://web.facebook.com/dr.mathee/";
  const messengerUrl = "https://m.me/dr.mathee";

  return (
    <div className="landing-page fade-in">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title font-heading">
              <span className="text-gradient">منصة الدكتور</span> فى الرياضيات
            </h1>
            <p className="hero-subtitle">
              وجهتك الأولى لاحتراف الرياضيات بأسلوب تفاعلي، مبسط، وعصري. 
              تعلم بشغف، تدرب بذكاء، وحقق التفوق الذي تطمح إليه في جميع المراحل التعليمية.
            </p>
            <div className="hero-buttons">
              <Link to="/register" className="button button-primary hero-btn">
                ابدأ رحلة التفوق
              </Link>
              <Link to="/login" className="button button-secondary hero-btn">
                تسجيل الدخول
              </Link>
            </div>
          </div>
          <div className="hero-image-container">
            <div className="hero-logo-wrapper">
              <div className="hero-logo-aura"></div>
              <img 
                src="/logo-circle.png" 
                alt="شعار منصة الدكتور فى الرياضيات" 
                className="hero-logo-animated"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title font-heading">لماذا تختار منصتنا؟</h2>
        <div className="features-grid">
          <div className="feature-card glass">
            <div className="feature-icon">🚀</div>
            <h3>شرح متطور ومبسط</h3>
            <p>
              نقدم المفاهيم الرياضية المعقدة بطريقة بصرية سهلة الفهم تضمن لك استيعاب الدروس بسرعة.
            </p>
          </div>
          <div className="feature-card glass">
            <div className="feature-icon">📊</div>
            <h3>اختبارات تفاعلية</h3>
            <p>
              قيم مستواك باستمرار من خلال اختبارات ذكية تواكب جميع مستويات المنهج الدراسي.
            </p>
          </div>
          <div className="feature-card glass">
            <div className="feature-icon">📈</div>
            <h3>متابعة مستمرة</h3>
            <p>
              راقب تقدمك خطوة بخطوة من خلال لوحة تحكم ذكية تعرض تقارير الأداء بشكل تفصيلي.
            </p>
          </div>
        </div>
      </section>

      {/* Direct Contact Section */}
      <section className="contact-showcase-section">
        <div className="section-header-centered">
          <span className="section-pill">قنوات التواصل المباشر</span>
          <h2 className="section-title font-heading">تواصل مباشرة مع مدير المنصة</h2>
          <p className="section-subtitle">
            يسعدنا الرد على جميع استفسارات الطلاب وأولياء الأمور عبر مختلف منصات التواصل
          </p>
        </div>

        <div className="contact-cards-grid">
          {/* WhatsApp Card */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-feature-card contact-card-wa glass"
          >
            <div className="card-top-row">
              <div className="contact-card-icon-wrap wa-gradient">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.64c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
                </svg>
              </div>
              <span className="contact-status-live">متصل الآن</span>
            </div>
            <h3 className="font-heading">محادثة واتساب</h3>
            <p className="contact-card-desc">تواصل فوري وسريع مع د. محمود جاد لأي استفسار</p>
            <div className="contact-card-cta">
              <span>بدء المحادثة</span>
              <span className="cta-icon-arrow">←</span>
            </div>
          </a>

          {/* Messenger Card */}
          <a
            href={messengerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-feature-card contact-card-ms glass"
          >
            <div className="card-top-row">
              <div className="contact-card-icon-wrap ms-gradient">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.13 2 11.23c0 2.91 1.45 5.51 3.73 7.15V22l3.43-1.88c.9.25 1.86.39 2.84.39 5.52 0 10-4.13 10-9.23C22 6.13 17.52 2 12 2zm1.09 12.42-2.82-3.01-5.5 3.01 6.05-6.42 2.89 3.01 5.43-3.01-6.05 6.42z" />
                </svg>
              </div>
              <span className="contact-status-badge">رد سريع</span>
            </div>
            <h3 className="font-heading">رسائل ماسنجر</h3>
            <p className="contact-card-desc">راسلنا مباشرة على ماسنجر صفحة الدكتور في الرياضيات</p>
            <div className="contact-card-cta">
              <span>بدء المحادثة</span>
              <span className="cta-icon-arrow">←</span>
            </div>
          </a>

          {/* Facebook Card */}
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-feature-card contact-card-fb glass"
          >
            <div className="card-top-row">
              <div className="contact-card-icon-wrap fb-gradient">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95C18.05 21.45 22 17.19 22 12z" />
                </svg>
              </div>
              <span className="contact-status-badge">الصفحة الرسمية</span>
            </div>
            <h3 className="font-heading">صفحة فيسبوك</h3>
            <p className="contact-card-desc">تابع آخر الإعلانات والمنشورات والمواد التعليمية الحصرية</p>
            <div className="contact-card-cta">
              <span>زيارة الصفحة</span>
              <span className="cta-icon-arrow">←</span>
            </div>
          </a>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section glass">
        <h2 className="font-heading">جاهز لتحقيق التميز في الرياضيات؟</h2>
        <p>انضم الآن لمئات الطلاب الذين غيروا نظرتهم للرياضيات واكتشف متعة التعلم.</p>
        <Link to="/register" className="button button-primary cta-btn">
          أنشئ حسابك 
        </Link>
      </section>
    </div>
  );
}
