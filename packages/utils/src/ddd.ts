import { v4 as uuidv4, validate } from 'uuid';
import { shallowEqual } from 'shallow-equal-object';

export class UniqueEntityID {
  readonly value: string;

  private constructor(plainId?: string) {
    if (plainId) this.value = plainId;
    else this.value = uuidv4();
  }

  equals(other: UniqueEntityID) {
    return this.value === other.value;
  }

  static create(plainId?: string): UniqueEntityID {
    if (plainId && !validate(plainId))
      throw Error(`Invalid UUID v4: ${plainId}`);
    return new UniqueEntityID(plainId);
  }
}

export abstract class Entity<T> {
  readonly id: UniqueEntityID;

  protected readonly props: T;

  protected constructor(props: T, id?: UniqueEntityID) {
    this.id = id || UniqueEntityID.create();
    this.props = props;
  }

  public equals(object?: Entity<T>): boolean {
    if (object == null) {
      return false;
    }
    if (this === object) {
      return true;
    }

    return this.id.equals(object.id);
  }
}

export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<T> | null): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return shallowEqual(this.props, vo.props);
  }
}

// eventos del dominio y agregados

export interface DomainEvent {
  readonly occurredOn: Date;
  readonly type: string;
}

export abstract class AggregateRoot<T> extends Entity<T> {
  private domainEvents: DomainEvent[] = [];

  protected constructor(props: T, id?: UniqueEntityID) {
    super(props, id);
  }

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  public pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }
}

export class DomainEvents {
  private static handlers: Map<string, ((event: DomainEvent) => void)[]> =
    new Map();

  static register<T extends DomainEvent>(
    eventName: string,
    handler: (event: T) => void,
  ) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    // Desactivar eslint para modulos proporcionados en FullStack
    /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
    this.handlers.get(eventName)!.push(handler as any);
  }

  static dispatch(events: DomainEvent[]) {
    for (const event of events) {
      const handlers = this.handlers.get(event.constructor.name) || [];
      handlers.forEach((handler) => handler(event));
    }
  }
}