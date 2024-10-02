import './style.css';

import { AppComponent } from './app.component';
import { createApplication } from '@angular/platform-browser';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';

(async () => {
  const app = await createApplication({
    providers: [
      provideExperimentalZonelessChangeDetection(),
    ],
  });

  app.bootstrap(AppComponent, 'div#app-root');
})();
