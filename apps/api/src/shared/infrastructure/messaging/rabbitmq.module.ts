import { Global, Module } from '@nestjs/common';
import { JobMessagePublisherPort } from '../../../sessions/application/ports/job-message-publisher.port.js';
import { RabbitMqConnectionService } from './rabbitmq-connection.service.js';
import { RabbitMqJobPublisherAdapter } from './rabbitmq-job-publisher.adapter.js';

@Global()
@Module({
  providers: [
    RabbitMqConnectionService,
    {
      provide: JobMessagePublisherPort,
      useClass: RabbitMqJobPublisherAdapter,
    },
  ],
  exports: [RabbitMqConnectionService, JobMessagePublisherPort],
})
export class RabbitMqModule {}
