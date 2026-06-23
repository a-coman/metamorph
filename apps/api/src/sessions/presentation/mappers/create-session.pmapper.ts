import type { CreateSessionDto } from '../../application/dtos/create-session.dto.js';
import type { CreateSessionRequest } from '../contracts/create-session.request.js';

export function toCreateSessionDto(
  request: CreateSessionRequest,
): CreateSessionDto {
  return {
    url: request.url,
    mode: request.mode,
    generateCount: request.generateCount,
    weakOracle: request.weakOracle,
    transformFamilies: request.transformFamilies,
  };
}
