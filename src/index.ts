import { existsSync, promises as fs, readFileSync } from 'fs'
import { unlink } from 'fs/promises'
import path from 'path'

import { Manifest, Plugin } from 'vite'

import { resolveOptions, VitePluginShopifyCleanOptions } from './options'

let buildStartFirstRun = true
let closeBundleFirstRun = true

// eslint-disable-next-line import/no-default-export
export default function shopifyClean (options: VitePluginShopifyCleanOptions = {}): Plugin {
  const resolvedOptions = resolveOptions(options)

  return {
    name: 'vite-plugin-shopify-clean',
    buildStart: async () => {
      const rootPath = path.resolve(resolvedOptions.themeRoot)
      const assetsDir = path.resolve(rootPath, './assets')

      if (!existsSync(assetsDir)) {
        console.warn(`WARNING: No assets folder located at ${assetsDir}. No clean attempted.`)

        return
      }

      const manifestFile = path.join(assetsDir, resolvedOptions.manifestFileName)

      if (!existsSync(manifestFile)) {
        console.warn(`WARNING: No ${resolvedOptions.manifestFileName} in ${assetsDir}. No clean attempted.`)

        return
      }

      const manifest = JSON.parse(readFileSync(manifestFile, 'utf-8')) as Manifest
      const filesInManifest = getFilesInManifest(manifest)

      if (process.env.VITE_WATCH && !buildStartFirstRun) {
        return
      }

      buildStartFirstRun = false

      await Promise.all(filesInManifest.map(async file => {
        const location = path.join(assetsDir, file)

        if (existsSync(location)) {
          return unlink(location)
        }

        return Promise.resolve()
      }))
    },

    writeBundle: async (_, bundle) => {
      if (!(resolvedOptions.manifestFileName in bundle)) return
      if (!process.env.VITE_WATCH) return
      if (closeBundleFirstRun) {
        closeBundleFirstRun = false

        return
      }

      const rootPath = path.resolve(resolvedOptions.themeRoot)
      const assetsDir = path.resolve(rootPath, './assets')

      if (!existsSync(assetsDir)) {
        console.warn(`WARNING: No assets folder located at ${assetsDir}. No clean attempted.`)

        return
      }

      const manifestAsset = bundle[resolvedOptions.manifestFileName]
      if (!('source' in manifestAsset)) return

      const manifest = JSON.parse(manifestAsset.source.toString()) as Manifest
      const filesInManifest = getFilesInManifest(manifest)
      const filesInAssets = await fs.readdir(assetsDir)
      const filesToDelete = [...new Set(filesInManifest.map(file => {
        const fileStartsWith = file
          .split('-')
          .slice(0, file.split('-').length - 1)
          .join('-')
        const fileExtension = file.split('.')[file.split('.').length - 1]
        const toLookFor = new RegExp(`${fileStartsWith}-(.*).${fileExtension}`, 'i')

        return filesInAssets
          .filter(assetFile => {
            const matches = assetFile.match(toLookFor)
            const fileIsInManifest = filesInManifest.includes(assetFile)

            return matches && !fileIsInManifest
          })
      }).flat())]

      await Promise.all(filesToDelete.map(async file => {
        const location = path.join(assetsDir, file)

        if (existsSync(location)) {
          return unlink(location)
        }

        return Promise.resolve()
      }))
    },
  }
}

function getFilesInManifest (manifest: Manifest) {
  const filesListedInImports = new Set(
    Object.values(manifest)
      .map(block => {
        if ('imports' in block) {
          return block.imports
        }

        return []
      })
      .flat(),
  )

  return Object.entries(manifest)
    .map(([key, block]) => {
      const file = block.file

      // We're experiencing a manifest which is listing a file that isn't output so we'll check the imports to make sure all files are actually used. This typically only seems to be for imports which start with an _
      if (key.startsWith('_')) {
        if (filesListedInImports.has(key)) {
          return [file]
        }

        return []
      }

      return [file]
    })
    .flat()
}
