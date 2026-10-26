/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the API, without a trailing slash. Defaults to the /api proxy. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
