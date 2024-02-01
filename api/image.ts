import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pollId = req.query["id"];
  res.statusCode = 200;
  res.end(pollId ?? "Null");
}
