import {describe, it, expect} from 'vitest';

import {stripTSX} from './ngxc';

describe('simple component', () => {
  it('works for hello', () => {
    const src = `export function Comp({}) { return <div>Hello</div>; }`;
    const actual = stripTSX('test.tsx', src);
    expect(actual).toMatchInlineSnapshot(`
      "import { ɵɵdefineComponent, ɵɵStandaloneFeature, ɵɵtext, inject, EnvironmentInjector, runInInjectionContext } from "@angular/core";
      export function Comp({}) { return { ɵɵtemplate: function Comp_Template(rf, ctx) {
              if ((rf & 1)) {
                  ɵɵtext(0, "Hello");
              }
          } }; }
      Comp.ɵcmp = ɵɵdefineComponent({
          type: {
              ɵfac: () => {
                  var ctx = {
                      ɵɵinjector: inject(EnvironmentInjector),
                      ɵɵtemplateImpl: () => { throw new Error("Template impl called before init"); },
                      ɵɵtemplate: rf => { ctx.ɵɵtemplateImpl(rf); },
                      ɵɵinitialized: signal(false),
                      ...(({}) => ({}))({})
                  };
                  return ctx;
              },
              prototype: {
                  ngOnInit: function ngOnInit() {
                      var instance = runInInjectionContext(this.ɵɵinjector, () => Comp(this));
                      this.ɵɵtemplateImpl = instance.ɵɵtemplate;
                      this.ɵɵinitialized.set(true);
                  }
              }
          },
          selectors: [["div"]],
          exportAs: [],
          standalone: true,
          features: [ɵɵStandaloneFeature],
          decls: 1,
          vars: 1,
          template: function (rf, ctx) {
              if (rf & 1) {
                  ɵɵtemplate(0, ctx.ɵɵtemplate, 1, 0);
              }
              if (rf & 2) {
                  ɵɵconditional(ctx.ɵɵinitialized() ? 0 : -1);
              }
          },
          encapsulation: 2
      });
      "
    `);
  });

  it('works for input & input.required', () => {
    const src = `export function Comp({text = input(''), other = input.required<string>()}) { return <div>Hello</div>; }`;
    const actual = stripTSX('test.tsx', src);
    expect(actual).toMatchInlineSnapshot(`
      "import { ɵɵdefineComponent, ɵɵStandaloneFeature, ɵɵtext, inject, EnvironmentInjector, runInInjectionContext } from "@angular/core";
      export function Comp({ text = input(''), other = input.required<string>() }) { return { ɵɵtemplate: function Comp_Template(rf, ctx) {
              if ((rf & 1)) {
                  ɵɵtext(0, "Hello");
              }
          } }; }
      Comp.ɵcmp = ɵɵdefineComponent({
          type: {
              ɵfac: () => {
                  var ctx = {
                      ɵɵinjector: inject(EnvironmentInjector),
                      ɵɵtemplateImpl: () => { throw new Error("Template impl called before init"); },
                      ɵɵtemplate: rf => { ctx.ɵɵtemplateImpl(rf); },
                      ɵɵinitialized: signal(false),
                      ...(({ text = input(''), other = input.required<string>() }) => ({ text: text, other: other }))({})
                  };
                  return ctx;
              },
              prototype: {
                  ngOnInit: function ngOnInit() {
                      var instance = runInInjectionContext(this.ɵɵinjector, () => Comp(this));
                      this.ɵɵtemplateImpl = instance.ɵɵtemplate;
                      this.ɵɵinitialized.set(true);
                  }
              }
          },
          selectors: [["div"]],
          inputs: {
              text: [1, "text"],
              other: [1, "other"]
          },
          exportAs: [],
          standalone: true,
          features: [ɵɵStandaloneFeature],
          decls: 1,
          vars: 1,
          template: function (rf, ctx) {
              if (rf & 1) {
                  ɵɵtemplate(0, ctx.ɵɵtemplate, 1, 0);
              }
              if (rf & 2) {
                  ɵɵconditional(ctx.ɵɵinitialized() ? 0 : -1);
              }
          },
          encapsulation: 2
      });
      "
    `);
  });

  it('resolves imported components', () => {
    const src = `export function Comp({}) { return <div><MatButton disabled>Hello</MatButton></div>; }`;
    // const src = `export function Comp({}) { return <div><button mat-button disabled>Hello</button></div>; }`;
    const actual = stripTSX('test.tsx', src);
    expect(actual).toMatchInlineSnapshot(`
      "import { ɵɵdefineComponent, ɵɵStandaloneFeature, ɵɵelementStart, ɵɵtext, ɵɵelementEnd, inject, EnvironmentInjector, runInInjectionContext } from "@angular/core";
      export function Comp({}) { return { ɵɵtemplate: function Comp_Template(rf, ctx) {
              if ((rf & 1)) {
                  ɵɵelementStart(0, ɵɵselectorTag(MatButton), 0);
                  ɵɵtext(1, "Hello");
                  ɵɵelementEnd();
              }
          } }; }
      Comp.ɵcmp = ɵɵdefineComponent({
          type: {
              ɵfac: () => {
                  var ctx = {
                      ɵɵinjector: inject(EnvironmentInjector),
                      ɵɵtemplateImpl: () => { throw new Error("Template impl called before init"); },
                      ɵɵtemplate: rf => { ctx.ɵɵtemplateImpl(rf); },
                      ɵɵinitialized: signal(false),
                      ...(({}) => ({}))({})
                  };
                  return ctx;
              },
              prototype: {
                  ngOnInit: function ngOnInit() {
                      var instance = runInInjectionContext(this.ɵɵinjector, () => Comp(this));
                      this.ɵɵtemplateImpl = instance.ɵɵtemplate;
                      this.ɵɵinitialized.set(true);
                  }
              }
          },
          selectors: [["div"]],
          exportAs: [],
          standalone: true,
          features: [ɵɵStandaloneFeature],
          decls: 1,
          vars: 1,
          consts: [["disabled", ""]],
          template: function (rf, ctx) {
              if (rf & 1) {
                  ɵɵtemplate(0, ctx.ɵɵtemplate, 2, 0);
              }
              if (rf & 2) {
                  ɵɵconditional(ctx.ɵɵinitialized() ? 0 : -1);
              }
          },
          encapsulation: 2
      });
      function ɵɵselectorTag(C) {
          return C.selectors[0][0];
      }
      "
    `);
  });
});
