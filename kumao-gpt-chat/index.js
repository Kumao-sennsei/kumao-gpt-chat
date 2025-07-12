require('dotenv').config();
const express = require("express");
const { middleware, Client } = require("@line/bot-sdk");
const axios = require("axios");

const app = express();

// ✅ LINE Botの設定（ReplitのSecretsに設定）
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// ✅ OpenAIのAPIキー（ReplitのSecretsに設定）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ LINE Bot用クライアント
const client = new Client(config);

// ✅ webhookの受け口
app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = await Promise.all(events.map(handleEvent));
  res.json(results);
});

// ✅ イベント処理（テキスト or 画像対応）
async function handleEvent(event) {
  if (event.type !== "message") return null;

  // ✅ ユーザーが画像を送ってきた場合（写真質問）
  if (event.message.type === "image") {
    const imageUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
    const imageBuffer = await axios
      .get(imageUrl, {
        responseType: "arraybuffer",
        headers: { Authorization: `Bearer ${config.channelAccessToken}` },
      })
      .then((res) => res.data);

    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const visionResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "画像を見て質問に答えてください。",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "この画像からわかることを教えてください。",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const replyText = visionResponse.data.choices[0].message.content;
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText,
    });
  }

  // ✅ テキストメッセージ対応
  const userMessage = event.message.text;

  const completion = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたはていねいで優しい先生くまお先生です。",
        },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1000,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  const replyText = completion.data.choices[0].message.content;
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: replyText,
  });
}

// ✅ サーバー起動
app.listen(3000, () => {
  console.log("✅ くまお先生接続中ポート：3000");
});
