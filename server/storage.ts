// This file is kept for compatibility but is not used in the Supabase implementation
// All storage operations go through Supabase directly

export interface IStorage {
  // Empty interface for compatibility
}

export class MemStorage implements IStorage {
  constructor() {
    // Empty constructor
  }
}

export const storage = new MemStorage();
