/*******************************************************
 * index.js (โค้ดเต็ม – ฉบับตัดทอน เพื่อดึงข้อมูลจาก Sheets)
 * - ใช้ Express + body-parser (Webhook สำหรับ Facebook)
 * - MongoDB เก็บประวัติแชท
 * - ดึง systemInstructions จาก Google Docs + Google Sheets
 * - ใช้ OpenAI GPT ตอบ
 ********************************************************/

const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');
const { OpenAI } = require('openai');

const app = express();
app.use(bodyParser.json());

// ====================== 1) ENV Config ======================
const PORT = process.env.PORT || 3000;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "XianTA1234";
const MONGO_URI = process.env.MONGO_URI;

const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";
const GOOGLE_DOC_ID = "1-fSovnXKbRmSu45T_oeT2vnZOfqcDkkO0Xk3VaBZhpg";   // ใส่ ID ของ Google Docs
const SPREADSHEET_ID = "1cNJOeVYqwl29CLDWBUurmKHQzVIqoiIF434nkqbAWNY"; // ใส่ ID ของ Google Sheets
const SHEET_RANGE = "ชีต1!A2:B18";               // ช่วงข้อมูลใน Google Sheets

// ====================== 2) MongoDB ======================
let mongoClient = null;

async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("MongoDB connected (global).");
  }
  return mongoClient;
}

async function getChatHistory(senderId) {
  console.log(">> [MongoDB] getChatHistory START", senderId, new Date().toISOString());
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  const chats = await coll.find({ senderId }).sort({ timestamp: 1 }).toArray();
  console.log(">> [MongoDB] getChatHistory END", senderId, new Date().toISOString());
  return chats.map(ch => ({
    role: ch.role,
    content: ch.content,
  }));
}

async function saveChatHistory(senderId, userMsg, assistantMsg) {
  console.log(">> [MongoDB] saveChatHistory START", senderId, new Date().toISOString());
  const client = await connectDB();
  const db = client.db("chatbot");
  const coll = db.collection("chat_history");
  await coll.insertOne({
    senderId,
    role: "user",
    content: userMsg,
    timestamp: new Date(),
  });
  await coll.insertOne({
    senderId,
    role: "assistant",
    content: assistantMsg,
    timestamp: new Date(),
  });
  console.log(">> [MongoDB] saveChatHistory END", senderId, new Date().toISOString());
}

// ====================== 3) ดึง systemInstructions จาก Google Docs ======================
let googleDocInstructions = "";

async function fetchGoogleDocInstructions() {
  try {
    const auth = new google.auth.JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });
    const docs = google.docs({ version: 'v1', auth });
    const res = await docs.documents.get({ documentId: GOOGLE_DOC_ID });
    const docBody = res.data.body?.content || [];

    let fullText = '';
    docBody.forEach(block => {
      if (block.paragraph?.elements) {
        block.paragraph.elements.forEach(elem => {
          if (elem.textRun?.content) {
            fullText += elem.textRun.content;
          }
        });
      }
    });

    googleDocInstructions = fullText.trim();
    console.log("Fetched Google Doc instructions OK.");
  } catch (err) {
    console.error("Failed to fetch systemInstructions:", err);
    googleDocInstructions = "Error fetching system instructions.";
  }
}

// ====================== 4) ดึงข้อมูลจาก Google Sheets + แปลงเป็น JSON ======================
async function getSheetsApi() {
  const sheetsAuth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: sheetsAuth });
}

async function fetchSheetData(spreadsheetId, range) {
  try {
    const sheetsApi = await getSheetsApi();
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log("No data found in sheet.");
      return [];
    }
    return rows;
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return [];
  }
}

function transformSheetRowsToJSON(rows) {
  // สมมติแถวแรก (คอลัมน์ A,B) ไม่มี header (หรือข้ามไปแล้ว)
  // เราจะเก็บเป็น { title: row[0], content: row[1] }
  const result = rows.map(row => {
    return {
      title: row[0] || "",
      content: row[1] || ""
    };
  });
  return result;
}

let sheetJSON = [];  // เก็บข้อมูลจาก Sheets

// ====================== 5) สร้าง systemInstructions (ผสาน Docs + Sheets) ======================
function buildSystemInstructions() {
  // ใส่ข้อมูลจาก Sheets เป็น JSON String
  const sheetsDataString = JSON.stringify(sheetJSON, null, 2);

  // ผสานกับข้อความจาก Google Docs
  const finalSystemInstructions = `
คุณเป็นแชทบอท AI สำหรับ "เซียนต้าร์ พุทธคุณ" เพื่อขายสินค้า
ด้านล่างนี้เป็นคำแนะนำจาก Google Doc:
---
${googleDocInstructions}

ด้านล่างนี้เป็นข้อมูลเพิ่มเติมจาก Google Sheets:
---
${sheetsDataString}

Rules:
- Please use the data above as reference for answering user questions.
- If not related, you may answer as usual.
`.trim();

  return finalSystemInstructions;
}

// ====================== 6) เรียก GPT ======================
async function getAssistantResponse(systemInstructions, history, userMessage) {
  try {
    console.log(">> [OpenAI] Start request:", new Date().toISOString());
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const messages = [
      { role: "system", content: systemInstructions },
      ...history,
      { role: "user", content: userMessage },
    ];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // หรือ gpt-4
      messages,
      temperature: 0.5,
    });
    console.log(">> [OpenAI] Response received:", new Date().toISOString());

    const assistantReply = response.choices[0].message.content.trim();
    return assistantReply;
  } catch (error) {
    console.error("Error getAssistantResponse:", error);
    return "ขออภัยค่ะ ระบบขัดข้องชั่วคราว ไม่สามารถตอบได้ในขณะนี้";
  }
}

// ====================== 7) ฟังก์ชันส่งข้อความกลับ Facebook ======================
function sendTextMessage(senderId, response) {
  // ถ้ามีแท็ก [SEND_IMAGE:URL] ให้แยกส่งรูปออกไป
  const imageRegex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
  const images = [...response.matchAll(imageRegex)];

  let textPart = response.replace(imageRegex, '').trim();

  if (textPart.length > 0) {
    sendSimpleTextMessage(senderId, textPart);
  }
  for (const match of images) {
    const imageUrl = match[1];
    sendImageMessage(senderId, imageUrl);
  }
}

function sendSimpleTextMessage(senderId, text) {
  const reqBody = {
    recipient: { id: senderId },
    message: { text }
  };
  request({
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: reqBody
  }, (err) => {
    if (!err) console.log("ส่งข้อความสำเร็จ!");
    else console.error("ไม่สามารถส่งข้อความ:", err);
  });
}

function sendImageMessage(senderId, imageUrl) {
  const reqBody = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: 'image',
        payload: { url: imageUrl, is_reusable: true }
      }
    }
  };
  request({
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: reqBody
  }, (err) => {
    if (!err) console.log("ส่งรูปภาพสำเร็จ!");
    else console.error("ไม่สามารถส่งรูปภาพ:", err);
  });
}

// ====================== 8) Webhook Routes & Startup ======================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  if (req.body.object === 'page') {
    for (const entry of req.body.entry) {
      // ตรวจสอบก่อนว่า messaging มีหรือไม่
      if (!entry.messaging || entry.messaging.length === 0) {
        console.log(">> [Webhook] No messaging in this entry. Skipping:", JSON.stringify(entry));
        continue;
      }

      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender && webhookEvent.sender.id;
      if (!senderId) {
        console.log(">> [Webhook] No sender found. Skipping this event:", webhookEvent);
        continue;
      }

      console.log(">> [Webhook] Event received:", senderId, new Date().toISOString());

      // ===== 1) เคสเป็น "ข้อความ" แบบ text =====
      if (webhookEvent.message && webhookEvent.message.text) {
        const userMsg = webhookEvent.message.text;
        console.log(">> [Webhook] userMsg:", userMsg);

        console.log(">> [Webhook] Start getChatHistory", new Date().toISOString());
        const history = await getChatHistory(senderId);
        console.log(">> [Webhook] Done getChatHistory", new Date().toISOString());

        const systemInstructions = buildSystemInstructions();

        console.log(">> [Webhook] Start getAssistantResponse", new Date().toISOString());
        const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);
        console.log(">> [Webhook] Done getAssistantResponse", new Date().toISOString());

        console.log(">> [Webhook] Start saveChatHistory", new Date().toISOString());
        await saveChatHistory(senderId, userMsg, assistantMsg);
        console.log(">> [Webhook] Done saveChatHistory", new Date().toISOString());

        sendTextMessage(senderId, assistantMsg);

      // ===== 2) เคสเป็นไฟล์แนบ (attachments) =====
      } else if (webhookEvent.message && webhookEvent.message.attachments) {
        const attachments = webhookEvent.message.attachments;
        const hasImage = attachments.some(a => a.type === 'image');

        // === 2.1) ถ้ามีไฟล์แนบเป็นรูปภาพ
        if (hasImage) {
          console.log(">> [Webhook] User sent image(s).");
          let userMsg = "**ลูกค้าส่งรูปมา**";

          console.log(">> [Webhook] Start getChatHistory", new Date().toISOString());
          const history = await getChatHistory(senderId);
          console.log(">> [Webhook] Done getChatHistory", new Date().toISOString());

          const systemInstructions = buildSystemInstructions();

          console.log(">> [Webhook] Start getAssistantResponse", new Date().toISOString());
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);
          console.log(">> [Webhook] Done getAssistantResponse", new Date().toISOString());

          console.log(">> [Webhook] Start saveChatHistory", new Date().toISOString());
          await saveChatHistory(senderId, userMsg, assistantMsg);
          console.log(">> [Webhook] Done saveChatHistory", new Date().toISOString());

          sendTextMessage(senderId, assistantMsg);

        // === 2.2) ถ้าเป็นไฟล์แนบประเภทอื่น (เช่น documents, location, etc.)
        } else {
          console.log(">> [Webhook] User sent attachment (non-image).");
          let userMsg = "**ลูกค้าส่งไฟล์แนบ**";

          console.log(">> [Webhook] Start getChatHistory", new Date().toISOString());
          const history = await getChatHistory(senderId);
          console.log(">> [Webhook] Done getChatHistory", new Date().toISOString());

          const systemInstructions = buildSystemInstructions();

          console.log(">> [Webhook] Start getAssistantResponse", new Date().toISOString());
          const assistantMsg = await getAssistantResponse(systemInstructions, history, userMsg);
          console.log(">> [Webhook] Done getAssistantResponse", new Date().toISOString());

          console.log(">> [Webhook] Start saveChatHistory", new Date().toISOString());
          await saveChatHistory(senderId, userMsg, assistantMsg);
          console.log(">> [Webhook] Done saveChatHistory", new Date().toISOString());

          sendTextMessage(senderId, assistantMsg);
        }

      // ===== 3) กรณีอื่น ๆ
      } else {
        console.log(">> [Webhook] Received event but not a text or recognized attachment:", webhookEvent);
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});


app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT} - ${new Date().toISOString()}`);

  try {
    // 1) เชื่อมต่อ DB
    await connectDB();

    // 2) ดึง instructions จาก Google Docs
    await fetchGoogleDocInstructions();

    // 3) ดึงข้อมูลจาก Sheets
    const rows = await fetchSheetData(SPREADSHEET_ID, SHEET_RANGE);
    sheetJSON = transformSheetRowsToJSON(rows);

  } catch (err) {
    console.error("Startup error:", err);
  }
});
