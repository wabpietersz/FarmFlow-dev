import { Router } from 'express';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import employeeRoutes from './employees';
import siteRoutes from './sites';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Auth routes
router.use('/auth', authRoutes);

// Dashboard
router.use('/dashboard', dashboardRoutes);

// Employees
router.use('/employees', employeeRoutes);

// Sites
router.use('/sites', siteRoutes);

// Future route mounts:
// router.use('/users', userRoutes);
// router.use('/cages', cageRoutes);
// router.use('/batches', batchRoutes);
// router.use('/daily-records', dailyRecordRoutes);
// router.use('/vaccinations', vaccinationRoutes);
// router.use('/buyers', buyerRoutes);
// router.use('/sales', saleRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/system-config', systemConfigRoutes);
// router.use('/notifications', notificationRoutes);
// router.use('/documents', documentRoutes);

export default router;
