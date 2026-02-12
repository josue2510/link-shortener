import type { Link } from '@/models/link.model.js';
import type { LinkRepository } from '@/repositories/link.repository.js';
import { generateShortId } from '@/utils/short-id.utils.js';
import { AppError } from '@/middleware/error-handler.js';
import { LruCache } from '@/utils/lru-cache.js';

const CACHE_MAX_SIZE = 50;

export class LinkService {
  private readonly shortCodeCache = new LruCache<Link>(CACHE_MAX_SIZE);
  private readonly urlCache = new LruCache<Link>(CACHE_MAX_SIZE);

  constructor(private readonly linkRepository: LinkRepository) {}

  shortenUrl(originalUrl: string): Link {
    this.validateUrl(originalUrl);

    const cached = this.urlCache.get(originalUrl);

    if (cached) {
      return cached;
    }

    const link: Link = {
      id: generateShortId(),
      originalUrl,
      shortCode: generateShortId(),
      createdAt: new Date(),
    };

    const saved = this.linkRepository.save(link);
    this.shortCodeCache.set(saved.shortCode, saved);
    this.urlCache.set(saved.originalUrl, saved);

    return saved;
  }

  resolveShortCode(shortCode: string): Link {
    const cached = this.shortCodeCache.get(shortCode);

    if (cached) {
      return cached;
    }

    const link = this.linkRepository.findByShortCode(shortCode);

    if (!link) {
      throw new AppError('Short link not found', 404, 'LINK_NOT_FOUND');
    }

    this.shortCodeCache.set(shortCode, link);
    this.urlCache.set(link.originalUrl, link);

    return link;
  }

  private validateUrl(url: string): void {
    try {
      new URL(url);
    } catch {
      throw new AppError('Invalid URL provided', 400, 'INVALID_URL');
    }
  }
}
