import { AppController } from './app.controller';

describe('Health release identification', () => {
  const original = process.env.RENDER_GIT_COMMIT;
  afterEach(() => {
    if (original === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = original;
  });
  it('identifies a deployed source revision without changing readiness', () => {
    process.env.RENDER_GIT_COMMIT = 'a'.repeat(40);
    expect(new AppController().getHealth()).toMatchObject({
      status: 'ok',
      service: 'church-management-api',
      release: 'a'.repeat(40),
    });
  });
  it('omits unset or unexpected environment values', () => {
    for (const value of [undefined, 'not-a-source-revision']) {
      if (value === undefined) delete process.env.RENDER_GIT_COMMIT;
      else process.env.RENDER_GIT_COMMIT = value;
      expect(new AppController().getHealth()).not.toHaveProperty('release');
    }
  });
});
