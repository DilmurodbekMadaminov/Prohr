import React from 'react';
import { X, Key, Shield, HelpCircle, Terminal, ExternalLink } from 'lucide-react';

interface SetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string | null;
}

export const SetupGuide: React.FC<SetupGuideProps> = ({ isOpen, onClose, appUrl }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Bot Sozlash Qo'llanmasi</h2>
            <p className="text-xs text-slate-400">Telegram botni ishga tushirish va ulash bosqichlari</p>
          </div>
        </div>

        <div className="mt-6 space-y-6 text-sm text-slate-300">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              1
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" /> Telegram Bot yaratish va Bot Token olish
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Telegram'da <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">@BotFather</a> ga kiring, <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-300">/newbot</code> buyrug'ini yuboring va botingizga nom hamda username bering. BotFather sizga maxsus <b>HTTP API Token</b> beradi.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              2
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> AI Studio Secrets bo'limiga kalit qo'shish
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI Studio interfeysidagi yuqori menyuda joylashgan <b>Settings / Secrets</b> bo'limiga kiring va quyidagi o'zgaruvchilarni kiriting:
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs space-y-1 text-slate-300">
                <div><span className="text-blue-400">BOT_TOKEN</span> = <i>BotFather bergan token</i></div>
                <div><span className="text-emerald-400">ADMIN_ID</span> = <i>Sizning Telegram ID raqamingiz</i></div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              3
            </div>
            <div className="space-y-1.5 flex-1">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" /> Telegram ID va Admin paneldan foydalanish
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                O'zingizning Telegram ID raqamingizni bilish uchun botingizga <code className="bg-slate-950 px-1.5 py-0.5 rounded text-purple-300">/myid</code> buyrug'ini yuboring. <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300">ADMIN_ID</code> kiritilgach, bot ichida <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300">/admin</code> buyrug'i orqali ham boshqarishingiz mumkin.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
          >
            Tushundim
          </button>
        </div>
      </div>
    </div>
  );
};
