import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useUpdateMyProfile } from "@/hooks/useMyProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState } from "@/components/common/States";
import { FieldError, SettingsSection } from "./shared";
import { browserTimezone, errorMessage, fullNameSchema, initials, listTimezones } from "./validation";

const schema = z.object({
  full_name: fullNameSchema,
  job_title: z.string().trim().max(100, "Keep it under 100 characters"),
  timezone: z.string().min(1),
});
type Values = z.infer<typeof schema>;

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function ProfileSettings() {
  const { user } = useAuth();
  const profileQuery = useMyProfile();
  const update = useUpdateMyProfile();
  const profile = profileQuery.data;
  const timezones = useMemo(() => listTimezones(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", job_title: "", timezone: browserTimezone() },
  });
  const { register, handleSubmit, formState, reset, watch, setValue } = form;
  const timezone = watch("timezone");
  const name = watch("full_name");

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? "",
        job_title: profile.job_title ?? "",
        timezone: profile.timezone ?? browserTimezone(),
      });
    }
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        full_name: values.full_name.trim(),
        job_title: values.job_title.trim() || null,
        timezone: values.timezone,
      });
      reset(values);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Use a JPEG, PNG, GIF or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Images must be under 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await update.mutateAsync({ avatar_url: `${data.publicUrl}?v=${Date.now()}` });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    try {
      await update.mutateAsync({ avatar_url: null });
      toast.success("Photo removed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading profile">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }
  if (profileQuery.isError) {
    return <ErrorState error={profileQuery.error} title="Couldn't load your profile" onRetry={() => profileQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Photo" description="Shown next to your deals, tasks and activity.">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="text-lg">{initials(name || profile?.full_name, user?.email)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={AVATAR_TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={onAvatarSelected}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload photo"}
            </Button>
            {profile?.avatar_url && (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={uploading || update.isPending} onClick={removeAvatar}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground sm:ml-auto">JPEG, PNG, GIF or WebP, up to 2 MB.</p>
        </div>
      </SettingsSection>

      <form onSubmit={onSubmit} noValidate>
        <SettingsSection
          title="Personal details"
          description="How you appear to teammates."
          footer={
            <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
              {formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">
                Full name <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input id="profile-name" autoComplete="name" aria-invalid={!!formState.errors.full_name} {...register("full_name")} />
              <FieldError message={formState.errors.full_name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-title">Job title</Label>
              <Input id="profile-title" placeholder="e.g. Account Executive" autoComplete="organization-title" {...register("job_title")} />
              <FieldError message={formState.errors.job_title?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={user?.email ?? ""} readOnly disabled />
              <p className="text-xs text-muted-foreground">Change it under Account.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-timezone">Time zone</Label>
              <Select value={timezone} onValueChange={(v) => setValue("timezone", v, { shouldDirty: true })}>
                <SelectTrigger id="profile-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(timezones.includes(timezone) ? timezones : [timezone, ...timezones]).map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {timezone !== browserTimezone() && (
                <button
                  type="button"
                  className="rounded-sm text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={() => setValue("timezone", browserTimezone(), { shouldDirty: true })}
                >
                  Use this device's time zone ({browserTimezone().replace(/_/g, " ")})
                </button>
              )}
            </div>
          </div>
        </SettingsSection>
      </form>
    </div>
  );
}
