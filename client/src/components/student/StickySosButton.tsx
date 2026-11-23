import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import { Flame, AlertTriangle, X, CheckCircle, Navigation } from 'lucide-react';

export const StickySosButton: React.FC = () => {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Obtain current geolocation when modal opens
  useEffect(() => {
    if (isOpen) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {
            // Default to hostel campus coordinates
            setCoords({ lat: 15.8344, lng: 78.0373 });
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        setCoords({ lat: 15.8344, lng: 78.0373 });
      }
    }
  }, [isOpen]);

  // Handle 3-second auto-trigger countdown
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0 && !sosSent && !isSending) {
      triggerSos('COUNTDOWN_AUTO');
    }
    return () => clearTimeout(timer);
  }, [countdown, sosSent, isSending]);

  const handleOpenModal = () => {
    setIsOpen(true);
    setSosSent(false);
    setCountdown(3); // Start 3-second countdown as specified in Section 18.1
  };

  const handleCancelCountdown = () => {
    setCountdown(null);
    setIsOpen(false);
  };

  const triggerSos = async (triggerType: 'INSTANT' | 'COUNTDOWN_AUTO') => {
    try {
      setIsSending(true);
      setCountdown(null);

      await apiFetch('/api/sos/trigger', {
        method: 'POST',
        body: JSON.stringify({
          triggerType,
          latitude: coords?.lat || 15.8344,
          longitude: coords?.lng || 78.0373,
        }),
      });

      setSosSent(true);
      addToast(
        'sos',
        'EMERGENCY SOS DISPATCHED',
        'Chief Warden and Security Guard patrol alerted with your room and GPS location.',
        10000
      );
    } catch (err: any) {
      addToast('error', 'SOS Dispatch Failed', err.message || 'Please contact security directly.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Sticky Floating Panic Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={handleOpenModal}
          className="group relative flex items-center gap-2.5 px-5 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm tracking-wide rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-red-400 focus:outline-none focus:ring-4 focus:ring-red-400/50"
          aria-label="Sticky Emergency SOS Panic Button"
        >
          {/* Pulsing ring animation */}
          <span className="absolute -inset-1 rounded-full bg-red-600/30 animate-ping pointer-events-none" />
          <Flame className="w-5 h-5 text-white animate-pulse" />
          <span className="uppercase tracking-wider font-extrabold">SOS Emergency</span>
        </button>
      </div>

      {/* Confirmation & Auto-Trigger Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-500 max-w-md w-full overflow-hidden text-center p-6 sm:p-8">
            {!sosSent ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4 border-2 border-red-300">
                  {countdown !== null ? (
                    <span className="text-4xl font-extrabold text-red-600 animate-scale font-mono">
                      {countdown}
                    </span>
                  ) : (
                    <AlertTriangle className="w-10 h-10 text-red-600" />
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  EMERGENCY SOS PANIC BUTTON
                </h3>

                <p className="text-sm text-slate-600 mb-4">
                  {countdown !== null
                    ? `Dispatching automatic alert in ${countdown} seconds...`
                    : 'Dispatching immediate emergency alert.'}
                </p>

                {coords && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 bg-slate-100 py-1.5 px-3 rounded-lg mb-6">
                    <Navigation className="w-3.5 h-3.5 text-slate-600" />
                    <span>
                      GPS: {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E (Hostel Area)
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => triggerSos('INSTANT')}
                    disabled={isSending}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <Flame className="w-5 h-5" />
                    {isSending ? 'Sending Alert...' : 'DISPATCH SOS IMMEDIATELY'}
                  </button>

                  <button
                    onClick={handleCancelCountdown}
                    disabled={isSending}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Cancel (False Alarm)
                  </button>
                </div>
              </>
            ) : (
              <div className="py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3 text-emerald-600">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">SOS Alert Dispatched</h3>
                <p className="text-xs text-slate-600 mb-6">
                  Warden and security teams have been alerted. Stay in your room or safe location.
                </p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 text-white font-medium text-sm rounded-xl hover:bg-slate-700 transition"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
