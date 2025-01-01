// ------------------------
// server.js
// ------------------------
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const { OpenAI } = require('openai');
const { MongoClient } = require('mongodb');

// สร้าง Express App
const app = express();
const PORT = process.env.PORT || 3000;

// ตัวแปร Environment
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "XianTA1234";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MONGO_URI = process.env.MONGO_URI;

// สร้าง OpenAI Instance
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY, // ใช้ API key จาก Environment Variable
});

// สร้าง MongoClient
const client = new MongoClient(MONGO_URI);

// ใช้ bodyParser
app.use(bodyParser.json());

// ------------------------
// System Instructions (ไม่แก้ไขหรือตัดทอน)
// ------------------------
const systemInstructions = `


`;

// ------------------------
// Facebook Webhook Verify
// ------------------------
app.get('/webhook', (req, res) => {
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
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(async (entry) => {
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;

      // 1) กรณีลูกค้าส่งข้อความปกติ
      if (webhookEvent.message && webhookEvent.message.text) {
        const messageText = webhookEvent.message.text;

        // ดึงประวัติการแชทจาก MongoDB
        const history = await getChatHistory(senderId);

        // เรียก Assistant (ChatGPT) โดยส่ง System Instructions + ประวัติสนทนา + ข้อความใหม่
        const assistantResponse = await getAssistantResponse(history, messageText);

        // บันทึกประวัติใหม่ลงใน MongoDB
        await saveChatHistory(senderId, messageText, assistantResponse);

        // ตอบกลับผู้ใช้ทาง Messenger
        sendTextMessage(senderId, assistantResponse);

      }
      // 2) กรณีลูกค้าส่งรูป (หรือ attachment) แต่ไม่มี text
      else if (webhookEvent.message && webhookEvent.message.attachments) {
        const attachments = webhookEvent.message.attachments;
        let isImageFound = false;

        // ตรวจสอบว่ามีภาพใน attachments หรือไม่
        for (let att of attachments) {
          if (att.type === 'image') {
            isImageFound = true;
            break;
          }
        }

        if (isImageFound) {
          // หากพบว่าเป็นรูปภาพ ให้บอก ChatGPT ว่า “ลูกค้าส่งรูปมา”
          const userMessage = "**ลูกค้าส่งรูปมา**";

          // ดึงประวัติการแชท
          const history = await getChatHistory(senderId);

          // เรียก Assistant
          const assistantResponse = await getAssistantResponse(history, userMessage);

          // บันทึกลงใน MongoDB
          await saveChatHistory(senderId, userMessage, assistantResponse);

          // ตอบกลับผู้ใช้
          sendTextMessage(senderId, assistantResponse);
        } else {
          // หากเป็นไฟล์แนบอื่น เช่น location, file, audio...
          const userMessage = "**ลูกค้าส่งไฟล์แนบที่ไม่ใช่รูป**";
          const history = await getChatHistory(senderId);
          const assistantResponse = await getAssistantResponse(history, userMessage);

          await saveChatHistory(senderId, userMessage, assistantResponse);

          sendTextMessage(senderId, assistantResponse);
        }
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// ------------------------
// ฟังก์ชัน: getChatHistory
// ------------------------
async function getChatHistory(senderId) {
  try {
    await client.connect();
    const db = client.db("chatbot");
    const collection = db.collection("chat_history");

    const chats = await collection.find({ senderId }).toArray();

    // แปลงเป็นรูปแบบข้อความตาม role: "user"
    return chats.map((chat) => ({
      role: "user",
      content: chat.message,
    }));
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  } finally {
    await client.close();
  }
}

// ------------------------
// ฟังก์ชัน: getAssistantResponse
// ------------------------
async function getAssistantResponse(history, message) {
  try {
    // รวม system instructions + history + user message
    const messages = [
      { role: "system", content: systemInstructions },
      ...history,
      { role: "user", content: message },
    ];

    // เรียกโมเดลผ่าน OpenAI API (เปลี่ยนชื่อโมเดลตามต้องการ)
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // ตัวอย่างโมเดล
      messages: messages,
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
async function saveChatHistory(senderId, message, response) {
  try {
    await client.connect();
    const db = client.db("chatbot");
    const collection = db.collection("chat_history");

    const chatRecord = {
      senderId,
      message,
      response,
      timestamp: new Date(),
    };
    await collection.insertOne(chatRecord);

    console.log("บันทึกประวัติการแชทสำเร็จ");
  } catch (error) {
    console.error("Error saving chat history:", error);
  } finally {
    await client.close();
  }
}

// ------------------------
// ฟังก์ชัน: sendTextMessage (รองรับหลายรูปพร้อมกัน)
// ------------------------
function sendTextMessage(senderId, response) {
  // Regex แบบ global เพื่อจับหลายคำสั่ง [SEND_IMAGE_XXX:URL]
  const imageRegex = /\[SEND_IMAGE_(HUNN|SROI):(https?:\/\/[^\s]+)\]/g;

  // matchAll เพื่อดึง match หลายรายการ
  const matches = [...response.matchAll(imageRegex)];

  // ตัดคำสั่ง [SEND_IMAGE_XXX:URL] ออกจากข้อความทั้งหมด
  let textPart = response.replace(imageRegex, '').trim();

  // ส่งข้อความ (ถ้ามี text เหลือ)
  if (textPart.length > 0) {
    sendSimpleTextMessage(senderId, textPart);
  }

  // วนลูปส่งรูปทีละ match
  matches.forEach(match => {
    const imageUrl = match[2];  // URL
    sendImageMessage(senderId, imageUrl);
  });
}

// ------------------------
// ฟังก์ชัน: sendSimpleTextMessage
// ------------------------
function sendSimpleTextMessage(senderId, text) {
  const requestBody = {
    recipient: { id: senderId },
    message: { text: text },
  };

  request({
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err, res, body) => {
    if (!err) {
      console.log('ข้อความถูกส่งสำเร็จ!');
    } else {
      console.error('ไม่สามารถส่งข้อความ:', err);
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
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err, res, body) => {
    if (!err) {
      console.log('รูปภาพถูกส่งสำเร็จ!');
    } else {
      console.error('ไม่สามารถส่งรูปภาพ:', err);
    }
  });
}

// ------------------------
// Start Server
// ------------------------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
