import type { Channel } from "amqplib";

/**
 * Broker layout. All events go to one durable topic exchange keyed by routing key. Each subscriber
 * owns a quorum queue; messages that exceed the delivery limit move to that queue's `.dead-letter`
 * queue through a direct dead-letter exchange.
 */
export const EVENTS_EXCHANGE = "parley.events";
export const DEAD_LETTER_EXCHANGE = "parley.dead-letter";

export async function assertExchanges(channel: Channel): Promise<void> {
  await channel.assertExchange(EVENTS_EXCHANGE, "topic", { durable: true });
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, "direct", { durable: true });
}

export async function assertSubscription(
  channel: Channel,
  queue: string,
  routingKey: string,
  deliveryLimit: number,
): Promise<void> {
  await assertExchanges(channel);

  const deadLetterQueue = `${queue}.dead-letter`;
  await channel.assertQueue(deadLetterQueue, { durable: true, arguments: { "x-queue-type": "quorum" } });
  await channel.bindQueue(deadLetterQueue, DEAD_LETTER_EXCHANGE, queue);

  await channel.assertQueue(queue, {
    durable: true,
    arguments: {
      "x-queue-type": "quorum",
      "x-delivery-limit": deliveryLimit,
      "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
      "x-dead-letter-routing-key": queue,
    },
  });
  await channel.bindQueue(queue, EVENTS_EXCHANGE, routingKey);
}
