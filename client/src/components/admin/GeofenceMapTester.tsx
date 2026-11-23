import React, { useState } from 'react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.js';
import type { GeofenceTestResult } from '../../types/index.js';
import { Compass, CheckCircle2, XCircle } from 'lucide-react';

export const GeofenceMapTester: React.FC = () => {
  const { addToast } = useToast();

  const [lat, setLat] = useState<number>(15.8344);
  const [lng, setLng] = useState<number>(78.0373);
  const [accuracy, setAccuracy] = useState<number>(10);
  const [result, setResult] = useState<GeofenceTestResult | null>(null);
  const [testing, setTesting] = useState<boolean>(false);

  const presets = [
    { label: 'Hostel Courtyard (Center)', lat: 15.8344, lng: 78.0373, accuracy: 8 },
    { label: 'Block B Wing (55m Inside)', lat: 15.8349, lng: 78.0373, accuracy: 12 },
    { label: 'GPREC Gate (180m Boundary)', lat: 15.836, lng: 78.0373, accuracy: 15 },
    { label: 'Kurnool Bus Stand (Outside, 3km)', lat: 15.8281, lng: 78.0373, accuracy: 25 },
  ];

  const handleTestPoint = async (testLat = lat, testLng = lng, testAcc = accuracy) => {
    try {
      setTesting(true);
      const res = await apiFetch<GeofenceTestResult>('/api/hostel/geofence/test-point', {
        method: 'POST',
        body: JSON.stringify({
          latitude: testLat,
          longitude: testLng,
          accuracyMeters: testAcc,
        }),
      });
      setResult(res);
      if (res.insideGeofence && res.accuracyPassed) {
        addToast('success', 'Inside Approved Perimeter', `Distance: ${res.distanceMeters.toFixed(1)}m from GNBVG Center`);
      } else {
        addToast('warning', 'Geofence Containment Failed', `Status: ${res.status.replace(/_/g, ' ')}`);
      }
    } catch (err: any) {
      addToast('error', 'Test Failed', err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
          <Compass className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Manual Geo-Coordinate Pin & Geofence Validator</h2>
          <p className="text-xs text-slate-500">
            Simulate and calibrate GPS coordinates against the authoritative GNBVG hostel perimeter (15.8344° N, 78.0373° E)
          </p>
        </div>
      </div>

      {/* Preset Quick Buttons */}
      <div className="mb-6">
        <span className="text-xs font-semibold text-slate-600 block mb-2">Preset Calibration Coordinates:</span>
        <div className="flex flex-wrap gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setLat(p.lat);
                setLng(p.lng);
                setAccuracy(p.accuracy);
                handleTestPoint(p.lat, p.lng, p.accuracy);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:border-slate-800 hover:bg-slate-50 text-slate-700 transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude (° N)</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude (° E)</label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Simulated GPS Accuracy (± meters)
            </label>
            <input
              type="number"
              value={accuracy}
              onChange={(e) => setAccuracy(parseFloat(e.target.value))}
              className="w-full text-xs font-mono px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Maximum allowed accuracy threshold: 50m</span>
          </div>

          <button
            type="button"
            onClick={() => handleTestPoint()}
            disabled={testing}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition"
          >
            {testing ? 'Calculating Haversine Distance...' : 'Evaluate Coordinate Pin'}
          </button>
        </div>

        {/* Visual Evaluation Results */}
        <div className="flex flex-col justify-between bg-slate-900 text-white rounded-xl p-5 border border-slate-800 font-mono text-xs">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block mb-3">
              Geofence Engine Calculation
            </span>

            {result ? (
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Hostel Center:</span>
                  <span className="text-slate-200">
                    {result.hostelCenterLat}° N, {result.hostelCenterLng}° E
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Tested Point:</span>
                  <span className="text-slate-200">
                    {result.latitude}° N, {result.longitude}° E
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Haversine Distance:</span>
                  <span className="text-emerald-400 font-bold text-sm">{result.distanceMeters.toFixed(2)} meters</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Perimeter Radius:</span>
                  <span>{result.geofenceRadiusMeters} meters</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">GPS Accuracy Check:</span>
                  <span className={result.accuracyPassed ? 'text-emerald-400' : 'text-red-400'}>
                    {result.accuracyPassed ? 'PASSED (≤ 50m)' : 'FAILED (> 50m)'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 py-8 text-center font-sans">
                Select a preset or click &quot;Evaluate Coordinate Pin&quot; to test.
              </p>
            )}
          </div>

          {result && (
            <div
              className={`mt-4 p-3 rounded-lg border font-sans font-semibold flex items-center gap-2 ${
                result.insideGeofence && result.accuracyPassed
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/60 border-red-500/50 text-red-300'
              }`}
            >
              {result.insideGeofence && result.accuracyPassed ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>COORDINATE IS VALID AND INSIDE THE APPROVED GNBVG PERIMETER.</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>COORDINATE OUTSIDE APPROVED PERIMETER ({result.status}).</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
