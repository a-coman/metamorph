import { Global, Module } from '@nestjs/common';

/**
 * Cross-cutting primitives shared across bounded contexts.
 * DomainEvents is static on @metamorph/utils — no provider needed yet.
 */
@Global()
@Module({})
export class CoreModule {}
