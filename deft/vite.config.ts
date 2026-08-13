import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3004',
    },
  },
  plugins: [
    figmaAssetResolver(),


    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {

      '@': path.resolve(__dirname, './src'),
    },
  },


  assetsInclude: ['**/*.svg', '**/*.csv'],
})
