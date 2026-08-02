import { Resend } from "resend";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── PARSE MULTIPART FORM ─────────────────────────────────────────────────
  const form = new IncomingForm({ multiples: true, maxFileSize: 50 * 1024 * 1024 });

  const { fields, files } = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

  const get = (key) => (Array.isArray(fields[key]) ? fields[key][0] : fields[key]) ?? "Not provided";

  const jobType    = get("job_type");
  const description = get("description");
  const name       = get("name");
  const phone      = get("phone");
  const postcode   = get("postcode");

  // ── COLLECT UPLOADED FILES ───────────────────────────────────────────────
  const uploadedFiles = files["files[]"]
    ? Array.isArray(files["files[]"]) ? files["files[]"] : [files["files[]"]]
    : [];

  const attachments = uploadedFiles.map((file) => ({
    filename: file.originalFilename || "upload",
    content: fs.readFileSync(file.filepath).toString("base64"),
  }));

  // ── SEND EMAIL VIA RESEND ─────────────────────────────────────────────────
  await resend.emails.send({
    from:    process.env.EMAIL_FROM,   // e.g. leads@yoursite.com (verified domain)
    to:      process.env.EMAIL_TO,     // roofer's email
    subject: `New Lead: ${name} — ${jobType} in ${postcode}`,
    text: `
New lead from your website!

Name:        ${name}
Phone:       ${phone}
Postcode:    ${postcode}
Job Type:    ${jobType}
Description: ${description}
Files:       ${attachments.length} attached

Call them back ASAP!
    `.trim(),
    attachments,
  });

  // ── WHATSAPP NOTIFICATION (CallMeBot) ────────────────────────────────────
  const waMessage = encodeURIComponent(
    `🔔 *New Lead*\n\n` +
    `👤 *Name:* ${name}\n` +
    `📞 *Phone:* ${phone}\n` +
    `📍 *Postcode:* ${postcode}\n` +
    `🏠 *Job:* ${jobType}\n` +
    `📝 *Notes:* ${description}\n` +
    `📸 *Files:* ${attachments.length} (see email)\n\n` +
    `Reply ASAP! ⚡`
  );

  const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${process.env.WA_PHONE}&text=${waMessage}&apikey=${process.env.WA_APIKEY}`;

  await fetch(waUrl).catch(() => {}); // fire and forget — don't fail the request if WA is down

  return res.status(200).json({ success: true, files: attachments.length });
}
