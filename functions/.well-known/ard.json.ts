import ardManifest from "../../public/.well-known/ard.json";

export const onRequestGet = async () => {
  return new Response(JSON.stringify(ardManifest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
