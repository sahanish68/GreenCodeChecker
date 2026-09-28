import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ status: "ok", service: "greencode", time: new Date().toISOString() }),
    },
  },
});
