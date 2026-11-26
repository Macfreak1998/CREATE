declare module "opentype.js" {
  export interface FontPath {
    toPathData(decimalPlaces?: number): string;
  }

  export class Font {
    ascender: number;
    descender: number;
    unitsPerEm: number;
    getAdvanceWidth(text: string, fontSize?: number): number;
    getPath(text: string, x: number, y: number, fontSize: number): FontPath;
  }

  export function parse(buffer: ArrayBuffer): Font;
}
