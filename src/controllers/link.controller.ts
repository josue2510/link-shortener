import type { Request, Response } from 'express';
import type { CreateLinkRequest, LinkResponse } from '@/types/link.types.js';
import type { LinkService } from '@/services/link.service.js';

export class LinkController {
  constructor(private readonly linkService: LinkService) {}

  createLink = async (req: Request, res: Response): Promise<void> => {
    const { url } = req.body as CreateLinkRequest;

    const link = this.linkService.shortenUrl(url);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response: LinkResponse = {
      id: link.id,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      shortUrl: `${baseUrl}/api/links/${link.shortCode}`,
      createdAt: link.createdAt,
    };

    res.status(201).json({
      success: true,
      data: response,
    });
  };

  redirectLink = async (
    req: Request<{ shortCode: string }>,
    res: Response,
  ): Promise<void> => {
    const { shortCode } = req.params;

    const link = this.linkService.resolveShortCode(shortCode);

    res.redirect(301, link.originalUrl);
  };
}
