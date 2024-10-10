import {
  ɵɵdefineComponent,
  ɵɵStandaloneFeature,
  ɵɵtemplate,
  ɵɵconditional,
  ɵɵelementStart,
  ɵɵtext,
  ɵɵelementEnd,
  ɵɵnextContext,
  ɵɵadvance,
  ɵɵtextInterpolate1,
  ɵɵgetCurrentView,
  ɵɵlistener,
  ɵɵrestoreView,
  ɵɵresetView,
  ɵɵstyleProp,
  ɵɵtextInterpolate,
  EnvironmentInjector,
  runInInjectionContext,
} from "@angular/core";
import { input, signal, inject } from "@angular/core";

export function ManualCounter({ initialValue: init = input(0) }) {
  const count = signal(init());
  function inc() {
    count.set(count() + 1);
  }
  function reset() {
    count.set(init());
  }
  function isWeirdCount() {
    return count() < 10 || count() > 20;
  }
  function ManualCounter_Conditional_0_Conditional_6_Template(rf, ctx) {
    if (rf & 1) {
      ɵɵelementStart(0, "p");
      ɵɵtext(1, "Take it slow, dude!");
      ɵɵelementEnd();
      ɵɵelementStart(2, "em");
      ɵɵtext(3);
      ɵɵelementEnd();
    }
    if (rf & 2) {
      var ctx_r1 = ɵɵnextContext(2);
      ɵɵadvance(3);
      ɵɵtextInterpolate1("In if block: ", count(), "");
    }
  }
  return {
    ɵɵtemplate: function ManualCounter_Template(rf, ctx) {
      if (rf & 1) {
        var _r1 = ɵɵgetCurrentView();
        ɵɵelementStart(0, "h1");
        ɵɵtext(1);
        ɵɵelementEnd();
        ɵɵelementStart(2, "button", 0);
        ɵɵlistener(
          "click",
          function ManualCounter_Conditional_0_Template_button_click_2_listener() {
            ɵɵrestoreView(_r1);
            var ctx_r12 = ɵɵnextContext();
            return ɵɵresetView(inc());
          }
        );
        ɵɵtext(3, "Increment");
        ɵɵelementEnd();
        ɵɵelementStart(4, "button", 0);
        ɵɵlistener(
          "click",
          function ManualCounter_Conditional_0_Template_button_click_4_listener() {
            ɵɵrestoreView(_r1);
            var ctx_r12 = ɵɵnextContext();
            return ɵɵresetView(reset());
          }
        );
        ɵɵtext(5, "Reset Count");
        ɵɵelementEnd();
        ɵɵtemplate(6, ManualCounter_Conditional_0_Conditional_6_Template, 4, 1);
      }
      if (rf & 2) {
        var ctx_r1 = ɵɵnextContext();
        ɵɵstyleProp("font-size", count() * 2 + 20 + "px");
        ɵɵadvance();
        ɵɵtextInterpolate(count());
        ɵɵadvance(5);
        ɵɵconditional(isWeirdCount() ? 6 : -1);
      }
    },
    initialValue: init,
  };
}
ManualCounter.ɵcmp = ɵɵdefineComponent({
  type: {
    prototype: {
      ngOnInit() {
        // 1. Call actual "init code".
        const instance = runInInjectionContext(this.ɵɵinjector, () =>
          ManualCounter(this)
        );
        // 2. Set actual template.
        this.ɵɵtemplateImpl = instance.ɵɵtemplate;
        // 3. Set initialized signal to trigger re-render.
        this.ɵɵinitialized.set(true);
      },
    },
    ɵfac: () => {
      const ctx = {
        ɵɵinjector: inject(EnvironmentInjector),
        ɵɵtemplateImpl: (rf) => {
          throw new Error("Template impl called before init");
        },
        ɵɵtemplate: (rf) => {
          ctx.ɵɵtemplateImpl(rf);
        },
        ɵɵinitialized: signal(false),

        // Copy of function declaration:
        ...(({ initialValue: init = input(0) }) => {
          return {
            initialValue: init,
          };
        })({}),
      };
      return ctx;
    },
  },
  selectors: [["manual-counter"]],
  inputs: {
    initialValue: [1, "initialValue"],
  },
  exportAs: [],
  standalone: true,
  features: [ɵɵStandaloneFeature],
  decls: 1,
  vars: 1,
  consts: [[3, "click"]],
  template: function (rf, ctx) {
    if (rf & 1) {
      ɵɵtemplate(0, ctx.ɵɵtemplate, 7, 4);
    }
    if (rf & 2) {
      ɵɵconditional(ctx.ɵɵinitialized() ? 0 : -1);
    }
  },
  encapsulation: 2,
});
// ManualCounter.ɵfac = () => ManualCounter({});
