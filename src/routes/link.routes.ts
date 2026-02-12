import { Router, type Router as RouterType } from 'express';
import { LinkController } from '@/controllers/link.controller.js';
import { LinkService } from '@/services/link.service.js';
import { InMemoryLinkRepository } from '@/repositories/link.repository.js';
import { createLinkRateLimiter } from '@/middleware/rate-limiter.js';

const router: RouterType = Router();

const linkRepository = new InMemoryLinkRepository();
const linkService = new LinkService(linkRepository);
const linkController = new LinkController(linkService);

router.post('/', createLinkRateLimiter, linkController.createLink);
router.get('/:shortCode', linkController.redirectLink);

export default router;
