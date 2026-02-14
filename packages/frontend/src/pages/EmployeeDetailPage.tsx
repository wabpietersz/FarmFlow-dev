import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  useEmployee,
  useAddEmergencyContact,
  useDeleteEmergencyContact,
  useUpsertBankDetails,
  useDeleteBankDetails,
  useCompensationProfile,
  useCompensationHistory,
  useCreateCompensationRevision,
  useUpdateCompensationRevision,
  useActivateCompensationRevision,
  useDeleteCompensationRevision,
} from '@/hooks/useEmployees';
import { useAuthStore } from '@/store/authStore';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  emergencyContactFormSchema,
  bankDetailsFormSchema,
  compensationRevisionFormSchema,
  type EmergencyContactFormValues,
  type BankDetailsFormValues,
  type CompensationRevisionFormValues,
} from '@/lib/validations/employee';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import DocumentList from '@/components/documents/DocumentList';
import { getApiErrorMessage, parseApiError } from '@/lib/api';
import type { CreateCompensationRevisionRequest, PayType } from '@farmflow/shared';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = useEmployee(id);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [compensationDialogOpen, setCompensationDialogOpen] = useState(false);
  const [compensationError, setCompensationError] = useState<string | null>(null);
  const [editingRevisionId, setEditingRevisionId] = useState<number | null>(null);

  const addContact = useAddEmergencyContact(id!);
  const deleteContact = useDeleteEmergencyContact(id!);
  const upsertBank = useUpsertBankDetails(id!);
  const deleteBank = useDeleteBankDetails(id!);
  const { data: compensationProfileData } = useCompensationProfile(id);
  const { data: compensationHistoryData } = useCompensationHistory(id, 1, 50);
  const createCompensationRevision = useCreateCompensationRevision(id!);
  const updateCompensationRevision = useUpdateCompensationRevision(id!);
  const activateCompensationRevision = useActivateCompensationRevision(id!);
  const deleteCompensationRevision = useDeleteCompensationRevision(id!);

  const contactForm = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(emergencyContactFormSchema),
    defaultValues: { contactName: '', relationship: '', phoneNumber: '' },
  });

  const bankForm = useForm<BankDetailsFormValues>({
    resolver: zodResolver(bankDetailsFormSchema),
    defaultValues: { accountHolderName: '', bankName: '', branchCode: '', accountNumber: '', ifscCode: '' },
  });

  const compensationForm = useForm<CompensationRevisionFormValues>({
    resolver: zodResolver(compensationRevisionFormSchema),
    defaultValues: {
      payType: 'monthly',
      baseRate: 0,
      overtimeRate: 0,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      standardHoursPerDay: 8,
      notes: '',
      isActive: true,
      components: [],
    },
  });

  const componentsFieldArray = useFieldArray({
    control: compensationForm.control,
    name: 'components',
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const detail = data?.data;
  const employee = detail?.employee;
  if (!employee) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-foreground">Employee not found</h2>
        <p className="text-muted-foreground mt-2">The employee you are looking for does not exist.</p>
        <Button asChild className="mt-4">
          <Link to="/employees">Back to Employees</Link>
        </Button>
      </div>
    );
  }

  const emergencyContacts = detail?.emergencyContacts ?? [];
  const bankDetails = detail?.bankDetails ?? null;
  const compensationProfile = compensationProfileData?.data;
  const currentCompensation = compensationProfile?.currentRevision ?? null;
  const upcomingCompensation = compensationProfile?.upcomingRevision ?? null;
  const compensationHistory = compensationHistoryData?.data ?? [];
  const todayIso = new Date().toISOString().split('T')[0];

  const statusVariant = (s: string) => {
    if (s === 'active') return 'default' as const;
    if (s === 'on_leave') return 'secondary' as const;
    return 'destructive' as const;
  };

  const handleAddContact = async (values: EmergencyContactFormValues) => {
    try {
      await addContact.mutateAsync(values);
      toast.success('Emergency contact added');
      setContactDialogOpen(false);
      contactForm.reset();
    } catch {
      toast.error('Failed to add emergency contact');
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    try {
      await deleteContact.mutateAsync(contactId);
      toast.success('Emergency contact removed');
    } catch {
      toast.error('Failed to remove contact');
    }
  };

  const handleUpsertBank = async (values: BankDetailsFormValues) => {
    try {
      await upsertBank.mutateAsync({
        accountHolderName: values.accountHolderName,
        bankName: values.bankName,
        branchCode: values.branchCode || undefined,
        accountNumber: values.accountNumber,
        ifscCode: values.ifscCode || undefined,
      });
      toast.success('Bank details saved');
      setBankDialogOpen(false);
      bankForm.reset();
    } catch {
      toast.error('Failed to save bank details');
    }
  };

  const handleDeleteBank = async () => {
    try {
      await deleteBank.mutateAsync();
      toast.success('Bank details removed');
    } catch {
      toast.error('Failed to remove bank details');
    }
  };

  const handleSaveCompensationRevision = async (values: CompensationRevisionFormValues) => {
    try {
      setCompensationError(null);
      const payload: CreateCompensationRevisionRequest = {
        payType: values.payType as PayType,
        baseRate: values.baseRate,
        overtimeRate: values.overtimeRate,
        effectiveFrom: values.effectiveFrom,
        effectiveTo: values.effectiveTo || null,
        standardHoursPerDay: values.standardHoursPerDay,
        notes: values.notes || undefined,
        isActive: values.isActive,
        components: values.components.map((component) => ({
          componentType: component.componentType as NonNullable<CreateCompensationRevisionRequest['components']>[number]['componentType'],
          name: component.name,
          calculationType: component.calculationType as NonNullable<CreateCompensationRevisionRequest['components']>[number]['calculationType'],
          value: component.value,
          isTaxable: component.isTaxable,
          isActive: component.isActive,
        })),
      };

      if (editingRevisionId) {
        await updateCompensationRevision.mutateAsync({ revisionId: editingRevisionId, data: payload });
        toast.success('Compensation revision updated');
      } else {
        await createCompensationRevision.mutateAsync(payload);
        toast.success('Compensation revision created');
      }

      setCompensationDialogOpen(false);
      setEditingRevisionId(null);
    } catch (error) {
      const errorCode = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (errorCode === 'COMPENSATION_SCHEMA_NOT_READY') {
        setCompensationError('Compensation schema is not ready. Run npm run db:migrate -w packages/backend, restart backend, and retry.');
      } else {
        setCompensationError(getApiErrorMessage(error, 'Failed to save compensation revision'));
      }
      parseApiError(error, 'Failed to save compensation revision');
    }
  };

  const handleActivateRevision = async (revisionId: number) => {
    try {
      await activateCompensationRevision.mutateAsync(revisionId);
      toast.success('Compensation revision activated');
    } catch (error) {
      parseApiError(error, 'Failed to activate compensation revision');
    }
  };

  const handleDeleteRevision = async (revisionId: number) => {
    const confirmed = window.confirm('Delete this compensation revision? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await deleteCompensationRevision.mutateAsync(revisionId);
      toast.success('Compensation revision deleted');
    } catch (error) {
      parseApiError(error, 'Failed to delete compensation revision');
    }
  };

  const openNewRevisionDialog = () => {
    setCompensationError(null);
    setEditingRevisionId(null);
    compensationForm.reset({
      payType: 'monthly',
      baseRate: 0,
      overtimeRate: 0,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      standardHoursPerDay: 8,
      notes: '',
      isActive: true,
      components: [],
    });
    componentsFieldArray.replace([]);
    setCompensationDialogOpen(true);
  };

  const openEditRevisionDialog = (revision: NonNullable<typeof compensationHistory[number]>) => {
    setCompensationError(null);
    setEditingRevisionId(revision.id);
    const mappedComponents = (revision.components ?? []).map((component: {
      componentType: 'earning' | 'deduction';
      name: string;
      calculationType: 'fixed' | 'percentage';
      value: number;
      isTaxable: boolean;
      isActive: boolean;
    }) => ({
      componentType: component.componentType,
      name: component.name,
      calculationType: component.calculationType,
      value: Number(component.value),
      isTaxable: component.isTaxable,
      isActive: component.isActive,
    }));

    compensationForm.reset({
      payType: revision.payType,
      baseRate: Number(revision.baseRate),
      overtimeRate: Number(revision.overtimeRate),
      effectiveFrom: typeof revision.effectiveFrom === 'string'
        ? revision.effectiveFrom
        : new Date(revision.effectiveFrom).toISOString().split('T')[0],
      effectiveTo: revision.effectiveTo
        ? (typeof revision.effectiveTo === 'string'
          ? revision.effectiveTo
          : new Date(revision.effectiveTo).toISOString().split('T')[0])
        : '',
      standardHoursPerDay: Number(revision.standardHoursPerDay),
      notes: revision.notes ?? '',
      isActive: revision.isActive,
      components: mappedComponents,
    });
    componentsFieldArray.replace(mappedComponents);
    setCompensationDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {employee.firstName} {employee.lastName}
          </h1>
          <Badge variant={statusVariant(employee.status)} className="capitalize">
            {employee.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        {hasPermission('employees:update') && (
          <Button asChild>
            <Link to={`/employees/${id}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Designation" value={employee.designation} />
            <InfoRow label="Employment Type" value={employee.employmentType} />
            <InfoRow label="Join Date" value={new Date(employee.joinDate).toLocaleDateString()} />
            <InfoRow label="Phone" value={employee.phone ?? '--'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Site Information</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Site" value={employee.siteName || '--'} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Emergency Contacts</CardTitle>
          {hasPermission('employees:update') && (
            <Button size="sm" variant="outline" onClick={() => setContactDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {emergencyContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emergency contacts on file.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Phone</TableHead>
                  {hasPermission('employees:update') && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {emergencyContacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.contactName}</TableCell>
                    <TableCell>{c.relationship}</TableCell>
                    <TableCell>{c.phoneNumber}</TableCell>
                    {hasPermission('employees:update') && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bank Details</CardTitle>
          {hasPermission('employees:update') && !bankDetails && (
            <Button size="sm" variant="outline" onClick={() => setBankDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {bankDetails ? (
            <div className="space-y-3">
              <InfoRow label="Account Holder" value={bankDetails.accountHolderName} />
              <InfoRow label="Bank" value={bankDetails.bankName} />
              <InfoRow label="Branch Code" value={bankDetails.branchCode ?? '--'} />
              <InfoRow label="Account Number" value={bankDetails.accountNumber} />
              <InfoRow label="IFSC Code" value={bankDetails.ifscCode ?? '--'} />
              {hasPermission('employees:update') && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    bankForm.reset({
                      accountHolderName: bankDetails.accountHolderName,
                      bankName: bankDetails.bankName,
                      branchCode: bankDetails.branchCode ?? '',
                      accountNumber: bankDetails.accountNumber,
                      ifscCode: bankDetails.ifscCode ?? '',
                    });
                    setBankDialogOpen(true);
                  }}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDeleteBank}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No bank details on file.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Compensation</CardTitle>
          <div className="flex items-center gap-2">
            {upcomingCompensation && (
              <Badge variant="secondary">Upcoming Change</Badge>
            )}
            {hasPermission('employees:update') && (
              <Button size="sm" variant="outline" onClick={openNewRevisionDialog}>
                <Plus className="h-4 w-4 mr-1" />
                Add Revision
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentCompensation ? (
            <div className="space-y-3">
              <InfoRow label="Pay Type" value={currentCompensation.payType} />
              <InfoRow label="Base Rate" value={Number(currentCompensation.baseRate).toFixed(2)} />
              <InfoRow label="Overtime Rate" value={Number(currentCompensation.overtimeRate).toFixed(2)} />
              <InfoRow label="Standard Hours/Day" value={Number(currentCompensation.standardHoursPerDay).toFixed(2)} />
              <InfoRow label="Effective From" value={new Date(currentCompensation.effectiveFrom).toLocaleDateString()} />
              <InfoRow label="Effective To" value={currentCompensation.effectiveTo ? new Date(currentCompensation.effectiveTo).toLocaleDateString() : '--'} />
              <InfoRow label="Notes" value={currentCompensation.notes ?? '--'} />

              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-medium text-foreground">Recurring Components</h4>
                {currentCompensation.components && currentCompensation.components.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Calculation</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentCompensation.components.map((component: {
                        id: number;
                        name: string;
                        componentType: string;
                        calculationType: string;
                        value: number;
                      }) => (
                        <TableRow key={component.id}>
                          <TableCell>{component.name}</TableCell>
                          <TableCell className="capitalize">{component.componentType}</TableCell>
                          <TableCell className="capitalize">{component.calculationType}</TableCell>
                          <TableCell>{Number(component.value).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No recurring components on current revision.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active compensation revision configured.</p>
          )}

          <div className="space-y-2 border-t pt-3">
            <h4 className="text-sm font-medium text-foreground">Revision History</h4>
            {compensationHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No compensation history available.</p>
            ) : (
              <div className="space-y-2">
                {compensationHistory.map((revision) => {
                  const revisionEffectiveFrom = typeof revision.effectiveFrom === 'string'
                    ? revision.effectiveFrom
                    : new Date(revision.effectiveFrom).toISOString().split('T')[0];
                  const revisionEffectiveTo = revision.effectiveTo
                    ? (typeof revision.effectiveTo === 'string'
                      ? revision.effectiveTo
                      : new Date(revision.effectiveTo).toISOString().split('T')[0])
                    : null;
                  const isFuture = revisionEffectiveFrom > todayIso;
                  const isEnded = Boolean(revisionEffectiveTo && revisionEffectiveTo < todayIso);
                  const isCurrentWindow = revisionEffectiveFrom <= todayIso && (!revisionEffectiveTo || revisionEffectiveTo >= todayIso);
                  const isCurrentActive = revision.isActive && isCurrentWindow;
                  const canEditOrDelete = hasPermission('employees:update') && !isEnded;
                  return (
                    <div key={revision.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {revision.payType} | Base {Number(revision.baseRate).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(revision.effectiveFrom).toLocaleDateString()} - {revision.effectiveTo ? new Date(revision.effectiveTo).toLocaleDateString() : 'Open'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={isCurrentActive ? 'default' : 'outline'}>
                            {isCurrentActive ? 'Active' : (isEnded ? 'Ended' : (revision.isActive ? 'Scheduled' : 'Inactive'))}
                          </Badge>
                          {canEditOrDelete && (
                            <Button size="sm" variant="outline" onClick={() => openEditRevisionDialog(revision)}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                          {canEditOrDelete && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRevision(revision.id)}
                              disabled={deleteCompensationRevision.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          )}
                          {hasPermission('employees:update') && isFuture && !revision.isActive && (
                            <Button size="sm" onClick={() => handleActivateRevision(revision.id)}>
                              Activate
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <DocumentList entityType="employee" entityId={employee.id} title="Employee Documents" />

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Emergency Contact</DialogTitle>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(handleAddContact)} className="space-y-4">
              <FormField control={contactForm.control} name="contactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={contactForm.control} name="relationship" render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <FormControl><Input placeholder="e.g. Spouse, Parent" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={contactForm.control} name="phoneNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addContact.isPending}>
                  {addContact.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Contact
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bankDetails ? 'Edit' : 'Add'} Bank Details</DialogTitle>
          </DialogHeader>
          <Form {...bankForm}>
            <form onSubmit={bankForm.handleSubmit(handleUpsertBank)} className="space-y-4">
              <FormField control={bankForm.control} name="accountHolderName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Holder Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bankForm.control} name="bankName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={bankForm.control} name="branchCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch Code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={bankForm.control} name="ifscCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>IFSC Code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={bankForm.control} name="accountNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Number</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBankDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={upsertBank.isPending}>
                  {upsertBank.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={compensationDialogOpen}
        onOpenChange={(open) => {
          setCompensationDialogOpen(open);
          if (!open) {
            setCompensationError(null);
            setEditingRevisionId(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRevisionId ? 'Edit Compensation Revision' : 'Add Compensation Revision'}</DialogTitle>
          </DialogHeader>
          <Form {...compensationForm}>
            <form onSubmit={compensationForm.handleSubmit(handleSaveCompensationRevision)} className="space-y-5">
              {compensationError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {compensationError}
                </p>
              )}
              <FormField
                control={compensationForm.control}
                name="payType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pay Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={compensationForm.control}
                  name="baseRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Rate</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={compensationForm.control}
                  name="overtimeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overtime Rate</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={compensationForm.control}
                  name="effectiveFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective From</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={compensationForm.control}
                  name="effectiveTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective To (Optional)</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={compensationForm.control}
                name="standardHoursPerDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standard Hours Per Day</FormLabel>
                    <FormControl><Input type="number" step="0.5" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Recurring Components</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => componentsFieldArray.append({
                      componentType: 'earning',
                      name: '',
                      calculationType: 'fixed',
                      value: 0,
                      isTaxable: false,
                      isActive: true,
                    })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Component
                  </Button>
                </div>
                {componentsFieldArray.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recurring components configured.</p>
                ) : (
                  <div className="space-y-3">
                    {componentsFieldArray.fields.map((field, index) => (
                      <div key={field.id} className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                          <FormField
                            control={compensationForm.control}
                            name={`components.${index}.name`}
                            render={({ field: componentField }) => (
                              <FormItem className="sm:col-span-6">
                                <FormLabel>Name</FormLabel>
                                <FormControl><Input {...componentField} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={compensationForm.control}
                            name={`components.${index}.componentType`}
                            render={({ field: componentField }) => (
                              <FormItem className="sm:col-span-3">
                                <FormLabel>Type</FormLabel>
                                <Select value={componentField.value} onValueChange={componentField.onChange}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="earning">Earning</SelectItem>
                                    <SelectItem value="deduction">Deduction</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={compensationForm.control}
                            name={`components.${index}.calculationType`}
                            render={({ field: componentField }) => (
                              <FormItem className="sm:col-span-3">
                                <FormLabel>Calc</FormLabel>
                                <Select value={componentField.value} onValueChange={componentField.onChange}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="fixed">Fixed</SelectItem>
                                    <SelectItem value="percentage">Percentage</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                          <FormField
                            control={compensationForm.control}
                            name={`components.${index}.value`}
                            render={({ field: componentField }) => (
                              <FormItem className="sm:col-span-4">
                                <FormLabel>Value</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...componentField} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => componentsFieldArray.remove(index)}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <FormField
                control={compensationForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCompensationDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCompensationRevision.isPending || updateCompensationRevision.isPending}>
                  {(createCompensationRevision.isPending || updateCompensationRevision.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Revision
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground capitalize">{value}</span>
    </div>
  );
}
