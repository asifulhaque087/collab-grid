import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Two connections: the main client for commands, and a dedicated subscriber.
// ioredis puts a connection into subscriber mode once it SUBSCRIBEs, after
// which it can no longer issue normal commands — hence the split.
export const REDIS = Symbol('REDIS');
export const REDIS_SUBSCRIBER = Symbol('REDIS_SUBSCRIBER');

function createClient(config: ConfigService): Redis {
  const url = config.get<string>('REDIS_URL');
  if (!url) throw new Error('REDIS_URL is not set');
  // lazyConnect so app bootstrap does not hard-fail when Redis is down; the
  // first command connects. retryStrategy keeps the socket reconnecting.
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createClient(config),
    },
    {
      provide: REDIS_SUBSCRIBER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createClient(config),
    },
  ],
  exports: [REDIS, REDIS_SUBSCRIBER],
})
export class RedisModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS) private readonly client: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
  ) {}

  async onModuleDestroy() {
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }
}
