"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const BG_DARK = "#17191E";
const BG_CARD = "#1C1E23";
const BG_SURFACE = "#252729";
const BORDER = "#343740";
const ACCENT = "#C8102E";
const TEXT_PRIMARY = "#F5F5F5";
const TEXT_MUTED = "#808080";
const ERROR = "#C8102E";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin/voice";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Enter both username and password.");
      return;
    }

    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username: username.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid username or password.");
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: BG_DARK, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 16,
      fontFamily: "'Manrope', system-ui, sans-serif",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG_DARK}; }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 400, backgroundColor: BG_CARD,
        border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32,
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${ACCENT}, #8B0000)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          }}>
            🎙️
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY }}>Budo League</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: TEXT_MUTED }}>Admin Login</p>
        </div>

        {/* Form */}
        <div>
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 16,
              backgroundColor: `${ERROR}10`, border: `1px solid ${ERROR}30`,
              fontSize: 13, color: ERROR, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(e); }}
              placeholder="Enter your username"
              autoComplete="username"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                color: TEXT_PRIMARY, fontSize: 15, fontFamily: "inherit", outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSubmit(e); }}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "12px 14px", paddingRight: 48, borderRadius: 10,
                  border: `1px solid ${BORDER}`, backgroundColor: BG_SURFACE,
                  color: TEXT_PRIMARY, fontSize: 15, fontFamily: "inherit", outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                style={{
                  position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                  width: 36, height: 36, borderRadius: 8,
                  border: "none", backgroundColor: "transparent",
                  color: TEXT_MUTED, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "14px 20px", borderRadius: 10,
              border: "none", backgroundColor: ACCENT, color: "#FFFFFF",
              fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
              fontFamily: "inherit", opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}