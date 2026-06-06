import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { DomainError } from '@metamorph/utils';
import {
  InvalidSessionUrlError,
  SessionNotFoundError,
} from '../../domain/errors/session.errors.js';

export function mapSessionDomainError(error: DomainError): never {
  if (error instanceof SessionNotFoundError) {
    throw new NotFoundException(error.errorMessage);
  }

  if (error instanceof InvalidSessionUrlError) {
    throw new BadRequestException(error.errorMessage);
  }

  throw new BadRequestException(error.errorMessage ?? 'Domain error');
}
