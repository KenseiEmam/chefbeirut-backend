export function authenticateApp(req:any, res:any, next:any) {
  const apiKey = req.headers["x-api-key"]
  if (!apiKey || apiKey !== process.env.APP_API_KEY) {
    return res.status(403).json({ error: "Forbidden: Invalid API key" })
  }
  next()
}
