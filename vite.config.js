import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        painel: resolve(__dirname, 'painel/index.html'),
        login: resolve(__dirname, 'painel/login.html'),
        relatorio: resolve(__dirname, 'painel/relatorio.html'),
        contratos: resolve(__dirname, 'painel/contratos.html'),
        onboarding: resolve(__dirname, 'painel/onboarding.html'),
        equipe: resolve(__dirname, 'painel/equipe.html'),
        convite: resolve(__dirname, 'painel/convite.html'),
        migrar: resolve(__dirname, 'painel/migrar.html'),
        privacidade: resolve(__dirname, 'painel/privacidade.html'),
        termos: resolve(__dirname, 'painel/termos.html'),
        site: resolve(__dirname, 'site/index.html'),
        siteMotorsul: resolve(__dirname, 'site-motorsul/index.html'),
        siteMotorsulDetalhes: resolve(__dirname, 'site-motorsul/detalhes.html'),
        siteBaseMotors: resolve(__dirname, 'site-basemotors/index.html'),
        siteBaseMotorsDetalhes: resolve(__dirname, 'site-basemotors/detalhes.html'),
        siteAdinhoMotos: resolve(__dirname, 'site-adinhomotos/index.html'),
        siteAdinhoMotosDetalhes: resolve(__dirname, 'site-adinhomotos/detalhes.html')
      }
    }
  }
});
