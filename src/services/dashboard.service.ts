import { Types } from 'mongoose';
import { Doctor } from '../models/doctor.model';
import { Patient } from '../models/patient.model';

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date;
}

export interface OverviewStats {
  totalDoctors: number;
  totalPatients: number;
  avgPatientsPerDoctor: number;
  activeDoctors: number;
  newPatientsLast7Days: number;
  newPatientsLast30Days: number;
  criticalPatients: number;
  dischargedPatients: number;
  byCondition: Array<{ _id: string; count: number }>;
  byGender: Array<{ _id: string; count: number }>;
  byStatus: Array<{ _id: string; count: number }>;
  registrationsByDay: Array<{ _id: string; patients: number; doctors: number }>;
}

interface OverviewFacet {
  totalPatients: Array<{ count: number }>;
  byCondition: Array<{ _id: string; count: number }>;
  byGender: Array<{ _id: string; count: number }>;
  byStatus: Array<{ _id: string; count: number }>;
  last7: Array<{ count: number }>;
  last30: Array<{ count: number }>;
  perDoctorCounts: Array<{ avg: number | null; doctorsWithPatients: number }>;
  byDay: Array<{ _id: string; count: number }>;
}

const EMPTY_FACET: OverviewFacet = {
  totalPatients: [],
  byCondition: [],
  byGender: [],
  byStatus: [],
  last7: [],
  last30: [],
  perDoctorCounts: [],
  byDay: [],
};

/**
 * Single $facet pipeline over patients + one count on doctors:
 * two round trips total for the entire overview payload.
 */
export async function getOverview(): Promise<OverviewStats> {
  const since = daysAgo(30);

  const [doctorsCount, patientFacet] = await Promise.all([
    Doctor.countDocuments({}),
    Patient.aggregate<OverviewFacet>([
      {
        $facet: {
          totalPatients: [{ $count: 'count' }],
          byCondition: [
            { $group: { _id: '$condition', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byGender: [{ $group: { _id: '$gender', count: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          last7: [{ $match: { createdAt: { $gte: daysAgo(7) } } }, { $count: 'count' }],
          last30: [{ $match: { createdAt: { $gte: since } } }, { $count: 'count' }],
          perDoctorCounts: [
            { $group: { _id: '$doctorId', count: { $sum: 1 } } },
            {
              $group: {
                _id: null,
                avg: { $avg: '$count' },
                doctorsWithPatients: { $sum: 1 },
              },
            },
          ],
          byDay: [
            { $match: { createdAt: { $gte: since } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]),
  ]);

  const doctorRegistrations = await Doctor.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
  ]);

  const facet: OverviewFacet = patientFacet[0] ?? EMPTY_FACET;

  const totalPatients = facet.totalPatients[0]?.count ?? 0;
  const avg = facet.perDoctorCounts[0]?.avg ?? 0;

  const dayMap = new Map<string, { patients: number; doctors: number }>();
  for (const entry of facet.byDay) {
    dayMap.set(entry._id, { patients: entry.count, doctors: 0 });
  }
  for (const entry of doctorRegistrations) {
    const bucket = dayMap.get(entry._id) ?? { patients: 0, doctors: 0 };
    bucket.doctors = entry.count;
    dayMap.set(entry._id, bucket);
  }
  const registrationsByDay = [...dayMap.entries()]
    .map(([date, value]) => ({ _id: date, ...value }))
    .sort((a, b) => a._id.localeCompare(b._id));

  return {
    totalDoctors: doctorsCount,
    totalPatients,
    avgPatientsPerDoctor: Math.round(avg * 10) / 10,
    activeDoctors: doctorsCount,
    newPatientsLast7Days: facet.last7[0]?.count ?? 0,
    newPatientsLast30Days: facet.last30[0]?.count ?? 0,
    criticalPatients: facet.byStatus.find((s) => s._id === 'critical')?.count ?? 0,
    dischargedPatients: facet.byStatus.find((s) => s._id === 'discharged')?.count ?? 0,
    byCondition: facet.byCondition,
    byGender: facet.byGender,
    byStatus: facet.byStatus,
    registrationsByDay,
  };
}

export interface AnalyticsStats {
  patientsPerDoctor: Array<{
    doctorId: string;
    doctorName: string;
    specialization: string;
    hospital: string;
    patientCount: number;
  }>;
  doctorsPerDay: Array<{ _id: string; count: number }>;
  patientsPerDay: Array<{ _id: string; count: number }>;
  totalDoctors: number;
  totalPatients: number;
  windowDays: number;
}

/** Top doctors by patient load, plus daily registration series — one $lookup pipeline, no N+1. */
export async function getAnalytics(rawDays?: number): Promise<AnalyticsStats> {
  const windowDays = rawDays && [7, 14, 30, 60, 90].includes(rawDays) ? rawDays : 14;
  const since = daysAgo(windowDays);

  const patientsPerDoctor = await Patient.aggregate<AnalyticsStats['patientsPerDoctor'][number]>([
    { $group: { _id: '$doctorId', patientCount: { $sum: 1 } } },
    { $sort: { patientCount: -1 } },
    { $limit: 8 },
    {
      $lookup: {
        from: 'doctors',
        localField: '_id',
        foreignField: '_id',
        as: 'doctor',
        pipeline: [{ $project: { name: 1, specialization: 1, hospital: 1 } }],
      },
    },
    { $unwind: '$doctor' },
    {
      $project: {
        _id: 0,
        doctorId: { $toString: '$_id' },
        doctorName: '$doctor.name',
        specialization: '$doctor.specialization',
        hospital: '$doctor.hospital',
        patientCount: 1,
      },
    },
  ]);

  const [doctorsPerDay, patientsPerDay] = await Promise.all([
    Doctor.aggregate<AnalyticsStats['doctorsPerDay'][number]>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Patient.aggregate<AnalyticsStats['patientsPerDay'][number]>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const [totalDoctors, totalPatients] = await Promise.all([
    Doctor.countDocuments({}),
    Patient.countDocuments({}),
  ]);

  return {
    patientsPerDoctor,
    doctorsPerDay,
    patientsPerDay,
    totalDoctors,
    totalPatients,
    windowDays,
  };
}

export async function getRecent(limit = 5) {
  const [doctors, patients] = await Promise.all([
    Doctor.find({})
      .select({ name: 1, specialization: 1, hospital: 1, createdAt: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean({ virtuals: false }),
    Patient.find({})
      .select({ name: 1, condition: 1, status: 1, createdAt: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean({ virtuals: false }),
  ]);

  return { doctors, patients };
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
