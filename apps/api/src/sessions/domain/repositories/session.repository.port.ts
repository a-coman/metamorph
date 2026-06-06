import { Repository } from '@metamorph/utils';
import { SessionAggregate } from '../aggregates/session.aggregate.js';

export abstract class SessionRepositoryPort extends Repository<SessionAggregate> {}
