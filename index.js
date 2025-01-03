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
const GOOGLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9...<etc>...QKBgQ==\n-----END PRIVATE KEY-----\n`;
const GOOGLE_DOC_ID = "1PF5GxEHCVaMAYyrwLCcX_6gmQm3beCz2Ss1pz2A-NHA";

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
  if (assistantResponse.includes("เพื่อเป็นการรับประกันสินค้า รบกวนลูกค้า")) {
    await markSaleAsClosed(senderId);
  }
}

async function markSaleAsClosed(senderId) {
  try {
    const client = await connectDB();
    const db = client.db("chatbot");
    const closedSalesCollection = db.collection("closed_sales");

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
