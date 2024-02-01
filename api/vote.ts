import { Message, getSSLHubRpcClient } from "@farcaster/hub-nodejs";
import { kv } from "@vercel/kv";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Poll } from "./types";
import { polls } from "./polls";

const HUB_URL = process.env["HUB_URL"] || "nemes.farcaster.xyz:2283";
const client = getSSLHubRpcClient(HUB_URL);
const latestPoll = polls.slice(-1)[0];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!(await kv.hgetall(`poll:${latestPoll.id}`))) {
      const newPoll: Poll = {
        ...latestPoll,
        created_at: Date.now(),
      };
      await kv.hset(`poll:${newPoll.id}`, newPoll);
      await kv.zadd("polls_by_date", {
        score: Number(newPoll.created_at),
        member: newPoll.id,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).end("Error initialize poll");
  }

  if (req.method === "POST") {
    let validatedMessage: Message | undefined = undefined;
    try {
      const frameMessage = Message.decode(Buffer.from(req.body?.trustedData?.messageBytes || "", "hex"));
      const result = await client.validateMessage(frameMessage);
      if (result.isOk() && result.value.valid) {
        validatedMessage = result.value.message;
      }

      const urlBuffer = validatedMessage?.data?.frameActionBody?.url || [];
      const urlString = Buffer.from(urlBuffer).toString("utf-8");
      if (!urlString.startsWith(process.env["HOST"] || "")) {
        return res.status(400).end(`Invalid frame url: ${urlBuffer}`);
      }
    } catch (e) {
      return res.status(400).end(`Failed to validate message: ${e}`);
    }

    try {
      const buttonId = validatedMessage?.data?.frameActionBody?.buttonIndex || 0;
      const fid = validatedMessage?.data?.fid || 0;
      const voted = req.query["voted"] === "true" || (await kv.sismember(`poll:${latestPoll.id}:voted`, fid));

      if (fid > 0 && buttonId > 0 && buttonId < 5 && !voted) {
        const multi = kv.multi();
        multi.hincrby(`poll:${latestPoll.id}`, `votes${buttonId}`, 1);
        multi.sadd(`poll:${latestPoll.id}:voted`, fid);
        await multi.exec();
      }

      const poll: Poll | null = await kv.hgetall(`poll:${latestPoll.id}`);
      if (!poll) {
        return res.status(400).send(`Missing poll for #${latestPoll.id}`);
      }

      const imageUrl = `${process.env["HOST"]}/api/image?id=${poll.id}&voted=${
        voted ? "true" : "false"
      }&date=${Date.now()}`;

      res.setHeader("Content-Type", "text/html");
      res.status(200).end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Vote Recorded</title>
            <meta property="og:title" content="Vote Recorded">
            <meta property="og:image" content="${imageUrl}">
            <meta name="fc:frame" content="vNext">
            <meta name="fc:frame:image" content="${imageUrl}">
          </head>
          <body>
            <p>${
              voted
                ? `You have already voted. You clicked ${buttonId}`
                : `Your vote for ${buttonId} has been recorded for fid ${fid}.`
            }</p>
          </body>
        </html>
      `);
    } catch (err) {
      console.error(err);
      return res.status(500).end("Error voting poll");
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
