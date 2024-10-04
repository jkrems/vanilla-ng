import { expect, test, beforeEach } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AppComponent } from "./app.component";

let fixture: ComponentFixture<AppComponent>;

beforeEach(async () => {
  TestBed.configureTestingModule({
    imports: [AppComponent],
  });

  fixture = TestBed.createComponent(AppComponent);
  await fixture.whenStable();
});

test("Contains the static content", async () => {
  expect(fixture.nativeElement.textContent).toContain("Some more (static) content.");
});

test("Toggles static content", async () => {
  const btn = fixture.nativeElement.querySelector('button');
  btn.click();
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent).not.toContain("Some more (static) content.");
});
