import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEmployee, useAddEmergencyContact, useDeleteEmergencyContact, useUpsertBankDetails, useDeleteBankDetails } from '@/hooks/useEmployees';
import { useAuthStore } from '@/store/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { emergencyContactFormSchema, bankDetailsFormSchema, type EmergencyContactFormValues, type BankDetailsFormValues } from '@/lib/validations/employee';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { ArrowLeft, Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = useEmployee(id);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);

  const addContact = useAddEmergencyContact(id!);
  const deleteContact = useDeleteEmergencyContact(id!);
  const upsertBank = useUpsertBankDetails(id!);
  const deleteBank = useDeleteBankDetails(id!);

  const contactForm = useForm<EmergencyContactFormValues>({
    resolver: zodResolver(emergencyContactFormSchema),
    defaultValues: { contactName: '', relationship: '', phoneNumber: '' },
  });

  const bankForm = useForm<BankDetailsFormValues>({
    resolver: zodResolver(bankDetailsFormSchema),
    defaultValues: { accountHolderName: '', bankName: '', branchCode: '', accountNumber: '', ifscCode: '' },
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
            <InfoRow label="Site ID" value={String(employee.siteId)} />
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
