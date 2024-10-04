import { expect, test, beforeEach } from "vitest";
import { ComponentFixture, TestBed } from "#angular/platform-browser-dynamic/testing-init";

import { MessageComponent } from "./message.component";

let fixture: ComponentFixture<MessageComponent>;

beforeEach(async () => {
  TestBed.configureTestingModule({
    imports: [MessageComponent],
  });

  fixture = TestBed.createComponent(MessageComponent);
  await fixture.whenStable();
});

test("Contains the static content", async () => {
  expect(fixture.nativeElement.textContent).toBe("Some more (static) content.");
});
