/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🔱 ANTIGRAVITY AI DEVELOPER BOT (TELEGRAM PAIR-PROGRAMMING AGENT)
 * ══════════════════════════════════════════════════════════════════════════
 * A dedicated Telegram Bot to pair-program with Antigravity directly from your phone!
 *  - Full Project Generation ("/build <app idea>" or "bana de ek ...")
 *  - Automated GitHub Repository Creation & Push
 *  - Terminal Command Execution ("/run <command>")
 *  - Natural Conversational Gemini 3.6 Flash Pair-Programmer (Hindi/English)
 * ══════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { createGitHubRepoAndPush, getGitHubConfig, saveGitHubConfig, fetchGitHubUser } from './src/github_cloud_creator.js';
import { talkToGemini } from './src/gemini_natural_brain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// ⚙️ Dedicated Antigravity Bot Configuration
const DEV_BOT_CONFIG_PATH = path.join(__dirname, 'config', 'dev_bot_config.json');

export function getDevBotConfig() {
  let cfg = {
    botToken: process.env.DEV_BOT_TOKEN || "YOUR_DEV_BOT_TOKEN",
    allowedChatId: process.env.TELEGRAM_CHAT_ID || "5489148234",
    geminiApiKey: process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY",
    workspaceRoot: rootDir
  };
  if (fs.existsSync(DEV_BOT_CONFIG_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(DEV_BOT_CONFIG_PATH, 'utf8'));
      if (saved.botToken) cfg.botToken = saved.botToken;
      if (saved.geminiApiKey) cfg.geminiApiKey = saved.geminiApiKey;
    } catch (e) {}
  }
  return cfg;
}



const config = getDevBotConfig();
let lastUpdateId = 0;

/**
 * Sends formatted message to Telegram
 */
async function sendDevMessage(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
  } catch (e) {
    console.error('[Antigravity Bot] Send Error:', e.message);
  }
}

/**
 * Executes a terminal command on the host PC
 */
function executeTerminalCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: config.workspaceRoot }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout ? stdout.substring(0, 3000) : '',
        stderr: stderr ? stderr.substring(0, 1000) : '',
        error: err ? err.message : null
      });
    });
  });
}

/**
 * Calls Gemini AI to design and build an application
 */
async function buildAppFromPrompt(chatId, appDescription) {
  await sendDevMessage(chatId,
    `🛠️ <b>Antigravity Agent Activated!</b>\n\n` +
    `📋 <b>Task:</b> <i>"${appDescription}"</i>\n\n` +
    `⏳ <i>Designing full-stack architecture, writing components & server logic...</i>`
  );

  const slug = 'app_' + Date.now();
  const targetDir = path.join(config.workspaceRoot, slug);
  fs.mkdirSync(targetDir, { recursive: true });

  const prompt = `You are Antigravity, an elite full-stack software engineer. ` +
    `The user wants to build: "${appDescription}". ` +
    `Generate the complete production code files (HTML, CSS, JavaScript, Node.js server, or Python). ` +
    `Return ONLY a valid JSON object matching this schema: {"projectName": "${slug}", "files": [{"filename": "index.html", "content": "..."}, {"filename": "server.js", "content": "..."}]}. Do not include markdown ticks outside the JSON.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${config.geminiApiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsed = JSON.parse(text);
    if (parsed.files && Array.isArray(parsed.files)) {
      parsed.files.forEach(file => {
        const filePath = path.join(targetDir, file.filename);
        fs.writeFileSync(filePath, file.content, 'utf8');
      });

      // Push to GitHub if configured
      let githubNotice = '';
      try {
        const ghRes = await createGitHubRepoAndPush(slug, appDescription, parsed.files);
        if (ghRes.success) {
          githubNotice = `\n🔗 <b>GitHub Cloud Repo:</b> <a href="${ghRes.repoUrl}">${ghRes.repoUrl}</a>\n`;
        }
      } catch (ghErr) {}

      await sendDevMessage(chatId,
        `✅ <b>Application Built Successfully!</b>\n\n` +
        `📁 <b>Local PC Folder:</b> <code>${targetDir}</code>\n` +
        githubNotice +
        `📝 <b>Files Generated (${parsed.files.length}):</b>\n` +
        parsed.files.map(f => `• <code>${f.filename}</code>`).join('\n') +
        `\n\n🚀 <b>To Launch:</b> Open folder and start server!`
      );
    }
  } catch (err) {
    await sendDevMessage(chatId, `⚠️ <b>Build Note:</b> Directory created at <code>${targetDir}</code>. Detail: ${err.message}`);
  }
}

/**
 * Handles incoming developer commands & programming discussions
 */
async function handleDevMessage(msg) {
  const chatId = msg.chat?.id;
  const raw = (msg.text || '').trim();
  const lower = raw.toLowerCase();
  const sender = msg.from?.first_name || 'Developer';

  console.log(`[Antigravity Dev Bot] 💬 ${sender}: "${raw}"`);

  // 1. Command: /build <app idea> or "bana de ek ..."
  if (lower.startsWith('/build ') || lower.startsWith('build ') || lower.startsWith('bana de ') || lower.startsWith('create app ')) {
    const task = raw.replace(/^\/(build)\s+/i, '').replace(/^(build|bana de|create app)\s+/i, '').trim();
    await buildAppFromPrompt(chatId, task);
    return;
  }

  // 2. Command: /run <terminal command>
  if (lower.startsWith('/run ') || lower.startsWith('run ')) {
    const cmd = raw.replace(/^\/(run)\s+/i, '').replace(/^run\s+/i, '').trim();
    await sendDevMessage(chatId, `⚡ <b>Executing Terminal Command:</b>\n<code>${cmd}</code>`);
    const output = await executeTerminalCommand(cmd);
    let reply = `📋 <b>Execution Result:</b>\n`;
    if (output.stdout) reply += `<pre>${output.stdout}</pre>\n`;
    if (output.stderr) reply += `⚠️ <b>Stderr:</b>\n<pre>${output.stderr}</pre>\n`;
    if (output.error) reply += `❌ <b>Error:</b> ${output.error}`;
    await sendDevMessage(chatId, reply);
    return;
  }

  // 3. Command: /github <token> [optional username]
  if (lower.startsWith('/github ') || lower.startsWith('github ') || lower.startsWith('ghp_')) {
    const rawTokenInput = raw.replace(/^\/(github)\s+/i, '').replace(/^github\s+/i, '').trim();
    const parts = rawTokenInput.split(/\s+/);
    const token = parts[0].trim();
    let username = parts[1] ? parts[1].trim() : '';

    await sendDevMessage(chatId, `🔍 <i>Verifying GitHub Token...</i>`);

    if (!username) {
      const userRes = await fetchGitHubUser(token);
      if (userRes.success && userRes.username) {
        username = userRes.username;
      } else {
        await sendDevMessage(chatId, `❌ <b>GitHub Error:</b> Could not verify token. Detail: ${userRes.error}`);
        return;
      }
    }

    saveGitHubConfig({
      githubToken: token,
      githubUsername: username,
      enabled: true
    });

    await sendDevMessage(chatId, `✅ <b>GitHub Linked Successfully!</b>\n\n👤 <b>Username:</b> <code>@${username}</code>\n🚀 <i>All future <code>/build</code> apps will automatically create new GitHub repositories under your account!</i>`);
    return;
  }

  // 4. NATURAL CONVERSATIONAL AI BRAIN (Hinglish/English like talking to Gemini!)
  const reply = await talkToGemini(raw, sender, 'developer');
  await sendDevMessage(chatId, reply);
}

/**
 * Starts Long-Polling Developer Agent
 */
export async function startDevBot() {
  console.log(`[Antigravity Dev Bot] 🚀 Antigravity Developer Bot is LIVE and listening with Gemini 3.6 Flash...`);
  while (true) {
    try {
      const url = `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const u of data.result) {
          lastUpdateId = u.update_id;
          if (u.message && u.message.text) {
            await handleDevMessage(u.message);
          }
        }
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startDevBot();
}
