import type { Response } from "express";

const clients = new Set<Response>();

export function addAlertStreamClient(res: Response) {
  clients.add(res);
}

export function removeAlertStreamClient(res: Response) {
  clients.delete(res);
}

export function pushAlertUpdate(payload: unknown) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    client.write(data);
  }
}
