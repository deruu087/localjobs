import { v2 as cloudinary } from 'cloudinary';
import { IncomingForm } from 'formidable';

export const config = { api: { bodyParser: false } };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new IncomingForm({ multiples: true, maxFileSize: 50 * 1024 * 1024 });

  const { fields, files } = await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

  const get = (key) => (Array.isArray(fields[key]) ? fields[key][0] : fields[key]) ?? 'Not provided';

  const jobType     = get('job_type');
  const description = get('description');
  const name        = get('name');
  const phone       = get('phone');
  const postcode    = get('postcode');

  // Upload files to Cloudinary
  const uploadedFiles = files['files[]']
    ? Array.isArray(files['files[]']) ? files['files[]'] : [files['files[]']]
    : [];

  const uploadedUrls = (await Promise.all(
    uploadedFiles.map((file) =>
      cloudinary.uploader.upload(file.filepath, {
        resource_type: 'auto',
        folder: 'roofing-leads',
      }).then((result) => result.secure_url).catch(() => null)
    )
  )).filter(Boolean);

  // Build WhatsApp message
  const photoLines = uploadedUrls.length > 0
    ? uploadedUrls.map((url, i) => `📸 Photo ${i + 1}: ${url}`).join('\n')
    : '📸 No photos uploaded';

  const waMessage = encodeURIComponent(
    `🔔 *New Lead*\n\n` +
    `👤 *Name:* ${name}\n` +
    `📞 *Phone:* ${phone}\n` +
    `📍 *Postcode:* ${postcode}\n` +
    `🏠 *Job:* ${jobType}\n` +
    `📝 *Notes:* ${description}\n` +
    `${photoLines}\n\n` +
    `Reply ASAP! ⚡`
  );

  const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${process.env.WA_PHONE}&text=${waMessage}&apikey=${process.env.WA_APIKEY}`;

  await fetch(waUrl).catch(() => {});

  return res.status(200).json({ success: true, files: uploadedUrls.length });
}
