// src/components/StudentAIRoomModal.jsx
import { useState, useRef } from "react";

export default function StudentAIRoomModal({ room, onClose }) {
  const [iframeKey, setIframeKey] = useState(1);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const iframeRef = useRef(null);

  if (!room) return null;

  const handleRefresh = () => {
    setIsIframeLoaded(false);
    setIframeKey((prev) => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(room.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        animation: "overlayFadeIn 0.2s ease both",
      }}
    >
      <div
        className="glass fade-in"
        style={{
          maxWidth: "1100px",
          width: "100%",
          height: "92vh",
          borderRadius: "24px",
          border: "1.5px solid rgba(168, 85, 247, 0.45)",
          background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(168, 85, 247, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "0.9rem 1.4rem",
            borderBottom: "1px solid rgba(168, 85, 247, 0.25)",
            background: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          {/* Room Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #a855f7, #0284c7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                boxShadow: "0 4px 14px rgba(168, 85, 247, 0.4)",
              }}
            >
              {room.icon || "🤖"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#ffffff", margin: 0 }}>
                  {room.title}
                </h3>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    background: "rgba(168, 85, 247, 0.25)",
                    color: "#c084fc",
                    border: "1px solid rgba(168, 85, 247, 0.45)",
                    padding: "2px 9px",
                    borderRadius: "12px",
                  }}
                >
                  {room.badgeText || "مساعد ذكي تفاعلي ⚡"}
                </span>
              </div>
              {room.description && (
                <p style={{ margin: "2px 0 0 0", color: "#cbd5e1", fontSize: "0.8rem", fontWeight: 600 }}>
                  {room.description}
                </p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              onClick={handleRefresh}
              className="button button-sm button-muted"
              title="إعادة تحميل المساعد"
              style={{ borderRadius: "10px", fontSize: "0.82rem", padding: "0.35rem 0.75rem", gap: "4px" }}
            >
              🔄 تحديث
            </button>

            <button
              onClick={handleOpenExternal}
              className="button button-sm button-primary"
              title="فتح في نافذة خارجية جديدة"
              style={{
                background: "linear-gradient(135deg, #0284c7, #0369a1)",
                borderRadius: "10px",
                fontSize: "0.82rem",
                padding: "0.35rem 0.85rem",
                fontWeight: 800,
                boxShadow: "0 2px 10px rgba(2, 132, 199, 0.3)",
              }}
            >
              ↗ فتح كنافذة كاملة
            </button>

            <button
              onClick={onClose}
              className="button button-sm button-muted"
              title="إغلاق"
              style={{ borderRadius: "50%", width: "36px", height: "36px", padding: 0 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Iframe Container */}
        <div style={{ flex: 1, position: "relative", width: "100%", height: "100%", background: "#0f172a" }}>
          {!isIframeLoaded && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f172a",
                zIndex: 2,
                color: "#cbd5e1",
                gap: "0.8rem",
              }}
            >
              <div style={{ fontSize: "2.5rem", animation: "logoSway 3s ease-in-out infinite" }}>🤖</div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "#38bdf8" }}>جاري تحميل المساعد الذكي...</div>
            </div>
          )}

          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={room.url}
            title={room.title}
            onLoad={() => setIsIframeLoaded(true)}
            allow="camera; microphone; clipboard-read; clipboard-write; web-share"
            allowFullScreen
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
              background: "#ffffff",
            }}
          />
        </div>

        {/* Footer info bar */}
        <div
          style={{
            padding: "0.6rem 1.2rem",
            background: "rgba(15, 23, 42, 0.85)",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            fontSize: "0.8rem",
            color: "#94a3b8",
          }}
        >
          <span>💡 <strong>ملاحظة:</strong> إذا واجهت شاشة بيضاء أو تقييداً من الموقع الأصلي، اضغط على زر <strong>(↗ فتح كنافذة كاملة)</strong> بالأعلى.</span>
          <span style={{ color: "#c084fc", fontWeight: 700 }}>منصة الدكتور فى الرياضيات 🎓</span>
        </div>
      </div>
    </div>
  );
}
