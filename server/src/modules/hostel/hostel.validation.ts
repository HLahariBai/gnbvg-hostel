import { z } from 'zod';

export const updateHostelConfigSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    centerLat: z.number().min(-90).max(90).optional(),
    centerLng: z.number().min(-180).max(180).optional(),
    geofenceRadiusMeters: z.number().positive().max(5000).optional(),
    geofencePolygonGeoJson: z.string().optional().nullable(),
    timezone: z.string().default('Asia/Kolkata').optional(),
    attendanceStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24-hour)').optional(),
    attendanceEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24-hour)').optional(),
    reminderIntervalMin: z.number().int().min(1).max(60).optional(),
  }),
});

export const testGeofencePointSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
    longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
    accuracyMeters: z.number().min(0).max(1000).default(10),
  }),
});

export const createRoomSchema = z.object({
  body: z.object({
    blockId: z.string().min(1, 'Block ID is required'),
    roomNumber: z.string().min(1, 'Room number is required (e.g. A-101)'),
    floorNumber: z.number().int().min(0).max(10, 'Floor number must be between 0 and 10'),
    capacity: z.number().int().min(1).max(10).default(4),
  }),
});

export const updateRoomSchema = z.object({
  params: z.object({
    roomId: z.string().min(1, 'Room ID is required'),
  }),
  body: z.object({
    capacity: z.number().int().min(1).max(10).optional(),
    isActive: z.boolean().optional(),
  }),
});
