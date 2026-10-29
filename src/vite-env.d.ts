/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_STYLE_ID?: string
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string
  readonly VITE_MAPBOX_TILE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
