"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Role, StaffMember } from "@restroflow/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/auth-api";
import { createStaff, fetchStaff, updateStaff } from "@/lib/management-api";
import { cn } from "@/lib/utils";

const roles: Role[] = ["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"];
const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
  CASHIER: "Cashier",
};

type EditorValues = {
  displayName: string;
  email: string;
  password: string;
  role: Role;
};

function editorSchema(isNew: boolean) {
  return z
    .object({
      displayName: z.string().trim().min(1, "Name is required.").max(120),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.email("Enter a valid email.")),
      password: z.string().max(128),
      role: z.enum(roles),
    })
    .superRefine((value, context) => {
      if (isNew && value.password.length < 12) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: "Use at least 12 characters.",
        });
      }
    });
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="bg-muted inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
      {roleLabels[role]}
    </span>
  );
}

function StaffEditor({
  restaurantId,
  staffMember,
  open,
  onClose,
  onSaved,
}: {
  restaurantId: string;
  staffMember: StaffMember | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isNew = staffMember === null;
  const schema = useMemo(() => editorSchema(isNew), [isNew]);
  const [pendingRoleChange, setPendingRoleChange] =
    useState<EditorValues | null>(null);
  const {
    register,
    reset,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditorValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", email: "", password: "", role: "WAITER" },
  });
  const mutation = useMutation({
    mutationFn: async (values: EditorValues) => {
      if (isNew) {
        return createStaff(restaurantId, {
          displayName: values.displayName,
          email: values.email,
          password: values.password,
          role: values.role,
        });
      }
      return updateStaff(restaurantId, staffMember.id, {
        displayName: values.displayName,
        email: values.email,
        role: values.role,
      });
    },
    onSuccess: async () => {
      setPendingRoleChange(null);
      await onSaved();
      onClose();
    },
  });

  useEffect(() => {
    reset({
      displayName: staffMember?.displayName ?? "",
      email: staffMember?.email ?? "",
      password: "",
      role: staffMember?.role ?? "WAITER",
    });
  }, [open, reset, staffMember]);

  const save = async (values: EditorValues) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      setPendingRoleChange(null);
      setError("root", {
        message:
          error instanceof ApiError
            ? error.message
            : "The staff account could not be saved.",
      });
    }
  };
  const submit = handleSubmit((values) => {
    if (!isNew && values.role !== staffMember.role) {
      setPendingRoleChange(values);
      return;
    }
    return save(values);
  });

  return (
    <>
      <Dialog
        open={open && !pendingRoleChange}
        onClose={onClose}
        title={isNew ? "Add staff member" : "Edit staff member"}
        description={
          isNew
            ? "Create secure credentials and assign the staff member’s restaurant role."
            : "Update profile information or change access responsibilities."
        }
      >
        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-5 p-5 sm:p-6"
          noValidate
        >
          <label className="block space-y-2 text-sm font-semibold">
            Full name
            <Input
              {...register("displayName")}
              aria-invalid={Boolean(errors.displayName)}
            />
            {errors.displayName && (
              <span className="block text-red-700" role="alert">
                {errors.displayName.message}
              </span>
            )}
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            Work email
            <Input
              type="email"
              {...register("email")}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && (
              <span className="block text-red-700" role="alert">
                {errors.email.message}
              </span>
            )}
          </label>
          {isNew && (
            <label className="block space-y-2 text-sm font-semibold">
              Temporary password
              <Input
                type="password"
                autoComplete="new-password"
                {...register("password")}
                aria-invalid={Boolean(errors.password)}
              />
              <span className="text-muted-foreground block text-xs font-normal">
                Use at least 12 characters and share it securely.
              </span>
              {errors.password && (
                <span className="block text-red-700" role="alert">
                  {errors.password.message}
                </span>
              )}
            </label>
          )}
          <label className="block space-y-2 text-sm font-semibold">
            Role
            <Select {...register("role")}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </Select>
          </label>
          {errors.root?.message && (
            <p
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {errors.root.message}
            </p>
          )}
          <div className="flex justify-end gap-3 border-t pt-5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              {isNew ? "Create account" : "Save changes"}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(pendingRoleChange)}
        onClose={() => setPendingRoleChange(null)}
        title="Confirm role change"
        description="Changing a role immediately revokes this staff member’s active sessions. They will need to sign in again."
      >
        <div className="space-y-5 p-5 sm:p-6">
          <p className="text-sm">
            Change <strong>{staffMember?.displayName}</strong> from{" "}
            {staffMember ? roleLabels[staffMember.role] : ""} to{" "}
            {pendingRoleChange ? roleLabels[pendingRoleChange.role] : ""}?
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setPendingRoleChange(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => pendingRoleChange && void save(pendingRoleChange)}
              disabled={mutation.isPending}
            >
              Confirm role change
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function StaffDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const membership = user?.memberships.find(
    (candidate) => candidate.role === "ADMIN" || candidate.role === "MANAGER",
  );
  const restaurantId = membership?.restaurantId;
  const canManage = membership?.role === "ADMIN";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [editor, setEditor] = useState<StaffMember | "new" | null>(null);
  const [statusTarget, setStatusTarget] = useState<StaffMember | null>(null);
  const queryKey = [
    "staff",
    restaurantId,
    deferredSearch,
    role,
    status,
  ] as const;
  const staffQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchStaff(restaurantId!, {
        search: deferredSearch || undefined,
        role: role || undefined,
        status,
      }),
    enabled: Boolean(restaurantId),
  });
  const statusMutation = useMutation({
    mutationFn: (target: StaffMember) =>
      updateStaff(restaurantId!, target.id, { isActive: !target.isActive }),
    onSuccess: async () => {
      setStatusTarget(null);
      await queryClient.invalidateQueries({
        queryKey: ["staff", restaurantId],
      });
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["staff", restaurantId] });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-xs font-bold tracking-[.16em] uppercase">
            Team access
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Staff management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage staff profiles, roles, and restaurant access.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setEditor("new")}>
            <Plus className="size-4" /> Add staff
          </Button>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
            Manager view · read only
          </span>
        )}
      </header>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(14rem,1fr)_12rem_12rem]">
          <label className="relative">
            <span className="sr-only">Search staff</span>
            <Search className="text-muted-foreground pointer-events-none absolute top-3.5 left-3 size-4" />
            <Input
              className="pl-9"
              placeholder="Search by name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Filter by role</span>
            <Select
              value={role}
              onChange={(event) => setRole(event.target.value as Role | "")}
            >
              <option value="">All roles</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {roleLabels[item]}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Filter by status</span>
            <Select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All statuses</option>
            </Select>
          </label>
        </CardContent>
      </Card>

      {staffQuery.isPending ? (
        <div className="grid min-h-72 place-items-center" aria-live="polite">
          <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" /> Loading staff
          </span>
        </div>
      ) : staffQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Staff list unavailable</CardTitle>
            <p className="text-muted-foreground text-sm">
              The team directory could not be loaded.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void staffQuery.refetch()}>
              <RefreshCw className="size-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : staffQuery.data.total === 0 ? (
        <Card className="py-10 text-center">
          <CardContent>
            <Users className="text-muted-foreground mx-auto size-9" />
            <h2 className="mt-4 font-bold">No staff match these filters</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Adjust the search, role, or status filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground border-b text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Staff member</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {staffQuery.data.staff.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{member.displayName}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {member.email}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <RoleBadge role={member.role} />
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold",
                          member.isActive
                            ? "text-emerald-700"
                            : "text-stone-500",
                        )}
                      >
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            member.isActive ? "bg-emerald-500" : "bg-stone-400",
                          )}
                        />
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditor(member)}
                            >
                              <Pencil className="size-4" /> Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setStatusTarget(member)}
                            >
                              {member.isActive ? (
                                <UserX className="size-4" />
                              ) : (
                                <UserCheck className="size-4" />
                              )}
                              {member.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y md:hidden">
            {staffQuery.data.staff.map((member) => (
              <article key={member.id} className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{member.displayName}</h2>
                    <p className="text-muted-foreground mt-1 text-xs break-all">
                      {member.email}
                    </p>
                  </div>
                  <RoleBadge role={member.role} />
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      member.isActive ? "text-emerald-700" : "text-stone-500",
                    )}
                  >
                    {member.isActive ? "Active" : "Inactive"}
                  </span>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditor(member)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusTarget(member)}
                      >
                        {member.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {restaurantId && (
        <StaffEditor
          restaurantId={restaurantId}
          staffMember={editor === "new" ? null : editor}
          open={editor !== null}
          onClose={() => setEditor(null)}
          onSaved={refresh}
        />
      )}
      <Dialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={
          statusTarget?.isActive
            ? "Deactivate staff account"
            : "Activate staff account"
        }
        description={
          statusTarget?.isActive
            ? "This immediately revokes active sessions and blocks restaurant access."
            : "This restores restaurant access for the staff member’s assigned role."
        }
      >
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-950">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            <p className="text-sm leading-6">
              {statusTarget?.isActive ? "Deactivate" : "Activate"}{" "}
              <strong>{statusTarget?.displayName}</strong>?
            </p>
          </div>
          {statusMutation.isError && (
            <p
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {statusMutation.error instanceof ApiError
                ? statusMutation.error.message
                : "The account status could not be changed."}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                statusTarget && statusMutation.mutate(statusTarget)
              }
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              {statusTarget?.isActive
                ? "Deactivate account"
                : "Activate account"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
