"use client";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { errorMessage } from "@/lib/http/error-messages";
import { ageRepository } from "@/repositories/age-repository";
export function AgeVerification() {
  const { isSignedIn, isRestoring } = useSession();
  const query = useQuery({
    queryKey: ["age-verification"],
    queryFn: ageRepository.status,
    enabled: isSignedIn,
  });
  const start = useMutation({
    mutationFn: ageRepository.start,
    onSuccess: ({ url }) => window.location.assign(url),
  });
  if (isRestoring) return <p>Restoring your account�</p>;
  if (!isSignedIn)
    return (
      <Link className="underline" href="/login?next=/age-verification">
        Sign in to view age verification
      </Link>
    );
  return (
    <div className="flex flex-col gap-4">
      <p>
        Verified adult status is separate from confirming your age at registration. No identity
        documents are collected by this page.
      </p>
      {query.data && (
        <p role="status">
          Status: {query.data.status}.{" "}
          {!query.data.configured &&
            "Age verification is unavailable until a provider is approved and configured. Adult Chat remains disabled."}
        </p>
      )}
      {(query.error || start.error) && (
        <p role="alert">{errorMessage(query.error ?? start.error)}</p>
      )}
      <Button disabled={!query.data?.configured || start.isPending} onClick={() => start.mutate()}>
        Start age verification
      </Button>
    </div>
  );
}
