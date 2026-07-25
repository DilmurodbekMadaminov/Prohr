import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { SettingsPanel } from './components/SettingsPanel';
import { BroadcastCenter } from './components/BroadcastCenter';
import { UsersTable } from './components/UsersTable';
import { BotSimulator } from './components/BotSimulator';
import { SetupGuide } from './components/SetupGuide';
import { BotStatus, BotStats, BotSettings } from './types';
import { AlertCircle, Terminal, HelpCircle } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, statsRes, settingsRes] = await Promise.all([
        fetch('/api/status').then((res) => res.json()),
        fetch('/api/stats').then((res) => res.json()),
        fetch('/api/settings').then((res) => res.json()),
      ]);

      if (!statusRes.error) setStatus(statusRes);
      if (!statsRes.error) setStats(statsRes);
      if (!settingsRes.error) setSettings(settingsRes);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSaveSettings = async (newSettings: BotSettings) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to update settings');
    }
    setSettings(newSettings);
    fetchData();
  };

  const handleSendBroadcast = async (text: string) => {
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to send broadcast');
    }
    return data;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <Header
        status={status}
        loading={loading}
        onRefresh={fetchData}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Warning banner if BOT_TOKEN is missing */}
        {status && !status.configured && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-300">
                  Telegram BOT_TOKEN sozlanmagan
                </h3>
                <p className="text-xs text-amber-200/80 mt-1">
                  Telegram bot faoliyat yuritishi uchun AI Studio'dagi "Secrets" paneli orqali <b>BOT_TOKEN</b> kiritilishi lozim.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsGuideOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-xl transition shrink-0"
            >
              Qo'llanmani ko'rish
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <MetricCards stats={stats} settings={settings} />

        {/* Middle Section: Settings Panel & Bot Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SettingsPanel settings={settings} onSave={handleSaveSettings} />
          <BotSimulator settings={settings} />
        </div>

        {/* Broadcast Message Section */}
        <BroadcastCenter
          totalUsers={stats?.totalUsers || 0}
          onSendBroadcast={handleSendBroadcast}
        />

        {/* Users Statistics Table */}
        <UsersTable users={stats?.users || []} />
      </main>

      {/* Setup Guide Modal */}
      <SetupGuide
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        appUrl={status?.appUrl || null}
      />
    </div>
  );
}
