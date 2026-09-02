import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv, defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [tailwindcss(), sveltekit()],
        server: {
            // VITE_HOST=0.0.0.0 lets the dev server run in a container while
            // staying reachable through the published port (docker dev/test).
            host: env.VITE_HOST || 'localhost',
            port: Number(env.VITE_PORT) || 3000,
            // In containers the server is reached under service hostnames
            // (client-test:3000 in the docker test stack) or whatever host
            // published the port; Vite's DNS-rebinding guard 403s anything
            // but localhost. Widen the guard only when binding non-localhost.
            allowedHosts: env.VITE_HOST ? true : undefined,
        },
    };
});
