import mongoose from 'mongoose'

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('[db] Connected to MongoDB')
  } catch (err) {
    console.error('[db] Connection failed:', err.message)
    process.exit(1)
  }
}
