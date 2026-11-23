import { prisma } from '../../config/database.js';
import { recordAuditLog } from '../../utils/audit.js';
import { NotFoundError, ConflictError, BadRequestError } from '../../errors/AppError.js';
import { HOSTEL } from '../../constants/index.js';

export interface GeofenceTestResult {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  hostelCenterLat: number;
  hostelCenterLng: number;
  distanceMeters: number;
  geofenceRadiusMeters: number;
  insideGeofence: boolean;
  accuracyPassed: boolean;
  status: 'INSIDE_APPROVED_PERIMETER' | 'OUTSIDE_GEOFENCE' | 'ACCURACY_TOO_LOW';
  thresholdMeters: number;
}

/**
 * Computes great-circle distance between two coordinates in meters via Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Round to 2 decimal places
}

export class HostelService {
  /**
   * Retrieves or initializes default master record for GNBVG Hostel.
   */
  async getOrCreateHostelConfig() {
    let hostel = await prisma.hostel.findUnique({
      where: { code: HOSTEL.CODE },
      include: {
        blocks: {
          orderBy: { code: 'asc' },
          include: {
            _count: {
              select: { rooms: true, students: true },
            },
          },
        },
      },
    });

    if (!hostel) {
      hostel = await prisma.hostel.create({
        data: {
          code: HOSTEL.CODE,
          name: HOSTEL.NAME,
          institutionName: 'G. Pulla Reddy Engineering College (Autonomous)',
          campus: 'Kurnool',
          centerLat: HOSTEL.COORDINATES.LATITUDE,
          centerLng: HOSTEL.COORDINATES.LONGITUDE,
          geofenceRadiusMeters: HOSTEL.COORDINATES.DEFAULT_RADIUS_METERS,
          timezone: HOSTEL.TIMEZONE,
          attendanceStart: '17:00',
          attendanceEnd: '19:00',
          reminderIntervalMin: 15,
          blocks: {
            create: [
              { code: 'A', name: HOSTEL.BLOCKS.A.NAME, totalFloors: 4, totalRooms: 100 },
              { code: 'B', name: HOSTEL.BLOCKS.B.NAME, totalFloors: 4, totalRooms: 100 },
              { code: 'C', name: HOSTEL.BLOCKS.C.NAME, totalFloors: 4, totalRooms: 100 },
            ],
          },
        },
        include: {
          blocks: {
            orderBy: { code: 'asc' },
            include: {
              _count: {
                select: { rooms: true, students: true },
              },
            },
          },
        },
      });
    }

    return hostel;
  }

  /**
   * Updates hostel master geofence and attendance window configuration.
   */
  async updateHostelConfig(data: any, actorId: string, actorRole: string, clientIp?: string, userAgent?: string) {
    const existing = await this.getOrCreateHostelConfig();

    const updated = await prisma.hostel.update({
      where: { id: existing.id },
      data,
    });

    await recordAuditLog({
      actorId,
      actorRole,
      action: 'HOSTEL_CONFIG_UPDATED',
      entityName: 'Hostel',
      entityId: updated.id,
      previousState: existing,
      newState: updated,
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }

  /**
   * Tests manual or live geo-coordinate positioning against the GNBVG geofence.
   */
  async testGeofencePoint(latitude: number, longitude: number, accuracyMeters = 10): Promise<GeofenceTestResult> {
    const hostel = await this.getOrCreateHostelConfig();

    const distanceMeters = calculateHaversineDistance(
      hostel.centerLat,
      hostel.centerLng,
      latitude,
      longitude
    );

    const insideGeofence = distanceMeters <= hostel.geofenceRadiusMeters;
    const accuracyPassed = accuracyMeters <= 50; // Max acceptable GPS accuracy is 50 meters

    let status: GeofenceTestResult['status'] = 'INSIDE_APPROVED_PERIMETER';
    if (!accuracyPassed) {
      status = 'ACCURACY_TOO_LOW';
    } else if (!insideGeofence) {
      status = 'OUTSIDE_GEOFENCE';
    }

    return {
      latitude,
      longitude,
      accuracyMeters,
      hostelCenterLat: hostel.centerLat,
      hostelCenterLng: hostel.centerLng,
      distanceMeters,
      geofenceRadiusMeters: hostel.geofenceRadiusMeters,
      insideGeofence,
      accuracyPassed,
      status,
      thresholdMeters: hostel.geofenceRadiusMeters,
    };
  }

  /**
   * Lists hostel blocks with room and resident counts.
   */
  async listBlocks() {
    const hostel = await this.getOrCreateHostelConfig();
    return prisma.block.findMany({
      where: { hostelId: hostel.id },
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: {
            rooms: true,
            students: true,
          },
        },
      },
    });
  }

  /**
   * Lists rooms within a specific block.
   */
  async listRooms(blockId: string, floorNumber?: number) {
    return prisma.room.findMany({
      where: {
        blockId,
        ...(floorNumber !== undefined ? { floorNumber } : {}),
      },
      orderBy: { roomNumber: 'asc' },
      include: {
        students: {
          select: {
            id: true,
            fullName: true,
            registrationNumber: true,
            primaryPhone: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Creates a new room in a hostel block.
   */
  async createRoom(data: { blockId: string; roomNumber: string; floorNumber: number; capacity?: number }, actorId: string, actorRole: string, clientIp?: string, userAgent?: string) {
    const block = await prisma.block.findUnique({
      where: { id: data.blockId },
    });
    if (!block) {
      throw new NotFoundError('Specified hostel block does not exist.');
    }

    const existing = await prisma.room.findUnique({
      where: {
        blockId_roomNumber: {
          blockId: data.blockId,
          roomNumber: data.roomNumber.trim().toUpperCase(),
        },
      },
    });

    if (existing) {
      throw new ConflictError(`Room ${data.roomNumber} already exists in Block ${block.name}.`);
    }

    const room = await prisma.room.create({
      data: {
        blockId: data.blockId,
        roomNumber: data.roomNumber.trim().toUpperCase(),
        floorNumber: data.floorNumber,
        capacity: data.capacity || 4,
      },
    });

    await recordAuditLog({
      actorId,
      actorRole,
      action: 'ROOM_CREATED',
      entityName: 'Room',
      entityId: room.id,
      newState: room,
      ipAddress: clientIp,
      userAgent,
    });

    return room;
  }

  /**
   * Updates an existing room's capacity or active status.
   */
  async updateRoom(roomId: string, data: { capacity?: number; isActive?: boolean }, actorId: string, actorRole: string, clientIp?: string, userAgent?: string) {
    const existing = await prisma.room.findUnique({
      where: { id: roomId },
    });
    if (!existing) {
      throw new NotFoundError('Room not found.');
    }

    if (data.capacity && data.capacity < existing.occupiedCount) {
      throw new BadRequestError(`Cannot decrease room capacity below current occupant count (${existing.occupiedCount}).`);
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data,
    });

    await recordAuditLog({
      actorId,
      actorRole,
      action: 'ROOM_UPDATED',
      entityName: 'Room',
      entityId: updated.id,
      previousState: existing,
      newState: updated,
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }

  /**
   * Generates a hierarchical room matrix across Blocks A (Arundhathi), B (Annapurna), and C (Anuradha).
   */
  async getRoomMatrix() {
    const hostel = await this.getOrCreateHostelConfig();
    const blocks = await prisma.block.findMany({
      where: { hostelId: hostel.id },
      orderBy: { code: 'asc' },
      include: {
        rooms: {
          orderBy: { roomNumber: 'asc' },
          select: {
            id: true,
            roomNumber: true,
            floorNumber: true,
            capacity: true,
            occupiedCount: true,
            isActive: true,
          },
        },
      },
    });

    return blocks.map((b) => ({
      blockId: b.id,
      blockCode: b.code,
      blockName: b.name,
      totalRooms: b.rooms.length,
      totalCapacity: b.rooms.reduce((acc, r) => acc + r.capacity, 0),
      totalOccupied: b.rooms.reduce((acc, r) => acc + r.occupiedCount, 0),
      rooms: b.rooms,
    }));
  }
}

export const hostelService = new HostelService();
