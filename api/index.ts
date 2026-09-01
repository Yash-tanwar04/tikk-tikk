import { Request, Response } from 'express';
import { createExpressApp } from '../server/app';

const app = createExpressApp();

export default function handler(req: Request, res: Response) {
  return app(req, res);
}

