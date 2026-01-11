declare module 'verovio/wasm' {
  const createVerovioModule: () => Promise<any>;
  export default createVerovioModule;
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: any);
    setOptions(options: Record<string, any>): void;
    loadData(data: string): boolean;
    getPageCount(): number;
    renderToSVG(page: number): string;
    getLog(): string;
  }
}
