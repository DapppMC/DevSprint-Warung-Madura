import { useState, type FormEvent } from 'react';
import {
  Lock,
  User,
  ShieldAlert,
  Sparkles,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Crown,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';

export function LoginPage() {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) {
      setErrorMessage('Username dan PIN rahasia wajib diisi.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setIsRateLimited(false);
    try {
      await login(username.trim(), pin.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Username atau PIN salah.';
      if (
        msg.includes('429') ||
        msg.toLowerCase().includes('terlalu banyak') ||
        msg.toLowerCase().includes('rate limit')
      ) {
        setIsRateLimited(true);
        setErrorMessage(
          'Terlalu banyak percobaan gagal berturut-turut. Akun dikunci sementara (15 menit) untuk proteksi keamanan dari serangan brute force.',
        );
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (user: string, defaultPin: string) => {
    setUsername(user);
    setPin(defaultPin);
    setIsLoading(true);
    setErrorMessage(null);
    setIsRateLimited(false);
    try {
      await login(user, defaultPin);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-transform duration-100 ease-out duration-150 relative">
      {/* Theme toggle in top-right */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
          className="rounded-lg p-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform duration-100 ease-out shadow-xs"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600 dark:text-slate-300" />}
        </button>
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <img
          src="/warung-madura-logo.jpg"
          alt="Warung Madura"
          className="inline-block w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-lg shadow-emerald-600/20 mb-3"
        />
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Warung Madura Stock Manager
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
          Enterprise Logistics, Stock & Role-Based Access Control
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-sm rounded-2xl sm:px-10 border border-slate-200/90 dark:border-slate-800 transition-transform duration-100 ease-out">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-500" /> Masuk ke Sistem
            </h3>
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 font-mono">v2.0 Hardened</span>
          </div>

          {errorMessage && (
            <div
              className={`mb-5 rounded-xl border p-3.5 text-xs flex items-start gap-2.5 shadow-xs ${
                isRateLimited
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300'
              }`}
            >
              <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{isRateLimited ? 'Sistem Terkunci (Rate Limit)' : 'Autentikasi Gagal'}</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label
                htmlFor="username"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1"
              >
                Username
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: cakrofi, udin, sari"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:focus:ring-emerald-500 transition-transform duration-100 ease-out"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="pin"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1"
              >
                PIN Rahasia / Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan PIN otentikasi"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:focus:ring-emerald-500 transition-transform duration-100 ease-out"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg shadow-xs text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-transform duration-100 ease-out cursor-pointer"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memverifikasi Kredensial...
                </span>
              ) : (
                'Masuk ke Sistem'
              )}
            </button>
          </form>

          {/* Quick Demo Access Switcher */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" /> Akses Cepat Demo (1-Klik Masuk):
            </p>

            <div className="space-y-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickLogin('cakrofi', '123456')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100/70 dark:hover:bg-amber-900/50 text-left transition-transform duration-100 ease-out group cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Cak Rofi</span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                      PEMILIK
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    User: <code className="font-mono font-semibold">cakrofi</code> · PIN:{' '}
                    <code className="font-mono font-semibold">123456</code> (Full RBAC + Omset)
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-700 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickLogin('udin', '1111')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 text-left transition-transform duration-100 ease-out group cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Udin (Gudang)</span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-200 dark:bg-blue-900/80 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                      STAF
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    User: <code className="font-mono font-semibold">udin</code> · PIN:{' '}
                    <code className="font-mono font-semibold">1111</code> (Terima Barang, No Cost)
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-700 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickLogin('sari', '2222')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-950/40 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 text-left transition-transform duration-100 ease-out group cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Sari (Kasir)</span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-200 dark:bg-blue-900/80 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                      STAF
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    User: <code className="font-mono font-semibold">sari</code> · PIN:{' '}
                    <code className="font-mono font-semibold">2222</code> (Kasir & Transaksi)
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-700 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
