import request from 'supertest';
import { app } from '../src/app';
import { clearDatabase, disconnectTestDatabase } from './setup';
import {
  authHeader,
  createAdmin,
  createDoctor,
  createDoctors,
  createPatient,
  getAccessToken,
  validDoctorPayload,
} from './helpers';

let token: string;

beforeEach(async () => {
  await clearDatabase();
  await createAdmin();
  token = await getAccessToken();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await disconnectTestDatabase();
});

describe('POST /api/doctors', () => {
  it('rejects unauthenticated creation', async () => {
    const response = await request(app).post('/api/doctors').send(validDoctorPayload);
    expect(response.status).toBe(401);
  });

  it('creates a doctor with all PDF-specified fields', async () => {
    const response = await request(app)
      .post('/api/doctors')
      .set(authHeader(token))
      .send(validDoctorPayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe(validDoctorPayload.name);
    expect(response.body.data.specialization).toBe('Cardiology');
    expect(response.body.data.hospital).toBe(validDoctorPayload.hospital);
    expect(response.body.data.phone).toBe(validDoctorPayload.phone);
    expect(response.body.data.email).toBe(validDoctorPayload.email);
    expect(response.body.data._id).toBeTruthy();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/doctors').set(authHeader(token)).send(validDoctorPayload);
    const duplicate = await request(app)
      .post('/api/doctors')
      .set(authHeader(token))
      .send({ ...validDoctorPayload, name: 'Another Name' });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('rejects invalid payloads with field-level 422 details', async () => {
    const response = await request(app).post('/api/doctors').set(authHeader(token)).send({
      name: 'A',
      specialization: 'Quantum Physics',
      hospital: '',
      phone: 'abc',
      email: 'not-an-email',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    const paths = response.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining(['name', 'specialization', 'hospital', 'phone', 'email']),
    );
  });
});

describe('GET /api/doctors', () => {
  it('returns paginated doctors with meta', async () => {
    await createDoctors(12);
    const response = await request(app).get('/api/doctors').set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(10);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
  });

  it('serves the second page correctly', async () => {
    await createDoctors(12);
    const response = await request(app).get('/api/doctors?page=2&limit=10').set(authHeader(token));

    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta.page).toBe(2);
  });

  it('searches across name, email, hospital and specialization', async () => {
    await createDoctors(4);
    await createDoctor({
      name: 'Dr. Zelda Windmere',
      email: 'zelda@careguide.test',
      hospital: 'Northwind Clinic',
    });

    const byName = await request(app).get('/api/doctors?search=zelda').set(authHeader(token));
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].name).toBe('Dr. Zelda Windmere');

    const byHospital = await request(app)
      .get('/api/doctors?search=northwind')
      .set(authHeader(token));
    expect(byHospital.body.data).toHaveLength(1);

    const bySpecialization = await request(app)
      .get('/api/doctors?search=neurology')
      .set(authHeader(token));
    expect(bySpecialization.body.data).toHaveLength(1);

    const noMatch = await request(app)
      .get('/api/doctors?search=zzzznotfound')
      .set(authHeader(token));
    expect(noMatch.body.data).toHaveLength(0);
    expect(noMatch.body.meta.total).toBe(0);
  });

  it('searches safely when input contains regex metacharacters', async () => {
    await createDoctors(3);
    const response = await request(app).get('/api/doctors?search=(.*+?').set(authHeader(token));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  it('filters by specialization', async () => {
    await createDoctors(8);
    const response = await request(app)
      .get('/api/doctors?specialization=Neurology')
      .set(authHeader(token));

    expect(response.body.meta.total).toBe(2);
    expect(
      response.body.data.every((d: { specialization: string }) => d.specialization === 'Neurology'),
    ).toBe(true);
  });

  it('filters by date range (createdFrom / createdTo)', async () => {
    const old = new Date();
    old.setUTCDate(old.getUTCDate() - 30);
    const recent = new Date();

    await createDoctor({
      name: 'Dr. Old Timer',
      email: 'old@careguide.test',
      createdAt: old,
      updatedAt: old,
    });
    await createDoctor({ name: 'Dr. New Face', email: 'new@careguide.test', createdAt: recent });

    const response = await request(app)
      .get(
        '/api/doctors?createdFrom=' +
          new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
      )
      .set(authHeader(token));

    expect(response.body.meta.total).toBe(1);
    expect(response.body.data[0].name).toBe('Dr. New Face');
  });

  it('sorts by name ascending', async () => {
    await createDoctors(5);
    const response = await request(app)
      .get('/api/doctors?sortBy=name&sortOrder=asc&limit=5')
      .set(authHeader(token));

    const names = response.body.data.map((d: { name: string }) => d.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('rejects invalid query values with 422', async () => {
    const response = await request(app)
      .get('/api/doctors?page=0&limit=1000&specialization=Magic')
      .set(authHeader(token));
    expect(response.status).toBe(422);
  });
});

describe('GET /api/doctors/:id', () => {
  it('returns doctor details including patient count', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id);
    await createPatient(doctor._id, { name: 'Second Patient', email: 'second@example.test' });

    const response = await request(app).get(`/api/doctors/${doctor._id}`).set(authHeader(token));
    expect(response.status).toBe(200);
    expect(response.body.data.patientCount).toBe(2);
    expect(response.body.data.email).toBe(validDoctorPayload.email);
  });

  it('404s for an unknown but well-formed id', async () => {
    const response = await request(app)
      .get(`/api/doctors/${'5f7b1b3b7f3d4c2b1a9e8f7d'}`)
      .set(authHeader(token));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('422s for a malformed id', async () => {
    const response = await request(app).get('/api/doctors/not-an-objectid').set(authHeader(token));
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/doctors/:id', () => {
  it('updates doctor fields', async () => {
    const doctor = await createDoctor();
    const response = await request(app)
      .put(`/api/doctors/${doctor._id}`)
      .set(authHeader(token))
      .send({ phone: '+880 1700 000 999', hospital: 'Updated General Hospital' });

    expect(response.status).toBe(200);
    expect(response.body.data.phone).toBe('+880 1700 000 999');
    expect(response.body.data.hospital).toBe('Updated General Hospital');
    expect(response.body.data.email).toBe(validDoctorPayload.email);
  });

  it('rejects changing email to one that already exists', async () => {
    const first = await createDoctor();
    const second = await createDoctor({
      name: 'Dr. Other',
      email: 'other@careguide.test',
    });

    const response = await request(app)
      .put(`/api/doctors/${second._id}`)
      .set(authHeader(token))
      .send({ email: validDoctorPayload.email });

    expect(response.status).toBe(409);
    expect(first).toBeTruthy();
  });
});

describe('DELETE /api/doctors/:id', () => {
  it('deletes a doctor with no patients', async () => {
    const doctor = await createDoctor();
    const response = await request(app).delete(`/api/doctors/${doctor._id}`).set(authHeader(token));

    expect(response.status).toBe(200);
    const found = await request(app).get(`/api/doctors/${doctor._id}`).set(authHeader(token));
    expect(found.status).toBe(404);
  });

  it('blocks deletion while patients are assigned (409)', async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id);

    const response = await request(app).delete(`/api/doctors/${doctor._id}`).set(authHeader(token));

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/still has 1 patient/);
  });
});

describe('POST /api/doctors/:id/patients', () => {
  it('creates a patient directly under the path doctor', async () => {
    const doctor = await createDoctor();
    const response = await request(app)
      .post(`/api/doctors/${doctor._id}/patients`)
      .set(authHeader(token))
      .send({
        name: 'Path Created Patient',
        phone: '+880 1900 555 010',
        gender: 'female',
        condition: 'asthma',
        status: 'active',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.doctorId).toBe(doctor._id.toString());

    const list = await request(app)
      .get(`/api/doctors/${doctor._id}/patients`)
      .set(authHeader(token));
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].name).toBe('Path Created Patient');
  });

  it('rejects invalid patient payloads with 422', async () => {
    const doctor = await createDoctor();
    const response = await request(app)
      .post(`/api/doctors/${doctor._id}/patients`)
      .set(authHeader(token))
      .send({ name: 'X' });
    expect(response.status).toBe(422);
  });

  it('rejects unauthenticated creation', async () => {
    const doctor = await createDoctor();
    const response = await request(app).post(`/api/doctors/${doctor._id}/patients`).send({
      name: 'No Auth Patient',
      phone: '+880 1900 555 011',
      gender: 'male',
      condition: 'other',
      status: 'active',
    });
    expect(response.status).toBe(401);
  });
});

describe('GET /api/doctors/:id/patients', () => {
  it('lists only the patients of the given doctor, paginated', async () => {
    const doctorA = await createDoctor();
    const doctorB = await createDoctor({ name: 'Dr. Second', email: 'second.doc@careguide.test' });

    await createPatient(doctorA._id, { name: 'Alice One' });
    await createPatient(doctorA._id, { name: 'Alice Two' });
    await createPatient(doctorB._id, { name: 'Bob Other' });

    const response = await request(app)
      .get(`/api/doctors/${doctorA._id}/patients`)
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(2);
    expect(response.body.data.map((p: { name: string }) => p.name).sort()).toEqual([
      'Alice One',
      'Alice Two',
    ]);
  });

  it("supports search and pagination inside a doctor's patient list", async () => {
    const doctor = await createDoctor();
    await createPatient(doctor._id, { name: 'Findable Fred' });
    await createPatient(doctor._id, { name: 'Hidden Harry' });

    const response = await request(app)
      .get(`/api/doctors/${doctor._id}/patients?search=findable`)
      .set(authHeader(token));

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe('Findable Fred');
  });

  it('404s when the doctor does not exist', async () => {
    const response = await request(app)
      .get(`/api/doctors/${'5f7b1b3b7f3d4c2b1a9e8f7d'}/patients`)
      .set(authHeader(token));
    expect(response.status).toBe(404);
  });
});
