import mongoose, { Schema, Document, Model } from 'mongoose';
import { ReportSchedule } from '@/types/schedule';

export interface IScheduleDocument extends Omit<ReportSchedule, 'id'>, Document {
  id: string;
}

const ScheduleSchema = new Schema<IScheduleDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    clientName: { type: String, required: true },
    clientId: { type: String },
    reportType: { type: String, required: true },
    datePreset: { type: String, required: true },
    customStartDate: { type: String },
    customEndDate: { type: String },
    time: { type: String, required: true },
    frequency: { type: String, required: true },
    weeklyDay: { type: Number },
    monthlyDay: { type: Number },
    recipients: { type: [String], required: true },
    ccRecipients: { type: [String], default: [] },
    formats: { type: [String], required: true },
    subjectTemplate: { type: String },
    customNotes: { type: String },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
    lastRunAt: { type: String },
    lastRunStatus: { type: String, enum: ['success', 'failed'] },
    lastRunMessage: { type: String },
    lastScheduledSlot: { type: String },
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

export const ScheduleModel: Model<IScheduleDocument> =
  mongoose.models.Schedule || mongoose.model<IScheduleDocument>('Schedule', ScheduleSchema);
