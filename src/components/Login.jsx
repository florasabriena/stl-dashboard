import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { getFirebaseAuthErrorMessage } from '../lib/authErrors.js';

export { getFirebaseAuthErrorMessage };

/**
 * Komponen Login Firebase Authentication
 * Mode Terhubung hanya bisa dibuka setelah pengguna berhasil login.
 * Mode Simulasi tetap terbuka tanpa autentikasi.
 */
export default function Login({
  isOpen = false,
  onClose,
  onSuccess,
  onSwitchToSimulation,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Harap masukkan alamat email.');
      return;
    }
    if (!password) {
      setErrorMsg('Harap masukkan kata sandi.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setIsLoading(false);
      setEmail('');
      setPassword('');
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      setIsLoading(false);
      setErrorMsg(getFirebaseAuthErrorMessage(err.code));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-xl border border-border-line bg-surface p-6 shadow-2xl relative">
        {/* Tombol Tutup / Kembali */}
        <div className="flex items-center justify-between mb-4 border-b border-border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
            <h3 className="text-sm font-bold text-text-main">
              Masuk Mode Terhubung
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-text-muted hover:text-text-main text-xl leading-none px-1 rounded-md hover:bg-surface-2 transition-colors"
              title="Tutup"
            >
              ×
            </button>
          )}
        </div>

        <p className="text-xs text-text-muted mb-4 leading-relaxed">
          Mode Terhubung ke Firebase RTDB memerlukan autentikasi resmi. Akun yang masuk hanya memiliki hak baca (read-only).
        </p>

        {/* Pesan Kesalahan Bahasa Indonesia */}
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-error/10 border border-error/40 p-3 text-xs text-error flex items-start gap-2 animate-fadeIn">
            <span className="shrink-0 text-sm">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-text-muted font-medium mb-1">
              Alamat Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@institusi.ac.id"
              disabled={isLoading}
              className="w-full rounded-lg bg-surface-2 border border-border-line px-3 py-2 text-text-main outline-hidden focus:border-accent transition-colors disabled:opacity-50"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-text-muted font-medium mb-1">
              Kata Sandi
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              className="w-full rounded-lg bg-surface-2 border border-border-line px-3 py-2 text-text-main outline-hidden focus:border-accent transition-colors disabled:opacity-50"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 rounded-lg bg-accent text-surface py-2.5 font-bold hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <span>Masuk</span>
            )}
          </button>
        </form>

        {/* Tombol kembali ke Mode Simulasi bila diblokir saat masuk Mode Terhubung */}
        {onSwitchToSimulation && (
          <div className="mt-4 pt-3 border-t border-border-line text-center">
            <button
              type="button"
              onClick={onSwitchToSimulation}
              className="text-xs text-accent hover:underline font-medium"
            >
              ← Tetap di Mode Simulasi (Tanpa Login)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
