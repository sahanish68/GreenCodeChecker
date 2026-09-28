import { createFileRoute } from "@tanstack/react-router";

import { REGIONS } from "@/lib/greencode/regions";

export const Route = createFileRoute("/api/public/regions")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          disclaimer:
            "Grid intensities are annual averages from public datasets and are estimates, not live measurements.",
          regions: REGIONS,
        }),
    },
  },
});
