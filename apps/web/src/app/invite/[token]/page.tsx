"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useOrg } from "@/contexts/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function InviteAcceptPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const api = useApi();
  const { setOrgId } = useOrg();
  const [accepting, setAccepting] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: () => api.acceptInvite({ token }),
    onSuccess: (membership) => {
      toast.success("Invitation accepted successfully");
      setOrgId(membership.org_id);
      router.push("/");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to accept invitation");
      setAccepting(false);
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Redirect to sign in, then come back
      router.push(`/sign-in?redirect_url=/invite/${token}`);
    }
  }, [isLoaded, isSignedIn, router, token]);

  const handleAccept = () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/invite/${token}`);
      return;
    }
    setAccepting(true);
    acceptMutation.mutate();
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSignedIn ? (
            <>
              <p className="text-sm text-muted-foreground">
                Please sign in to accept this invitation.
              </p>
              <Button onClick={handleAccept} className="w-full">
                Sign In to Accept
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Click the button below to accept the organization invitation.
              </p>
              <Button
                onClick={handleAccept}
                className="w-full"
                disabled={accepting || acceptMutation.isPending}
              >
                {accepting || acceptMutation.isPending
                  ? "Accepting..."
                  : "Accept Invitation"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
