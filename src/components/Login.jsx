import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { getFirebaseAuthErrorMessage } from '../lib/authErrors.js';

/**
 * Login
 * Halaman login split-screen Firebase Authentication untuk Mode Terhubung.
 * Mode Terhubung memerlukan akun terdaftar (read-only); Mode Simulasi dapat diakses sebagai tamu.
 */
export default function Login({ isOpen, onClose, onSuccess, onSwitchToSimulation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Email tidak boleh kosong.');
      return;
    }
    if (!password) {
      setErrorMsg('Kata sandi tidak boleh kosong.');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setEmail('');
      setPassword('');
      if (onSuccess) onSuccess();
    } catch (err) {
      setErrorMsg(getFirebaseAuthErrorMessage(err?.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = () => {
    setErrorMsg('');
    if (onSwitchToSimulation) {
      onSwitchToSimulation();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-app-bg text-text-main">
      {/* Panel Kiri: Informasi Sistem */}
      <div className="flex flex-col justify-center px-8 py-12 sm:px-14 lg:px-20 bg-surface border-b lg:border-b-0 lg:border-r border-border-line">
        <div className="max-w-md mx-auto lg:mx-0">
          {/* Ikon Lampu Lalu Lintas */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-border-line mb-7 shadow-xs">
            <span className="w-3.5 h-3.5 rounded-full bg-tl-red shadow-xs shadow-tl-red" />
            <span className="w-3.5 h-3.5 rounded-full bg-tl-yellow shadow-xs shadow-tl-yellow" />
            <span className="w-3.5 h-3.5 rounded-full bg-tl-green shadow-xs shadow-tl-green" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-main leading-tight mb-4">
            Smart Traffic Light
            <br />
            Rawamangun
          </h1>

          <p className="text-sm text-text-muted leading-relaxed mb-5">
            Dasbor pemantauan dan kontrol lampu lalu lintas cerdas di Persimpangan
            Rawamangun Muka, dengan prioritas ambulans.
          </p>

          <div className="mb-6">
            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full border border-warning/40 text-warning bg-warning/10">
              Prototipe simulasi akademik
            </span>
          </div>

          <ul className="space-y-2.5 text-sm text-text-main">
            <li className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <span>Pantau fase aktif dan sisa waktu lampu secara real-time</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <span>Atur kepadatan antrean dan kecepatan simulasi</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
              <span>Panggil skenario multi-ambulans dari 3 arah</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Panel Kanan: Kartu Form Login */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-app-bg">
        <div className="w-full max-w-md rounded-2xl border border-border-line bg-surface p-7 sm:p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-text-main">Masuk</h2>
            <p className="text-xs text-text-muted mt-1">
              Gunakan akun terdaftar untuk Mode Terhubung.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label htmlFor="login-email" className="block text-text-muted font-medium mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                autoComplete="email"
                className="w-full rounded-lg bg-surface-2 border border-border-line px-3.5 py-2.5 text-sm text-text-main outline-hidden focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-text-muted font-medium mb-1.5">
                Kata sandi
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-lg bg-surface-2 border border-border-line px-3.5 py-2.5 text-sm text-text-main outline-hidden focus:border-accent transition-colors"
              />
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-lg bg-error/10 border border-error/40 px-3.5 py-2.5 text-xs text-error font-medium"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-accent text-slate-950 py-2.5 text-sm font-bold hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-border-line" />
            <span className="bg-surface px-3 text-[11px] text-text-muted">atau</span>
          </div>

          <button
            type="button"
            onClick={handleGuestMode}
            className="w-full rounded-lg bg-surface-2 border border-border-line py-2.5 text-xs font-semibold text-text-main hover:border-accent hover:text-accent transition-colors cursor-pointer"
          >
            Lanjut sebagai Tamu (Mode Simulasi)
          </button>

          <p className="mt-4 text-center text-[11px] text-text-muted">
            Mode Simulasi berjalan lokal dan tidak memerlukan akun.
          </p>
        </div>
      </div>
    </div>
  );
}
