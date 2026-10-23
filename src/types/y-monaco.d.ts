declare module 'y-monaco' {
  import * as Y from 'yjs';
  import type * as monaco from 'monaco-editor';
  import type { Awareness } from 'y-protocols/awareness';

  export class MonacoBinding {
    constructor(
      ytext: Y.Text,
      monacoModel: monaco.editor.ITextModel,
      editors?: Set<monaco.editor.IStandaloneCodeEditor> | monaco.editor.IStandaloneCodeEditor,
      awareness?: Awareness | null
    );
    destroy(): void;
  }
}
