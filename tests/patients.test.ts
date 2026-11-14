import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../src/app';
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from './setup';
import {
  authHeader,
  createAdmin,
  createDoctor,
  createPatient,
  createDoctors,
  getAccessToken,
  validPatientPayload,
} from './helpers';

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

describe('POST /api/patients', () => {
  it('rejects unauthenticated creation', async () => {
    const doctor = await createDoctor();
    const response = await request(app)
      .post('/api/patients')
      .send({ ...validPatientPayload, doctorId: doctor._id.toString() });
    expect(response.status).toBe(401);
  });

  it('creates a patient linked to an existing doctor', async () => {
    const doctor = await createDoctor();
    const response = await request(app)
      .post('/api/patients')
      .set(authHeader(token))
      .send({ ...validPatientPayload, doctorId: doctor._id.toString() });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe(validPatientPayload.name);
    expect(response.body.data.condition).toBe('diabetes');
    expect(response.body.data.doctorId).toBe(doctor._id.toString());
  });

  it('rejects a doctorId that does not exist (422, prevents orphans)', async () => {
    const response = await request(app)
      .post('/api/patients')
      .set(authHeader(token))
      .send({
        ...validPatientPayload,
        doctorId: new Types.ObjectId('5f7b1b3b7f3d4c2b1a9e8f7d').toString(),
      });

    expect(response.status).toBe(422);
    expect(response.body.error.details[0].path).toBe('doctorId');
  });

  it('rejects invalid condition / gender values', async () => {
    const doctor = await createDoctor();
    const response = await request(app)
      .post('/api/patients')
      .set(authHeader(token))
      .send({
        ...validPatientPayload,
        doctorId: doctor._id.toString(),
        condition: 'dragonpox',
        gender: 'unknown',
      });

    expect(response.status).toBe(422);
    const paths = response.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['condition', 'gender']));
  });
});

describe('GET /api/patients', () => {
  it('lists patients with pagination meta', async () => {
    const doctor = await createDoctor();
    for (let i = 0; i < 14; i += 1) {
      await createPatient(doctor._id, { name: `Patient ${String(i).padStart(2, '0')}` });
    }

    const response = await request(app).get('/api/patients').set(authHeader(token));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(10);
    expect(response.body.meta.total).toBe(14);
    expect(response.body.meta.totalPages).toBe(2);
  });

  it('searches by name, phone and condition', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id, { name: 'Searchable Sam', phone: '+880 1900 111 222' });
    await createPatient(doctor._id, { name: 'Other Person', condition: 'asthma' });

    const byName = await request(app).get('/api/patients?search=searchable').set(authHeader(token));
    expect(byName.body.data).toHaveLength(1);

    const byPhone = await request(app).get('/api/patients?search=1900').set(authHeader(token));
    expect(byPhone.body.data).toHaveLength(1);

    const byConditionText = await request(app)
      .get('/api/patients?search=asthma')
      .set(authHeader(token));
    expect(byConditionText.body.data).toHaveLength(1);
    expect(byConditionText.body.data[0].name).toBe('Other Person');
  });

  it('filters by condition', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id, { name: 'Diabetic One' });
    await createPatient(doctor._id, { name: 'Diabetic Two' });
    await createPatient(doctor._id, { name: 'Asthmatic', condition: 'asthma' });

    const response = await request(app)
      .get('/api/patients?condition=diabetes')
      .set(authHeader(token));

    expect(response.body.meta.total).toBe(2);
    expect(response.body.data.every((p: { condition: string }) => p.condition === 'diabetes')).toBe(
      true,
    );
  });

  it('filters by status and gender', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id, { name: 'Critical One', status: 'critical', gender: 'female' });
    await createPatient(doctor._id, { name: 'Recovered', status: 'discharged', gender: 'male' });

    const byStatus = await request(app).get('/api/patients?status=critical').set(authHeader(token));
    expect(byStatus.body.data).toHaveLength(1);
    expect(byStatus.body.data[0].name).toBe('Critical One');

    const byGender = await request(app).get('/api/patients?gender=female').set(authHeader(token));
    expect(byGender.body.meta.total).toBe(1);
  });

  it('filters by doctor', async () => {
    const [docA, docB] = await createDoctors(2, 100);
    await createPatient(docA._id, { name: 'Doc A Patient' });
    await createPatient(docB._id, { name: 'Doc B Patient' });

    const response = await request(app)
      .get(`/api/patients?doctorId=${docA._id}`)
      .set(authHeader(token));

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].name).toBe('Doc A Patient');
  });

  it('filters by date range', async () => {
    const doctor = await createDoctor();
    const oldDate = new Date();
    oldDate.setUTCDate(oldDate.getUTCDate() - 40);

    await createPatient(doctor._id, {
      name: 'Ancient Patient',
      createdAt: oldDate,
      updatedAt: oldDate,
    });
    await createPatient(doctor._id, { name: 'Fresh Patient' });

    const response = await request(app)
      .get(
        `/api/patients?createdFrom=${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)}`,
      )
      .set(authHeader(token));

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].name).toBe('Fresh Patient');
  });

  it('rejects unknown filter values with 422', async () => {
    const response = await request(app)
      .get('/api/patients?condition=bubblegum&page=abc')
      .set(authHeader(token));
    expect(response.status).toBe(422);
  });
});

describe('GET /api/patients/:id', () => {
  it('returns the patient with embedded doctor info', async () => {
    const doctor = await createDoctor();
    const patient = await createPatient(doctor._id);

    const response = await request(app).get(`/api/patients/${patient._id}`).set(authHeader(token));
    expect(response.status).toBe(200);
    expect(response.body.data.doctor).toBeTruthy();
    expect(response.body.data.doctor.name).toBe(doctor.name);
    expect(response.body.data.doctor.specialization).toBe('Cardiology');
  });

  it('422s on malformed id and 404s on unknown id', async () => {
    const bad = await request(app).get('/api/patients/nope').set(authHeader(token));
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await request(app)
      .get(`/api/patients/${new Types.ObjectId('5f7b1b3b7f3d4c2b1a9e8f7d').toString()}`)
      .set(authHeader(token));
    expect(missing.status).toBe(404);
  });
});

describe('PUT /api/patients/:id', () => {
  it('updates patient information', async () => {
    const doctor = await createDoctor();
    const patient = await createPatient(doctor._id);

    const response = await request(app)
      .put(`/api/patients/${patient._id}`)
      .set(authHeader(token))
      .send({ status: 'recovering', notes: 'Improving steadily.' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('recovering');
    expect(response.body.data.notes).toBe('Improving steadily.');
  });

  it('can reassign the patient to another doctor', async () => {
    const docA = await createDoctor();
    const docB = await createDoctor({ name: 'Dr. Target', email: 'target@careguide.test' });
    const patient = await createPatient(docA._id);

    const response = await request(app)
      .put(`/api/patients/${patient._id}`)
      .set(authHeader(token))
      .send({ doctorId: docB._id.toString() });

    expect(response.status).toBe(200);
    expect(response.body.data.doctorId).toBe(docB._id.toString());
  });

  it('refuses reassignment to a nonexistent doctor', async () => {
    const doctor = await createDoctor();
    const patient = await createPatient(doctor._id);

    const response = await request(app)
      .put(`/api/patients/${patient._id}`)
      .set(authHeader(token))
      .send({ doctorId: new Types.ObjectId('5f7b1b3b7f3d4c2b1a9e8f7d').toString() });

    expect(response.status).toBe(422);
  });
});

describe('DELETE /api/patients/:id', () => {
  it('deletes a patient and it disappears from the doctor list', async () => {
    const doctor = await createDoctor();
    const patient = await createPatient(doctor._id);

    const response = await request(app)
      .delete(`/api/patients/${patient._id}`)
      .set(authHeader(token));
    expect(response.status).toBe(200);

    const doctorPatients = await request(app)
      .get(`/api/doctors/${doctor._id}/patients`)
      .set(authHeader(token));
    expect(doctorPatients.body.meta.total).toBe(0);

    const getDeleted = await request(app)
      .get(`/api/patients/${patient._id}`)
      .set(authHeader(token));
    expect(getDeleted.status).toBe(404);
  });

  it('404s when deleting an unknown patient', async () => {
    const response = await request(app)
      .delete(`/api/patients/${new Types.ObjectId('5f7b1b3b7f3d4c2b1a9e8f7d').toString()}`)
      .set(authHeader(token));
    expect(response.status).toBe(404);
  });
});
