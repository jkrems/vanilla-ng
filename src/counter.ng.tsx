import {input, signal} from '@angular/core';

export function Counter({initialValue: init = input(0)}) {
  const count = signal(init());

  function inc() {
    count.set(count() + 1);
  }

  function reset() {
    count.set(init());
  }

  function isWeirdCount() {
    return count() < 10 || count() > 20;
  }

  return (
    <ngx-counter>
      <h1 style:fontSize={(count() * 2 + 20) + 'px'}>{count()}</h1>
      <button on:click={inc()}>Increment</button>
      <button on:click={reset()}>Reset Count</button>
      @if (isWeirdCount()) {
        <p>Take it slow, dude!</p>
        <em>In if block: {count()}</em>
      }
    </ngx-counter>
  );
}
