import pino, { type DestinationStream } from "pino";

export function createLogger(level: string, destination?: DestinationStream) {
  return pino(
    {
      level,
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-customer-proxy-secret"]',
        'res.headers["set-cookie"]',
      ],
    },
    destination,
  );
}
