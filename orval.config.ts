import { defineConfig } from "orval";

export default defineConfig({
  api: {
    output: {
      mode: "split",
      target: "src/services/queries.ts",
      schemas: "src/services/models",
      client: "react-query",
      prettier: true,
      override: {
        mutator: {
          path: "src/services/custom-client.ts",
          name: "customClient",
        },
        query: {
          options: {
            staleTime: 10000,
          },
        },
      },
    },
    input: {
      target: "http://localhost:5001/swagger/json",
    },
  },
});
