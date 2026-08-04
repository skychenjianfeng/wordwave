declare module 'hyphen/en-us/index.js' {
  interface HyphenateOptions {
    hyphenChar?: string;
    minWordLength?: number;
    debug?: boolean;
  }
  interface Hyphenator {
    hyphenate(text: string, options?: HyphenateOptions): Promise<string>;
    hyphenateSync(text: string, options?: HyphenateOptions): string;
    hyphenateHTML(text: string, options?: HyphenateOptions): Promise<string>;
    hyphenateHTMLSync(text: string, options?: HyphenateOptions): string;
  }
  const hyphenator: Hyphenator;
  export default hyphenator;
}
