export default async function handler(req, res) {
  res.status(200).json({
    username: process.env.TELEGRAM_BOT_USERNAME || null,
  });
}
