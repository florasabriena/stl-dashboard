import React from 'react';

/**
 * Login
 * Komponen login Firebase Authentication untuk mode terhubung (FR-23).
 * Dashboard hanya dapat dibuka pengguna terautentikasi dan hanya membaca data.
 */
export default function Login({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-xl border border-border-line bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-border-line pb-2">
          <h3 className="text-sm font-bold text-text-main">
            Login Mode Terhubung
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-main text-lg leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-text-muted mb-4">
          Mode terhubung ke Firebase RTDB memerlukan autentikasi. Akun hanya memiliki hak baca (read-only).
        </p>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-3 text-xs">
          <div>
            <label className="block text-text-muted font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="user@example.com"
              className="w-full rounded-lg bg-surface-2 border border-border-line px-3 py-2 text-text-main outline-hidden focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-text-muted font-medium mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg bg-surface-2 border border-border-line px-3 py-2 text-text-main outline-hidden focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="w-full mt-2 rounded-lg bg-accent text-surface py-2 font-bold hover:bg-accent-hover transition-colors"
          >
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
}
