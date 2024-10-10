import { signal } from '@angular/core';
import { MessageComponent } from './message.component';
import { Counter } from './counter.ng';
import { ManualCounter } from './manual-counter';

export class AppComponent {
  static selector = 'app-root';
  static imports = [MessageComponent, Counter, ManualCounter];

  title = 'Welcome';
  isDetailsEnabled = signal(true);

  toggleDetails() {
    this.isDetailsEnabled.set(!this.isDetailsEnabled());
  }
}
