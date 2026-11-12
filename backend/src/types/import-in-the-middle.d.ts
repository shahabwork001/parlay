// The package ships register-hooks.d.ts, which TypeScript does not map to the .mjs subpath.
declare module "import-in-the-middle/register-hooks.mjs" {
  export interface RegisterHooksOptions {
    include?: (string | RegExp)[];
    exclude?: (string | RegExp)[];
    disableCjsSourceStripping?: boolean;
  }
  export function register(options?: RegisterHooksOptions): void;
  export function supportsSyncHooks(): boolean;
}
