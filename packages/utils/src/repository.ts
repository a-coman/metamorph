import { Entity } from './ddd.js';

// Desactivar eslint para modulos proporcionados en FullStack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class Repository<T extends Entity<any>> {
  abstract save(obj: T): Promise<void>;

  abstract findById(id: string): Promise<T | null>;

  abstract remove(id: string): Promise<boolean>;
}
