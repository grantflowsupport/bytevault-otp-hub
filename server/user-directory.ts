import { supabaseAdmin } from './db.js';

interface UserInfo {
  id: string;
  email: string;
}

interface UserCache {
  [userId: string]: {
    email: string;
    timestamp: number;
  };
}

class UserDirectoryService {
  private userCache: UserCache = {};
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get emails for multiple user IDs, with caching
   */
  async getEmailsForUserIds(userIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const uncachedUserIds: string[] = [];
    const now = Date.now();

    // Check cache first
    for (const userId of userIds) {
      const cached = this.userCache[userId];
      if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
        result.set(userId, cached.email);
      } else {
        uncachedUserIds.push(userId);
      }
    }

    // Fetch uncached users from Supabase
    if (uncachedUserIds.length > 0) {
      try {
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000 // Adjust based on your needs
        });

        if (error) {
          console.error('Error fetching users from Supabase:', error);
          return result;
        }

        // Filter to only the users we need and update cache
        for (const user of users.users) {
          if (uncachedUserIds.includes(user.id) && user.email) {
            result.set(user.id, user.email);
            this.userCache[user.id] = {
              email: user.email,
              timestamp: now
            };
          }
        }
      } catch (error) {
        console.error('Error in getEmailsForUserIds:', error);
      }
    }

    return result;
  }

  /**
   * Resolve a single email to user ID
   */
  async resolveUserIdByEmail(email: string): Promise<string | null> {
    if (!email) return null;

    try {
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000 // In production, you might want pagination for large user bases
      });

      if (error) {
        console.error('Error fetching users for email resolution:', error);
        return null;
      }

      // Find user by email (case-insensitive)
      const user = users.users.find(u => 
        u.email?.toLowerCase() === email.toLowerCase()
      );

      if (user && user.id) {
        // Update cache
        this.userCache[user.id] = {
          email: user.email || email,
          timestamp: Date.now()
        };
        return user.id;
      }

      return null;
    } catch (error) {
      console.error('Error resolving user ID by email:', error);
      return null;
    }
  }

  /**
   * Search users by email query (for typeahead)
   */
  async searchUsersByEmail(query: string, limit: number = 10): Promise<UserInfo[]> {
    if (!query || query.length < 2) return [];

    try {
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000
      });

      if (error) {
        console.error('Error searching users:', error);
        return [];
      }

      // Filter and sort by relevance
      const filteredUsers = users.users
        .filter(user => user.email?.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map(user => ({
          id: user.id,
          email: user.email || ''
        }));

      return filteredUsers;
    } catch (error) {
      console.error('Error in searchUsersByEmail:', error);
      return [];
    }
  }

  /**
   * Clear cache (useful for testing or manual cache invalidation)
   */
  clearCache(): void {
    this.userCache = {};
  }

  /**
   * Get cache stats (useful for monitoring)
   */
  getCacheStats(): { totalEntries: number; oldEntries: number } {
    const now = Date.now();
    const oldEntries = Object.values(this.userCache)
      .filter(entry => (now - entry.timestamp) >= this.CACHE_TTL).length;
    
    return {
      totalEntries: Object.keys(this.userCache).length,
      oldEntries
    };
  }
}

export const userDirectoryService = new UserDirectoryService();