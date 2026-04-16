interface KVNamespace {
  get(key: string): Promise<string | null>;
  get(key: string, type: "text"): Promise<string | null>;
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

type EmailAddress = { address: string };

type ForwardableEmailMessage = {
  to: EmailAddress | EmailAddress[];
  raw: ReadableStream<Uint8Array>;
};

export interface Env {
  SECRET_KEY: string;
  MAILBOX_KV: KVNamespace;
  MAIL_DOMAIN: string;
}

type StoredMail = {
  email: string;
  code: string | null;
  time: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function extract6DigitCode(text: string): string | null {
  const m = text.match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

function getFirstToAddress(message: ForwardableEmailMessage): string | null {
  const to = message.to;
  if (Array.isArray(to)) return to[0]?.address ?? null;
  return to?.address ?? null;
}

function isAllowedDomain(email: string, allowedDomain: string): boolean {
  const domain = allowedDomain.trim().toLowerCase();
  if (!domain) return true;
  return email.endsWith(`@${domain}`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (url.pathname === "/api/get-code" && request.method === "GET") {
      const key = url.searchParams.get("key") ?? "";
      const email = url.searchParams.get("email") ?? "";

      if (!email) return json({ error: "missing email" }, 400);
      if (!key || key !== env.SECRET_KEY) return json({ error: "unauthorized" }, 401);

      const normalized = normalizeEmail(email);
      if (!isAllowedDomain(normalized, env.MAIL_DOMAIN)) {
        return json({ error: "email domain not allowed" }, 403);
      }

      const kvKey = `mail:${normalized}`;
      const stored = await env.MAILBOX_KV.get<StoredMail>(kvKey, "json");

      if (!stored) return json({ error: "未收到邮件" }, 404);
      if (!stored.code) return json({ error: "邮件中未找到6位验证码" }, 404);

      return json({ email: stored.email, code: stored.code, time: stored.time }, 200);
    }

    return json({ error: "not found" }, 404);
  },

  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const toAddr = getFirstToAddress(message);
    if (!toAddr) return;

    const normalized = normalizeEmail(toAddr);
    if (!isAllowedDomain(normalized, env.MAIL_DOMAIN)) return;

    const rawText = await new Response(message.raw).text();
    const code = extract6DigitCode(rawText);

    const stored: StoredMail = {
      email: normalized,
      code,
      time: new Date().toISOString(),
    };

    await env.MAILBOX_KV.put(`mail:${normalized}`, JSON.stringify(stored), {
      expirationTtl: 60 * 30,
    });
  },
};
