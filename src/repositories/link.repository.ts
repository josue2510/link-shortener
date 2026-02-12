import type { Link } from '@/models/link.model.js';

export interface LinkRepository {
  findById(id: string): Link | undefined;
  findByShortCode(shortCode: string): Link | undefined;
  save(link: Link): Link;
  findAll(): Link[];
}

export class InMemoryLinkRepository implements LinkRepository {
  private readonly links = new Map<string, Link>();

  findById(id: string): Link | undefined {
    return this.links.get(id);
  }

  findByShortCode(shortCode: string): Link | undefined {
    for (const link of this.links.values()) {
      if (link.shortCode === shortCode) {
        return link;
      }
    }
    return undefined;
  }

  save(link: Link): Link {
    this.links.set(link.id, link);
    return link;
  }

  findAll(): Link[] {
    return Array.from(this.links.values());
  }
}
