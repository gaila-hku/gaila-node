import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application } from 'express';
import { authenticateToken } from 'middleware/auth';
import assignmentRoutes from 'routes/assignment';
import assignmentSubmissionRoutes from 'routes/assignment-submission';
import authRoutes from 'routes/auth';
import chatbotSettingRoutes from 'routes/chatbot-setting';
import classRoutes from 'routes/class';
import gptRoutes from 'routes/gpt';
import homeRoutes from 'routes/home';
import reminderRoutes from 'routes/reminder';
import traceDataRoutes from 'routes/trace-data';
import userRoutes from 'routes/user';

dotenv.config();

const app: Application = express();
app.use(express.json());
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://gaila.hku.hk'],
  }),
);

// Routes
app.use('/', homeRoutes);
app.use('/auth', authRoutes);
app.use('/class', authenticateToken, classRoutes);
app.use('/assignment', authenticateToken, assignmentRoutes);
app.use('/submission', authenticateToken, assignmentSubmissionRoutes);
app.use('/user', authenticateToken, userRoutes);
app.use('/trace-data', authenticateToken, traceDataRoutes);
app.use('/gpt', authenticateToken, gptRoutes);
app.use('/reminder', authenticateToken, reminderRoutes);
app.use('/chatbot-setting', authenticateToken, chatbotSettingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
