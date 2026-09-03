import { getProjectName, applyProjectNameGuard } from './config';

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/beverages") {
      // If you did not use `DB` as your binding name, change it here
      const { results } = await env.DB.prepare(
        "SELECT * FROM Customers WHERE CompanyName = ?"
      )
        .bind("Bs Beverages")
        .all();
      return Response.json(results);
    }

    if (pathname === "/api/project-name") {
      return Response.json({ projectName: getProjectName() });
    }

    const welcomeMessage = applyProjectNameGuard(
      "Welcome to My Cool Project! Call /api/beverages to see everyone who works at Bs Beverages, or /api/project-name to see the current project name."
    );

    return new Response(welcomeMessage);
  },
} satisfies ExportedHandler<Env>;
