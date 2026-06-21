import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import chatHandler from "./api/chat";

dotenv.config();

const app = express();
const PORT = 3000;

// Allow handling base64 images within JSON bodies
app.use(express.json({ limit: "15mb" }));

// Call the shared Vercel serverless function handler directly
app.post("/api/chat", chatHandler);

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
