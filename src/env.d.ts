/// <reference types="vite/client" />

declare const __MAZE_UI_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_MAZE_API_URL?: string
  readonly VITE_MAZE_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
