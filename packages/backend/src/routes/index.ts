import { Router } from 'express';
import authRoutes from './auth';
import dashboardRoutes from './dashboard';
import employeeRoutes from './employees';
import siteRoutes from './sites';
import batchRoutes from './batches';
import documentRoutes from './documents';
import buyerRoutes from './buyers';
import saleRoutes from './sales';
import paymentRoutes from './payments';
import reportRoutes from './reports';
import feedRoutes from './feed';
import inventoryRoutes from './inventory';
import systemConfigRoutes from './systemConfig';
import shiftRoutes from './shifts';
import attendanceRoutes from './attendance';
import leaveBalanceRoutes from './leave-balances';
import payrollRoutes from './payroll';
import compensationTemplateRoutes from './compensation-templates';
import treasuryRoutes from './treasury';
import { healthCheckHandler, metricsHandler } from '../middleware/monitoring';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// Health check (with dependency status)
router.get('/health', healthCheckHandler);

// Metrics endpoint (admin only)
router.get('/metrics', authenticate, requirePermission('system:read'), metricsHandler);

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

// Buyers, Sales, Payments
router.use('/buyers', buyerRoutes);
router.use('/sales', saleRoutes);
router.use('/payments', paymentRoutes);

// Reports & Analytics
router.use('/reports', reportRoutes);

// Treasury
router.use('/treasury', treasuryRoutes);

// Feed Management
router.use('/feed', feedRoutes);

// Inventory Management
router.use('/inventory', inventoryRoutes);

// System Configuration
router.use('/system-config', systemConfigRoutes);

// Attendance & Payroll
router.use('/shifts', shiftRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leave-balances', leaveBalanceRoutes);
router.use('/payroll', payrollRoutes);
router.use('/compensation-templates', compensationTemplateRoutes);

export default router;
