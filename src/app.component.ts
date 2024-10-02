import { input } from '@angular/core';
import { MessageComponent } from './message.component';

export class AppComponent {
  static selector = 'app-root';
  static imports = [MessageComponent];

  title = input('Welcome');
}
