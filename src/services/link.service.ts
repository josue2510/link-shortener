import type { Link } from '@/models/link.model.js';
import type { LinkRepository } from '@/repositories/link.repository.js';
import { generateShortId } from '@/utils/short-id.utils.js';
import { AppError } from '@/middleware/error-handler.js';

export class LinkService {
  constructor(private readonly linkRepository: LinkRepository) {}

  shortenUrl(originalUrl: string): Link {
    this.validateUrl(originalUrl);

    const link: Link = {
      id: generateShortId(),
      originalUrl,
      shortCode: generateShortId(),
      createdAt: new Date(),
    };

    return this.linkRepository.save(link);
  }

  resolveShortCode(shortCode: string): Link {
    const link = this.linkRepository.findByShortCode(shortCode);

    if (!link) {
      throw new AppError('Short link not found', 404, 'LINK_NOT_FOUND');
    }

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
