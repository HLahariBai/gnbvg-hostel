import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jsonwebtoken from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { Role } from '@prisma/client';

export interface AuthenticatedSocketUser {
  userId: string;
  email: string;
  role: Role;
  studentId?: string;
  blockCode?: string;
}

export interface CustomSocket extends Socket {
  data: {
    user: AuthenticatedSocketUser;
  };
}

let io: SocketIOServer | null = null;

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookieStr) => {
    const parts = cookieStr.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

/**
 * Handshake Authentication Middleware for WebSockets
 * Validates token from Cookie, Auth payload, or Authorization header.
 */
export async function socketAuthMiddleware(
  socket: any,
  next: (err?: Error) => void
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check HTTP Cookies sent during handshake
    const rawCookies = socket.handshake?.headers?.cookie;
    if (rawCookies) {
      const parsed = parseCookies(rawCookies);
      token = parsed.accessToken;
    }

    // 2. Fallback to handshake auth payload or query/header
    if (!token && socket.handshake?.auth?.token) {
      token = socket.handshake.auth.token as string;
    }

    if (!token && socket.handshake?.headers?.authorization) {
      const parts = socket.handshake.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return next(new Error('Authentication Error: Missing access token for WebSocket handshake.'));
    }

    // 3. Verify JWT Signature and Expiry
    const decoded = jsonwebtoken.verify(token, env.JWT_ACCESS_SECRET) as {
      userId: string;
      email: string;
      role: Role;
      studentId?: string;
    };

    // 4. Validate User in Database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        studentProfile: {
          include: {
            block: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return next(new Error('Authentication Error: User account is inactive or revoked.'));
    }

    // Attach authenticated identity to socket
    if (!socket.data) {
      socket.data = {};
    }
    socket.data.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
      studentId: user.studentProfile?.id,
      blockCode: user.studentProfile?.block?.code,
    };

    next();
  } catch (err) {
    next(new Error('Authentication Error: Invalid or expired WebSocket token.'));
  }
}

/**
 * Connection Handler & Channel/Room Isolation
 */
export function handleSocketConnection(socket: any): void {
  const authSocket = socket as CustomSocket;
  const user = authSocket.data?.user;
  if (!user) return;

  // Room 1: User private room (for direct user notifications)
  socket.join(`user:${user.userId}`);

  // Room 2: Role room (e.g., 'role:STUDENT', 'role:WARDEN', 'role:ADMIN')
  socket.join(`role:${user.role}`);

  // Room 3: Student-specific rooms
  if (user.role === Role.STUDENT && user.studentId) {
    socket.join(`student:${user.studentId}`);
    if (user.blockCode) {
      // Block-isolated channel (e.g. 'block:A', 'block:B', 'block:C')
      socket.join(`block:${user.blockCode}`);
    }
  }

  // Room 4: Warden & Admin shared live monitoring feed
  if (user.role === Role.WARDEN || user.role === Role.ADMIN) {
    socket.join('warden-admin-feed');
    // Wardens can monitor all blocks or join all block rooms
    socket.join('block:A');
    socket.join('block:B');
    socket.join('block:C');
  }

  // Ping / Heartbeat event
  socket.on?.('ping:client', (cb?: (resp: { status: string; timestamp: number }) => void) => {
    if (typeof cb === 'function') {
      cb({ status: 'pong', timestamp: Date.now() });
    }
  });

  socket.on?.('disconnect', (_reason: string) => {
    // Graceful disconnect handling
  });
}

/**
 * Initializes the production Socket.IO Real-Time Server.
 * Configures CORS, JWT authentication handshake, and room isolation.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          env.NODE_ENV !== 'production' ||
          env.CORS_ALLOWED_ORIGINS.includes(origin) ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS Error: Origin ${origin} not allowed for WebSockets.`));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  io.use(socketAuthMiddleware);
  io.on('connection', handleSocketConnection);

  return io;
}

/**
 * Returns the active Socket.IO server instance.
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Injects a mock Socket.IO server for deterministic testing.
 */
export function setSocketServerForTesting(testIo: SocketIOServer | null): void {
  io = testIo;
}
