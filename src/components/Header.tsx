import React from 'react';
import { Bot, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';
import { BotStatus } from '../types';

interface HeaderProps {
  status: BotStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({ status, loading, onRefresh, onOpenGuide }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Xorazm Ish Bozor</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                  Telegram Bot Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Boshqaruv paneli va real vaqtdagi statistika
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {status ? (
              <div className="flex items-center gap-2 text-xs">
                {status.configured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Bot Faol
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> Token kiritilmagan
                  </span>
                )}

                {status.adminIdSet ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-medium border border-slate-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Admin ID: {status.adminId}
                  </span>
                ) : null}
              </div>
            ) : null}

            <button
              onClick={onOpenGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Sozlash qo'llanmasi"
            >
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Qo'llanma</span>
            </button>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Yangilash</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
