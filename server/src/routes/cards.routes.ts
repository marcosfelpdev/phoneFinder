import { Router, Request, Response } from 'express';
import { cardService } from '../services/card.service';
import { pairingService } from '../services/pairing.service';
import { CreateCardDTO, UpdateCardDTO } from 'shared';
import { logger } from '../utils/logger';

export const cardsRouter = Router();

function getParamId(req: Request): string {
  const { id } = req.params;
  return Array.isArray(id) ? id[0] : id;
}

cardsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const cards = await cardService.getAllCardsWithStatus();
    res.json(cards);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno ao listar cards';
    logger.error('CardsRouter', message);
    res.status(500).json({ error: message });
  }
});

cardsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = getParamId(req);
    const card = await cardService.getCardByIdWithStatus(id);
    if (!card) {
      res.status(404).json({ error: 'Card não encontrado.' });
      return;
    }
    res.json(card);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar card';
    res.status(500).json({ error: message });
  }
});

cardsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const dto: CreateCardDTO = req.body;
    const newCard = await cardService.createCard(dto);
    res.status(201).json(newCard);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar card';
    res.status(400).json({ error: message });
  }
});

cardsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = getParamId(req);
    const dto: UpdateCardDTO = req.body;
    const updated = await cardService.updateCard(id, dto);
    if (!updated) {
      res.status(404).json({ error: 'Card não encontrado para atualização.' });
      return;
    }
    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar card';
    res.status(400).json({ error: message });
  }
});

cardsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = getParamId(req);
    const success = await cardService.deleteCard(id);
    if (!success) {
      res.status(404).json({ error: 'Card não encontrado para exclusão.' });
      return;
    }
    res.json({ success: true, message: 'Card excluído com sucesso.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao excluir card';
    res.status(500).json({ error: message });
  }
});

cardsRouter.post('/:id/pairing-code', async (req: Request, res: Response) => {
  try {
    const id = getParamId(req);
    const payload = await pairingService.generateCode(id);
    res.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar código de pareamento';
    res.status(400).json({ error: message });
  }
});

cardsRouter.post('/:id/unpair', async (req: Request, res: Response) => {
  try {
    const id = getParamId(req);
    const success = await pairingService.unpairCard(id);
    if (!success) {
      res.status(400).json({ error: 'Nenhum dispositivo pareado encontrado para este card.' });
      return;
    }
    res.json({ success: true, message: 'Aparelho desvinculado com sucesso.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao desvincular aparelho';
    res.status(500).json({ error: message });
  }
});
