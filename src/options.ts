import path from 'path'

export interface VitePluginShopifyCleanOptions {
  manifestFileName?: string
  themeRoot?: string
}

export interface ResolvedVitePluginShopifyCleanOptions {
  manifestFileName: string
  themeRoot: string
}

export const resolveOptions = (
  options: VitePluginShopifyCleanOptions,
): ResolvedVitePluginShopifyCleanOptions => ({
  manifestFileName: typeof options.manifestFileName !== 'undefined' ? options.manifestFileName : '.vite/manifest.json',
  themeRoot: typeof options.themeRoot !== 'undefined' ? path.normalize(options.themeRoot) : './',
})
