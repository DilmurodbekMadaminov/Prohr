export interface BotStatus {
  configured: boolean;
  botTokenMasked: string | null;
  adminIdSet: boolean;
  adminId: number | null;
  appUrl: string | null;
  channelUsername: string;
}

export interface UserActivity {
  id: string;
  hdp: number;
  omon: number;
  total: number;
}

export interface BotStats {
  totalUsers?: number;
  usersCount?: number;
  totalHdp?: number;
  totalOmon?: number;
  totalOmonUrganch?: number;
  totalOmonGurlan?: number;
  totalOmonShovot?: number;
  totalOmonAll?: number;
  users?: UserActivity[];
}

export interface BotSettings {
  hdp_link: string;
  omon_link: string;
  channel_username: string;
}
