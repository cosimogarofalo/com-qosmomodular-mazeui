/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAZE_API_URL?: string
  readonly VITE_MAZE_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
