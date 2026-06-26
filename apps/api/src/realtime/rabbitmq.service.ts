import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export const WIDGET_POSITION_QUEUE = 'widget.position';

// Persisted widget reposition. The gateway publishes these (debounced during a
// drag, immediately on drag-end); the consumer writes posX/posY to Postgres.
export interface WidgetPositionMessage {
  boardId: string;
  widgetId: string;
  x: number;
  y: number;
}

export type WidgetPositionHandler = (
  msg: WidgetPositionMessage,
) => Promise<void>;

// Thin amqplib wrapper. Connection is lazy and failure-tolerant: if RabbitMQ is
// unreachable the realtime broadcasts still happen, only the durable
// persistence is skipped — the canvas stays live.
@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  // Per-widget debounce timers so a fast drag collapses into one persist write.
  private readonly debounce = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    for (const t of this.debounce.values()) clearTimeout(t);
    this.debounce.clear();
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async connect() {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      this.logger.warn('RABBITMQ_URL not set — position persistence disabled.');
      return;
    }
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertQueue(WIDGET_POSITION_QUEUE, { durable: true });
      this.connection.on('close', () => {
        this.channel = null;
        this.connection = null;
      });
    } catch (err) {
      this.logger.warn(
        `RabbitMQ connection failed (${(err as Error).message}); retrying lazily.`,
      );
    }
  }

  private async ensureChannel(): Promise<amqp.Channel | null> {
    if (!this.channel) await this.connect();
    return this.channel;
  }

  // Immediate, debounce-flushing publish — used on widget:move:end.
  async publish(msg: WidgetPositionMessage) {
    const pending = this.debounce.get(msg.widgetId);
    if (pending) {
      clearTimeout(pending);
      this.debounce.delete(msg.widgetId);
    }
    await this.send(msg);
  }

  // Coalesce rapid moves of the same widget into a single delayed publish.
  publishDebounced(msg: WidgetPositionMessage, delayMs = 400) {
    const existing = this.debounce.get(msg.widgetId);
    if (existing) clearTimeout(existing);
    this.debounce.set(
      msg.widgetId,
      setTimeout(() => {
        this.debounce.delete(msg.widgetId);
        void this.send(msg);
      }, delayMs),
    );
  }

  private async send(msg: WidgetPositionMessage) {
    const channel = await this.ensureChannel();
    if (!channel) return;
    channel.sendToQueue(
      WIDGET_POSITION_QUEUE,
      Buffer.from(JSON.stringify(msg)),
      { persistent: true },
    );
  }

  // Register the durable consumer that persists positions.
  async consume(handler: WidgetPositionHandler) {
    const channel = await this.ensureChannel();
    if (!channel) {
      this.logger.warn('No channel — widget position consumer not started.');
      return;
    }
    await channel.consume(WIDGET_POSITION_QUEUE, (raw) => {
      if (!raw) return;
      const msg = JSON.parse(raw.content.toString()) as WidgetPositionMessage;
      handler(msg)
        .then(() => channel.ack(raw))
        // Drop the message on failure (don't requeue a poison position write).
        .catch(() => channel.nack(raw, false, false));
    });
  }
}
