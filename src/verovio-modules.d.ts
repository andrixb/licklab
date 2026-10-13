declare module "verovio/esm" {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  export class VerovioToolkit {
    constructor(mod: unknown);
  }
}
declare module "verovio/wasm" {
  const createModule: () => Promise<unknown>;
  export default createModule;
}
