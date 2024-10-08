import { provideExperimentalZonelessChangeDetection } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";
import { beforeAll, afterEach } from "vitest";

beforeAll(() => {
  TestBed.initTestEnvironment(
    {
      // @ts-ignore
      ngModule: BrowserDynamicTestingModule,
      providers: [provideExperimentalZonelessChangeDetection()],
    },
    platformBrowserDynamicTesting()
  );
});

afterEach(() => {
  TestBed.resetTestingModule();
});
