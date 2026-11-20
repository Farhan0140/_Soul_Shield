import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Path separator that works on Windows and POSIX.
const sep = '[\\\\/]'
const pkg = (names) => new RegExp(`node_modules${sep}(${names.join('|')})${sep}`)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),],
  build: {
    rolldownOptions: {
      output: {
        // Pages are lazy-loaded (App.jsx). These groups keep the rest tidy:
        // libraries that rarely change get their own long-cacheable chunks,
        // and the small shared UI pieces travel together instead of as a
        // dozen sub-kilobyte requests.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: pkg(['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom', 'cookie', 'set-cookie-parser']),
              priority: 40,
            },
            { name: 'motion', test: pkg(['framer-motion', 'motion-dom', 'motion-utils']), priority: 30 },
            { name: 'icons', test: pkg(['lucide-react']), priority: 20 },
            {
              name: 'ui',
              test: new RegExp(`${sep}src${sep}(components${sep}ui|utils)${sep}`),
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
