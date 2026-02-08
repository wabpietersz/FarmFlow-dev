import { Router } from 'express';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import employeeRoutes from './employees';
import siteRoutes from './sites';
import batchRoutes from './batches';
import documentRoutes from './documents';

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

// Sites & Cages
router.use('/sites', siteRoutes);

// Batches, Daily Records, Vaccinations
router.use('/batches', batchRoutes);

// Documents (file upload/download)
router.use('/documents', documentRoutes);

// Future route mounts:
// router.use('/buyers', buyerRoutes);
// router.use('/sales', saleRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/system-config', systemConfigRoutes);
// router.use('/notifications', notificationRoutes);

export default router;
