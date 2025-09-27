/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // CRÍTICO: Incluir a pasta 'src' se ela for usada
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}', 
    
    // Manter as entradas para a raiz (caso você não use a pasta 'src')
    './pages/**/*.{js,jsx}', 
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
