import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.js';
import type { BlockMatrix } from '../../types/index.js';
import { Building2, Users, RefreshCw } from 'lucide-react';

export const RoomMatrixView: React.FC = () => {
  const [matrix, setMatrix] = useState<BlockMatrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBlockCode, setActiveBlockCode] = useState<string>('A');

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<BlockMatrix[]>('/api/hostel/matrix');
      setMatrix(res || []);
    } catch {
      setMatrix([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix();
  }, []);

  const currentBlock = matrix.find((b) => b.blockCode === activeBlockCode) || matrix[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Hostel Block & Room Directory Matrix</h2>
          <p className="text-xs text-slate-500">Live capacity and occupancy across Blocks A, B, and C</p>
        </div>

        <button
          onClick={fetchMatrix}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Matrix
        </button>
      </div>

      {/* Block Selector Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-3">
        {matrix.map((b) => (
          <button
            key={b.blockId}
            onClick={() => setActiveBlockCode(b.blockCode)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              activeBlockCode === b.blockCode
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>
              Block {b.blockCode} ({b.blockName})
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                activeBlockCode === b.blockCode ? 'bg-slate-800 text-emerald-400' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {b.totalOccupied}/{b.totalCapacity}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 py-8 text-center">Loading room matrix...</p>
      ) : !currentBlock ? (
        <p className="text-xs text-slate-500 py-6 text-center">No block data available.</p>
      ) : (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Block Name:</span>
              <p className="font-bold text-slate-900 mt-0.5">
                Block {currentBlock.blockCode} ({currentBlock.blockName})
              </p>
            </div>
            <div>
              <span className="text-slate-500">Total Rooms:</span>
              <p className="font-bold text-slate-900 mt-0.5 font-mono">{currentBlock.totalRooms}</p>
            </div>
            <div>
              <span className="text-slate-500">Total Capacity:</span>
              <p className="font-bold text-slate-900 mt-0.5 font-mono">{currentBlock.totalCapacity} beds</p>
            </div>
            <div>
              <span className="text-slate-500">Current Occupancy:</span>
              <p className="font-bold text-emerald-700 mt-0.5 font-mono">
                {currentBlock.totalOccupied} (
                {currentBlock.totalCapacity > 0
                  ? Math.round((currentBlock.totalOccupied / currentBlock.totalCapacity) * 100)
                  : 0}
                %)
              </p>
            </div>
          </div>

          {/* Rooms Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {currentBlock.rooms.map((room) => {
              const isFull = room.occupiedCount >= room.capacity;
              const isEmpty = room.occupiedCount === 0;

              return (
                <div
                  key={room.id}
                  className={`p-2.5 rounded-lg border text-center transition ${
                    isFull
                      ? 'bg-red-50/70 border-red-200 text-red-900'
                      : isEmpty
                      ? 'bg-slate-50 border-slate-200 text-slate-600'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <p className="font-mono font-bold text-xs">{room.roomNumber}</p>
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mt-1">
                    <Users className="w-2.5 h-2.5" />
                    <span>
                      {room.occupiedCount}/{room.capacity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
