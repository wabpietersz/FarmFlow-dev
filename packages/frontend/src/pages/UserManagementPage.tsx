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
  fullName: z.string().min(1, 'Full name is required').max(255),
  userRole: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Select a role' }) }),
  siteId: z.coerce.number().int().positive().optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255),
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
  system_admin: 'bg-red-100 text-red-800',
  farm_manager: 'bg-blue-100 text-blue-800',
  accountant: 'bg-green-100 text-green-800',
  supervisor: 'bg-yellow-100 text-yellow-800',
  feed_mill_operator: 'bg-purple-100 text-purple-800',
  farm_worker: 'bg-gray-100 text-gray-800',
  viewer: 'bg-slate-100 text-slate-800',
};

export default function UserManagementPage() {
  const { hasPermission, currentUser } = useAuthStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [resetLink, setResetLink] = useState<string | null>(null);
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
      fullName: '',
      userRole: undefined,
      siteId: undefined,
    },
  });

  // Edit form
  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: '',
      userRole: undefined,
      siteId: undefined,
    },
  });

  // Reset edit form when editingUser changes
  useEffect(() => {
    if (editingUser) {
      editForm.reset({
        fullName: editingUser.fullName,
        userRole: editingUser.userRole as UserRole,
        siteId: editingUser.siteId ?? undefined,
      });
    }
  }, [editingUser, editForm]);

  const handleCreate = async (values: CreateUserFormValues) => {
    try {
      const result = await createUserMutation.mutateAsync(values);
      const data = result.data as { user: unknown; passwordResetLink: string };

      // Send password reset email via Firebase (uses Firebase's own email infrastructure)
      try {
        await sendPasswordResetEmailToUser(values.email);
        toast.success('User created! Password reset email sent.');
      } catch {
        toast.success('User created! Email sending failed — share the link manually.');
      }

      setResetLinkDialogTitle('User Created Successfully');
      setResetLinkDialogDesc(
        'A password reset email has been sent to the user via Firebase. You can also share this link manually.',
      );
      setResetLink(data.passwordResetLink);
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
        fullName: values.fullName,
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
      const data = result.data as { passwordResetLink: string };

      // Send password reset email via Firebase
      try {
        await sendPasswordResetEmailToUser(user.email);
        toast.success(`Password reset email sent to ${user.email}`);
      } catch {
        toast.success('Reset link generated — email sending failed. Share the link manually.');
      }

      setResetLinkDialogTitle('Password Reset Link Sent');
      setResetLinkDialogDesc(
        `A password reset email has been sent to ${user.email}. You can also share this link manually.`,
      );
      setResetLink(data.passwordResetLink);
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
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
                                  : 'text-green-600 focus:text-green-600'
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
              <FormField
                control={createForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <div className="flex items-center gap-2 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
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
              <FormField
                control={editForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
      <Dialog open={!!resetLink} onOpenChange={(open) => !open && setResetLink(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{resetLinkDialogTitle}</DialogTitle>
            <DialogDescription>{resetLinkDialogDesc}</DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-3 rounded-md">
            <p className="text-xs text-muted-foreground mb-1 font-medium">
              Password Reset Link:
            </p>
            <p className="text-sm break-all font-mono">{resetLink}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetLink(null)}>
              Close
            </Button>
            <Button onClick={handleCopyLink}>
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
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
