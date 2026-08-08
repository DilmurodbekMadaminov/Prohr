import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import express from "express";
import compression from "compression";
import { LRUCache } from "lru-cache";
import { Agent } from "https";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { doc, getDoc, setDoc, collection, getDocs, onSnapshot, increment } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase.js";

class SimpleQueue {
  private concurrency: number;
  private running = 0;
  private queue: (() => Promise<void>)[] = [];

  constructor({ concurrency }: { concurrency: number }) {
    this.concurrency = concurrency;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = async () => {
        try {
          const res = await fn();
          resolve(res);
        } catch (err) {
          reject(err);
        } finally {
          this.running--;
          this.next();
        }
      };

      this.queue.push(task);
      this.next();
    });
  }

  private next() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.running++;
        task();
      }
    }
  }
}

// ================= PROCESS STABILITY & UNCAUGHT ERROR PROTECTION =================
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
});

const rawBotToken =
  process.env.BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_TOKEN ||
  process.env.BOTTOKEN ||
  process.env.TOKEN ||
  process.env.TELEGRAM_API_TOKEN;

const BOT_TOKEN = rawBotToken ? rawBotToken.trim().replace(/^["']|["']$/g, '') : undefined;
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || process.env.TELEGRAM_CHANNEL || "https://t.me/Xorazm_ish_elon_uz";
const ADMIN_ID = (process.env.ADMIN_ID || process.env.TELEGRAM_ADMIN_ID) ? Number(process.env.ADMIN_ID || process.env.TELEGRAM_ADMIN_ID) : undefined;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Memory caches for ultra-fast response
const subCache = new LRUCache<number, boolean>({ max: 50000, ttl: 1000 * 60 * 60 * 24 }); // 24 hours cache for subscribed users
const pendingCheckSub = new Map<number, Promise<boolean>>(); // Deduplicate simultaneous checkSubscription calls
const settingsCache = new Map<string, string>();
const messageQueue = new SimpleQueue({ concurrency: 50 }); // Process up to 50 messages concurrently

if (!BOT_TOKEN) {
  console.warn("⚠️ Warning: BOT_TOKEN is missing. Telegram bot features will be disabled.");
}

// Enable KeepAlive for much faster Telegram API requests by reusing TLS connections
const httpsAgent = new Agent({ keepAlive: true, maxSockets: 100, timeout: 5000 });
const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN, {
  telegram: { agent: httpsAgent }
}) : null;

if (bot) {
  bot.catch((err: any, ctx: any) => {
    console.error(`⚠️ Telegraf error on update ${ctx?.updateType}:`, err?.message || err);
  });
}

const WEBHOOK_PATH = "/telegraf/webhook";

const app = express();
app.use(compression());
app.use(express.json());

let statsCache = {
  usersCount: 0,
  totalHdp: 0,
  totalHdpVodiy: 0,
  totalOmonUrganch: 0,
  totalOmonGurlan: 0,
  totalOmonShovot: 0,
  totalOmonAll: 0,
};

// Health check endpoints for Railway and monitoring
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/api/health", (req, res) => res.status(200).json({ status: "ok" }));

// Mount Telegraf webhook middleware BEFORE static and wildcard routes
if (bot) {
  const handleWebhook = bot.webhookCallback();
  app.post(WEBHOOK_PATH, (req, res, next) => {
    handleWebhook(req, res, next);
  });
  app.get(WEBHOOK_PATH, (req, res) => {
    res.send("Telegram Webhook endpoint active.");
  });
}

// ================= DATABASE =================
async function initDb() {
  const defaults: Record<string, string> = {
    hdp_link: 'https://forms.gle/f6ZiQtiqCAH1CLy87',
    hdp_vodiy_link: 'https://forms.gle/dVVii5PdmqqvQe8Y7',
    omon_link: 'https://docs.google.com/forms/d/e/1FAIpQLSda7OhEe_fFn1TDfmzvpjzyvoRQhHLCUMYl1ojKLPJZVYsglg/viewform?usp=publish-editor',
    omon_urganch_link: 'https://docs.google.com/forms/d/e/1FAIpQLSda7OhEe_fFn1TDfmzvpjzyvoRQhHLCUMYl1ojKLPJZVYsglg/viewform?usp=publish-editor',
    omon_gurlan_link: 'https://docs.google.com/forms/d/e/1FAIpQLSfO59InkqjPVYwJTqsXwFS-RuDilzNMTEzz5hMv56SXqZqFjA/viewform?usp=publish-editor',
    omon_shovot_link: 'https://docs.google.com/forms/d/e/1FAIpQLSesCuKlxEQUzacWRFlHJWMot662B4D9dN2-ZGLKU2h-WxyR3g/viewform?usp=header',
    channel_username: CHANNEL_USERNAME
  };

  for (const [k, v] of Object.entries(defaults)) {
    settingsCache.set(k, v);
  }

  try {
    // Attach realtime snapshot listener for settings (0ms latency updates)
    onSnapshot(collection(db, 'settings'), (snapshot) => {
      snapshot.forEach((docSnap) => {
        if (docSnap.data()?.value) {
          settingsCache.set(docSnap.id, docSnap.data().value);
        }
      });
    }, (err) => console.error("Settings snapshot notice:", err.message));

    // Attach realtime snapshot listener for user stats (0ms API response)
    onSnapshot(collection(db, 'users'), (snapshot) => {
      let totalHdp = 0;
      let totalHdpVodiy = 0;
      let totalOmonUrganch = 0;
      let totalOmonGurlan = 0;
      let totalOmonShovot = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        totalHdp += data.hdp || 0;
        totalHdpVodiy += data.hdp_vodiy || 0;
        totalOmonUrganch += data.omon_urganch || 0;
        totalOmonGurlan += data.omon_gurlan || 0;
        totalOmonShovot += data.omon_shovot || 0;
      });

      statsCache = {
        usersCount: snapshot.size,
        totalHdp,
        totalHdpVodiy,
        totalOmonUrganch,
        totalOmonGurlan,
        totalOmonShovot,
        totalOmonAll: totalOmonUrganch + totalOmonGurlan + totalOmonShovot
      };
    }, (err) => console.error("Users snapshot notice:", err.message));

    const settingsSnap = await getDocs(collection(db, 'settings')).catch(() => null);
    for (const [key, defVal] of Object.entries(defaults)) {
      if (!settingsSnap || !settingsSnap.docs.some(d => d.id === key)) {
        const docRef = doc(db, 'settings', key);
        setDoc(docRef, { value: defVal }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, `settings/${key}`));
      }
    }
    // Update omon_gurlan_link and channel_username specifically to the requested URLs
    const gurlanUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSfO59InkqjPVYwJTqsXwFS-RuDilzNMTEzz5hMv56SXqZqFjA/viewform?usp=publish-editor';
    const channelUrl = 'https://t.me/Xorazm_ish_elon_uz';
    settingsCache.set('omon_gurlan_link', gurlanUrl);
    settingsCache.set('channel_username', channelUrl);
    setDoc(doc(db, 'settings', 'omon_gurlan_link'), { value: gurlanUrl }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'settings/omon_gurlan_link'));
    setDoc(doc(db, 'settings', 'channel_username'), { value: channelUrl }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'settings/channel_username'));
  } catch (err: any) {
    console.error("initDb notice:", err.message);
  }
}

// Synchronous fast getter from memory (0ms execution)
function getSettingSync(key: string, fallback: string = ""): string {
  return settingsCache.get(key) || fallback;
}

async function setSetting(key: string, value: string) {
  settingsCache.set(key, value); // Apply to cache instantly for 0ms response
  const docRef = doc(db, 'settings', key);
  setDoc(docRef, { value }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, `settings/${key}`));
}

function checkIsAdmin(userId: number): boolean {
  if (!userId) return false;
  if (ADMIN_ID && userId === ADMIN_ID) return true;
  const dbAdminStr = getSettingSync('admin_id') || process.env.ADMIN_ID;
  if (dbAdminStr) {
    const ids = String(dbAdminStr).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (ids.includes(userId)) return true;
  }
  return false;
}

const adminState = new Map<number, string>();

// Global Broadcast State & Lock
let activeBroadcast = {
  inProgress: false,
  total: 0,
  success: 0,
  fail: 0,
  startedAt: null as string | null,
  finishedAt: null as string | null,
  notifyAdminId: null as number | null
};

let globalPauseUntil = 0;
const rateLimitTimestamps: number[] = [];
const MAX_PER_SECOND = 28; // Maximum safe rate near Telegram's 30 msgs/sec global cap

async function waitForRateLimitToken(): Promise<void> {
  while (true) {
    const now = Date.now();
    if (globalPauseUntil > now) {
      await new Promise((r) => setTimeout(r, globalPauseUntil - now + 50));
      continue;
    }

    // Clean up timestamps older than 1 second (1000 ms)
    while (rateLimitTimestamps.length > 0 && rateLimitTimestamps[0] <= now - 1000) {
      rateLimitTimestamps.shift();
    }

    if (rateLimitTimestamps.length < MAX_PER_SECOND) {
      rateLimitTimestamps.push(now);
      return;
    }

    const oldest = rateLimitTimestamps[0];
    const waitMs = Math.max(10, 1000 - (now - oldest) + 5);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}

async function sendTelegramMessageSafely(
  sendFn: (user_id: number) => Promise<any>,
  targetUserId: number
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const now = Date.now();
    if (globalPauseUntil > now) {
      await new Promise((r) => setTimeout(r, globalPauseUntil - now + 50));
    }

    try {
      await sendFn(targetUserId);
      return true;
    } catch (err: any) {
      const errorMsg = err?.message || String(err) || "";
      const is429 =
        errorMsg.includes("429") ||
        errorMsg.includes("Too Many Requests") ||
        err?.code === 429 ||
        err?.response?.error_code === 429;

      if (is429) {
        const retryAfterSec =
          err?.parameters?.retry_after ||
          err?.response?.parameters?.retry_after ||
          5;
        const waitMs = retryAfterSec * 1000 + 1000;
        globalPauseUntil = Date.now() + waitMs;
        console.warn(
          `[Broadcast] 429 Rate limit hit for user ${targetUserId}. Global pause for ${waitMs}ms...`
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      // Non-retryable user errors (bot blocked, account deleted, chat not found)
      if (
        errorMsg.includes("403") ||
        errorMsg.includes("blocked") ||
        errorMsg.includes("deactivated") ||
        errorMsg.includes("chat not found") ||
        errorMsg.includes("user not found") ||
        errorMsg.includes("bot was blocked")
      ) {
        return false;
      }

      // Transient error - brief pause before retry
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return false;
}

// Helper to broadcast a message to all registered users asynchronously without 429 conflicts
async function broadcastToAllUsers(
  sendFn: (user_id: number) => Promise<any>,
  adminIdToNotify?: number
): Promise<{ total: number; success: number; fail: number }> {
  if (activeBroadcast.inProgress) {
    throw new Error(
      `Hozirda xabar tarqatilmoqda (${activeBroadcast.success + activeBroadcast.fail}/${activeBroadcast.total}). Iltimos tugashini kuting!`
    );
  }

  const userIdsSet = new Set<number>();

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.isBanned || data.banned || data.status === 'banned') return;

      const possibleIds = [
        docSnap.id,
        data.user_id,
        data.userId,
        data.id,
        data.telegram_id,
        data.chat_id,
        data.uid,
        data.tg_id
      ];
      for (const p of possibleIds) {
        if (p) {
          const num = Number(p);
          if (num && !isNaN(num) && num > 0) {
            userIdsSet.add(num);
          }
        }
      }
    });
  } catch (err) {
    console.error("Firestore getDocs error in broadcastToAllUsers:", err);
  }

  // Include configured admin ID(s)
  const dbAdminStr = getSettingSync('admin_id') || process.env.ADMIN_ID;
  if (dbAdminStr) {
    String(dbAdminStr).split(',').forEach(s => {
      const num = Number(s.trim());
      if (num && !isNaN(num) && num > 0) {
        userIdsSet.add(num);
      }
    });
  }
  if (ADMIN_ID) {
    userIdsSet.add(ADMIN_ID);
  }

  const userIds = Array.from(userIdsSet);

  if (userIds.length === 0) {
    return { total: 0, success: 0, fail: 0 };
  }

  activeBroadcast = {
    inProgress: true,
    total: userIds.length,
    success: 0,
    fail: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    notifyAdminId: adminIdToNotify || null
  };

  // Dispatch parallel background workers with sliding window rate limiting
  (async () => {
    const MAX_CONCURRENCY = 12;
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= userIds.length) break;

        const targetUserId = userIds[i];
        await waitForRateLimitToken();
        const sent = await sendTelegramMessageSafely(sendFn, targetUserId);
        if (sent) {
          activeBroadcast.success++;
        } else {
          activeBroadcast.fail++;
        }
      }
    };

    const workerPromises = [];
    const poolSize = Math.min(MAX_CONCURRENCY, userIds.length);
    for (let c = 0; c < poolSize; c++) {
      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);

    activeBroadcast.inProgress = false;
    activeBroadcast.finishedAt = new Date().toISOString();
    console.log(`[Broadcast] Done! Total: ${activeBroadcast.total}, Sent: ${activeBroadcast.success}, Failed: ${activeBroadcast.fail}`);

    if (activeBroadcast.notifyAdminId && bot) {
      bot.telegram
        .sendMessage(
          activeBroadcast.notifyAdminId,
          `✅ Xabar tarqatish yakunlandi!\n\n` +
          `Jami foydalanuvchilar: ${activeBroadcast.total} ta\n` +
          `Muvaffaqiyatli yetib bordi: ${activeBroadcast.success} ta\n` +
          `Yetib bormadi (bloklagan): ${activeBroadcast.fail} ta`
        )
        .catch(() => {});
    }
  })();

  return { total: userIds.length, success: 0, fail: 0 };
}

// Ultra-fast deduplicated non-blocking subscription check with instant caching
async function checkSubscription(ctx: any): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;

  // 1. Instant LRU cache lookup (0ms)
  if (subCache.has(userId)) {
    return subCache.get(userId) ?? true;
  }

  // 2. Deduplicate concurrent requests from the same user clicking rapidly
  if (pendingCheckSub.has(userId)) {
    return pendingCheckSub.get(userId)!;
  }

  // 3. Create check promise with 800ms timeout & aggressive fallback caching
  const promise = (async (): Promise<boolean> => {
    try {
      const rawChannel = getSettingSync('channel_username', CHANNEL_USERNAME);
      let channelId = rawChannel.trim();
      
      if (channelId.includes('t.me/')) {
        const parts = channelId.split('t.me/');
        const username = parts[1].replace(/\/$/, '');
        if (!username.startsWith('+') && !channelId.includes('joinchat')) {
          channelId = '@' + username;
        }
      } else if (!channelId.startsWith('@') && !channelId.startsWith('-') && !channelId.startsWith('http')) {
        channelId = '@' + channelId;
      }

      const memberPromise = ctx.telegram.getChatMember(channelId, userId);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Telegram API timeout")), 800)
      );

      const member: any = await Promise.race([memberPromise, timeoutPromise]);

      const isSubscribed = (
        member.status === "member" ||
        member.status === "creator" ||
        member.status === "administrator"
      );
      
      subCache.set(userId, isSubscribed, { ttl: isSubscribed ? 1000 * 60 * 60 * 24 : 1000 * 30 });
      return isSubscribed;
    } catch (err: any) {
      // Fallback: Cache as true so subsequent button clicks do NOT hang or lag
      subCache.set(userId, true, { ttl: 1000 * 60 * 60 * 24 });
      return true;
    } finally {
      pendingCheckSub.delete(userId);
    }
  })();

  pendingCheckSub.set(userId, promise);
  return promise;
}

// Utility to fix any URL string from DB before passing to Telegram Markup
function formatButtonUrl(url: string | null | undefined): string {
  if (!url) return "https://telegram.org";
  let cleaned = url.trim();
  if (cleaned.startsWith('@')) {
    return `https://t.me/${cleaned.replace(/^@/, "")}`;
  }
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

function subscriptionKeyboard() {
  const channel = getSettingSync('channel_username', CHANNEL_USERNAME);
  const channelUrl = formatButtonUrl(channel);

  return Markup.inlineKeyboard([
    [Markup.button.url("Obuna bo'lish", channelUrl)],
    [Markup.button.callback("Tekshirish", "check_sub")],
  ]);
}

function mainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [{ text: "HDP LC" }, { text: "HDP LC Vodiy" }],
        [{ text: "Omon school Urganch filiali" }, { text: "Omon school Gurlan filiali" }],
        [{ text: "Omon school Shovot filiali" }]
      ],
      resize_keyboard: true,
      is_persistent: true
    }
  };
}

// Fast non-blocking background analytics
function trackBranchClick(userId: number, branchField: string) {
  // Always keep user cached as active/subscribed
  subCache.set(userId, true, { ttl: 1000 * 60 * 60 * 24 });

  (async () => {
    try {
      const userRef = doc(db, 'users', String(userId));
      const updateData: Record<string, any> = {};
      updateData[branchField] = increment(1);
      if (branchField !== 'hdp' && branchField !== 'hdp_vodiy') {
        updateData['omon'] = increment(1);
      }
      await setDoc(userRef, updateData, { merge: true });
    } catch (e: any) {
      // Ignore background analytics error to keep user experience instant
    }
  })();
}

// ================= BOT HANDLERS =================
if (bot) {
  // Ensure every user interacting with bot is recorded in Firestore 'users' collection
  bot.use(async (ctx, next) => {
    if (ctx.from && ctx.from.id) {
      const uId = ctx.from.id;
      (async () => {
        try {
          const uRef = doc(db, 'users', String(uId));
          await setDoc(uRef, {
            user_id: uId,
            firstName: ctx.from.first_name || '',
            username: ctx.from.username || '',
            lastActive: new Date().toISOString()
          }, { merge: true });
          statsCache.usersCount = 0; // invalidate cache so next /api/stats call gets live count
        } catch (e) {}
      })();
    }
    return next();
  });

  // Priority middleware: Intercept admin state inputs (broadcast, links, channel) BEFORE any bot.hears/bot.command
  bot.use(async (ctx, next) => {
    if (ctx.from && ctx.from.id && ctx.message) {
      const userId = ctx.from.id;
      if (checkIsAdmin(userId) && adminState.has(userId)) {
        const msg = ctx.message as any;
        const text = msg.text || '';

        // Allow admin to cancel if they type /cancel or Bekor qilish
        if (text === '/cancel' || text === '❌ Bekor qilish' || text === 'Bekor qilish') {
          adminState.delete(userId);
          await ctx.reply("❌ Amal bekor qilindi.");
          await sendAdminPanel(ctx);
          return;
        }

        const state = adminState.get(userId);

        if (state === "awaiting_broadcast" || state === "awaiting_broadcast_msg") {
          adminState.delete(userId);
          if (activeBroadcast.inProgress) {
            await ctx.reply(`⚠️ Hozirda xabar tarqatish jarayoni ketmoqda (${activeBroadcast.success + activeBroadcast.fail}/${activeBroadcast.total}). Iltimos, tugashini kuting.`);
            return;
          }

          await ctx.reply("⏳ Reklama / Xabar barcha foydalanuvchilarga tarqatilmoqda, kuting...");

          try {
            const res = await broadcastToAllUsers(async (targetUserId) => {
              await ctx.copyMessage(targetUserId);
            }, userId);
            if (res.total === 0) {
              await ctx.reply("⚠️ Botda foydalanuvchilar topilmadi.");
            }
          } catch (e: any) {
            await ctx.reply(`❌ Xabar tarqatishda xatolik yuz berdi: ${e.message}`);
          }
          return;
        }

        if (!text) {
          await ctx.reply("Iltimos, matn yoki havola (link) yuboring.");
          return;
        }

        if (state === "awaiting_channel") {
          subCache.clear();
          let cleanedChannel = text.trim();
          if (!cleanedChannel.startsWith('http')) {
             if (cleanedChannel.startsWith('@')) {
                 cleanedChannel = `https://t.me/${cleanedChannel.replace('@', '')}`;
             } else if (!cleanedChannel.startsWith('-')) {
                 cleanedChannel = `https://t.me/${cleanedChannel}`;
             }
          }
          await setSetting('channel_username', cleanedChannel);
          await ctx.reply(`✅ Kanal muvaffaqiyatli o'zgartirildi!\nYangi havola: ${cleanedChannel}`);
        } else if (state === "awaiting_hdp") {
          await setSetting('hdp_link', text.trim());
          await ctx.reply("✅ HDP LC silkasi o'zgartirildi!");
        } else if (state === "awaiting_hdp_vodiy") {
          await setSetting('hdp_vodiy_link', text.trim());
          await ctx.reply("✅ HDP LC Vodiy silkasi o'zgartirildi!");
        } else if (state === "awaiting_omon_urganch") {
          await setSetting('omon_urganch_link', text.trim());
          await ctx.reply("✅ Omon School Urganch filiali silkasi o'zgartirildi!");
        } else if (state === "awaiting_omon_gurlan") {
          await setSetting('omon_gurlan_link', text.trim());
          await ctx.reply("✅ Omon School Gurlan filiali silkasi o'zgartirildi!");
        } else if (state === "awaiting_omon_shovot") {
          await setSetting('omon_shovot_link', text.trim());
          await ctx.reply("✅ Omon School Shovot filiali silkasi o'zgartirildi!");
        }

        adminState.delete(userId);
        await sendAdminPanel(ctx);
        return;
      }
    }
    return next();
  });

  bot.start(async (ctx) => {
    const userId = ctx.from.id;

    // Save user to DB in background
    (async () => {
      try {
        const userRef = doc(db, 'users', String(userId));
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, { hdp: 0, hdp_vodiy: 0, omon: 0, omon_urganch: 0, omon_gurlan: 0, omon_shovot: 0 });
        }
      } catch (e) {}
    })();

    const subscribed = await checkSubscription(ctx);
    if (!subscribed) {
      return ctx.reply("Botdan foydalanish uchun kanalga obuna bo‘ling:", subscriptionKeyboard());
    }

    subCache.set(userId, true, { ttl: 1000 * 60 * 60 * 24 });
    return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
  });

  bot.action("check_sub", async (ctx) => {
    ctx.answerCbQuery("Kanal obunasi tekshirilmoqda...").catch(() => {});
    const userId = ctx.from.id;
    subCache.delete(userId);
    const subscribed = await checkSubscription(ctx);

    if (!subscribed) {
      return ctx.reply("❌ Siz hali kanalga obuna bo‘lmadingiz! Iltimos, kanalga obuna bo‘lib, qayta 'Tekshirish' tugmasini bosing:", subscriptionKeyboard());
    }

    // Explicitly cache as subscribed for 24 hours so all buttons work instantly
    subCache.set(userId, true, { ttl: 1000 * 60 * 60 * 24 });

    await ctx.deleteMessage().catch(() => {});
    return ctx.reply("✅ Obuna tasdiqlandi! Ish joyini tanlang:", mainMenuKeyboard());
  });

  bot.hears([/^hdp lc vodiy$/i, /^hdp vodiy$/i, "HDP LC Vodiy", "HDP LC vodiy", "HDP Vodiy", "HDP vodiy", "HDP Vodiy filiali", "HDP Vodiy filial"], async (ctx) => {
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }

      trackBranchClick(ctx.from.id, 'hdp_vodiy');
      
      const vodiyLink = getSettingSync('hdp_vodiy_link') || 'https://forms.gle/dVVii5PdmqqvQe8Y7';
      const safeUrl = formatButtonUrl(vodiyLink);

      return await ctx.reply("HDP LC Vodiy filiali uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", safeUrl)],
      ]));
    } catch (err: any) {
      console.error("HDP Vodiy hears error:", err);
      return ctx.reply("HDP LC Vodiy filiali uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", "https://forms.gle/dVVii5PdmqqvQe8Y7")],
      ])).catch(() => {});
    }
  });

  bot.hears([/^hdp lc$/i, /^hdp$/i, "HDP LC", "HDP"], async (ctx) => {
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }

      trackBranchClick(ctx.from.id, 'hdp');
      
      const hdpLink = getSettingSync('hdp_link') || 'https://forms.gle/f6ZiQtiqCAH1CLy87';
      const safeUrl = formatButtonUrl(hdpLink);

      return await ctx.reply("HDP LC uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", safeUrl)],
      ]));
    } catch (err: any) {
      console.error("HDP hears error:", err);
      return ctx.reply("HDP LC uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", "https://forms.gle/f6ZiQtiqCAH1CLy87")],
      ])).catch(() => {});
    }
  });

  bot.hears([/^omon school urganch filiali$/i, /^urganch filiali$/i, /^urganch$/i, "Omon school Urganch filiali", "Omon school Urganch filial", "Urganch filiali"], async (ctx) => {
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }

      trackBranchClick(ctx.from.id, 'omon_urganch');
      
      const omonLink = getSettingSync('omon_urganch_link') || getSettingSync('omon_link') || 'https://docs.google.com/forms/d/e/1FAIpQLSda7OhEe_fFn1TDfmzvpjzyvoRQhHLCUMYl1ojKLPJZVYsglg/viewform?usp=publish-editor';
      const safeUrl = formatButtonUrl(omonLink);

      return await ctx.reply("Omon School (Urganch filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", safeUrl)],
      ]));
    } catch (err: any) {
      console.error("Urganch hears error:", err);
      return ctx.reply("Omon School (Urganch filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", "https://docs.google.com/forms/d/e/1FAIpQLSda7OhEe_fFn1TDfmzvpjzyvoRQhHLCUMYl1ojKLPJZVYsglg/viewform?usp=publish-editor")],
      ])).catch(() => {});
    }
  });

  bot.hears([/^omon school gurlan filiali$/i, /^gurlan filiali$/i, /^gurlan$/i, "Omon school Gurlan filiali", "Omon school Gurlan filial", "Gurlan filiali", "Gurlan filial", "Gurlan"], async (ctx) => {
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }

      trackBranchClick(ctx.from.id, 'omon_gurlan');
      
      const omonLink = getSettingSync('omon_gurlan_link') || getSettingSync('omon_link') || 'https://docs.google.com/forms/d/e/1FAIpQLSfO59InkqjPVYwJTqsXwFS-RuDilzNMTEzz5hMv56SXqZqFjA/viewform?usp=publish-editor';
      const safeUrl = formatButtonUrl(omonLink);

      return await ctx.reply("Omon School (Gurlan filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", safeUrl)],
      ]));
    } catch (err: any) {
      console.error("Gurlan hears error:", err);
      return ctx.reply("Omon School (Gurlan filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", "https://docs.google.com/forms/d/e/1FAIpQLSfO59InkqjPVYwJTqsXwFS-RuDilzNMTEzz5hMv56SXqZqFjA/viewform?usp=publish-editor")],
      ])).catch(() => {});
    }
  });

  bot.hears([/^omon school shovot filiali$/i, /^shovot filiali$/i, /^shovot$/i, "Omon school Shovot filiali", "Omon school Shovot filial", "Shovot filiali"], async (ctx) => {
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }

      trackBranchClick(ctx.from.id, 'omon_shovot');
      
      const omonLink = getSettingSync('omon_shovot_link') || getSettingSync('omon_link') || 'https://docs.google.com/forms/d/e/1FAIpQLSesCuKlxEQUzacWRFlHJWMot662B4D9dN2-ZGLKU2h-WxyR3g/viewform?usp=header';
      const safeUrl = formatButtonUrl(omonLink);

      return await ctx.reply("Omon School (Shovot filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", safeUrl)],
      ]));
    } catch (err: any) {
      console.error("Shovot hears error:", err);
      return ctx.reply("Omon School (Shovot filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", "https://docs.google.com/forms/d/e/1FAIpQLSesCuKlxEQUzacWRFlHJWMot662B4D9dN2-ZGLKU2h-WxyR3g/viewform?usp=header")],
      ])).catch(() => {});
    }
  });

  bot.action([/urganch/i, "branch_omon_urganch"], async (ctx) => {
    ctx.answerCbQuery().catch(() => {});
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }

      trackBranchClick(ctx.from.id, 'omon_urganch');
      
      const omonLink = getSettingSync('omon_urganch_link') || getSettingSync('omon_link') || 'https://docs.google.com/forms/d/e/1FAIpQLSda7OhEe_fFn1TDfmzvpjzyvoRQhHLCUMYl1ojKLPJZVYsglg/viewform?usp=publish-editor';
      const safeUrl = formatButtonUrl(omonLink);

      return await ctx.reply("Omon School (Urganch filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", safeUrl)],
      ]));
    } catch (err: any) {
      return ctx.reply("Omon School (Urganch filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", "https://docs.google.com/forms/d/e/1FAIpQLSda7OhEe_fFn1TDfmzvpjzyvoRQhHLCUMYl1ojKLPJZVYsglg/viewform?usp=publish-editor")],
      ])).catch(() => {});
    }
  });

  bot.action([/gurlan/i, "branch_omon_gurlan"], async (ctx) => {
    ctx.answerCbQuery().catch(() => {});
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }

      trackBranchClick(ctx.from.id, 'omon_gurlan');
      
      const omonLink = getSettingSync('omon_gurlan_link') || getSettingSync('omon_link') || 'https://docs.google.com/forms/d/e/1FAIpQLSfO59InkqjPVYwJTqsXwFS-RuDilzNMTEzz5hMv56SXqZqFjA/viewform?usp=publish-editor';
      const safeUrl = formatButtonUrl(omonLink);

      return await ctx.reply("Omon School (Gurlan filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", safeUrl)],
      ]));
    } catch (err: any) {
      return ctx.reply("Omon School (Gurlan filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", "https://docs.google.com/forms/d/e/1FAIpQLSfO59InkqjPVYwJTqsXwFS-RuDilzNMTEzz5hMv56SXqZqFjA/viewform?usp=publish-editor")],
      ])).catch(() => {});
    }
  });

  bot.action([/shovot/i, "branch_omon_shovot"], async (ctx) => {
    ctx.answerCbQuery().catch(() => {});
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }

      trackBranchClick(ctx.from.id, 'omon_shovot');
      
      const omonLink = getSettingSync('omon_shovot_link') || getSettingSync('omon_link') || 'https://docs.google.com/forms/d/e/1FAIpQLSesCuKlxEQUzacWRFlHJWMot662B4D9dN2-ZGLKU2h-WxyR3g/viewform?usp=header';
      const safeUrl = formatButtonUrl(omonLink);

      return await ctx.reply("Omon School (Shovot filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", safeUrl)],
      ]));
    } catch (err: any) {
      return ctx.reply("Omon School (Shovot filiali) uchun ariza topshirish:", Markup.inlineKeyboard([
        [Markup.button.url("Ariza topshirish", "https://docs.google.com/forms/d/e/1FAIpQLSesCuKlxEQUzacWRFlHJWMot662B4D9dN2-ZGLKU2h-WxyR3g/viewform?usp=header")],
      ])).catch(() => {});
    }
  });

  bot.command("myid", (ctx) => {
    ctx.reply(`Sizning Telegram ID raqamingiz: <code>${ctx.from.id}</code>\n\nShu raqamni nusxalab, AI Studio yoxud Railway "Variables" bo'limiga <b>ADMIN_ID</b> nomi bilan qo'shing. Shundan so'ng botni qayta ishga tushirsangiz /admin buyrug'i ishlaydi.`, { parse_mode: "HTML" });
  });

  async function sendAdminPanel(ctx: any) {
    let usersSnap: any = { docs: [], size: 0, forEach: () => {} };
    try {
      usersSnap = await getDocs(collection(db, 'users'));
    } catch(e) {}
    
    let totalHdp = 0;
    let totalHdpVodiy = 0;
    let totalOmonUrganch = 0;
    let totalOmonGurlan = 0;
    let totalOmonShovot = 0;
    usersSnap.forEach((docSnap: any) => {
      const data = docSnap.data();
      totalHdp += data.hdp || 0;
      totalHdpVodiy += data.hdp_vodiy || 0;
      totalOmonUrganch += data.omon_urganch || 0;
      totalOmonGurlan += data.omon_gurlan || 0;
      totalOmonShovot += data.omon_shovot || 0;
    });
    
    const usersCount = usersSnap.size || 0;

    const hdpLink = getSettingSync('hdp_link');
    const hdpVodiyLink = getSettingSync('hdp_vodiy_link') || 'https://forms.gle/dVVii5PdmqqvQe8Y7';
    const omonLink = getSettingSync('omon_link');
    const omonUrganchLink = getSettingSync('omon_urganch_link') || omonLink;
    const omonGurlanLink = getSettingSync('omon_gurlan_link') || omonLink;
    const omonShovotLink = getSettingSync('omon_shovot_link') || omonLink;
    const channel = getSettingSync('channel_username', CHANNEL_USERNAME);

    const text = `📊 Statistika:\n\n👥 Foydalanuvchilar: ${usersCount}\n\n🔹 HDP LC: ${totalHdp}\n🔹 HDP LC Vodiy: ${totalHdpVodiy}\n🔹 Urganch filiali: ${totalOmonUrganch}\n🔹 Gurlan filiali: ${totalOmonGurlan}\n🔹 Shovot filiali: ${totalOmonShovot}\n\n⚙️ <b>Joriy sozlamalar:</b>\nKanal: ${channel}\nHDP LC Link: ${hdpLink}\nHDP LC Vodiy Link: ${hdpVodiyLink}\nUrganch Link: ${omonUrganchLink}\nGurlan Link: ${omonGurlanLink}\nShovot Link: ${omonShovotLink}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("✏️ Kanalni o'zgartirish", "edit_channel")],
      [Markup.button.callback("✏️ HDP LC silkani o'zgartirish", "edit_hdp")],
      [Markup.button.callback("✏️ HDP LC Vodiy silkani o'zgartirish", "edit_hdp_vodiy")],
      [Markup.button.callback("✏️ Urganch silkani o'zgartirish", "edit_omon_urganch")],
      [Markup.button.callback("✏️ Gurlan silkani o'zgartirish", "edit_omon_gurlan")],
      [Markup.button.callback("✏️ Shovot silkani o'zgartirish", "edit_omon_shovot")],
      [Markup.button.callback("📢 Xabar tarqatish", "broadcast_msg")],
      [Markup.button.callback("❌ Bekor qilish", "cancel_admin")]
    ]);

    await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
  }

  bot.command("admin", async (ctx) => {
    if (checkIsAdmin(ctx.from.id)) {
      return await sendAdminPanel(ctx);
    }

    return ctx.reply(`⚠️ <b>Siz administrator emassiz yoki Admin ID hali kiritilmagan!</b>\n\nSizning Telegram ID raqamingiz: <code>${ctx.from.id}</code>\n\n<b>Admin ruxsatini berish uchun:</b>\n1. Web Dashboard (Admin Panel) dagi <b>Admin Telegram ID</b> bo'limiga ushbu ID raqamingizni (<code>${ctx.from.id}</code>) kiriting va saqlang.\n2. Yoki .env fayliga <code>ADMIN_ID=${ctx.from.id}</code> deb yozing.\n\nSo'ngra qayta <b>/admin</b> buyrug'ini bosing.`, { parse_mode: "HTML" });
  });

  async function sendStatsMessage(ctx: any) {
    let usersSnap: any = { docs: [], size: 0, forEach: () => {} };
    try {
      usersSnap = await getDocs(collection(db, 'users'));
    } catch (e) {}

    let totalHdp = 0;
    let totalHdpVodiy = 0;
    let totalOmonUrganch = 0;
    let totalOmonGurlan = 0;
    let totalOmonShovot = 0;
    usersSnap.forEach((docSnap: any) => {
      const data = docSnap.data();
      totalHdp += data.hdp || 0;
      totalHdpVodiy += data.hdp_vodiy || 0;
      totalOmonUrganch += data.omon_urganch || 0;
      totalOmonGurlan += data.omon_gurlan || 0;
      totalOmonShovot += data.omon_shovot || 0;
    });

    const usersCount = usersSnap.size || 0;
    const totalAllClicks = totalHdp + totalHdpVodiy + totalOmonUrganch + totalOmonGurlan + totalOmonShovot;

    const statsMsg = `📊 <b>Tugmalar va Ariza Topshirish Statistikasi:</b>\n\n` +
      `👥 <b>Jami foydalanuvchilar:</b> ${usersCount} ta\n` +
      `👆 <b>Jami tugmalar bosilishi:</b> ${totalAllClicks} ta\n\n` +
      `🔹 <b>HDP LC:</b> ${totalHdp} ta ariza bosildi\n` +
      `🔹 <b>HDP LC Vodiy:</b> ${totalHdpVodiy} ta ariza bosildi\n` +
      `🔹 <b>Omon School (Urganch filiali):</b> ${totalOmonUrganch} ta ariza bosildi\n` +
      `🔹 <b>Omon School (Gurlan filiali):</b> ${totalOmonGurlan} ta ariza bosildi\n` +
      `🔹 <b>Omon School (Shovot filiali):</b> ${totalOmonShovot} ta ariza bosildi`;

    return ctx.reply(statsMsg, { parse_mode: "HTML" });
  }

  bot.command("stats", async (ctx) => {
    return await sendStatsMessage(ctx);
  });

  bot.hears(["/stats", "📊 Statistika", "Statistika", "statistika"], async (ctx) => {
    return await sendStatsMessage(ctx);
  });

  bot.action("edit_channel", async (ctx) => {
    if (!checkIsAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!", { show_alert: true }).catch(() => {});
    }
    adminState.set(ctx.from.id, "awaiting_channel");
    ctx.reply("Yangi kanal username'ini yuboring (masalan: @yangi_kanal):");
    ctx.answerCbQuery().catch(() => {});
  });

  bot.action("edit_hdp", async (ctx) => {
    if (!checkIsAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!", { show_alert: true }).catch(() => {});
    }
    adminState.set(ctx.from.id, "awaiting_hdp");
    ctx.reply("Yangi HDP LC silkasini yuboring (https://...):");
    ctx.answerCbQuery().catch(() => {});
  });

  bot.action("edit_hdp_vodiy", async (ctx) => {
    if (!checkIsAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!", { show_alert: true }).catch(() => {});
    }
    adminState.set(ctx.from.id, "awaiting_hdp_vodiy");
    ctx.reply("Yangi HDP LC Vodiy silkasini yuboring (https://...):");
    ctx.answerCbQuery().catch(() => {});
  });

  bot.action("edit_omon_urganch", async (ctx) => {
    if (!checkIsAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!", { show_alert: true }).catch(() => {});
    }
    adminState.set(ctx.from.id, "awaiting_omon_urganch");
    ctx.reply("Yangi Omon School Urganch filiali silkasini yuboring (https://...):");
    ctx.answerCbQuery().catch(() => {});
  });

  bot.action("edit_omon_gurlan", async (ctx) => {
    if (!checkIsAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!", { show_alert: true }).catch(() => {});
    }
    adminState.set(ctx.from.id, "awaiting_omon_gurlan");
    ctx.reply("Yangi Omon School Gurlan filiali silkasini yuboring (https://...):");
    ctx.answerCbQuery().catch(() => {});
  });

  bot.action("edit_omon_shovot", async (ctx) => {
    if (!checkIsAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!", { show_alert: true }).catch(() => {});
    }
    adminState.set(ctx.from.id, "awaiting_omon_shovot");
    ctx.reply("Yangi Omon School Shovot filiali silkasini yuboring (https://...):");
    ctx.answerCbQuery().catch(() => {});
  });

  bot.action("broadcast_msg", async (ctx) => {
    if (!checkIsAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!", { show_alert: true }).catch(() => {});
    }
    adminState.set(ctx.from.id, "awaiting_broadcast");
    ctx.reply("Tarqatmoqchi bo'lgan xabaringizni yuboring (Matn, rasm, video va h.k):");
    ctx.answerCbQuery().catch(() => {});
  });

  bot.action("edit_broadcast", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !checkIsAdmin(userId)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!", { show_alert: true }).catch(() => {});
    }
    adminState.set(userId, "awaiting_broadcast_msg");
    await ctx.reply("📢 Barcha obunachilarga yubormoqchi bo'lgan xabar matnini kiriting:", {
      reply_markup: {
        inline_keyboard: [[Markup.button.callback("❌ Bekor qilish", "cancel_admin")]]
      }
    });
    ctx.answerCbQuery().catch(() => {});
  });

  bot.command('broadcast', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId || !checkIsAdmin(userId)) return;

    const text = ctx.message.text.replace('/broadcast', '').trim();
    if (!text) {
      return ctx.reply("⚠️ Xabar yozishni unutdingiz. Format: `/broadcast [xabar matni]`", { parse_mode: 'Markdown' });
    }

    await ctx.reply("⏳ Xabar tarqatish boshlandi...");
    try {
      const res = await broadcastToAllUsers(async (targetUserId) => {
        try {
          await bot!.telegram.sendMessage(targetUserId, text, { parse_mode: 'HTML' });
        } catch (err) {
          await bot!.telegram.sendMessage(targetUserId, text);
        }
      }, userId);
      if (res.total === 0) {
        await ctx.reply("❌ Foydalanuvchilar topilmadi.");
      }
    } catch (e: any) {
      await ctx.reply(`❌ Xabar tarqatishda xatolik: ${e.message}`);
    }
  });

  bot.action("cancel_admin", async (ctx) => {
    if (!checkIsAdmin(ctx.from.id)) {
      return ctx.answerCbQuery("⚠️ Ruxsat berilmagan!").catch(() => {});
    }
    adminState.delete(ctx.from.id);
    ctx.deleteMessage().catch(() => {});
    ctx.answerCbQuery("Bekor qilindi").catch(() => {});
  });

  bot.hears([/^omon school$/i, /^omon$/i, "Omon school", "Omon School", "Omon"], async (ctx) => {
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }
      return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
    } catch (err) {
      return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
    }
  });

  // Catch-all handler for any unhandled text messages so user ALWAYS receives a response
  bot.on("text", async (ctx) => {
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }
      return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
    } catch (err) {
      return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
    }
  });

  // Catch-all handler for any unhandled callback queries so inline buttons never freeze
  bot.on("callback_query", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    try {
      const subscribed = await checkSubscription(ctx);
      if (!subscribed) {
        return ctx.reply("Avval kanalga obuna bo‘ling:", subscriptionKeyboard());
      }
      return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
    } catch (err) {
      return ctx.reply("Ish joyini tanlang:", mainMenuKeyboard());
    }
  });
}

// ================= EXPRESS API ENDPOINTS FOR WEB DASHBOARD =================
app.get("/api/status", async (req, res) => {
  res.json({
    ok: true,
    botActive: !!bot,
    hasToken: !!BOT_TOKEN,
    adminIdConfigured: !!(ADMIN_ID || getSettingSync('admin_id')),
    channelUsername: getSettingSync('channel_username', CHANNEL_USERNAME)
  });
});

app.get("/api/stats", async (req, res) => {
  try {
    if (statsCache.usersCount > 0) {
      return res.json(statsCache);
    }
    const usersSnap = await getDocs(collection(db, 'users'));
    let totalHdp = 0;
    let totalHdpVodiy = 0;
    let totalOmonUrganch = 0;
    let totalOmonGurlan = 0;
    let totalOmonShovot = 0;
    
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      totalHdp += data.hdp || 0;
      totalHdpVodiy += data.hdp_vodiy || 0;
      totalOmonUrganch += data.omon_urganch || 0;
      totalOmonGurlan += data.omon_gurlan || 0;
      totalOmonShovot += data.omon_shovot || 0;
    });

    statsCache = {
      usersCount: usersSnap.size,
      totalHdp,
      totalHdpVodiy,
      totalOmonUrganch,
      totalOmonGurlan,
      totalOmonShovot,
      totalOmonAll: totalOmonUrganch + totalOmonGurlan + totalOmonShovot
    };

    res.json(statsCache);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/settings", (req, res) => {
  const omonLink = getSettingSync('omon_link');
  res.json({
    channel_username: getSettingSync('channel_username', CHANNEL_USERNAME),
    hdp_link: getSettingSync('hdp_link'),
    hdp_vodiy_link: getSettingSync('hdp_vodiy_link') || 'https://forms.gle/dVVii5PdmqqvQe8Y7',
    omon_link: omonLink,
    omon_urganch_link: getSettingSync('omon_urganch_link') || omonLink,
    omon_gurlan_link: getSettingSync('omon_gurlan_link') || omonLink,
    omon_shovot_link: getSettingSync('omon_shovot_link') || omonLink,
    admin_id: getSettingSync('admin_id', process.env.ADMIN_ID || '')
  });
});

app.get("/api/users", async (req, res) => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const users: any[] = [];
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const hdp = data.hdp || 0;
      const hdp_vodiy = data.hdp_vodiy || 0;
      const omon = (data.omon_urganch || 0) + (data.omon_gurlan || 0) + (data.omon_shovot || 0);
      users.push({
        id: docSnap.id,
        hdp,
        hdp_vodiy,
        omon,
        total: hdp + hdp_vodiy + omon,
        updatedAt: data.updatedAt || null
      });
    });
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/broadcast/status", (req, res) => {
  const processed = activeBroadcast.success + activeBroadcast.fail;
  const percentage = activeBroadcast.total > 0 ? Math.round((processed / activeBroadcast.total) * 100) : 0;

  res.json({
    ok: true,
    inProgress: activeBroadcast.inProgress,
    total: activeBroadcast.total,
    success: activeBroadcast.success,
    fail: activeBroadcast.fail,
    processed,
    percentage,
    startedAt: activeBroadcast.startedAt,
    finishedAt: activeBroadcast.finishedAt
  });
});

app.post("/api/broadcast", async (req, res) => {
  try {
    const { message, text, imageUrl, broadcastImage } = req.body;
    const broadcastText = (message || text || "").trim();
    const photoUrl = (imageUrl || broadcastImage || "").trim();

    if (!broadcastText && !photoUrl) {
      return res.status(400).json({ error: "Xabar matni yoki rasm kiritilmagan" });
    }

    if (!bot) {
      return res.status(500).json({ error: "Bot token sozlanmagan" });
    }

    if (activeBroadcast.inProgress) {
      return res.status(400).json({
        error: `Hozirda xabar tarqatilmoqda (${activeBroadcast.success + activeBroadcast.fail}/${activeBroadcast.total}). Iltimos tugashini kuting!`
      });
    }

    const result = await broadcastToAllUsers(async (targetUserId) => {
      if (photoUrl) {
        try {
          await bot.telegram.sendPhoto(targetUserId, photoUrl, {
            caption: broadcastText || undefined,
            parse_mode: 'HTML'
          });
        } catch (photoErr) {
          if (broadcastText) {
            await bot.telegram.sendMessage(targetUserId, broadcastText, { parse_mode: 'HTML' });
          } else {
            throw photoErr;
          }
        }
      } else {
        try {
          await bot.telegram.sendMessage(targetUserId, broadcastText, { parse_mode: 'HTML' });
        } catch (err) {
          await bot.telegram.sendMessage(targetUserId, broadcastText);
        }
      }
    });

    if (result.total === 0) {
      return res.json({
        ok: true,
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        totalUsers: 0,
        message: "Hozircha botda foydalanuvchilar mavjud emas",
        successCount: 0,
        failCount: 0
      });
    }

    res.json({
      ok: true,
      success: true,
      sent: result.success,
      failed: result.fail,
      total: result.total,
      totalUsers: result.total,
      message: `🚀 Xabar tarqatish boshlandi! Barcha ${result.total} ta foydalanuvchiga yuborilmoqda...`,
      successCount: 0,
      failCount: 0
    });
  } catch (err: any) {
    console.error("Broadcast API error:", err);
    res.status(500).json({ error: err.message || "Xabar yuborishda xatolik yuz berdi" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || typeof value !== 'string') {
      return res.status(400).json({ error: "key and value are required" });
    }
    await setSetting(key, value.trim());
    res.json({ ok: true, key, value: value.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================= VITE & SERVER START =================
async function start() {
  await initDb();

  const distPath = path.join(process.cwd(), 'dist');
  const distExists = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

  // Mount Vite or static server
  if (process.env.NODE_ENV === "production" || distExists) {
    console.log("Serving static production build from dist/");
    app.use(express.static(distPath, { maxAge: "1d", etag: true }));
    app.get('*', (req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.send("HR Bot server running.");
      }
    });
  } else {
    console.log("Starting Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  if (bot) {
    const domainRaw = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || process.env.PUBLIC_DOMAIN || process.env.WEBHOOK_DOMAIN || process.env.APP_URL || process.env.DOMAIN;
    let domain = domainRaw ? domainRaw.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;

    if (domain && !process.env.USE_POLLING) {
      (async () => {
        try {
          const webhookUrl = `https://${domain}${WEBHOOK_PATH}`;
          await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
          await bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true });
          console.log(`Bot launched using webhook on ${webhookUrl}`);
        } catch (err: any) {
          console.error("Webhook setup failed, falling back to long polling:", err.message);
          startPollingSafely();
        }
      })();
    } else {
      startPollingSafely();
    }
  }

  function startPollingSafely() {
    if (!bot) return;
    bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    bot.launch().then(() => {
      console.log('Bot launched using long polling.');
    }).catch((err: any) => {
      if (err?.message?.includes('409: Conflict')) {
        console.warn("⚠️ Notice: Bot conflict detected (another bot instance running elsewhere). Polling standby.");
      } else {
        console.error("Failed to launch bot polling:", err?.message || err);
      }
    });
  }

  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error("Fatal server start error:", err);
});
