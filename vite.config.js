import { defineConfig } from 'vite';
import ngComponent from './hacks/vite/vite-plugin-ng-component';
import ngxComponent from './hacks/vite/vite-plugin-ngx-component';
import ngLinker from './hacks/vite/vite-plugin-ng-linker';

export default defineConfig({
  resolve: {
  },
  plugins: [
    ngLinker(),
    ngComponent(),
    ngxComponent(),
  ],
  esbuild: {
    supported: {
      decorators: false
    },
  },
});
