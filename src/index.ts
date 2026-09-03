export default {
  async fetch(_request, _env): Promise<Response> {
    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },
} satisfies ExportedHandler<Env>;
