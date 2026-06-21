import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Allow handling base64 images within JSON bodies
app.use(express.json({ limit: "15mb" }));

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const policy_document = `
FoodFix Customer Support Policy

1. Refund Policy
Customers may be eligible for a refund if:
- The order is cancelled by the restaurant.
- The order is not delivered.
- The delivered food is spoiled, unsafe, or not edible.
- A major item is missing from the order.
- The wrong item is delivered.

Refunds are not guaranteed automatically. Final refund approval may require review by the FoodFix support team.

2. Refund Timeline
Once approved, refunds usually take 3 to 7 business days to reflect in the customer's original payment method.
Wallet refunds may reflect faster.

3. Delay Compensation Policy
If an order is delayed, the customer may be eligible for an apology coupon depending on the delay duration and order value.
A delayed order does not always mean automatic refund.
If the customer wants exact live order status, the issue should be escalated to a human agent.

4. Cancellation Policy
Customers can cancel an order before the restaurant starts preparing it.
Once preparation has started, cancellation may not be allowed.
If the order is extremely delayed, FoodFix support may review the case.

5. Coupon Policy
Only one coupon can be applied per order unless clearly mentioned in the offer.
Coupons may fail if the order does not meet minimum order value, restaurant eligibility, location eligibility, or payment method conditions.

6. Missing or Wrong Item Policy
If an item is missing or the wrong item is delivered, the customer should report it through support.
FoodFix may ask for order details or an image.
Refund or replacement depends on verification.

7. Food Quality Policy
If food is spoiled, unsafe, spilled, leaked, or packaging is damaged, the customer should upload a clear image.
FoodFix support will review the complaint.
The customer may be eligible for refund, coupon, or replacement depending on the case.

8. Human Escalation Policy
Escalate to a human agent if:
- The customer asks for a human.
- The issue needs payment verification.
- The issue needs live order tracking.
- The issue is unclear.
- The customer is very angry.
- The AI is not sure about the answer.
`;

const foodQualityPromptTemplate = `You're a helpful assistant of a food service company called food fix,
 please respond to user's query, be courteous.
 Use the following policy document -
 {policy_document}.
 Check the food quality and if the food quality is bad- food is burnt or there is mould then tell him that refund is being processed and also apologize. If the food is not corrupt or there is no mould and it's not burnt, then clearly state you cannot process an automatic refund and escalate the matter to human support.
 Here is the query - {query}.
Use the following historical conversation -
{history_text}`;

const policyPromptTemplate = `You're a helpful assistant of a food service company called food fix,
 please respond to user's query, be courteous.
 Use the following policy document -
 {policy_document}.
 If the question is related to policy then only answer it else say that I'm routing to human support agent
 Here is the query - {query}.
Use the following historical conversation -
{history_text}`;

app.post("/api/chat", async (req, res) => {
  try {
    const { query, history, image } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Format historical messages
    const formattedHistory = (history || [])
      .map((item: any) => `${item.isBot ? "Assistant" : "User"}: ${item.text}`)
      .join("\n");

    // First inspect the text query to check if it represents a food quality complain/issue
    const lowerQuery = query.toLowerCase();
    const isQualityQuery = 
      lowerQuery.includes("quality") || 
      lowerQuery.includes("burnt") || 
      lowerQuery.includes("mould") || 
      lowerQuery.includes("mold") || 
      lowerQuery.includes("spoil") || 
      lowerQuery.includes("rotten") || 
      lowerQuery.includes("hair") || 
      lowerQuery.includes("ruined") || 
      lowerQuery.includes("bad food") || 
      lowerQuery.includes("corrupt");

    // If it's quality-related but no image is uploaded yet, request one.
    if (isQualityQuery && !image) {
      return res.json({
        text: "I am sorry to hear that you have food quality concerns. 📸 Please upload a photo of your food so I can check its quality and process a refund for you.",
        requireImageUpload: true,
        category: "food_quality"
      });
    }

    if (image) {
      // Use food quality prompt with the image attached
      const finalPrompt = foodQualityPromptTemplate
        .replace("{policy_document}", policy_document)
        .replace("{query}", query)
        .replace("{history_text}", formattedHistory);

      const imagePart = {
        inlineData: {
          mimeType: image.mimeType,
          data: image.data, // base64 payload
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [finalPrompt, imagePart],
      });

      return res.json({
        text: response.text,
        category: "food_quality"
      });
    } else {
      // Policy prompt
      const finalPrompt = policyPromptTemplate
        .replace("{policy_document}", policy_document)
        .replace("{query}", query)
        .replace("{history_text}", formattedHistory);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: finalPrompt,
      });

      return res.json({
        text: response.text,
        category: "policy"
      });
    }
  } catch (err: any) {
    console.error("Gemini API error:", err);
    return res.status(500).json({ error: err.message || "An error occurred with Gemini assistant" });
  }
});

async function startServer() {
  // Vite middleware for development, static file serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
