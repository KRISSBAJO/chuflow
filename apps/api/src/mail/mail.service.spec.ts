import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('Relykit email transport', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  const service = new MailService(
    new ConfigService({
      mailProvider: 'relykit',
      relykitApiKey: 'rlk_live_test_only',
      mailFrom: 'ChuFlow <no-reply@chuflow.com>',
    }),
  );
  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });
  afterAll(() => {
    global.fetch = originalFetch;
  });
  it('uses the official endpoint, safe retries and provider acceptance without claiming delivery', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email-1', status: 'queued' }),
    });
    const payload = {
      to: 'test@example.com',
      subject: 'Welcome',
      text: 'Hello',
      idempotencyKey: 'test-stable-key',
    };
    const result = await service.sendAppEmail(payload);
    await service.sendAppEmail(payload);
    expect(result).toMatchObject({
      accepted: true,
      deliveryStatus: 'queued',
      messageId: 'email-1',
    });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.relykit.com/emails');
    expect(options.redirect).toBe('error');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer rlk_live_test_only',
    });
    expect(
      (
        fetchMock.mock.calls[1] as [string, { headers: Record<string, string> }]
      )[1].headers['Idempotency-Key'],
    ).toBe((options.headers as Record<string, string>)['Idempotency-Key']);
  });
  it('does not disclose provider error bodies', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => ({ message: 'secret link and key' }),
    });
    await expect(
      service.sendAppEmail({ to: 'test@example.com', subject: 'a', text: 'b' }),
    ).rejects.toThrow('Email provider rejected the request (403)');
  });
  it('escapes welcome content and never includes a temporary password', async () => {
    const send = jest
      .spyOn(service, 'sendAppEmail')
      .mockResolvedValue({ delivered: true, previewUrl: null, messageId: '1' });
    await service.sendWelcomeEmail(
      'test@example.com',
      '<script>name</script>',
      'district admin',
      'Atlanta & Americas',
      'https://chuflow.com/reset-password?token=example',
    );
    const message = send.mock.calls[0][0];
    expect(message.html).toContain('&lt;script&gt;name&lt;/script&gt;');
    expect(message.html).toContain('Atlanta &amp; Americas');
    expect(message.text).toContain('24 hours');
    expect(message.text).not.toContain('temporary password');
    send.mockRestore();
  });
});
