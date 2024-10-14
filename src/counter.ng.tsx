import {inject, input, signal} from '@angular/core';
import {MatButton} from '@angular/material/button';

import {CalculatorFactory} from './calculator';

export function Counter({initialValue: init = input(0)}) {
  const calc = inject(CalculatorFactory).createCalculator(init());
  const count = calc.value();

  function inc() {
    calc.add(1);
  }

  function reset() {
    calc.reset();
  }

  function isWeirdCount() {
    return count() < 10 || count() > 20;
  }

  return (
    <ngx-counter>
      <h1 style:fontSize={(count() * 2 + 20) + 'px'}>{count()}</h1>
      <MatButton mat-flat-button on:click={inc()}>Increment</MatButton>
      <MatButton mat-flat-button on:click={reset()}>Reset Count</MatButton>
      @if (isWeirdCount()) {
        <p>Take it slow, dude!</p>
        <em>In if block: {count()}</em>
      }
    </ngx-counter>
  );
}
