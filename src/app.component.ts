import { signal } from '@angular/core';
import { MessageComponent } from './message.component';
import { Counter } from './counter.ng';

export class AppComponent {
  static selector = 'app-root';
  static imports = [MessageComponent, Counter];

  title = 'Welcome';
  isDetailsEnabled = signal(true);

  toggleDetails() {
    this.isDetailsEnabled.set(!this.isDetailsEnabled());
  }
}
