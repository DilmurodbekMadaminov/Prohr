import React, { useState } from 'react';
import { Send, Megaphone, AlertCircle, CheckCircle } from 'lucide-react';

interface BroadcastCenterProps {
  totalUsers: number;
  onSendBroadcast: (text: string) => Promise<{ success: boolean; message: string; totalUsers: number }>;
}

export const BroadcastCenter: React.FC<BroadcastCenterProps> = ({ totalUsers, onSendBroadcast }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const confirmMsg = totalUsers > 0 
      ? `Haqiqatan ham barcha (${totalUsers} ta) foydalanuvchilarga xabar yubormoqchimisiz?` 
      : `Haqiqatan ham barcha foydalanuvchilarga xabar yubormoqchimisiz?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setSending(true);
    setStatusMsg(null);

    try {
      const res = await onSendBroadcast(text);
      setStatusMsg({ type: 'success', text: res.message });
      setText('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || "Xabar tarqatishda xatolik yuz berdi" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
          <Megaphone className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Xabar Tarqatish (Broadcast)</h2>
          <p className="text-xs text-slate-400">
            Botning barcha {totalUsers} ta foydalanuvchisiga ommaviy xabar yuborish
          </p>
        </div>
      </div>

      <form onSubmit={handleBroadcast} className="mt-5 space-y-4">
        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Xabar matni:
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Assalomu alaykum! Yangi bo'sh ish o'rinlari haqida e'lon..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none"
            required
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>Matn tahriri va emojilardan foydalanishingiz mumkin</span>
            <span>{text.length} belgi</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">
            {totalUsers > 0 ? `Target: ${totalUsers} ta foydalanuvchi` : 'Target: Barcha foydalanuvchilar'}
          </span>
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? "Yuborilmoqda..." : "Xabar Yuborish"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
