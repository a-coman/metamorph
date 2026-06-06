export class Result<T> {
  private readonly _isSuccess: boolean;

  private readonly _errorValue?: string;

  private readonly _value?: T;

  get success() {
    return this._isSuccess;
  }

  get failure() {
    return !this._isSuccess;
  }

  get value() {
    return this._value;
  }

  get errorValue() {
    return this._errorValue;
  }

  protected constructor({
    isSuccess,
    errorValue,
    value,
  }: {
    isSuccess: boolean;
    errorValue?: string;
    value?: T;
  }) {
    if (isSuccess && errorValue) {
      throw new Error(
        'InvalidOperation: A result cannot be successful and contain an error',
      );
    }
    if (!isSuccess && !errorValue) {
      throw new Error(
        'InvalidOperation: A failing result needs to contain an error message',
      );
    }
    this._isSuccess = isSuccess;
    this._errorValue = errorValue;
    this._value = value;
  }

  static ok<U>(value?: U): Result<U> {
    return new Result<U>({ isSuccess: true, value });
  }

  static fail<U>(errorValue: string): Result<U> {
    return new Result<U>({ isSuccess: false, errorValue });
  }
}

// Estrategia Either

interface EitherProps<L, A> {
  value: L | A;
  isLeft(): boolean;
  isRight(): boolean;
}

export class Left<L, A> implements EitherProps<L, A> {
  readonly value: L;

  constructor(value: L) {
    this.value = value;
  }

  isLeft(): this is Left<L, A> {
    // aserto de tipos
    return true;
  }

  isRight(): this is Right<L, A> {
    return false;
  }
}

export class Right<L, A> implements EitherProps<L, A> {
  readonly value: A;

  constructor(value: A) {
    this.value = value;
  }

  isLeft(): this is Left<L, A> {
    return false;
  }

  isRight(): this is Right<L, A> {
    return true;
  }
}

export type Either<L, A> = Left<L, A> | Right<L, A>;

export function left<L, A>(l: L): Either<L, A> {
  return new Left(l);
}

export function right<L, A>(a: A): Either<L, A> {
  return new Right(a);
}

export interface DomainError {
  errorMessage?: string;
  // Desactivar eslint para modulos proporcionados en FullStack
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: any;
}
