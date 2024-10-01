Object.assign(globalThis, {
  ngJitMode: false,
  // ng: {
  //   ɵcompilerFacade: {
  //     compileFactoryDeclaration(angularCoreEnv: any, filename: string, decl: any) {
  //       console.error({angularCoreEnv, filename, decl});
  //       return (...args: unknown[]) => {
  //         console.error('factory called', {type: decl.type, args});
  //         return new decl.type(...args);
  //       };
  //     },

  //     compileInjectableDeclaration(angularCoreEnv: any, filename: string, decl: any) {
  //       console.error({angularCoreEnv, filename, decl});
  //       return () => {
  //         console.error('injectable called');
  //       };
  //     },

  //     compileInjectorDeclaration(angularCoreEnv: any, filename: string, decl: any) {
  //       console.error({angularCoreEnv, filename, decl});
  //       return () => {
  //         console.error('injector called');
  //       };
  //     },

  //     compileDirectiveDeclaration(angularCoreEnv: any, filename: string, decl: any) {
  //       console.error({angularCoreEnv, filename, decl});
  //       return () => {
  //         console.error('directive called');
  //       };
  //     },

  //     compilePipeDeclaration(angularCoreEnv: any, filename: string, decl: any) {
  //       console.error({angularCoreEnv, filename, decl});
  //       return () => {
  //         console.error('pipe called');
  //       };
  //     },

  //     compileNgModuleDeclaration(angularCoreEnv: any, filename: string, decl: any) {
  //       console.error({angularCoreEnv, filename, decl});
  //       return () => {
  //         console.error('ng-module called');
  //       };
  //     },
  //   },
  // },
});
