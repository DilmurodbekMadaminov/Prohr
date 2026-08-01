import React, { useState } from 'react';
import { Smartphone, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { BotSettings } from '../types';

interface BotSimulatorProps {
  settings: BotSettings | null;
}

export const BotSimulator: React.FC<BotSimulatorProps> = ({ settings }) => {
  const [messages, setMessages] = useState<
    { sender: 'bot' | 'user'; text: string; buttons?: { label: string; url?: string; action?: string }[] }[]
  >([
    {
      sender: 'bot',
      text: 'Bot faollashtirildi. Ish joyini tanlang:',
      buttons: [
        { label: 'HDP LC', action: 'hdp' },
        { label: 'HDP LC Vodiy', action: 'hdp_vodiy' },
      ],
    },
  ]);

  const [subscribed, setSubscribed] = useState(true);

  const handleUserClick = (action: string) => {
    if (action === 'start') {
      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: '/start' },
      ]);
      setTimeout(() => {
        if (!subscribed) {
          setMessages((prev) => [
            ...prev,
            {
              sender: 'bot',
              text: 'Botdan foydalanish uchun kanalga obuna bo‘ling:',
              buttons: [
                { label: "Obuna bo'lish", url: settings?.channel_username || '#' },
                { label: 'Tekshirish', action: 'check_sub' },
              ],
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              sender: 'bot',
              text: 'Ish joyini tanlang:',
              buttons: [
                { label: 'HDP LC', action: 'hdp' },
                { label: 'HDP LC Vodiy', action: 'hdp_vodiy' },
              ],
            },
          ]);
        }
      }, 400);
    } else if (action === 'hdp') {
      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: 'HDP LC' },
      ]);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: 'HDP LC uchun ariza topshirish:',
            buttons: [
              { label: 'Ariza topshirish ↗', url: settings?.hdp_link || '#' },
            ],
          },
        ]);
      }, 400);
    } else if (action === 'hdp_vodiy') {
      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: 'HDP LC Vodiy' },
      ]);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: 'HDP LC Vodiy filiali uchun ariza topshirish:',
            buttons: [
              { label: 'Ariza topshirish ↗', url: settings?.hdp_vodiy_link || 'https://forms.gle/dVVii5PdmqqvQe8Y7' },
            ],
          },
        ]);
      }, 400);
    } else if (action === 'omon') {
      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: 'Omon School' },
      ]);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: 'Omon School uchun ariza topshirish:',
            buttons: [
              { label: 'Ariza topshirish ↗', url: settings?.omon_link || '#' },
            ],
          },
        ]);
      }, 400);
    } else if (action === 'check_sub') {
      setSubscribed(true);
      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: 'Tekshirish [Button Click]' },
        {
          sender: 'bot',
          text: '✅ Obuna tasdiqlandi!\n\nIsh joyini tanlang:',
          buttons: [
            { label: 'HDP LC', action: 'hdp' },
            { label: 'HDP LC Vodiy', action: 'hdp_vodiy' },
          ],
        },
      ]);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Bot Simulyatori (Live Preview)</h2>
            <p className="text-xs text-slate-400">Foydalanuvchi interfeysini jonli sinab ko'ring</p>
          </div>
        </div>

        <button
          onClick={() => handleUserClick('start')}
          className="px-3 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition"
        >
          /start jo'natish
        </button>
      </div>

      {/* Phone Mockup Screen */}
      <div className="mt-4 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col justify-between min-h-[320px] max-h-[460px] overflow-hidden">
        {/* Messages list */}
        <div className="overflow-y-auto space-y-3 pr-1 text-xs">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>

                {msg.buttons && msg.buttons.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 space-y-1.5">
                    {msg.buttons.map((btn, bIdx) =>
                      btn.url ? (
                        <a
                          key={bIdx}
                          href={btn.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-300 font-medium transition text-[11px]"
                        >
                          <span>{btn.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <button
                          key={bIdx}
                          onClick={() => btn.action && handleUserClick(btn.action)}
                          className="w-full py-1.5 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white font-medium transition text-[11px]"
                        >
                          {btn.label}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Reply Keyboard preview */}
        <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
          <button
            onClick={() => handleUserClick('hdp')}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-semibold text-xs transition active:scale-95 text-center"
          >
            HDP LC
          </button>
          <button
            onClick={() => handleUserClick('hdp_vodiy')}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white font-semibold text-xs transition active:scale-95 text-center"
          >
            HDP LC Vodiy
          </button>
        </div>
      </div>
    </div>
  );
};
