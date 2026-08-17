/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🔱 APEX-OMNIVERSE SOVEREIGN TITAN v12.0 — NATURAL GEMINI AI BRAIN
 * ══════════════════════════════════════════════════════════════════════════
 * Provides human-level conversational intelligence in natural Hindi, Hinglish,
 * and English. Answers ANY question, chats casually, or analyzes markets & code.
 * ══════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const DEFAULT_GEMINI_KEY = 'YOUR_GEMINI_API_KEY';
const GEMINI_CONFIG_PATH = path.join(rootDir, 'config', 'gemini_config.json');

export function getGeminiApiKey() {

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) return process.env.GEMINI_API_KEY;
  if (fs.existsSync(GEMINI_CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(GEMINI_CONFIG_PATH, 'utf8'));
      if (cfg.apiKey && cfg.apiKey.length > 10) return cfg.apiKey;
    } catch (e) {}
  }
  return DEFAULT_GEMINI_KEY;
}



/**
 * Calls Gemini 3.6 Flash for fluid natural conversations
 * @param {string} userMessage The incoming message from user
 * @param {string} sender Name of the user
 * @param {string} personaContext Special role context ('trader' or 'developer' or 'general')
 * @param {object} extraData Optional live quantitative stock or code data
 * @returns {Promise<string>}
 */
export async function talkToGemini(userMessage, sender = 'Bhai', personaContext = 'trader', extraData = null) {
  const apiKey = getGeminiApiKey();
  const model = 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let systemPrompt = '';
  if (personaContext === 'developer') {
    systemPrompt = `You are Antigravity, Google Deepmind's elite AI Software Engineer and developer partner. ` +
      `You are chatting directly with the user (${sender}) on Telegram. ` +
      `Talk naturally, casually, and warmly in fluent Hinglish (Hindi + English mix) or pure Hindi/English depending on what the user speaks. ` +
      `If the user says 'hi', 'hello', 'kya haal hai', or chats casually, respond warmly like a real close friend and coding buddy. ` +
      `If they ask for coding help, software architecture, or debugging, give clear, master-level guidance. Keep responses concise and formatted with Telegram HTML tags (<b>bold</b>, <i>italic</i>, <code>code</code>, <pre>code blocks</pre>).`;
  } else {
    systemPrompt = `You are Antigravity / APEX Sovereign AI, an elite institutional quant trader and friendly AI companion. ` +
      `You are chatting with the user (${sender}) on Telegram. ` +
      `Talk naturally, casually, and warmly in fluent Hinglish (Hindi + English mix) or pure Hindi/English depending on how the user speaks. ` +
      `If the user says 'hi', 'kya haal hai', 'bhai kya kar raha hai', respond warmly and playfully like a real human friend! ` +
      `You specialize in Indian Equities (NSE/BSE) with a 93.8% Win Rate strategy (14-Pillars, RSI Launchpad < 48, SuperTrend, Piotroski 9/9, ROCE 18%+, Plan-B 60 sessions). ` +
      `If they ask about stocks or markets, explain with institutional authority. Format responses with Telegram HTML tags (<b>bold</b>, <i>italic</i>, <code>code</code>).`;
  }

  if (extraData) {
    systemPrompt += `\n[Context Data]: ${JSON.stringify(extraData)}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser message: "${userMessage}"` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      let reply = data.candidates[0].content.parts[0].text;
      // Convert markdown **bold** to <b>bold</b> and *italic* to <i>italic</i> for Telegram
      reply = reply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      reply = reply.replace(/\*(.*?)\*/g, '<i>$1</i>');
      reply = reply.replace(/`([^`]+)`/g, '<code>$1</code>');
      return reply;
    }
  } catch (err) {
    console.error('[Gemini AI Brain Error]:', err.message);
  }

  return `Hey <b>${sender}</b>! Main bilkul ready hoon. Batao aaj kya chal raha hai — stock analyze karein ya kuch naya build karein? 🚀`;
}
