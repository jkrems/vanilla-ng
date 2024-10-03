import { expect, test, beforeEach } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";

import { MessageComponent } from "./message.component";
import { provideExperimentalZonelessChangeDetection } from "@angular/core";

TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

let fixture: ComponentFixture<MessageComponent>;

beforeEach(async () => {
  TestBed.configureTestingModule({
    imports: [MessageComponent],
    providers: [provideExperimentalZonelessChangeDetection()],
  });

  fixture = TestBed.createComponent(MessageComponent);
  await fixture.whenStable();
});

test("Contains the static content", async () => {
  expect(fixture.nativeElement.textContent).toBe("Some more (static) content.");
});
