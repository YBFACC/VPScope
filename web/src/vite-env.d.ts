/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VPSCOPE_CLIENT?: "mock" | "tauri";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
