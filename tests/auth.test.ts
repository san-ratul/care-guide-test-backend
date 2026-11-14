import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from './setup';
import { ADMIN_EMAIL, ADMIN_PASSWORD, authHeader, createAdmin } from './helpers';

beforeAll(async () => {
  await connectTestDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await disconnectTestDatabase();
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await createAdmin();
  });

  it('logs in with valid credentials and returns tokens + user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(ADMIN_EMAIL);
    expect(response.body.data.user).not.toHaveProperty('password');
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.refreshToken).toBeTruthy();
    expect(response.body.data.refreshToken).toHaveLength(128);
  });

  it('rejects an unknown email with a generic 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: ADMIN_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Invalid email or password');
  });

  it('rejects a wrong password with a generic 401', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'WrongPassword!' });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Invalid email or password');
  });

  it('rejects missing credentials with 422', async () => {
    const missingEmail = await request(app)
      .post('/api/auth/login')
      .send({ password: ADMIN_PASSWORD });
    const missingPassword = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL });

    expect(missingEmail.status).toBe(422);
    expect(missingEmail.body.error.code).toBe('VALIDATION_ERROR');
    expect(missingPassword.status).toBe(422);
  });

  it('rejects a malformed email with 422', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: ADMIN_PASSWORD });

    expect(response.status).toBe(422);
  });
});

describe('Authentication middleware', () => {
  it('blocks protected endpoints without a token', async () => {
    const response = await request(app).get('/api/doctors');
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Missing or malformed Authorization header');
  });

  it('blocks requests with an invalid token', async () => {
    const response = await request(app).get('/api/doctors').set(authHeader('this-is-not-a-jwt'));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_INVALID');
  });

  it('blocks requests with an expired token', async () => {
    const admin = await createAdmin();
    const expired = jwt.sign(
      { sub: admin.id, email: ADMIN_EMAIL, role: 'admin' },
      process.env.JWT_ACCESS_SECRET as string,
      { expiresIn: '-10s' },
    );

    const response = await request(app).get('/api/doctors').set(authHeader(expired));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('blocks tokens signed with the wrong secret', async () => {
    const admin = await createAdmin();
    const forged = jwt.sign(
      { sub: admin.id, email: ADMIN_EMAIL, role: 'admin' },
      'wrong-secret-1234567890',
    );

    const response = await request(app).get('/api/doctors').set(authHeader(forged));
    expect(response.status).toBe(401);
  });

  it('blocks tokens for deleted users', async () => {
    const admin = await createAdmin();
    const token = await (
      await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    ).body.data.accessToken;
    await (await import('../src/models/user.model')).User.findByIdAndDelete(admin.id);

    const response = await request(app).get('/api/doctors').set(authHeader(token));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user profile', async () => {
    await createAdmin();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const token = login.body.data.accessToken;

    const response = await request(app).get('/api/auth/me').set(authHeader(token));
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(ADMIN_EMAIL);
    expect(response.body.data.user).not.toHaveProperty('password');
  });
});

describe('Refresh token rotation and logout', () => {
  it('rotates refresh tokens and invalidates the previous one', async () => {
    await createAdmin();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const firstRefresh = login.body.data.refreshToken;

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.refreshToken).toBeTruthy();
    expect(refresh.body.data.refreshToken).not.toBe(firstRefresh);

    const replay = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_INVALID');

    const refreshAgain = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh.body.data.refreshToken });
    expect(refreshAgain.status).toBe(200);
  });

  it('rejects a garbage refresh token', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(response.status).toBe(401);
  });

  it('revokes the refresh token on logout so it can no longer be used', async () => {
    await createAdmin();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const { refreshToken } = login.body.data;

    const logout = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(logout.status).toBe(200);

    const refreshAfterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('responds without authentication', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });
});
