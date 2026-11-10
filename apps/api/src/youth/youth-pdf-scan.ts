import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { createConnection } from 'node:net';

export const MAX_YOUTH_PDF_BYTES = 2 * 1024 * 1024;

/** ClamAV INSTREAM on a private network. An unavailable or ambiguous scan fails closed. */
export async function scanYouthPdf(buffer: Buffer, host: string | undefined, port: number) {
  if (!host) throw new ServiceUnavailableException('File scanning is unavailable.');
  const reply = await new Promise<string>((resolve, reject) => {
    const socket = createConnection({ host, port });
    const deadline = setTimeout(() => socket.destroy(new Error('Scan timed out')), 8000);
    let response = '';
    socket.setEncoding('utf8');
    socket.once('connect', () => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(buffer.length);
      socket.write(Buffer.concat([Buffer.from('zINSTREAM\0'), length, buffer, Buffer.alloc(4)]));
    });
    socket.on('data', (chunk: string) => {
      response += chunk;
      if (response.length > 2048) socket.destroy(new Error('Invalid scan reply'));
      else if (response.includes('\0')) {
        resolve(response.split('\0')[0]);
        socket.destroy();
      }
    });
    socket.once('error', reject);
    socket.once('close', () => {
      clearTimeout(deadline);
      reject(new Error('Scanner closed connection'));
    });
  }).catch(() => { throw new ServiceUnavailableException('File scanning is unavailable.'); });
  if (reply.endsWith(' FOUND')) throw new BadRequestException('The PDF did not pass the safety scan.');
  if (reply !== 'stream: OK') throw new ServiceUnavailableException('File scanning is unavailable.');
}
