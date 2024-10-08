import { stripTSX } from "../typescript/ngxc";

const fileRegex = /\.(component|ng)\.tsx$/;

export default function ngComponent() {
  return {
    name: "ngx-component",

    enforce: "pre",

    async transform(code, id) {
      if (fileRegex.test(id)) {
        return stripTSX(id, code);
      }
    },
  };
}
