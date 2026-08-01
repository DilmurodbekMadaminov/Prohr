import React, { useState, useEffect } from 'react';
import { Settings, Save, Check, Link, Radio, ExternalLink, ShieldCheck } from 'lucide-react';
import { BotSettings } from '../types';

interface SettingsPanelProps {
  settings: BotSettings | null;
  onSave: (newSettings: BotSettings) => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSave }) => {
  const [channelUsername, setChannelUsername] = useState('');
  const [hdpLink, setHdpLink] = useState('');
  const [hdpVodiyLink, setHdpVodiyLink] = useState('');
  const [omonLink, setOmonLink] = useState('');
  const [adminId, setAdminId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setChannelUsername(settings.channel_username || '');
      setHdpLink(settings.hdp_link || '');
      setHdpVodiyLink(settings.hdp_vodiy_link || '');
      setOmonLink(settings.omon_link || '');
      setAdminId(settings.admin_id || '');
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await onSave({
        channel_username: channelUsername.trim(),
        hdp_link: hdpLink.trim(),
        hdp_vodiy_link: hdpVodiyLink.trim(),
        omon_link: omonLink.trim(),
        admin_id: adminId.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "Sozlamalarni saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Bot Sozlamalari</h2>
          <p className="text-xs text-slate-400">
            Arizalar havolalari va majburiy obuna kanalini o'zgartirish
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              Majburiy Obuna Kanali
            </span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={channelUsername}
              onChange={(e) => setChannelUsername(e.target.value)}
              placeholder="https://t.me/Xorazm_ish_bozor1 yoki @kanal_nomi"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
              required
            />
            {channelUsername && (
              <a
                href={channelUsername.startsWith('http') ? channelUsername : `https://t.me/${channelUsername.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-400 transition"
                title="Kanalni ochish"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Foydalanuvchi botdan foydalanishi uchun ushbu kanalga obuna bo'lishi shart.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Admin Telegram ID ( /admin buyrug'i uchun )
            </span>
          </label>
          <input
            type="text"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            placeholder="masalan: 123456789"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition font-mono"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Botda /admin buyrug'idan foydalanishi mumkin bo'lgan admin foydalanuvchi Telegram ID raqami.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-emerald-400" />
              HDP LC Ariza Silkasi (Google Form / Link)
            </span>
          </label>
          <input
            type="url"
            value={hdpLink}
            onChange={(e) => setHdpLink(e.target.value)}
            placeholder="https://forms.gle/..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-blue-400" />
              HDP LC Vodiy Ariza Silkasi (Google Form / Link)
            </span>
          </label>
          <input
            type="url"
            value={hdpVodiyLink}
            onChange={(e) => setHdpVodiyLink(e.target.value)}
            placeholder="https://forms.gle/dVVii5PdmqqvQe8Y7"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-purple-400" />
              Omon School Ariza Silkasi (Google Form / Link)
            </span>
          </label>
          <input
            type="url"
            value={omonLink}
            onChange={(e) => setOmonLink(e.target.value)}
            placeholder="https://forms.gle/..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
            required
          />
        </div>

        <div className="pt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            O'zgarishlar darhol bazaga saqlanadi.
          </span>
          <button
            type="submit"
            disabled={saving}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white transition shadow-sm ${
              saved
                ? 'bg-emerald-600'
                : 'bg-blue-600 hover:bg-blue-500 active:scale-95'
            } disabled:opacity-50`}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saqlandi!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{saving ? "Saqlanmoqda..." : "Saqlash"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
