import React from 'react';
import { Users, Building2, School, Radio } from 'lucide-react';
import { BotStats, BotSettings } from '../types';

interface MetricCardsProps {
  stats: BotStats | null;
  settings: BotSettings | null;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ stats, settings }) => {
  const safeFormat = (val: any): string => {
    if (val === undefined || val === null) return '0';
    try {
      if (typeof val === 'number' && !isNaN(val)) {
        return val.toLocaleString();
      }
      if (typeof val === 'string' && val.trim() !== '') {
        const num = Number(val);
        if (!isNaN(num)) return num.toLocaleString();
      }
    } catch {
      return '0';
    }
    return '0';
  };

  const totalUsersStr = safeFormat(stats?.totalUsers ?? stats?.usersCount);
  const totalHdpStr = safeFormat(stats?.totalHdp);
  const totalOmonStr = safeFormat(stats?.totalOmon ?? stats?.totalOmonAll);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Users */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all duration-300"></div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Jami foydalanuvchilar</p>
            <h3 className="text-2xl font-bold text-white mt-1">
              {totalUsersStr}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Botdan foydalanganlar</p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* HDP LC Clicks */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all duration-300"></div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">HDP LC Arizalari</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">
              {totalHdpStr}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Ariza tugmasi bosilishi</p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Omon School Clicks */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all duration-300"></div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Omon School Arizalari</p>
            <h3 className="text-2xl font-bold text-purple-400 mt-1">
              {totalOmonStr}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Ariza tugmasi bosilishi</p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <School className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Channel Link */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all duration-300"></div>
        <div className="flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-xs font-medium text-slate-400">Majburiy Kanal</p>
            <h3 className="text-sm font-semibold text-amber-400 mt-2 truncate">
              {settings?.channel_username || 'Kanal sozlanmagan'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Obuna tekshiriladigan manzil</p>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0">
            <Radio className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};
