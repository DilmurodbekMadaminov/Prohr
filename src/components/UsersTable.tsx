import React, { useState } from 'react';
import { Users, Search, Download, Building2, School } from 'lucide-react';
import { UserActivity } from '../types';

interface UsersTableProps {
  users: UserActivity[];
}

export const UsersTable: React.FC<UsersTableProps> = ({ users }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter((u) =>
    u.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadCSV = () => {
    if (users.length === 0) return;
    const headers = "Telegram_User_ID,HDP_Clicks,Omon_Clicks,Total_Interactions\n";
    const rows = users
      .map((u) => `${u.id},${u.hdp},${u.omon},${u.total}`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xorazm_ish_bozor_users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Faol Foydalanuvchilar Ro'yxati</h2>
            <p className="text-xs text-slate-400">
              Telegram ID va ariza bosish statistikasi ({users.length} ta yozuv)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Telegram ID qidirish..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
            />
          </div>
          <button
            onClick={downloadCSV}
            disabled={users.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 shrink-0"
            title="CSV fayl yuklab olish"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        {filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            {searchTerm ? "Qidiruv bo'yicha foydalanuvchi topilmadi" : "Hozircha foydalanuvchilar statistikasi mavjud emas"}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Telegram ID</th>
                <th className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <Building2 className="w-3 h-3" /> HDP LC
                  </span>
                </th>
                <th className="py-3 px-4 text-center">
                  <span className="inline-flex items-center gap-1 text-purple-400">
                    <School className="w-3 h-3" /> Omon School
                  </span>
                </th>
                <th className="py-3 px-4 text-right">Jami Bosishlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {filteredUsers.map((user, idx) => (
                <tr key={user.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                  <td className="py-3 px-4 font-mono font-medium text-white">{user.id}</td>
                  <td className="py-3 px-4 text-center text-emerald-400 font-semibold">{user.hdp}</td>
                  <td className="py-3 px-4 text-center text-purple-400 font-semibold">{user.omon}</td>
                  <td className="py-3 px-4 text-right font-bold text-blue-400">{user.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
