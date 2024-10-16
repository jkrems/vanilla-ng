import { computed, signal } from "@angular/core";

interface Type<T> {
  new (...args: any[]): T;
}

interface Providable<T> extends Type<T> {
  ɵprov?: unknown;
}

interface InjectableOpts<T> {
  token?: unknown;
  providedIn?: Type<T> | "root" | "platform" | "any" | "environment" | null;
  factory?: () => T;
}

function provides<T>(C: Providable<T>, opts: InjectableOpts<T> = {}) {
  C.ɵprov = {
    token: opts.token ?? C,
    factory: opts.factory ?? (() => new C()),
    providedIn: opts.providedIn || null,
    value: undefined,
  };
}

function Injectable<T>(opts: InjectableOpts<T> = {}) {
  return (target: Providable<T>) => {
    provides(target, opts);
  };
}

export class Calculator {
  #initialValue: number;
  #value;

  constructor(initialValue: number) {
    this.#initialValue = initialValue;
    this.#value = signal(this.#initialValue);
  }

  reset() {
    this.#value.set(this.#initialValue);
  }

  add(n: number): this {
    this.#value.set(this.#value() + n);
    return this;
  }

  value() {
    return computed(() => this.#value());
  }
}

@Injectable({ providedIn: "root" })
export class CalculatorFactory {
  static {
    // Alternative, without decorator:
    // provides(this, { providedIn: "root" });
  }

  createCalculator(initialValue: number): Calculator {
    return new Calculator(initialValue);
  }
}
