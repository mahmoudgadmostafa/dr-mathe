// src/components/FloatingContactWidget.jsx
import React, { useState, useEffect, useRef } from "react";

export default function FloatingContactWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const widgetRef = useRef(null);

  const whatsappUrl = "https://wa.me/201060607654?text=" + encodeURIComponent("السلام عليكم د. محمود جاد، أود الاستفسار بخصوص منصة الدكتور فى الرياضيات");
  const facebookUrl = "https://web.facebook.com/dr.mathee/";
  const messengerUrl = "https://m.me/dr.mathee";

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setHasInteracted(true);
  };

  return (
    <aside
      className={`floating-contact-container ${isOpen ? "is-open" : ""}`}
      ref={widgetRef}
      aria-label="قنوات التواصل مع إدارة المنصة"
    >
      {/* Contact Popout Menu */}
      <div
        className={`floating-contact-popup ${isOpen ? "popup-active" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label="خيارات التواصل السريع"
      >
        {/* Header */}
        <div className="contact-popup-header">
          <div className="contact-popup-avatar-box">
            <img
              src="/logo-circle.png"
              alt="مدير المنصة د. محمود جاد"
              className="contact-popup-avatar"
            />
            <span className="online-indicator" title="متصل ومتاح للتواصل"></span>
          </div>
          <div className="contact-popup-info">
            <h4 className="contact-popup-title font-heading">تواصل مع مدير المنصة</h4>
            <p className="contact-popup-subtitle">د. محمود جاد مصطفى</p>
            <span className="contact-badge-live">⚡ متاح للرد المباشر</span>
          </div>
          <button
            type="button"
            className="contact-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="إغلاق نافذة التواصل"
          >
            ✕
          </button>
        </div>

        {/* Action Items */}
        <div className="contact-popup-body">
          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-channel-item whatsapp-channel"
            title="محادثة عبر واتساب"
          >
            <div className="channel-icon-wrap whatsapp-icon-bg">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.64c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.12-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.3z" />
              </svg>
            </div>
            <div className="channel-text-wrap">
              <div className="channel-title-row">
                <span className="channel-title">واتساب (WhatsApp)</span>
                <span className="channel-tag tag-wa">محادثة فورية</span>
              </div>
              <span className="channel-desc">محادثة مباشرة عبر واتساب</span>
            </div>
            <span className="channel-arrow">‹</span>
          </a>

          {/* Messenger */}
          <a
            href={messengerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-channel-item messenger-channel"
            title="محادثة عبر ماسنجر"
          >
            <div className="channel-icon-wrap messenger-icon-bg">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.13 2 11.23c0 2.91 1.45 5.51 3.73 7.15V22l3.43-1.88c.9.25 1.86.39 2.84.39 5.52 0 10-4.13 10-9.23C22 6.13 17.52 2 12 2zm1.09 12.42-2.82-3.01-5.5 3.01 6.05-6.42 2.89 3.01 5.43-3.01-6.05 6.42z" />
              </svg>
            </div>
            <div className="channel-text-wrap">
              <div className="channel-title-row">
                <span className="channel-title">ماسنجر (Messenger)</span>
                <span className="channel-tag tag-ms">تواصل مباشر</span>
              </div>
              <span className="channel-desc">محادثة سريعة عبر فيسبوك</span>
            </div>
            <span className="channel-arrow">‹</span>
          </a>

          {/* Facebook Page */}
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-channel-item facebook-channel"
            title="الصفحة الرسمية على فيسبوك"
          >
            <div className="channel-icon-wrap facebook-icon-bg">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95C18.05 21.45 22 17.19 22 12z" />
              </svg>
            </div>
            <div className="channel-text-wrap">
              <div className="channel-title-row">
                <span className="channel-title">فيسبوك (Facebook)</span>
                <span className="channel-tag tag-fb">الصفحة الرسمية</span>
              </div>
              <span className="channel-desc">الصفحة الرسمية للدكتور في الرياضيات</span>
            </div>
            <span className="channel-arrow">‹</span>
          </a>
        </div>

        {/* Quick Footer Prompt */}
        <div className="contact-popup-footer">
          <div className="contact-footer-note">
            <span className="footer-note-icon">💬</span>
            <span className="footer-note-text">يسعدنا الرد على استفساراتكم والتواصل معكم دائماً</span>
          </div>
        </div>
      </div>

      {/* Floating Main Button */}
      <button
        type="button"
        className={`floating-contact-trigger ${isOpen ? "trigger-open" : ""}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label="فتح خيارات التواصل مع مدير المنصة"
      >
        <span className="trigger-pulse-ring"></span>
        <span className="trigger-pulse-ring ring-delay"></span>

        {/* Floating Icons Stack / Cross */}
        <div className="trigger-icons-container">
          {isOpen ? (
            <span className="trigger-close-icon">✕</span>
          ) : (
            <div className="trigger-multi-icons">
              {/* Headset / Chat icon */}
              <svg className="icon-main-chat" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
              </svg>
              {/* Mini glowing badges */}
              <span className="trigger-mini-badge badge-wa" title="واتساب"></span>
              <span className="trigger-mini-badge badge-fb" title="فيسبوك"></span>
            </div>
          )}
        </div>

        {/* Floating Tooltip / Label */}
        {!isOpen && !hasInteracted && (
          <span className="floating-trigger-bubble">
            <span className="bubble-wave">👋</span> تواصل مع الإدارة
          </span>
        )}
      </button>
    </aside>
  );
}
