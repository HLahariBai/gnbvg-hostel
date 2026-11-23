import React, { useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../common/Modal.js';
import { EyeOff } from 'lucide-react';

interface SafetyTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const SafetyTicketModal: React.FC<SafetyTicketModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { addToast } = useToast();

  const [category, setCategory] = useState<string>('LOCK_SECURITY');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiFetch('/api/safety/tickets', {
        method: 'POST',
        body: JSON.stringify({
          category,
          title,
          description,
          priority,
          isAnonymous,
        }),
      });

      addToast(
        'success',
        isAnonymous ? 'Anonymous Incident Reported' : 'Incident Ticket Filed',
        'Warden safety desk notified.'
      );

      setTitle('');
      setDescription('');
      setIsAnonymous(false);
      onClose();
      if (onCreated) onCreated();
    } catch (err: any) {
      addToast('error', 'Report Failed', err.message || 'Could not submit safety ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Incident / Maintenance Issue">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200"
          >
            <option value="LOCK_SECURITY">Door Lock & Latch Security Fault</option>
            <option value="CCTV_FAULT">CCTV Camera Blindspot or Hardware Fault</option>
            <option value="CORRIDOR_LIGHTING">Corridor or Washroom Lighting Defect</option>
            <option value="UNAUTHORIZED_VISITOR">Suspicious or Unauthorized Visitor</option>
            <option value="HARASSMENT_RAGGING">Confidential Harassment or Ragging Concern</option>
            <option value="MAINTENANCE_OTHER">Plumbing / Electrical / Other Maintenance</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Broken window latch on 2nd floor"
            className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Description</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the exact location, symptoms, or concerns..."
            className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-slate-200"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
          <div className="grid grid-cols-4 gap-2">
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                  priority === p
                    ? p === 'URGENT'
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : p === 'HIGH'
                      ? 'bg-amber-50 border-amber-500 text-amber-800'
                      : 'bg-slate-800 text-white border-slate-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Anonymous Toggle as specified in Section 18.3 */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-slate-600" />
            <div>
              <p className="text-xs font-bold text-slate-800">Submit Anonymously</p>
              <p className="text-[10px] text-slate-500">
                Your student profile & identity will be detached completely from the ticket.
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow"
          >
            {submitting ? 'Submitting...' : 'File Ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
