import { signal } from '@angular/core';
import { MessageComponent } from './message.component';

export class AppComponent {
  static selector = 'app-root';
  static imports = [MessageComponent];

  title = 'Welcome';
  isDetailsEnabled = signal(true);

  toggleDetails() {
    this.isDetailsEnabled.set(!this.isDetailsEnabled());
  }
}
