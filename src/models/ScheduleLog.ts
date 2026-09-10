import mongoose, { Schema, Document, Model } from 'mongoose';
import { ScheduleExecutionLog } from '@/types/schedule';

export interface IScheduleLogDocument extends Omit<ScheduleExecutionLog, 'id'>, Document {
  id: string;
}

const ScheduleLogSchema = new Schema<IScheduleLogDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    scheduleId: { type: String, index: true },
    scheduleName: { type: String, required: true },
    clientName: { type: String, required: true },
    reportType: { type: String, required: true },
    dateRange: { type: String, required: true },
    recipients: { type: [String], required: true },
    formats: { type: [String], required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    message: { type: String, required: true },
    timestamp: { type: String, required: true, index: true },
    durationMs: { type: Number },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: function (_, ret) {
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

export const ScheduleLogModel: Model<IScheduleLogDocument> =
  mongoose.models.ScheduleLog || mongoose.model<IScheduleLogDocument>('ScheduleLog', ScheduleLogSchema);
