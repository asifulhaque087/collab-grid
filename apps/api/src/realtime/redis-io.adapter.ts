import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions, Server } from 'socket.io';

// Socket.io adapter backed by Redis Pub/Sub so a `server.to(room).emit(...)` on
// one API instance reaches clients connected to every other instance. Without
// it, running more than one node would silently fragment broadcasts (an emit on
// instance A never reaches sockets on instance B).
//
// Degrades gracefully: if REDIS_URL is unset or Redis is unreachable, the
// connection is skipped and socket.io falls back to its default in-memory
// adapter (correct for a single instance). This mirrors the lazy/retry Redis
// posture used elsewhere — Redis being down never blocks bootstrap.
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  // Build the pub/sub client pair and the adapter factory. Called once at
  // bootstrap, before the gateway starts accepting connections. The Redis
  // adapter needs two dedicated connections (one enters subscriber mode), kept
  // separate from the command/subscriber clients in redis.module.ts.
  async connectToRedis(): Promise<void> {
    const url = this.app.get(ConfigService).get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn(
        'REDIS_URL not set — using the in-memory socket.io adapter (single instance only).',
      );
      return;
    }

    // lazyConnect so construction never throws. retryStrategy is left infinite
    // so the backplane self-heals if Redis blips at runtime — but the *initial*
    // connect is raced against a timeout so a Redis that's down at boot falls
    // back to in-memory instead of hanging bootstrap behind endless retries.
    const pubClient = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    const subClient = pubClient.duplicate();

    try {
      await this.withTimeout(
        Promise.all([pubClient.connect(), subClient.connect()]),
        3000,
      );
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log('Socket.io Redis adapter connected — broadcasts are cluster-wide.');
    } catch (err) {
      this.logger.warn(
        `Socket.io Redis adapter unavailable (${(err as Error).message}); ` +
          'falling back to the in-memory adapter.',
      );
      pubClient.disconnect();
      subClient.disconnect();
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Redis connect timed out after ${ms}ms`)), ms),
      ),
    ]);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
