import React, { useState, useEffect } from 'react';
import { Send, Megaphone, AlertCircle, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react';

interface BroadcastCenterProps {
  totalUsers: number;
  onSendBroadcast: (text: string, imageUrl?: string) => Promise<{ success: boolean; message: string; totalUsers: number; sent?: number; failed?: number }>;
}

interface BroadcastStatus {
  inProgress: boolean;
  total: number;
  success: number;
  fail: number;
  processed: number;
  percentage: number;
}

export const BroadcastCenter: React.FC<BroadcastCenterProps> = ({ totalUsers, onSendBroadcast }) => {
  const [text, setText] = useState('');
  const [broadcastImage, setBroadcastImage] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [broadcastProgress, setBroadcastProgress] = useState<BroadcastStatus | null>(null);

  // Poll broadcast status every 1.5 seconds if active
  useEffect(() => {
    let interval: any = null;

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/broadcast/status');
        const data = await res.json();
        if (data.ok) {
          setBroadcastProgress(data);
          if (!data.inProgress && broadcastProgress?.inProgress) {
            setStatusMsg({
              type: 'success',
              text: `✅ Xabar tarqatish yakunlandi! Jami: ${data.total}, Yetkazildi: ${data.success}, Yetib bormadi: ${data.fail}`
            });
          }
        }
      } catch (err) {}
    };

    checkStatus();
    interval = setInterval(checkStatus, 1500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !broadcastImage.trim()) return;

    if (broadcastProgress?.inProgress) {
      alert("Hozirda xabar tarqatish davom etmoqda. Iltimos, u tugashini kuting!");
      return;
    }

    const confirmMsg = totalUsers > 0 
      ? `Haqiqatan ham barcha (${totalUsers} ta) foydalanuvchilarga xabar yubormoqchimisiz?` 
      : `Haqiqatan ham barcha foydalanuvchilarga xabar yubormoqchimisiz?`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setSending(true);
    setStatusMsg(null);

    try {
      const res = await onSendBroadcast(text, broadcastImage.trim() || undefined);
      setStatusMsg({ type: 'success', text: res.message });
      setText('');
      setBroadcastImage('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || "Xabar tarqatishda xatolik yuz berdi" });
    } finally {
      setSending(false);
    }
  };

  const isBroadcasting = broadcastProgress?.inProgress;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
          <Megaphone className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            Foydalanuvchilarga Xabar Tarqatish
          </h2>
          <p className="text-xs text-slate-400">
            Botning barcha {totalUsers} ta foydalanuvchisiga ommaviy xabar yoki rasm yuborish
          </p>
        </div>
      </div>

      <form onSubmit={handleBroadcast} className="mt-5 space-y-4">
        {/* Live Broadcast Progress Bar */}
        {isBroadcasting && (
          <div className="p-4 bg-indigo-950/50 border border-indigo-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-indigo-300 font-medium">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                Xabar yuborilmoqda...
              </span>
              <span>
                {broadcastProgress.processed} / {broadcastProgress.total} ({broadcastProgress.percentage}%)
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, broadcastProgress.percentage)}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 pt-1">
              <span className="text-emerald-400">✅ Yetkazildi: {broadcastProgress.success}</span>
              <span className="text-amber-400">❌ Yetib bormadi: {broadcastProgress.fail}</span>
            </div>
          </div>
        )}

        {statusMsg && !isBroadcasting && (
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

        {/* Image URL Input */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
            Rasm URL (ixtiyoriy)
          </label>
          <input
            type="url"
            value={broadcastImage}
            onChange={(e) => setBroadcastImage(e.target.value)}
            disabled={sending || isBroadcasting}
            placeholder="https://example.com/image.jpg"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition disabled:opacity-50 font-mono text-xs"
          />
          {broadcastImage.trim() && (
            <div className="mt-2 relative w-32 h-20 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={broadcastImage}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Text Area */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Xabar matni (HTML formatida ham yozish mumkin):
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending || isBroadcasting}
            rows={5}
            placeholder="Assalomu alaykum! Yangi bo'sh ish o'rinlari haqida e'lon..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none disabled:opacity-50"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>Matn tahriri va HTML teglari (<b>...</b>, <i>...</i>, <a>...</a>) hamda emojilardan foydalanishingiz mumkin</span>
            <span>{text.length} belgi</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-500">
            {totalUsers > 0 ? `Target: ${totalUsers} ta foydalanuvchi` : 'Target: Barcha foydalanuvchilar'}
          </span>
          <button
            type="submit"
            disabled={sending || isBroadcasting || (!text.trim() && !broadcastImage.trim())}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {sending || isBroadcasting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {isBroadcasting
                ? `Yuborilmoqda (${broadcastProgress?.percentage || 0}%)`
                : sending
                ? "Yuborilmoqda..."
                : "Xabarni Barchaga Yuborish"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
