export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { rating, feedback } = req.body;

  const waMessage = encodeURIComponent(
    `⚠️ *Private Feedback Received*\n\n` +
    `*Rating:* ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)\n` +
    `*Feedback:* ${feedback}\n\n` +
    `Reply to this customer directly.`
  );

  const waUrl = `https://api.callmebot.com/whatsapp.php?phone=${process.env.WA_PHONE}&text=${waMessage}&apikey=${process.env.WA_APIKEY}`;

  await fetch(waUrl).catch(() => {});

  return res.status(200).json({ success: true });
}
