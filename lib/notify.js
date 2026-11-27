'use strict';

// Delivers a submission. If RESEND_API_KEY and NOTIFY_TO are configured in the
// Vercel project, it is emailed; otherwise it is written to the function log
// (Vercel → Project → Logs), which is where submissions can be read.
async function deliver(kind, fields) {
  const id = `${kind}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_TO;
  if (key && to) {
    const from = process.env.NOTIFY_FROM || 'EquityLens <onboarding@resend.dev>';
    const text = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: fields.email, subject: `[EquityLens] ${kind} ${id}`, text }),
    });
    if (!r.ok) {
      console.error('[notify] email failed', r.status, await r.text().catch(() => ''));
      const e = new Error('Could not deliver message');
      e.status = 502;
      throw e;
    }
    return { id, delivered: 'email' };
  }
  console.log(`[notify] ${kind}`, JSON.stringify({ id, ...fields }));
  return { id, delivered: 'log' };
}

module.exports = { deliver };
