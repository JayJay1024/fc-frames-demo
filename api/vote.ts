import type { VercelRequest, VercelResponse } from "@vercel/node";

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    res.statusCode = 200;
    return res.end("Haha");
  } else {
    res.setHeader("Allow", ["POST"]);
    res.statusCode = 405;
    return res.end(`Method ${req.method} Not Allowed`);
  }
}
