import { computed, signal, ɵɵdefineInjectable } from "@angular/core";

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

export class CalculatorFactory {
  static ɵprov = /* @__PURE__ */ ɵɵdefineInjectable({
      token: CalculatorFactory,
      factory: () => new CalculatorFactory(),
      providedIn: "any"
  });

  createCalculator(initialValue: number): Calculator {
    return new Calculator(initialValue);
  }
}
