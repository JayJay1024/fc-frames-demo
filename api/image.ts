import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const pollId = req.query["id"];
    if (!pollId) {
      return res.status(400).send("Missing poll ID");
    }

    return res.status(200).send("Debug");
  } catch (err) {
    res.statusCode = 500;
    return res.status(500).end("Error generating image");
  }
}
