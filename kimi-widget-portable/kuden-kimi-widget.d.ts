export type KimiState =
  | 'idle'
  | 'thinking'
  | 'success'
  | 'walking'
  | 'spinning'
  | 'pulse'
  | 'curious'
  | 'sleeping';

export interface KimiStateOptions {
  title?: string;
  message?: string;
  source?: string;
}

export interface KimiSpeakOptions {
  speed?: number;
  announce?: boolean;
}

export declare class KudenKimiWidget extends HTMLElement {
  static readonly version: string;
  static readonly states: KimiState[];

  state: KimiState;
  minimized: boolean;

  setState(state: KimiState, options?: KimiStateOptions): this;
  setMessage(title: string, message: string): this;
  useDefaultMessage(): this;
  speak(title: string, message: string, options?: KimiSpeakOptions): Promise<boolean>;
  show(): this;
  hide(): this;
  toggle(): this;
  advance(source?: string): this;
}

declare global {
  interface HTMLElementTagNameMap {
    'kuden-kimi-widget': KudenKimiWidget;
  }

  interface HTMLElementEventMap {
    'kimi-state-change': CustomEvent<{ state: KimiState; source: string }>;
    'kimi-minimize': CustomEvent<{ state: KimiState }>;
    'kimi-restore': CustomEvent<{ state: KimiState }>;
  }
}

export default KudenKimiWidget;
