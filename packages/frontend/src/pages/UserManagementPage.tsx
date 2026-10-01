import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUsers, useCreateUser, useUpdateUser, useResendResetLink } from '@/hooks/useUsers';
import type { UserListItem, UpdateUserRequest } from '@/hooks/useUsers';
import { useSites } from '@/hooks/useSites';
import { UserRole } from '@farmflow/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  UserPlus,
  Shield,
  Search,
  Copy,
  Check,
  MoreHorizontal,
  Pencil,
  KeyRound,
  UserX,
  UserCheck,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { sendPasswordResetEmailToUser } from '@/lib/firebase';

const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstName: z.string().trim().min(1, 'First name is required').max(120),
  lastName: z.string().trim().min(1, 'Last name is required').max(120),
  userRole: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Select a role' }) }),
  siteId: z.coerce.number().int().positive().optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(120),
  lastName: z.string().trim().min(1, 'Last name is required').max(120),
  userRole: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Select a role' }) }),
  siteId: z.coerce.number().int().positive().optional(),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SystemAdmin]: 'System Admin',
  [UserRole.FarmManager]: 'Farm Manager',
  [UserRole.Accountant]: 'Accountant',
  [UserRole.Supervisor]: 'Supervisor',
  [UserRole.FeedMillOperator]: 'Feed Mill Operator',
  [UserRole.FarmWorker]: 'Farm Worker',
  [UserRole.Viewer]: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  system_admin: 'bg-danger-soft text-danger',
  farm_manager: 'bg-info-soft text-info',
  accountant: 'bg-success-soft text-success',
  supervisor: 'bg-warning-soft text-warning',
  feed_mill_operator: 'bg-secondary text-secondary-foreground',
  farm_worker: 'bg-muted text-foreground',
  viewer: 'bg-muted text-foreground',
};

/**
 * Make sure a set-password / reset email actually goes out: the server sends it if it has a mail server;
 * otherwise Firebase sends it. Either way the admin is told the truth and gets a link to share.
 */
/**
 * Every new Firebase reset request cancels the previous link. So when Firebase sends its own
 * email we must NOT also show the server-made link — it is already dead by then.
 */
async function deliverResetEmail(email: string, serverSent?: boolean): Promise<{ sent: boolean; message: string; showLink: boolean }> {
  if (serverSent) {
    return { sent: true, showLink: true, message: `An email with a link to set the password was sent to ${email}. Ask them to check spam if it doesn't arrive. You can also share the link below; it works for 1 hour.` };
  }
  try {
    await sendPasswordResetEmailToUser(email);
    return { sent: true, showLink: false, message: `Firebase sent a password email to ${email}, from noreply@farmflow-dev.firebaseapp.com. It can take a few minutes and often lands in spam. Only the newest link works — pressing reset again cancels this one.` };
  } catch (error) {
    const code = (error as { code?: string })?.code ?? 'unknown error';
    return { sent: false, showLink: true, message: `No email could be sent (${code}). Copy this link and send it to ${email} yourself (e.g. WhatsApp). It works for 1 hour.` };
  }
}

export default function UserManagementPage({ embedded = false }: { embedded?: boolean }) {
  const { hasPermission, currentUser } = useAuthStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLinkDialogTitle, setResetLinkDialogTitle] = useState('User Created Successfully');
  const [resetLinkDialogDesc, setResetLinkDialogDesc] = useState(
    'Share this password reset link with the new user so they can set their password and log in.',
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);

  const { data: usersData, isLoading } = useUsers();
  const { data: sitesResponse } = useSites();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const resendResetMutation = useResendResetLink();

  const sites = sitesResponse?.data ?? [];
  const allUsers = usersData?.data ?? [];
  const filteredUsers = search
    ? allUsers.filter(
        (u) =>
          u.fullName.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : allUsers;

  // Create form
  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      userRole: undefined,
      siteId: undefined,
    },
  });

  // Edit form
  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      userRole: undefined,
      siteId: undefined,
    },
  });

  // Reset edit form when editingUser changes
  useEffect(() => {
    if (editingUser) {
      // Older accounts may only have a full name: first word is the first name
      const [first = '', ...rest] = editingUser.fullName.trim().split(/\s+/);
      editForm.reset({
        firstName: editingUser.firstName || first,
        lastName: editingUser.lastName || rest.join(' '),
        userRole: editingUser.userRole as UserRole,
        siteId: editingUser.siteId ?? undefined,
      });
    }
  }, [editingUser, editForm]);

  const handleCreate = async (values: CreateUserFormValues) => {
    try {
      const result = await createUserMutation.mutateAsync(values);
      const data = result.data as { user: unknown; passwordResetLink: string; emailSent?: boolean };
      const delivery = await deliverResetEmail(values.email, data.emailSent);
      toast[delivery.sent ? 'success' : 'warning'](delivery.sent ? `User created. Set-password email sent to ${values.email}.` : 'User created, but the email could not be sent. Share the link below.');
      setResetLinkDialogTitle('User created');
      setResetLinkDialogDesc(delivery.message);
      setResetLink(delivery.showLink ? data.passwordResetLink : null);
      setResetDialogOpen(true);
      createForm.reset();
      setShowCreateDialog(false);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { error?: string } } };
      const message =
        axiosErr.response?.data?.error ||
        (error instanceof Error ? error.message : 'Failed to create user');
      toast.error(message);
    }
  };

  const handleEdit = async (values: EditUserFormValues) => {
    if (!editingUser) return;
    try {
      const data: UpdateUserRequest = {
        firstName: values.firstName,
        lastName: values.lastName,
        userRole: values.userRole,
        siteId: values.siteId ?? null,
      };
      await updateUserMutation.mutateAsync({ id: editingUser.id, data });
      toast.success('User updated successfully');
      setEditingUser(null);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { error?: string } } };
      const message =
        axiosErr.response?.data?.error ||
        (error instanceof Error ? error.message : 'Failed to update user');
      toast.error(message);
    }
  };

  const handleToggleActive = async (user: UserListItem) => {
    try {
      await updateUserMutation.mutateAsync({
        id: user.id,
        data: { isActive: !user.isActive },
      });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { error?: string } } };
      const message =
        axiosErr.response?.data?.error ||
        (error instanceof Error ? error.message : 'Failed to update user status');
      toast.error(message);
    }
  };

  const handleResendResetLink = async (user: UserListItem) => {
    try {
      const result = await resendResetMutation.mutateAsync(user.id);
      const data = result.data as { passwordResetLink: string; emailSent?: boolean };
      const delivery = await deliverResetEmail(user.email, data.emailSent);
      toast[delivery.sent ? 'success' : 'warning'](delivery.sent ? `Reset email sent to ${user.email}` : 'The email could not be sent. Share the link below.');
      setResetLinkDialogTitle(delivery.sent ? 'Reset email sent' : 'Send this link to the user');
      setResetLinkDialogDesc(delivery.message);
      setResetLink(delivery.showLink ? data.passwordResetLink : null);
      setResetDialogOpen(true);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { error?: string } } };
      const message =
        axiosErr.response?.data?.error ||
        (error instanceof Error ? error.message : 'Failed to send reset link');
      toast.error(message);
    }
  };

  const handleCopyLink = async () => {
    if (!resetLink) return;
    await navigator.clipboard.writeText(resetLink);
    setCopiedLink(true);
    toast.success('Password reset link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!hasPermission('users:create')) {
    return (
      <div className="text-center py-12">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Access Restricted</h3>
        <p className="text-sm text-muted-foreground">
          Only System Admins can manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={embedded ? 'flex justify-end' : 'flex items-center justify-between'}>
        {embedded ? null : <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Users</h1>}
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Register User
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No users found</h3>
              <p className="text-sm text-muted-foreground">
                {search
                  ? 'Try adjusting your search.'
                  : 'Register your first user to get started.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Last Login</TableHead>
                  <TableHead className="w-[50px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.userRole] ?? ''}`}
                      >
                        {ROLE_LABELS[user.userRole as UserRole] ?? user.userRole}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {user.siteName ?? 'All Sites'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'destructive'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResendResetLink(user)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Send Password Reset
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.id !== currentUser?.id && (
                            <DropdownMenuItem
                              onClick={() => handleToggleActive(user)}
                              className={
                                user.isActive
                                  ? 'text-destructive focus:text-destructive'
                                  : 'text-success focus:text-success'
                              }
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Register New User</DialogTitle>
            <DialogDescription>
              Create a new system user. They will receive a welcome email with a password reset
              link.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Nimal" autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Perera" autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@farmflow.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="userRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Site (Optional)</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : 'none'}
                      onValueChange={(v) =>
                        field.onChange(v === 'none' ? undefined : Number(v))
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All sites (no restriction)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">All Sites</SelectItem>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={String(site.id)}>
                            {site.siteName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-2 rounded-md bg-info-soft p-3 text-sm text-info">
                <Mail className="h-4 w-4 shrink-0" />
                <span>A welcome email with password setup link will be sent automatically.</span>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? 'Creating...' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details for {editingUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Nimal" autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Perera" autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="userRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Site (Optional)</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : 'none'}
                      onValueChange={(v) =>
                        field.onChange(v === 'none' ? undefined : Number(v))
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All sites (no restriction)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">All Sites</SelectItem>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={String(site.id)}>
                            {site.siteName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Password Reset Link Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{resetLinkDialogTitle}</DialogTitle>
            <DialogDescription>{resetLinkDialogDesc}</DialogDescription>
          </DialogHeader>
          {resetLink ? (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-xs text-muted-foreground mb-1 font-medium">
                Password Reset Link:
              </p>
              <p className="text-sm break-all font-mono">{resetLink}</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Close
            </Button>
            {resetLink ? <Button onClick={handleCopyLink}>
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
