// ------------------------
// index.js
// ------------------------
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const { OpenAI } = require('openai');
const { google } = require('googleapis');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "XianTA1234";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

const GOOGLE_CLIENT_EMAIL = "aitar-888@eminent-wares-446512-j8.iam.gserviceaccount.com";
const GOOGLE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDGhyeINArKZgaV\nitEcK+o89ilPYeRNTNZgJT7VNHB5hgNLLeAcFLJ7IlCIqTLMoJEnnoDQil6aKaz8\nExVL83uSXRrzk4zQvtt3tIP31+9wOCb9D4ZGWfVP1tD0qdD4WJ1qqg1j1/8879pH\nUeQGEMuCnyVbcQ3GbYQjyYb3wEz/Qv7kMVggF+MIaGGw2NQwM0XcufSFtyxvvX2S\nb8uGc1A8R+Dn/tmcgMODhbtEgcMg6yXI5Y26MPfDjVrEbk0lfCr7IGFJX4ASYeKl\n0jhm0RGb+aya2cb55auLN3VPO5MQ+cOp8gHBf5GiC/YgF1gbRgF5b7LgmENBxSfH\nb3WVQodLAgMBAAECggEACKB14M7LdekXZHyAQrZL0EitbzQknLv33Xyw2B3rvJ7M\nr4HM/nC4eBj7y+ciUc8GZQ+CWc2GzTHTa66+mwAia1qdYbPp3LuhGM4Leq5zn/o+\nA3rJuG6PS4qyUMy89msPXW5fSj/oE535QREiFKYP2dtlia2GI4xoag+x9uZwfMUO\nWKEe7tiUoZQEiGhwtjLq9lyST4kGGmlhNee9OyhDJcw4uCt8Cepr++hMDleWUF6c\nX0nbGmoSS0sZ5Boy8ATMhw/3luaOAlTUEz/nVDvbbWlNL9etwLKiAVw+AQXsPHNW\nNWF7gyEIsEi0qSM3PtA1X7IdReRXHqmfiZs0J3qSQQKBgQD1+Yj37Yuqj8hGi5PY\n+M0ieMdGcbUOmJsM1yUmBMV4bfaTiqm504P6DIYAqfDDWeozcHwcdpG1AfFAihEi\nh6lb0qRk8YaGbzvac8mWhwo/jDA5QB97fjFa6uwtlewZ0Er/U3QmOeVVnVC1y1b0\nrbJD5yjvI3ve+gpwAz0glpIMiwKBgQDOnpD7p7ylG4NQunqmzzdozrzZP0L6EZyE\n141st/Hsp9rtO9/ADuH6WhpirQ516l5LLv7mLPA8S9CF/cSdWF/7WlxBPjM8WRs9\nACFNBJIwUfjzPnvECmtsayzRlKuyCAspnNSkzgtdtvf2xI82Z3BGov9goZfu+D4A\n36b1qXsIQQKBgQCO1CojhO0vyjPKOuxL9hTvqmBUWFyBMD4AU8F/dQ/RYVDn1YG+\npMKi5Li/E+75EHH9EpkO0g7Do3AaQNG4UjwWVJcfAlxSHa8Mp2VsIdfilJ2/8KsX\nQ2yXVYh04/Rn/No/ro7oT4AKmcGu/nbstxuncEgFrH4WOOzspATPsn72BwKBgG5N\nBAT0NKbHm0B7bIKkWGYhB3vKY8zvnejk0WDaidHWge7nabkzuLtXYoKO9AtKxG/K\ndNUX5F+r8XO2V0HQLd0XDezecaejwgC8kwp0iD43ZHkmQBgVn+dPB6wSe94coSjj\nyjj4reSnipQ3tmRKsAtldIN3gI5YA3Gf85dtlHqBAoGAD5ePt7cmu3tDZhA3A8f9\no8mNPvqz/WGs7H2Qgjyfc3jUxEGhVt1Su7J1j+TppfkKtJIDKji6rVA9oIjZtpZT\ngxnU6hcYuiwbLh3wGEFIjP1XeYYILudqfWOEbwnxD1RgMkCqfSHf/niWlfiH6p3F\ndnBsLY/qXdKfS/OXyezAm4M=\n-----END PRIVATE KEY-----\n";
const GOOGLE_DOC_ID = "1JUSUxuuWCt50w_qpJyT2pYiApJJXFHMhwiox05G11uA";

let systemInstructions = "";

// ------------------------
// ฟังก์ชัน: fetchSystemInstructions
// ------------------------
async function fetchSystemInstructions() {
  try {
    // สร้าง JWT Auth
    const auth = new google.auth.JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });

    // สร้าง instance ของ Google Docs API
    const docs = google.docs({ version: 'v1', auth });

    // ดึงข้อมูลเอกสาร
    const res = await docs.documents.get({ documentId: GOOGLE_DOC_ID });
    const docContent = res.data.body?.content || [];

    // ดึงข้อความทั้งหมดจากเอกสาร
    let fullText = '';
    docContent.forEach((struct) => {
      if (struct.paragraph?.elements) {
        struct.paragraph.elements.forEach((elem) => {
          if (elem.textRun?.content) {
            fullText += elem.textRun.content;
          }
        });
      }
    });

    // กำหนดค่า systemInstructions เป็นสตริง
    systemInstructions = fullText.trim();

    console.log('---------- Document Content ----------');
    console.log(systemInstructions);
    console.log('--------------------------------------');
  } catch (error) {
    console.error('Failed to fetch document content:', error.message);
    systemInstructions = "เกิดข้อผิดพลาดในการดึง systemInstructions จาก Google Docs ครับ";
  }
}

// ------------------------
// เรียกใช้ bodyParser
// ------------------------
app.use(bodyParser.json());

// ------------------------
// Facebook Webhook Verify
// ------------------------
app.get('/webhook', (req, res) => {
  console.log("GET /webhook query:", JSON.stringify(req.query, null, 2));
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ------------------------
// Facebook Webhook Receiver
// ------------------------
app.post('/webhook', async (req, res) => {
  try {
    // แสดง body ทั้งหมดเพื่อดูว่าเป็น event อะไร
    console.log("POST /webhook body:", JSON.stringify(req.body, null, 2));

    // ตรวจสอบว่า object ของ webhook เป็น "page" หรือไม่
    if (req.body.object === 'page') {
      // ตรวจสอบว่า req.body.entry เป็นอาร์เรย์หรือไม่
      if (!Array.isArray(req.body.entry)) {
        console.log("No 'entry' array found in webhook body.");
        return res.status(200).send('EVENT_RECEIVED'); 
      }

      // วน loop ใน req.body.entry
      for (const entry of req.body.entry) {
        // ตรวจสอบว่า entry.messaging มีอยู่จริง เป็น array และ length > 0
        if (!entry.messaging || !Array.isArray(entry.messaging) || entry.messaging.length === 0) {
          console.log("No 'messaging' array or empty => skip this entry.");
          continue;
        }

        const webhookEvent = entry.messaging[0];

        // ตรวจสอบ webhookEvent.sender?.id เพื่อความชัวร์
        if (!webhookEvent.sender || !webhookEvent.sender.id) {
          console.log("No sender ID found in webhookEvent => skip this event.");
          continue;
        }

        const senderId = webhookEvent.sender.id;

        // ตรวจสอบประเภทของ event
        if (webhookEvent.message && webhookEvent.message.text) {
          // เคสข้อความ (Text)
          const messageText = webhookEvent.message.text;

          // เรียกประวัติแชท
          const history = await getChatHistory(senderId);
          // ให้ Assistant ตอบ
          const assistantResponse = await getAssistantResponse(history, messageText);
          // บันทึกและส่งข้อความ
          await saveChatHistory(senderId, messageText, assistantResponse);
          sendTextMessage(senderId, assistantResponse);

        } else if (webhookEvent.message && webhookEvent.message.attachments) {
          // เคสไฟล์แนบ (Attachments)
          const attachments = webhookEvent.message.attachments;
          const isImageFound = attachments.some(att => att.type === 'image');

          let userMessage = "";
          if (isImageFound) {
            userMessage = "**ลูกค้าส่งรูปมา**";
          } else {
            userMessage = "**ลูกค้าส่งไฟล์แนบที่ไม่ใช่รูป**";
          }

          const history = await getChatHistory(senderId);
          const assistantResponse = await getAssistantResponse(history, userMessage);
          await saveChatHistory(senderId, userMessage, assistantResponse);
          sendTextMessage(senderId, assistantResponse);

        } else {
          // ไม่เข้าข่ายข้อความหรือไฟล์แนบ
          console.log("Unhandled event type or structure:", JSON.stringify(webhookEvent, null, 2));
        }
      }

      // ตอบกลับ Facebook ว่าได้รับ event แล้ว
      return res.status(200).send('EVENT_RECEIVED');
    } 
    
    // ถ้า object ไม่ใช่ 'page' -> 404
    return res.sendStatus(404);

  } catch (error) {
    console.error("Error in /webhook POST: ", error);
    return res.sendStatus(500);
  }
});

/*
  แทนที่จะเปิด-ปิด MongoDB Client ในทุกฟังก์ชัน
  เราจะใช้ global client ตัวเดียว
*/
let mongoClient = null;

// ------------------------
// ฟังก์ชัน: เชื่อมต่อ MongoDB (Global client)
// ------------------------
async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("MongoDB connected (global client).");
  }
  return mongoClient;
}

// ------------------------
// ฟังก์ชัน: getChatHistory
// ------------------------
async function getChatHistory(senderId) {
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const collection = db.collection("chat_history");

    const chats = await collection.find({ senderId }).sort({ timestamp: 1 }).toArray();
    return chats.map(chat => ({
      role: chat.role,
      content: chat.content,
    }));
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }
}

// ------------------------
// ฟังก์ชัน: getAssistantResponse
// ------------------------
async function getAssistantResponse(history, message) {
  try {
    const messages = [
      { role: "system", content: systemInstructions },
      ...history,
      { role: "user", content: message },
    ];

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // คุณอาจเปลี่ยนโมเดลเป็น gpt-3.5-turbo หรือรุ่นอื่น ๆ ตามต้องการ
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      temperature: 0.5
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error("Error with ChatGPT Assistant:", error);
    return "เกิดข้อผิดพลาดในการเชื่อมต่อกับ Assistant";
  }
}

// ------------------------
// ฟังก์ชัน: saveChatHistory
// ------------------------
async function saveChatHistory(senderId, userMessage, assistantResponse) {
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const collection = db.collection("chat_history");

    const userChatRecord = {
      senderId,
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    const assistantChatRecord = {
      senderId,
      role: "assistant",
      content: assistantResponse,
      timestamp: new Date(),
    };

    // บันทึกข้อความของผู้ใช้
    await collection.insertOne(userChatRecord);
    // บันทึกข้อความของผู้ช่วย
    await collection.insertOne(assistantChatRecord);

    console.log("บันทึกประวัติการแชทสำเร็จ");
  } catch (error) {
    console.error("Error saving chat history:", error);
  }
}

// ------------------------
// ฟังก์ชัน: sendTextMessage
// ------------------------
function sendTextMessage(senderId, response) {
  const Simagex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
  const Simage = [...response.matchAll(Simagex)];

  // ตัดคำสั่ง [SEND_IMAGE:...] ออกจากข้อความที่จะส่ง
  let textPart = response.replace(Simagex, '').trim();

  // ส่งข้อความปกติ (ถ้ามี)
  if (textPart.length > 0) {
    sendSimpleTextMessage(senderId, textPart);
  }

  // ส่งรูป (ถ้ามี [SEND_IMAGE:...])
  Simage.forEach(match => {
    const imageUrl = match[1];
    sendImageMessage(senderId, imageUrl);
  });
}

// ------------------------
// ฟังก์ชัน: sendSimpleTextMessage
// ------------------------
function sendSimpleTextMessage(senderId, text) {
  const requestBody = {
    recipient: { id: senderId },
    message: { text },
  };

  request({
    uri: 'https://graph.facebook.com/v17.0/me/messages', // ปรับเป็น v17.0
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err, resFB, bodyFB) => {
    if (err) {
      console.error('ส่งข้อความไม่สำเร็จ (มี error):', err);
    } else {
      // ตรวจสอบ response จาก Facebook (bodyFB)
      if (bodyFB && bodyFB.error) {
        console.error("ส่งข้อความไม่สำเร็จ (Facebook error):", bodyFB.error);
      } else {
        console.log('ส่งข้อความสำเร็จ! responseFB =', bodyFB);
      }
    }
  });
}

// ------------------------
// ฟังก์ชัน: sendImageMessage
// ------------------------
function sendImageMessage(senderId, imageUrl) {
  const requestBody = {
    recipient: { id: senderId },
    message: {
      attachment: {
        type: 'image',
        payload: {
          url: imageUrl,
          is_reusable: true,
        },
      },
    },
  };

  request({
    uri: 'https://graph.facebook.com/v17.0/me/messages', // ปรับเป็น v17.0
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err, resFB, bodyFB) => {
    if (err) {
      console.error('ไม่สามารถส่งรูปภาพ:', err);
    } else {
      if (bodyFB && bodyFB.error) {
        console.error("ส่งรูปภาพไม่สำเร็จ (Facebook error):", bodyFB.error);
      } else {
        console.log('รูปภาพถูกส่งสำเร็จ! responseFB =', bodyFB);
      }
    }
  });
}

// ------------------------
// Start Server
// ------------------------
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  // เรียกเชื่อม MongoDB ตอน start server
  try {
    await connectDB();

    // ดึง systemInstructions จาก Google Docs ทันทีที่เซิร์ฟเวอร์เริ่ม
    await fetchSystemInstructions();

  } catch (err) {
    console.error("MongoDB connect or Fetch instructions error at startup:", err);
  }
});
