// vite.config.ts
import { defineConfig, loadEnv } from "file:///Users/dw/Project/python_project/wdm_app_v2/apps/wdm-admin/node_modules/vite/dist/node/index.js";
import vue from "file:///Users/dw/Project/python_project/wdm_app_v2/apps/wdm-admin/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import AutoImport from "file:///Users/dw/Project/python_project/wdm_app_v2/apps/wdm-admin/node_modules/unplugin-auto-import/dist/vite.js";
import Components from "file:///Users/dw/Project/python_project/wdm_app_v2/apps/wdm-admin/node_modules/unplugin-vue-components/dist/vite.js";
import { NaiveUiResolver } from "file:///Users/dw/Project/python_project/wdm_app_v2/apps/wdm-admin/node_modules/unplugin-vue-components/dist/resolvers.js";
import path from "node:path";
var __vite_injected_original_dirname = "/Users/dw/Project/python_project/wdm_app_v2/apps/wdm-admin";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      vue(),
      AutoImport({
        imports: [
          "vue",
          { "naive-ui": ["useDialog", "useMessage", "useNotification", "useLoadingBar"] }
        ]
      }),
      Components({ resolvers: [NaiveUiResolver()] })
    ],
    resolve: {
      alias: { "@": path.resolve(__vite_injected_original_dirname, "src") }
    },
    server: {
      port: 9021,
      host: "0.0.0.0",
      open: false,
      proxy: env.VITE_API_PROXY_TARGET ? { "/api": { target: env.VITE_API_PROXY_TARGET, changeOrigin: true } } : void 0
    },
    build: {
      target: "es2020",
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            "naive-ui": ["naive-ui"],
            "echarts-vendor": ["echarts", "vue-echarts"],
            "vue-vendor": ["vue", "vue-router", "pinia"]
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvZHcvUHJvamVjdC9weXRob25fcHJvamVjdC93ZG1fYXBwX3YyL2FwcHMvd2RtLWFkbWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvZHcvUHJvamVjdC9weXRob25fcHJvamVjdC93ZG1fYXBwX3YyL2FwcHMvd2RtLWFkbWluL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9kdy9Qcm9qZWN0L3B5dGhvbl9wcm9qZWN0L3dkbV9hcHBfdjIvYXBwcy93ZG0tYWRtaW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgQXV0b0ltcG9ydCBmcm9tICd1bnBsdWdpbi1hdXRvLWltcG9ydC92aXRlJ1xuaW1wb3J0IENvbXBvbmVudHMgZnJvbSAndW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvdml0ZSdcbmltcG9ydCB7IE5haXZlVWlSZXNvbHZlciB9IGZyb20gJ3VucGx1Z2luLXZ1ZS1jb21wb25lbnRzL3Jlc29sdmVycydcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCdcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKVxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IFtcbiAgICAgIHZ1ZSgpLFxuICAgICAgQXV0b0ltcG9ydCh7XG4gICAgICAgIGltcG9ydHM6IFtcbiAgICAgICAgICAndnVlJyxcbiAgICAgICAgICB7ICduYWl2ZS11aSc6IFsndXNlRGlhbG9nJywgJ3VzZU1lc3NhZ2UnLCAndXNlTm90aWZpY2F0aW9uJywgJ3VzZUxvYWRpbmdCYXInXSB9LFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgICBDb21wb25lbnRzKHsgcmVzb2x2ZXJzOiBbTmFpdmVVaVJlc29sdmVyKCldIH0pLFxuICAgIF0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHsgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjJykgfSxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogOTAyMSxcbiAgICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICAgIG9wZW46IGZhbHNlLFxuICAgICAgcHJveHk6IGVudi5WSVRFX0FQSV9QUk9YWV9UQVJHRVRcbiAgICAgICAgPyB7ICcvYXBpJzogeyB0YXJnZXQ6IGVudi5WSVRFX0FQSV9QUk9YWV9UQVJHRVQsIGNoYW5nZU9yaWdpbjogdHJ1ZSB9IH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgfSxcbiAgICBidWlsZDoge1xuICAgICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICAgIHNvdXJjZW1hcDogZmFsc2UsXG4gICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDE1MDAsXG4gICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICAgJ25haXZlLXVpJzogWyduYWl2ZS11aSddLFxuICAgICAgICAgICAgJ2VjaGFydHMtdmVuZG9yJzogWydlY2hhcnRzJywgJ3Z1ZS1lY2hhcnRzJ10sXG4gICAgICAgICAgICAndnVlLXZlbmRvcic6IFsndnVlJywgJ3Z1ZS1yb3V0ZXInLCAncGluaWEnXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnVyxTQUFTLGNBQWMsZUFBZTtBQUN0WSxPQUFPLFNBQVM7QUFDaEIsT0FBTyxnQkFBZ0I7QUFDdkIsT0FBTyxnQkFBZ0I7QUFDdkIsU0FBUyx1QkFBdUI7QUFDaEMsT0FBTyxVQUFVO0FBTGpCLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUMzQyxTQUFPO0FBQUEsSUFDTCxTQUFTO0FBQUEsTUFDUCxJQUFJO0FBQUEsTUFDSixXQUFXO0FBQUEsUUFDVCxTQUFTO0FBQUEsVUFDUDtBQUFBLFVBQ0EsRUFBRSxZQUFZLENBQUMsYUFBYSxjQUFjLG1CQUFtQixlQUFlLEVBQUU7QUFBQSxRQUNoRjtBQUFBLE1BQ0YsQ0FBQztBQUFBLE1BQ0QsV0FBVyxFQUFFLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7QUFBQSxJQUMvQztBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTyxFQUFFLEtBQUssS0FBSyxRQUFRLGtDQUFXLEtBQUssRUFBRTtBQUFBLElBQy9DO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixPQUFPLElBQUksd0JBQ1AsRUFBRSxRQUFRLEVBQUUsUUFBUSxJQUFJLHVCQUF1QixjQUFjLEtBQUssRUFBRSxJQUNwRTtBQUFBLElBQ047QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLHVCQUF1QjtBQUFBLE1BQ3ZCLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGNBQWM7QUFBQSxZQUNaLFlBQVksQ0FBQyxVQUFVO0FBQUEsWUFDdkIsa0JBQWtCLENBQUMsV0FBVyxhQUFhO0FBQUEsWUFDM0MsY0FBYyxDQUFDLE9BQU8sY0FBYyxPQUFPO0FBQUEsVUFDN0M7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
