import request from 'supertest';
import { app } from '../src/app';
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from './setup';
import { authHeader, createAdmin, createDoctor, createPatient, getAccessToken } from './helpers';

let token: string;

beforeAll(async () => {
  await connectTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
  await createAdmin();
  token = await getAccessToken();
});

afterAll(async () => {
  await disconnectTestDatabase();
});

describe('GET /api/dashboard/overview', () => {
  it('returns zeroed stats for an empty database without crashing', async () => {
    const response = await request(app).get('/api/dashboard/overview').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.totalDoctors).toBe(0);
    expect(response.body.data.totalPatients).toBe(0);
    expect(response.body.data.avgPatientsPerDoctor).toBe(0);
    expect(response.body.data.byCondition).toEqual([]);
    expect(response.body.data.registrationsByDay).toEqual([]);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/dashboard/overview');
    expect(response.status).toBe(401);
  });

  it('computes totals, patients per doctor and date-based statistics', async () => {
    const docA = await createDoctor({ name: 'Dr. Alpha', email: 'alpha@careguide.test' });
    const docB = await createDoctor({
      name: 'Dr. Beta',
      email: 'beta@careguide.test',
      specialization: 'Neurology',
    });

    await createPatient(docA._id, { name: 'One', condition: 'diabetes', status: 'active' });
    await createPatient(docA._id, { name: 'Two', condition: 'diabetes', status: 'critical' });
    await createPatient(docB._id, { name: 'Three', condition: 'asthma', status: 'recovering' });

    const response = await request(app).get('/api/dashboard/overview').set(authHeader(token));

    const { data } = response.body;
    expect(data.totalDoctors).toBe(2);
    expect(data.totalPatients).toBe(3);
    expect(data.avgPatientsPerDoctor).toBe(1.5);
    expect(data.criticalPatients).toBe(1);

    const diabetes = data.byCondition.find((c: { _id: string }) => c._id === 'diabetes');
    expect(diabetes.count).toBe(2);

    const asthma = data.byCondition.find((c: { _id: string }) => c._id === 'asthma');
    expect(asthma.count).toBe(1);

    expect(data.newPatientsLast7Days).toBe(3);
    expect(Array.isArray(data.registrationsByDay)).toBe(true);
    const dayBuckets = data.registrationsByDay.reduce(
      (sum: number, day: { patients: number }) => sum + day.patients,
      0,
    );
    expect(dayBuckets).toBe(3);
  });

  it('excludes old registrations from the 7-day window but keeps totals', async () => {
    const doctor = await createDoctor();
    const oldDate = new Date();
    oldDate.setUTCDate(oldDate.getUTCDate() - 20);

    await createPatient(doctor._id, { name: 'Old', createdAt: oldDate, updatedAt: oldDate });
    await createPatient(doctor._id, { name: 'New' });

    const response = await request(app).get('/api/dashboard/overview').set(authHeader(token));
    expect(response.body.data.totalPatients).toBe(2);
    expect(response.body.data.newPatientsLast7Days).toBe(1);
    expect(response.body.data.newPatientsLast30Days).toBe(2);
  });
});

describe('GET /api/dashboard/analytics', () => {
  it('ranks doctors by patient load and includes doctor names (no N+1 holes)', async () => {
    const docA = await createDoctor({ name: 'Dr. Busy', email: 'busy@careguide.test' });
    const docB = await createDoctor({ name: 'Dr. Quiet', email: 'quiet@careguide.test' });

    await createPatient(docA._id, { name: 'P1' });
    await createPatient(docA._id, { name: 'P2' });
    await createPatient(docA._id, { name: 'P3' });
    await createPatient(docB._id, { name: 'P4' });

    const response = await request(app).get('/api/dashboard/analytics').set(authHeader(token));

    expect(response.status).toBe(200);
    const ranking = response.body.data.patientsPerDoctor;
    expect(ranking).toHaveLength(2);
    expect(ranking[0].doctorName).toBe('Dr. Busy');
    expect(ranking[0].patientCount).toBe(3);
    expect(ranking[1].doctorName).toBe('Dr. Quiet');
    expect(ranking[1].patientCount).toBe(1);
    expect(ranking[0].specialization).toBeTruthy();
  });

  it('supports the days window parameter', async () => {
    const response = await request(app)
      .get('/api/dashboard/analytics?days=30')
      .set(authHeader(token));
    expect(response.status).toBe(200);
    expect(response.body.data.windowDays).toBe(30);
  });

  it('falls back to the default window for invalid days', async () => {
    const response = await request(app)
      .get('/api/dashboard/analytics?days=banana')
      .set(authHeader(token));
    expect(response.status).toBe(200);
    expect(response.body.data.windowDays).toBe(14);
  });
});

describe('GET /api/dashboard/recent', () => {
  it('returns the most recent doctors and patients', async () => {
    const doctor = await createDoctor({ name: 'Dr. Latest' });
    await createPatient(doctor._id, { name: 'Ms. Latest Patient' });
    await createPatient(doctor._id, { name: 'Mr. Older Patient' });

    const response = await request(app).get('/api/dashboard/recent').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.doctors[0].name).toBe('Dr. Latest');
    expect(response.body.data.patients[0].name).toBe('Mr. Older Patient');
    expect(response.body.data.patients.length).toBeLessThanOrEqual(5);
  });
});
