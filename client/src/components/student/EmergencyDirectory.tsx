import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.js';
import type { Announcement } from '../../types/index.js';
import { Phone, Bell, Shield, AlertTriangle, Building, Hospital } from 'lucide-react';

export const EmergencyDirectory: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Announcement[]>('/api/notices/announcements')
      .then((data) => setAnnouncements(data || []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  }, []);

  const emergencyContacts = [
    {
      title: 'Chief Warden (GNBVG)',
      number: '+91 94401 23456',
      role: 'Hostel Administration',
      icon: <Building className="w-4 h-4 text-emerald-600" />,
    },
    {
      title: 'GPREC Campus Security Patrol',
      number: '+91 85182 80755',
      role: '24/7 Main Gate Guard Desk',
      icon: <Shield className="w-4 h-4 text-blue-600" />,
    },
    {
      title: 'Women Helpline (National)',
      number: '181',
      role: 'Emergency Distress Line',
      icon: <Phone className="w-4 h-4 text-purple-600" />,
    },
    {
      title: 'Police Emergency Response',
      number: '112',
      role: 'Kurnool District Control Room',
      icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
    },
    {
      title: 'Ambulance Emergency Support',
      number: '108',
      role: 'Medical Emergency Services',
      icon: <Hospital className="w-4 h-4 text-rose-600" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Noticeboard Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Bell className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-slate-800 text-sm">Hostel Announcements & Curfew Notices</h3>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 py-3">Loading notices...</p>
        ) : announcements.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No active broadcast announcements at this time.</p>
        ) : (
          <div className="space-y-2.5">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`p-3 rounded-xl border text-xs ${
                  a.priority === 'URGENT'
                    ? 'bg-red-50/70 border-red-200 text-red-900'
                    : a.priority === 'HIGH'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{a.title}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/70">
                    {a.targetBlockCodes === 'ALL' ? 'All Blocks' : `Block ${a.targetBlockCodes}`}
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">{a.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Calling Directory */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Phone className="w-5 h-5 text-emerald-600" />
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Emergency Calling Directory</h3>
            <p className="text-[11px] text-slate-500">One-tap priority speed dial for campus & emergency services</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {emergencyContacts.map((contact, i) => (
            <a
              key={i}
              href={`tel:${contact.number.replace(/\s+/g, '')}`}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 group-hover:bg-white rounded-lg border border-slate-200 transition">
                  {contact.icon}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800 group-hover:text-emerald-700 transition">
                    {contact.title}
                  </h4>
                  <p className="text-[10px] text-slate-500">{contact.role}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 font-mono group-hover:text-emerald-700 transition">
                {contact.number}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
