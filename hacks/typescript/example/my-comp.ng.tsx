import {signal} from '@angular/core';

export function MyComp() {
  const count = signal(0);

  function inc() {
    count.set(count() + 1);
  }

  return (
    <my-comp>
      @if (count() < 10 || count() > 20) {
        <p>Take it slow, dude!</p>
      }
      <h1>{count()}</h1>
      <button on:click={inc}>Increment</button>
    </my-comp>
  );
}
