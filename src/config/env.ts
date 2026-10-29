const rawStyleId = import.meta.env.VITE_MAPBOX_STYLE_ID?.trim().replace(
  /^mapbox:\/\/styles\//,
  '',
)
const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim()
const customTileUrl = import.meta.env.VITE_MAPBOX_TILE_URL?.trim()

const hasMapboxCredentials = Boolean((rawStyleId && accessToken) || customTileUrl)

export const mapConfig = {
  isMapbox: hasMapboxCredentials,
  tileUrl:
    customTileUrl ||
    (rawStyleId && accessToken
      ? `https://api.mapbox.com/styles/v1/${rawStyleId}/tiles/256/{z}/{x}/{y}@2x?access_token=${accessToken}`
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  attribution: hasMapboxCredentials
    ? '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: hasMapboxCredentials ? 20 : 19,
}

