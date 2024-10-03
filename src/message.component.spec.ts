import { expect, test, beforeEach } from "vitest";
import { provideExperimentalZonelessChangeDetection } from "@angular/core";
import { ComponentFixture, TestBed } from "#angular/platform-browser-dynamic/testing-init";

import { MessageComponent } from "./message.component";

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
