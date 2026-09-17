import mongoose, { Schema, Document, Model } from 'mongoose';
import { User } from '@/types/common';

export interface IUserDocument extends Omit<User, 'id'>, Document {
  id: string;
  password?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
}

const UserSchema = new Schema<IUserDocument>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    role: { 
      type: String, 
      required: true, 
      enum: ['Administrator', 'Manager', 'Viewer'],
      default: 'Viewer' 
    },
    status: { 
      type: String, 
      required: true, 
      enum: ['Active', 'Inactive'],
      default: 'Active' 
    },
    password: { type: String, select: true },
    assignedClients: { type: [String], default: [] },
    lastLogin: { type: String, default: '' },
    resetToken: { type: String },
    resetTokenExpiry: { type: String },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
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

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
