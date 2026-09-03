import { 
  API_ROUTES, 
  SQL_QUERIES, 
  COMPANY_NAMES, 
  HTTP_HEADERS, 
  ERROR_MESSAGES, 
  RESPONSE_MESSAGES 
} from './lib/strings';

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === API_ROUTES.BEVERAGES) {
      try {
        // Optimized: Select only needed columns instead of SELECT *
        // This reduces data transfer and improves query performance
        const { results } = await env.DB.prepare(
          SQL_QUERIES.SELECT_CUSTOMERS_BY_COMPANY
        )
          .bind(COMPANY_NAMES.BS_BEVERAGES)
          .all();
        
        // Add cache headers for better performance
        return Response.json(results, {
          headers: {
            "Cache-Control": HTTP_HEADERS.CACHE_CONTROL_PUBLIC_60S,
          },
        });
      } catch (error) {
        // Proper error handling for database failures
        console.error(ERROR_MESSAGES.DATABASE_QUERY_FAILED, error);
        return Response.json(
          { error: ERROR_MESSAGES.FAILED_TO_FETCH_BEVERAGES },
          { status: 500 }
        );
      }
    }

    return new Response(
      RESPONSE_MESSAGES.DEFAULT_MESSAGE
    );
  },
} satisfies ExportedHandler<Env>;
