import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AdminAudit } from './admin-audit.schema';
import { UserActivity } from './user-activity.schema';
import { User } from './user.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(UserActivity.name) private readonly activities: Model<UserActivity>,
    @InjectModel(AdminAudit.name) private readonly audit: Model<AdminAudit>,
  ) {}

  async overview() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    const [totalUsers, activeUsers, newToday, signups, daily] = await Promise.all([
      this.users.countDocuments(),
      this.users.countDocuments({ isActive: { $ne: false } }),
      this.users.countDocuments({ createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }),
      this.users.countDocuments({ createdAt: { $gte: start } }),
      this.users.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const timeline = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, count: daily.find((item) => item._id === key)?.count ?? 0 };
    });
    const providerBreakdown = await this.users.aggregate([
      { $group: { _id: '$provider', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const recentUsers = await this.users.find().select('name email provider isActive createdAt picture')
      .sort({ createdAt: -1 }).limit(6).lean();
    const recentActivity = await this.activities.find().select('userId activity provider createdAt')
      .sort({ createdAt: -1 }).limit(8).lean();
    const recentIds = [...new Set(recentActivity.map((activity) => String(activity.userId)))];
    const activityUsers = await this.users.find({ _id: { $in: recentIds } }).select('name email').lean();
    const userMap = new Map(activityUsers.map((user) => [String(user._id), user]));
    return {
      metrics: { totalUsers, activeUsers, newToday, signupsLast30Days: signups },
      signupsByDay: timeline,
      providers: providerBreakdown.map((item) => ({ provider: item._id, count: item.count })),
      recentUsers,
      recentActivity: recentActivity.map((activity) => ({
        ...activity,
        user: userMap.get(String(activity.userId)) ?? null,
      })),
    };
  }

  async listUsers(options: { page: number; limit: number; search?: string; status?: string; provider?: string }) {
    const { page, limit, search, status, provider } = options;
    const filter: FilterQuery<User> = {};
    if (search?.trim()) {
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      filter.$or = [
        { email: { $regex: safe, $options: 'i' } },
        { name: { $regex: safe, $options: 'i' } },
      ];
    }
    if (status === 'active') filter.isActive = { $ne: false };
    if (status === 'inactive') filter.isActive = false;
    if (['google', 'microsoft', 'linkedin', 'password'].includes(provider ?? '')) filter.provider = provider;

    const [items, total] = await Promise.all([
      this.users.find(filter).select('name email provider emailVerified isActive createdAt picture')
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.users.countDocuments(filter),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async userDetails(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('User not found');
    const user = await this.users.findById(id)
      .select('name email provider emailVerified isActive createdAt updatedAt picture locale')
      .lean();
    if (!user) throw new NotFoundException('User not found');
    const activities = await this.activities.find({ userId: user._id })
      .select('activity provider createdAt browser operatingSystem devicePlatform')
      .sort({ createdAt: -1 }).limit(30).lean();
    return { user, activities };
  }

  async setUserStatus(id: string, isActive: boolean, actor: string, ipAddress?: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('User not found');
    const user = await this.users.findByIdAndUpdate(id, { $set: { isActive } }, { new: true })
      .select('name email provider emailVerified isActive createdAt picture').lean();
    if (!user) throw new NotFoundException('User not found');
    await this.audit.create({
      actor,
      action: isActive ? 'user.activated' : 'user.deactivated',
      targetUserId: user._id,
      ipAddress: ipAddress?.slice(0, 64),
    });
    return user;
  }

  async auditEvents(options: { page: number; limit: number; action?: string; search?: string }) {
    const { page, limit, action, search } = options;
    const filter: FilterQuery<AdminAudit> = {};
    if (['user.activated', 'user.deactivated'].includes(action ?? '')) filter.action = action;
    if (search?.trim()) {
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
      const matchingUsers = await this.users.find({
        $or: [{ email: { $regex: safe, $options: 'i' } }, { name: { $regex: safe, $options: 'i' } }],
      }).select('_id').lean();
      filter.$or = [
        { actor: { $regex: safe, $options: 'i' } },
        { targetUserId: { $in: matchingUsers.map((user) => user._id) } },
      ];
    }

    const [items, total] = await Promise.all([
      this.audit.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.audit.countDocuments(filter),
    ]);
    const targetIds = [...new Set(items.map((item) => String(item.targetUserId)))];
    const targets = await this.users.find({ _id: { $in: targetIds } })
      .select('name email isActive').lean();
    const targetMap = new Map(targets.map((user) => [String(user._id), user]));
    return {
      items: items.map((item) => {
        const target = targetMap.get(String(item.targetUserId));
        return {
          ...item,
          targetName: target?.name,
          targetEmail: target?.email,
          targetActive: target ? target.isActive !== false : null,
          targetExists: Boolean(target),
        };
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }
}
