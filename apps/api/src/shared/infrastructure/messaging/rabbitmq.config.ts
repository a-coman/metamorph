import { RABBITMQ_EXCHANGE_DEFAULT } from '@metamorph/contracts';

export type RabbitMqConfig = {
  url: string;
  exchange: string;
};

export function getRabbitMqConfig(): RabbitMqConfig {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    throw new Error('RABBITMQ_URL is required');
  }

  return {
    url,
    exchange: process.env.RABBITMQ_EXCHANGE ?? RABBITMQ_EXCHANGE_DEFAULT,
  };
}
