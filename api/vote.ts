import type { VercelRequest, VercelResponse } from "@vercel/node";

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    res.status(200).end(`Haha`);
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
