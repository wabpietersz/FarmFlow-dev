import { Router } from 'express';
import authRoutes from './auth';

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

// Future route mounts:
// router.use('/users', userRoutes);
// router.use('/employees', employeeRoutes);
// router.use('/sites', siteRoutes);
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
