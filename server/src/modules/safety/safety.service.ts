import { TicketCategory, TicketStatus, Priority } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { generateSecureToken } from '../../utils/crypto.js';
import { realtimeEmitter } from '../../realtime/events.js';
import { recordAuditLog } from '../../utils/audit.js';
import { NotFoundError } from '../../errors/AppError.js';

export class SafetyService {
  async createTicket(
    studentId: string,
    dto: {
      category: TicketCategory;
      title: string;
      description: string;
      priority?: Priority;
      isAnonymous?: boolean;
    },
    clientIp?: string,
    userAgent?: string
  ) {
    const ticketCode = generateSecureToken(3).toUpperCase();
    const ticketNumber = `TKT-${new Date().getFullYear()}-${ticketCode}`;

    // If anonymous, detach student reference to protect privacy
    const effectiveStudentId = dto.isAnonymous ? null : studentId;

    const ticket = await prisma.safetyTicket.create({
      data: {
        ticketNumber,
        studentId: effectiveStudentId,
        isAnonymous: dto.isAnonymous || false,
        category: dto.category,
        title: dto.title.trim(),
        description: dto.description.trim(),
        priority: dto.priority || Priority.MEDIUM,
        status: TicketStatus.REPORTED,
      },
    });

    realtimeEmitter.emitSafetyTicketCreated({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      title: ticket.title,
      priority: ticket.priority,
      status: ticket.status,
      isAnonymous: ticket.isAnonymous,
      studentId: ticket.studentId,
      createdAt: ticket.createdAt.toISOString(),
    });

    await recordAuditLog({
      actorId: dto.isAnonymous ? undefined : studentId,
      actorRole: 'STUDENT',
      action: 'SAFETY_TICKET_CREATED',
      entityName: 'SafetyTicket',
      entityId: ticket.id,
      newState: {
        ticketNumber: ticket.ticketNumber,
        category: ticket.category,
        isAnonymous: ticket.isAnonymous,
      },
      ipAddress: clientIp,
      userAgent,
    });

    return ticket;
  }

  async getMyTickets(studentId: string) {
    return prisma.safetyTicket.findMany({
      where: {
        studentId,
        isAnonymous: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllTickets(status?: TicketStatus, category?: TicketCategory, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const where: any = {
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
    };

    const [total, tickets] = await Promise.all([
      prisma.safetyTicket.count({ where }),
      prisma.safetyTicket.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          student: {
            select: {
              fullName: true,
              registrationNumber: true,
              block: true,
              room: true,
            },
          },
        },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      tickets,
    };
  }

  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
    wardenId: string,
    wardenRole: string,
    priority?: Priority,
    assignedToId?: string,
    resolutionSummary?: string,
    clientIp?: string,
    userAgent?: string
  ) {
    const existing = await prisma.safetyTicket.findUnique({
      where: { id: ticketId },
    });

    if (!existing) {
      throw new NotFoundError('Safety ticket not found.');
    }

    const isResolved = status === TicketStatus.RESOLVED;

    const updated = await prisma.safetyTicket.update({
      where: { id: ticketId },
      data: {
        status,
        ...(priority ? { priority } : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(resolutionSummary ? { resolutionSummary } : {}),
        ...(isResolved ? { resolvedById: wardenId, resolvedAt: new Date() } : {}),
      },
    });

    realtimeEmitter.emitSafetyTicketUpdated({
      id: updated.id,
      ticketNumber: updated.ticketNumber,
      category: updated.category,
      title: updated.title,
      priority: updated.priority,
      status: updated.status,
      isAnonymous: updated.isAnonymous,
      studentId: updated.studentId,
      createdAt: updated.createdAt.toISOString(),
    });

    await recordAuditLog({
      actorId: wardenId,
      actorRole: wardenRole,
      action: `SAFETY_TICKET_${status}`,
      entityName: 'SafetyTicket',
      entityId: updated.id,
      previousState: existing,
      newState: updated,
      ipAddress: clientIp,
      userAgent,
    });

    return updated;
  }
}

export const safetyService = new SafetyService();
