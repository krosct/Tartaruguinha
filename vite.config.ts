import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: env.VITE_DEV_HOST === "0.0.0.0",
      port: Number(env.FRONTEND_PORT) || 5173,
    },
    build: {
      target: "es2022",
      sourcemap: true,
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        devOptions: { enabled: false },
        manifest: {
          name: "Tartaruguinha",
          short_name: "Tartaruguinha",
          description:
            "Sua webcam observa a postura e avisa, na hora, quando você se curva.",
          lang: "pt-BR",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "any",
          background_color: "#0b1220",
          theme_color: "#0f766e",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,webp,webmanifest}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/\.well-known\//],
          runtimeCaching: [],
        },
      }),
    ],
  };
});
