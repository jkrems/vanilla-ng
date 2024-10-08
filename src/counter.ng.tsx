import {signal} from '@angular/core';

export function Counter() {
  const count = signal(0);

  function inc() {
    count.set(count() + 1);
  }

  function isWeirdCount() {
    return count() < 10 || count() > 20;
  }

  return (
    <ngx-counter>
      <h1>{count()}</h1>
      <button on:click={inc()}>Increment</button>
      @if (isWeirdCount()) {
        <p>Take it slow, dude!</p>
        <em>In if block: {count()}</em>
      }
    </ngx-counter>
  );
}
