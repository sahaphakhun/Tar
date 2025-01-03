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

async function fetchSystemInstructions() {
  try {
    const auth = new google.auth.JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/documents.readonly'],
    });
    const docs = google.docs({ version: 'v1', auth });
    const res = await docs.documents.get({ documentId: GOOGLE_DOC_ID });
    const docContent = res.data.body?.content || [];

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
    systemInstructions = fullText.trim();

    console.log('---------- Document Content ----------');
    console.log(systemInstructions);
    console.log('--------------------------------------');
  } catch (error) {
    console.error('Failed to fetch document content:', error.message);
    systemInstructions = "เกิดข้อผิดพลาดในการดึง systemInstructions จาก Google Docs ครับ";
  }
}

app.use(bodyParser.json());

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

app.post('/webhook', async (req, res) => {
  if (req.body.object === 'page') {
    for (const entry of req.body.entry) {
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;

      if (webhookEvent.message && webhookEvent.message.text) {
        const messageText = webhookEvent.message.text;
        const history = await getChatHistory(senderId);
        const assistantResponse = await getAssistantResponse(history, messageText);

        // บันทึกประวัติแชทลง DB
        await saveChatHistory(senderId, messageText, assistantResponse);

        // ตรวจสอบและส่งข้อความกลับหาผู้ใช้
        sendTextMessage(senderId, assistantResponse);

        // *** เพิ่มการเรียกเช็คปิดการขายหลังได้ assistantResponse ***
        checkAndMarkClosed(senderId, assistantResponse);

      } else if (webhookEvent.message && webhookEvent.message.attachments) {
        // มี attachment
        const attachments = webhookEvent.message.attachments;
        const isImageFound = attachments.some(att => att.type === 'image');
        let userMessage = isImageFound
          ? "**ลูกค้าส่งรูปมา**"
          : "**ลูกค้าส่งไฟล์แนบที่ไม่ใช่รูป**";

        const history = await getChatHistory(senderId);
        const assistantResponse = await getAssistantResponse(history, userMessage);

        await saveChatHistory(senderId, userMessage, assistantResponse);
        sendTextMessage(senderId, assistantResponse);

        // *** เพิ่มการเรียกเช็คปิดการขายหลังได้ assistantResponse ***
        checkAndMarkClosed(senderId, assistantResponse);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

let mongoClient = null;

async function connectDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    console.log("MongoDB connected (global client).");
  }
  return mongoClient;
}

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

async function getAssistantResponse(history, message) {
  try {
    const messages = [
      { role: "system", content: systemInstructions },
      ...history,
      { role: "user", content: message },
    ];

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // เลือกรุ่นตามที่คุณต้องการ
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: messages,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error with ChatGPT Assistant:", error);
    return "เกิดข้อผิดพลาดในการเชื่อมต่อกับ Assistant";
  }
}

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

    await collection.insertOne(userChatRecord);
    await collection.insertOne(assistantChatRecord);
    console.log("บันทึกประวัติการแชทสำเร็จ");
  } catch (error) {
    console.error("Error saving chat history:", error);
  }
}

// ------------------------
// เพิ่มฟังก์ชันตรวจสอบ และ mark ปิดการขาย
// ------------------------
async function checkAndMarkClosed(senderId, assistantResponse) {
  // เงื่อนไขง่าย ๆ: ถ้าในข้อความ assistantResponse มีคำว่า
  // “เพื่อเป็นการรับประกันสินค้า รบกวนลูกค้า” ให้ถือว่าปิดการขาย
  if (assistantResponse.includes("ขอบคุณสำหรับการสั่งซื้อสินค้า")) {
    await markSaleAsClosed(senderId);
  }
}

async function addUserToFollowupLabel(psid) {
  return new Promise((resolve, reject) => {
    request({
      uri: `https://graph.facebook.com/v12.0/${LABEL_ID}/label`, // LABEL_ID คือ 1234567890
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: 'POST',
      json: { user: psid },
    }, (err, resBody) => {
      if (err) {
        return reject(err);
      }
      resolve(resBody);
    });
  });
}

async function markSaleAsClosed(senderId) {
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const closedSalesCollection = db.collection("closed_sales");
    await addUserToFollowupLabel(senderId);
    // ใช้ updateOne แบบ upsert เพื่อไม่ต้องแทรก duplicate ถ้าเคยปิดไปแล้ว
    await closedSalesCollection.updateOne(
      { senderId: senderId },
      {
        $set: {
          senderId: senderId,
          closedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log("Sale closed for senderId:", senderId);
  } catch (error) {
    console.error("Error closing sale:", error);
  }
}


// ------------------------

// ------------------------
function sendTextMessage(senderId, response) {
  const Simagex = /\[SEND_IMAGE:(https?:\/\/[^\s]+)\]/g;
  const Simage = [...response.matchAll(Simagex)];

  // ตัดคำสั่ง [SEND_IMAGE:...] ออกจากข้อความที่จะส่ง
  let textPart = response.replace(Simagex, '').trim();

  if (textPart.length > 0) {
    sendSimpleTextMessage(senderId, textPart);
  }
  Simage.forEach(match => {
    const imageUrl = match[1];
    sendImageMessage(senderId, imageUrl);
  });
}

function sendSimpleTextMessage(senderId, text) {
  const requestBody = {
    recipient: { id: senderId },
    message: { text },
  };

  request({
    uri: 'https://graph.facebook.com/v12.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: requestBody,
  }, (err) => {
    if (!err) {
      console.log('ข้อความถูกส่งสำเร็จ!');
    } else {
      console.error('ไม่สามารถส่งข้อความ:', err);
    }
  });
}

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
  }, (err) => {
    if (!err) {
      console.log('รูปภาพถูกส่งสำเร็จ!');
    } else {
      console.error('ไม่สามารถส่งรูปภาพ:', err);
    }
  });
}

// ------------------------
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await connectDB();
    await fetchSystemInstructions();
  } catch (err) {
    console.error("MongoDB connect or Fetch instructions error at startup:", err);
  }
});
