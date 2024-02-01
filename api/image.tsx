import { kv } from "@vercel/kv";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Poll } from "./types";
import satori from "satori/wasm";
import { join } from "path";
import * as fs from "fs";
import sharp from "sharp";

const fontPath = join(process.cwd(), "Roboto-Regular.ttf");
const fontData = fs.readFileSync(fontPath);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const pollId = req.query["id"];
    if (!pollId) {
      return res.status(400).send("Missing poll ID");
    }

    const poll: Poll | null = await kv.hgetall(`poll:${pollId}`);
    if (!poll) {
      return res.status(400).send(`Missing poll for #${pollId}`);
    }

    const showResults = req.query["results"] === "true";

    const pollOptions = [poll.option1, poll.option2, poll.option3, poll.option4].filter((option) => option !== "");
    const totalVotes = pollOptions.map((_, index) => parseInt(poll[`votes${index + 1}`])).reduce((a, b) => a + b, 0);
    const pollData = {
      question: showResults ? `Results for ${poll.title}` : poll.title,
      options: pollOptions.map((option, index) => {
        const votes = poll[`votes${index + 1}`];
        const percentOfTotal = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
        const text = showResults ? `${percentOfTotal}%: ${option} (${votes} votes)` : `${index + 1}. ${option}`;
        return { option, votes, text, percentOfTotal };
      }),
    };

    const svg = await satori(
      <div
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#f2f3f5",
          padding: 50,
          lineHeight: 1.2,
          fontSize: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 20,
          }}
        >
          {pollData.options.map((opt, index) => {
            return (
              <div
                key={index}
                style={{
                  backgroundColor: showResults ? "#ff0083" : "",
                  color: "#f2f3f5",
                  padding: 10,
                  marginBottom: 10,
                  borderRadius: 4,
                  width: `${showResults ? opt.percentOfTotal : 100}%`,
                  whiteSpace: "nowrap",
                  overflow: "visible",
                }}
              >
                {opt.text}
              </div>
            );
          })}
        </div>
      </div>,
      {
        width: 600,
        height: 400,
        fonts: [
          {
            data: fontData,
            name: "Roboto",
            style: "normal",
            weight: 400,
          },
        ],
      }
    );

    const pngBuffer = await sharp(Buffer.from(svg)).toFormat("png").toBuffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "max-age=10");
    return res.end(pngBuffer);
  } catch (err) {
    res.statusCode = 500;
    return res.status(500).end("Error generating image");
  }
}
